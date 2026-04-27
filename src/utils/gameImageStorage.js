import { randomUUID } from "node:crypto";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
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

function createImageUploadError(message, statusCode = 502) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function isMissingAwsCredentialsError(error) {
  return (
    error?.name === "CredentialsProviderError" ||
    error?.code === "CredentialsProviderError" ||
    String(error?.message ?? "").toLowerCase().includes("could not load credentials")
  );
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

function decodePathSegments(filePath) {
  return filePath
    .split("/")
    .map((segment) => decodeURIComponent(segment))
    .join("/");
}

function isAbsoluteUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function hasConfiguredS3UploadCredentials() {
  return Boolean(env.aws.accessKeyId && env.aws.secretAccessKey);
}

export function isImageDataUrl(value) {
  return typeof value === "string" && value.trim().startsWith("data:image/");
}

function getConfiguredS3PublicUrlObjectKey(imageValue) {
  if (!env.aws.s3PublicUrl) {
    return null;
  }

  try {
    const imageUrl = new URL(imageValue);
    const publicUrl = new URL(`${env.aws.s3PublicUrl}/`);

    if (imageUrl.origin !== publicUrl.origin) {
      return null;
    }

    const publicPathPrefix = publicUrl.pathname.replace(/\/+$/, "");
    if (publicPathPrefix && !imageUrl.pathname.startsWith(`${publicPathPrefix}/`)) {
      return null;
    }

    const keyPath = publicPathPrefix
      ? imageUrl.pathname.slice(publicPathPrefix.length + 1)
      : imageUrl.pathname.replace(/^\/+/, "");

    return decodePathSegments(keyPath);
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

  const legacyUploadPrefix = "uploads/images/";
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
    const uploadError = isMissingAwsCredentialsError(error)
      ? createImageUploadError("AWS credentials are not configured in Cloud Run", 503)
      : createImageUploadError("Failed to upload image to S3");
    uploadError.cause = error;
    throw uploadError;
  }

  return buildS3PublicUrl(filePath);
}

export async function resolveStoredGameImageUrl(imageValue) {
  if (!imageValue || typeof imageValue !== "string") {
    return imageValue ?? null;
  }

  const trimmedImageValue = imageValue.trim();
  if (!trimmedImageValue) {
    return null;
  }

  const s3ObjectKey = getStoredS3ObjectKey(trimmedImageValue);
  if (!s3ObjectKey) {
    return trimmedImageValue;
  }

  return buildSignedS3ImageUrl(s3ObjectKey);
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
