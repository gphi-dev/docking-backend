import { randomUUID } from "node:crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { env } from "../config/env.js";
import { s3Client } from "../config/s3.js";

const s3ImagePathPrefix = "images";
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

function isAbsoluteUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
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

async function uploadImageToS3(decodedImage) {
  if (!env.aws.s3Bucket) {
    throw createBadRequestError("AWS_S3_BUCKET is required for image uploads");
  }

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

export function resolveStoredGameImageUrl(imageValue) {
  if (!imageValue || typeof imageValue !== "string") {
    return imageValue ?? null;
  }

  const trimmedImageValue = imageValue.trim();
  if (!trimmedImageValue) {
    return null;
  }

  if (isAbsoluteUrl(trimmedImageValue)) {
    return trimmedImageValue;
  }

  const legacyUploadPrefix = "uploads/games/";
  const normalizedImagePath = trimmedImageValue.replace(/^\/+/, "");
  if (!normalizedImagePath.startsWith(legacyUploadPrefix) || !env.aws.s3Bucket) {
    return trimmedImageValue;
  }

  const fileName = normalizedImagePath.slice(legacyUploadPrefix.length);
  return buildS3PublicUrl(`${s3ImagePathPrefix}/${fileName}`);
}

/**
 * Resolves the image value sent by game create/update payloads.
 *
 * Accepted values:
 * - undefined: leave the current image unchanged
 * - null or empty string: clear the image
 * - absolute http(s) URL: store the external URL as-is
 * - data:image/...;base64,...: upload to S3 and return its public URL
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

  if (isAbsoluteUrl(trimmedImageValue)) {
    return trimmedImageValue;
  }

  const decodedImage = decodeImageDataUrl(trimmedImageValue);
  if (!decodedImage) {
    throw createBadRequestError("image_url must be an absolute URL or an image data URL");
  }

  return uploadImageToS3(decodedImage);
}
