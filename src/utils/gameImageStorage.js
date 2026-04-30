import { constants } from "node:fs";
import { access, mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { env } from "../config/env.js";
import { s3Client } from "../config/s3.js";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

// Local storage is kept as a development/fallback path. Production uploads use
// S3 when AWS_S3_BUCKET is configured, so Cloud Run instances do not own images.
export const localUploadsDirectory = env.localUploadsDirectory
  ? path.resolve(env.localUploadsDirectory)
  : path.resolve(currentDirectory, "../../public/uploads");

const localGamesUploadsDirectory = path.join(localUploadsDirectory, "games");
const localPublicPathPrefix = "/uploads/games";
const localUploadPathPrefix = "uploads/games/";
const s3ImagePathPrefix = "images";
const gcsImagePathPrefix = "games";
const gcsPublicHost = "https://storage.googleapis.com";
const immutableImageCacheControl = "public, max-age=31536000, immutable";
const dataImageUrlPattern = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/;

const mimeTypeToExtension = Object.freeze({
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
});

export function hasConfiguredS3UploadCredentials() {
  return Boolean(env.aws.s3Bucket && env.aws.accessKeyId && env.aws.secretAccessKey);
}

export function isImageDataUrl(imageValue) {
  return typeof imageValue === "string" && imageValue.startsWith("data:image/");
}

function createBadRequestError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function createImageUploadError(message, statusCode = 502) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function buildImageFileName(fileExtension) {
  return `${Date.now()}-${randomUUID()}.${fileExtension}`;
}

function encodePathSegments(filePath) {
  return filePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function decodePathSegments(filePath) {
  return filePath
    .split("/")
    .map((segment) => decodeURIComponent(segment))
    .join("/");
}

function buildGcsPublicUrl(filePath) {
  const baseUrl = env.gcs.publicBaseUrl || `${gcsPublicHost}/${env.gcs.bucketName}`;
  return `${baseUrl}/${encodePathSegments(filePath)}`;
}

function buildS3PublicUrl(filePath) {
  const baseUrl =
    env.aws.s3PublicUrl || `https://${env.aws.s3Bucket}.s3.${env.aws.region}.amazonaws.com`;
  return `${baseUrl}/${encodePathSegments(filePath)}`;
}

function isAbsoluteUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function decodeImageDataUrl(imageValue) {
  if (!isImageDataUrl(imageValue)) {
    return null;
  }

  const matches = imageValue.match(dataImageUrlPattern);
  if (!matches) {
    throw createBadRequestError("Invalid image data URL");
  }

  const [, mimeType, encodedData] = matches;
  const fileExtension = mimeTypeToExtension[mimeType];

  if (!fileExtension) {
    throw createBadRequestError("Unsupported image type");
  }

  return {
    fileExtension,
    mimeType,
    buffer: Buffer.from(encodedData, "base64"),
  };
}

function getConfiguredS3PublicUrlObjectKey(imageValue) {
  if (!env.aws.s3PublicUrl) {
    return null;
  }

  try {
    const imageUrl = new URL(imageValue);
    const publicBaseUrl = new URL(`${env.aws.s3PublicUrl}/`);

    if (imageUrl.origin !== publicBaseUrl.origin) {
      return null;
    }

    const basePath = publicBaseUrl.pathname.replace(/^\/+|\/+$/g, "");
    const imagePath = imageUrl.pathname.replace(/^\/+/, "");

    if (!basePath) {
      return decodePathSegments(imagePath);
    }

    if (imagePath === basePath || !imagePath.startsWith(`${basePath}/`)) {
      return null;
    }

    return decodePathSegments(imagePath.slice(basePath.length + 1));
  } catch {
    return null;
  }
}

function getVirtualHostedS3ObjectKey(imageValue) {
  if (!env.aws.s3Bucket) {
    return null;
  }

  try {
    const imageUrl = new URL(imageValue);
    const allowedHosts = new Set([
      `${env.aws.s3Bucket}.s3.${env.aws.region}.amazonaws.com`,
      `${env.aws.s3Bucket}.s3.amazonaws.com`,
    ]);

    if (!allowedHosts.has(imageUrl.hostname)) {
      return null;
    }

    return decodePathSegments(imageUrl.pathname.replace(/^\/+/, ""));
  } catch {
    return null;
  }
}

function getPathStyleS3ObjectKey(imageValue) {
  if (!env.aws.s3Bucket) {
    return null;
  }

  try {
    const imageUrl = new URL(imageValue);
    const allowedHosts = new Set([
      `s3.${env.aws.region}.amazonaws.com`,
      "s3.amazonaws.com",
    ]);

    if (!allowedHosts.has(imageUrl.hostname)) {
      return null;
    }

    const pathParts = imageUrl.pathname.replace(/^\/+/, "").split("/");
    if (pathParts.shift() !== env.aws.s3Bucket) {
      return null;
    }

    return decodePathSegments(pathParts.join("/"));
  } catch {
    return null;
  }
}

function getStoredS3ObjectKey(imageValue) {
  if (!imageValue || typeof imageValue !== "string" || !env.aws.s3Bucket) {
    return null;
  }

  const trimmedImageValue = imageValue.trim();
  if (!trimmedImageValue) {
    return null;
  }

  const normalizedImagePath = trimmedImageValue.replace(/^\/+/, "");

  if (normalizedImagePath.startsWith(localUploadPathPrefix)) {
    const fileName = normalizedImagePath.slice(localUploadPathPrefix.length);
    return `${s3ImagePathPrefix}/${fileName}`;
  }

  if (normalizedImagePath.startsWith(`${s3ImagePathPrefix}/`)) {
    return normalizedImagePath;
  }

  if (!isAbsoluteUrl(trimmedImageValue)) {
    return null;
  }

  return (
    getConfiguredS3PublicUrlObjectKey(trimmedImageValue) ||
    getVirtualHostedS3ObjectKey(trimmedImageValue) ||
    getPathStyleS3ObjectKey(trimmedImageValue)
  );
}

async function ensureLocalUploadExists(imagePath, fieldName = "image_url") {
  const normalizedImagePath = imagePath.replace(/^\/+/, "");
  const fileName = path.basename(normalizedImagePath);

  if (normalizedImagePath !== `${localUploadPathPrefix}${fileName}`) {
    throw createBadRequestError(
      `${fieldName} must be an absolute URL, a data URL, or an existing /uploads/games path`,
    );
  }

  const filePath = path.join(localGamesUploadsDirectory, fileName);

  try {
    await access(filePath, constants.R_OK);
  } catch {
    throw createBadRequestError(`Image file not found: ${localPublicPathPrefix}/${fileName}`);
  }

  return `${localPublicPathPrefix}/${fileName}`;
}

async function uploadImageToGcs(decodedImage) {
  const { Storage } = await import("@google-cloud/storage");
  const storage = env.gcs.projectId
    ? new Storage({ projectId: env.gcs.projectId })
    : new Storage();

  const bucket = storage.bucket(env.gcs.bucketName);
  const fileName = buildImageFileName(decodedImage.fileExtension);
  const filePath = `${gcsImagePathPrefix}/${fileName}`;

  await bucket.file(filePath).save(decodedImage.buffer, {
    metadata: {
      contentType: decodedImage.mimeType,
      cacheControl: immutableImageCacheControl,
    },
    resumable: false,
  });

  return buildGcsPublicUrl(filePath);
}

async function uploadImageToS3(decodedImage) {
  if (!env.aws.s3Bucket) {
    throw createImageUploadError("AWS_S3_BUCKET is required for image uploads", 400);
  }

  const fileName = buildImageFileName(decodedImage.fileExtension);
  const filePath = `${s3ImagePathPrefix}/${fileName}`;

  try {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: env.aws.s3Bucket,
        Key: filePath,
        Body: decodedImage.buffer,
        ContentType: decodedImage.mimeType,
        CacheControl: immutableImageCacheControl,
      }),
    );
  } catch (error) {
    const uploadError = createImageUploadError("Failed to upload image to S3");
    uploadError.cause = error;
    throw uploadError;
  }

  return buildS3PublicUrl(filePath);
}

