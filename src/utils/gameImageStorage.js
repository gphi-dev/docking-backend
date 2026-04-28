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

function createBadRequestError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function buildImageFileName(fileExtension) {
  return `${Date.now()}-${randomUUID()}.${fileExtension}`;
}

function decodeImageDataUrl(imageValue) {
  if (typeof imageValue !== "string" || !imageValue.startsWith("data:image/")) {
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

function buildImageFileName(fileExtension) {
  return `${Date.now()}-${randomUUID()}.${fileExtension}`;
}

function encodePathSegments(filePath) {
  return filePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function buildS3PublicUrl(filePath) {
  const baseUrl =
    env.aws.s3PublicUrl || `https://${env.aws.s3Bucket}.s3.${env.aws.region}.amazonaws.com`;
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

async function ensureLocalUploadExists(imagePath) {
  const normalizedImagePath = imagePath.replace(/^\/+/, "");
  const fileName = path.basename(normalizedImagePath);

  if (normalizedImagePath !== `${localUploadPathPrefix}${fileName}`) {
    throw createBadRequestError(
      "image_url must be an absolute URL, a data URL, or an existing /uploads/games path",
    );
  }

  const filePath = path.join(localGamesUploadsDirectory, fileName);

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
    throw createBadRequestError(`Image file not found: ${localPublicPathPrefix}/${fileName}`);
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

  return `${localPublicPathPrefix}/${fileName}`;
}

function getStoredS3ObjectKey(imageValue) {
  if (!imageValue || typeof imageValue !== "string" || !env.aws.s3Bucket) {
    return null;
  }

  const trimmedImageValue = imageValue.trim();
  if (!trimmedImageValue) {
    return null;
  }

  const legacyUploadPrefix = "uploads/games/";
  const normalizedImagePath = trimmedImageValue.replace(/^\/+/, "");

  if (normalizedImagePath.startsWith(legacyUploadPrefix)) {
    const fileName = normalizedImagePath.slice(legacyUploadPrefix.length);
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

async function buildSignedS3ImageUrl(filePath) {
  if (!hasConfiguredS3UploadCredentials()) {
    return buildS3PublicUrl(filePath);
  }

  return getSignedUrl(
    s3Client,
    new GetObjectCommand({
      Bucket: env.aws.s3Bucket,
      Key: filePath,
    }),
    { expiresIn: env.aws.s3SignedUrlExpiresSeconds },
  );
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

async function uploadImageToS3(decodedImage) {
  if (!env.aws.s3Bucket) {
    throw createImageUploadError("AWS_S3_BUCKET is required for image uploads", 400);
  }

  if (!env.aws.accessKeyId || !env.aws.secretAccessKey) {
    throw createImageUploadError("AWS credentials are required for image uploads", 400);
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

async function uploadImageToS3(decodedImage) {
  const fileName = buildImageFileName(decodedImage.fileExtension);
  const filePath = `${s3ImagePathPrefix}/${fileName}`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: env.aws.s3Bucket,
      Key: filePath,
      Body: decodedImage.buffer,
      ContentType: decodedImage.mimeType,
      CacheControl: immutableImageCacheControl,
    }),
  );

  return buildS3PublicUrl(filePath);
}

async function saveImageLocally(decodedImage) {
  await mkdir(localGamesUploadsDirectory, { recursive: true });

  const fileName = buildImageFileName(decodedImage.fileExtension);
  const filePath = path.join(localGamesUploadsDirectory, fileName);

  const s3ObjectKey = getStoredS3ObjectKey(trimmedImageValue);
  if (!s3ObjectKey) {
    return trimmedImageValue;
  }

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
export async function resolveGameImageUrl(imageValue) {
  if (imageValue === undefined) {
    return undefined;
  }

  if (imageValue === null || imageValue === "") {
    return null;
  }

  if (typeof imageValue !== "string") {
    throw createBadRequestError("image_url must be a string");
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

  if (isAbsoluteUrl(trimmedImageValue)) {
    return trimmedImageValue;
  }

  // Storage priority: S3 for current production, GCS for legacy deployments,
  // and local disk for development or fallback environments.
  if (env.aws.s3Bucket) {
    return uploadImageToS3(decodedImage);
  }

  if (env.gcs.bucketName) {
    return uploadImageToGcs(decodedImage);
  }

  return uploadImageToS3(decodedImage);
}
