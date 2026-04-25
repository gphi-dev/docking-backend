import { access, mkdir, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { env } from "../config/env.js";
import { s3Client } from "../config/s3.js";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

// Local uploads are retained for development and fallback use. In production,
// AWS S3 is preferred whenever AWS_S3_BUCKET is configured.
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

const mimeTypeToExtension = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

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

  return {
    fileExtension,
    mimeType,
    buffer: Buffer.from(encodedData, "base64"),
  };
}

function encodePathSegments(filePath) {
  return filePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
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

async function ensureLocalUploadExists(imagePath) {
  const normalizedImagePath = imagePath.replace(/^\/+/, "");

  if (!normalizedImagePath.startsWith(localUploadPathPrefix)) {
    throw createBadRequestError(
      "image_url must be an absolute URL, a data URL, or an existing /uploads/games path",
    );
  }

  const fileName = path.basename(normalizedImagePath);
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

  await writeFile(filePath, decodedImage.buffer);

  return `${localPublicPathPrefix}/${fileName}`;
}

/**
 * Resolves the stored image URL for create/update game payloads.
 *
 * Accepted values:
 * - undefined: keep the existing image unchanged on updates
 * - null/empty string: clear the image
 * - absolute http(s) URL: store the URL as-is
 * - /uploads/games/... path: reuse an existing local upload
 * - data:image/... base64 URL: upload to S3, GCS, or local fallback
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
    // External image URLs are stored directly so callers can reference already
    // hosted assets without forcing a backend-managed upload.
    if (isAbsoluteUrl(trimmedImageValue)) {
      return trimmedImageValue;
    }

    return ensureLocalUploadExists(trimmedImageValue);
  }

  // Storage priority: S3 for production, GCS for legacy deployments, then
  // local disk for development/fallback environments.
  if (env.aws.s3Bucket) {
    return uploadImageToS3(decodedImage);
  }

  if (env.gcs.bucketName) {
    return uploadImageToGcs(decodedImage);
  }

  return saveImageLocally(decodedImage);
}