async function saveImageLocally(decodedImage) {
  await mkdir(localGamesUploadsDirectory, { recursive: true });

  const fileName = buildImageFileName(decodedImage.fileExtension);
  const filePath = path.join(localGamesUploadsDirectory, fileName);

  await writeFile(filePath, decodedImage.buffer);

  return `${localPublicPathPrefix}/${fileName}`;
}

/**
 * Resolves the image value sent by game create/update payloads.
 *
 * Accepted values:
 * - undefined: leave the current image unchanged
 * - null or empty string: clear the image
 * - absolute http(s) URL: store the external URL as-is
 * - /uploads/games/<file>: reuse an existing local upload
 * - data:image/...;base64,...: upload to managed storage and return its URL
 */
export async function resolveGameImageUrl(imageValue, options = {}) {
  const fieldName = options.fieldName ?? "image_url";

  if (imageValue === undefined) {
    return undefined;
  }

  if (imageValue === null || imageValue === "") {
    return null;
  }

  if (typeof imageValue !== "string") {
    throw createBadRequestError(`${fieldName} must be a string`);
  }

  const trimmedImageValue = imageValue.trim();
  if (!trimmedImageValue) {
    return null;
  }

  const decodedImage = decodeImageDataUrl(trimmedImageValue);

  if (!decodedImage) {
    if (isAbsoluteUrl(trimmedImageValue)) {
      return trimmedImageValue;
    }

    return ensureLocalUploadExists(trimmedImageValue, fieldName);
  }

  if (env.aws.s3Bucket) {
    return uploadImageToS3(decodedImage);
  }

  if (env.gcs.bucketName) {
    return uploadImageToGcs(decodedImage);
  }

  return saveImageLocally(decodedImage);
}

/**
 * Resolves stored game image values for API responses.
 *
 * S3-backed values are returned as stable public URLs, not presigned URLs.
 */
export async function resolveStoredGameImageUrl(imageValue) {
  if (!imageValue) {
    return null;
  }

  const trimmedImageValue = String(imageValue).trim();
  if (!trimmedImageValue) {
    return null;
  }

  const s3ObjectKey = getStoredS3ObjectKey(trimmedImageValue);
  if (s3ObjectKey) {
    return buildS3PublicUrl(s3ObjectKey);
  }

  return trimmedImageValue;
}
