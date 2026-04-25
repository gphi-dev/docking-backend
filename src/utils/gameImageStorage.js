import { access, mkdir, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { env } from "../config/env.js";
import { s3Client } from "../config/s3.js";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
export const localUploadsDirectory = env.localUploadsDirectory
  ? path.resolve(env.localUploadsDirectory)
  : path.resolve(currentDirectory, "../../public/uploads");
const gamesUploadsDirectory = path.join(localUploadsDirectory, "games");
const publicPathPrefix = "/uploads/games";
const gcsPublicHost = "https://storage.googleapis.com";
const s3ImagePathPrefix = "images";
const immutableImageCacheControl = "public, max-age=31536000, immutable";

const mimeTypeToExtension = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

function decodeImageDataUrl(imageValue) {
  if (typeof imageValue !== "string" || !imageValue.startsWith("data:image/")) {
    return null;
  }

  const matches = imageValue.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!matches) {
    const error = new Error("Invalid image data URL");
    error.statusCode = 400;
    throw error;
  }

  const [, mimeType, encodedData] = matches;
  const fileExtension = mimeTypeToExtension[mimeType];

  if (!fileExtension) {
    const error = new Error("Unsupported image type");
    error.statusCode = 400;
    throw error;
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
  const expectedPrefix = "uploads/games/";

  if (!normalizedImagePath.startsWith(expectedPrefix)) {
    const error = new Error("image_url must be an absolute URL, a data URL, or an existing /uploads/games path");
    error.statusCode = 400;
    throw error;
  }

  const fileName = path.basename(normalizedImagePath);
  const filePath = path.join(gamesUploadsDirectory, fileName);

  try {
    await access(filePath, constants.R_OK);
  } catch {
    const error = new Error(`Image file not found: /uploads/games/${fileName}`);
    error.statusCode = 400;
    throw error;
  }

  return `${publicPathPrefix}/${fileName}`;
}

async function uploadImageToGcs(decodedImage) {
  const { Storage } = await import("@google-cloud/storage");
  const storage = env.gcs.projectId
    ? new Storage({ projectId: env.gcs.projectId })
    : new Storage();

  const bucket = storage.bucket(env.gcs.bucketName);
  const fileName = `${Date.now()}-${randomUUID()}.${decodedImage.fileExtension}`;
  const filePath = `games/${fileName}`;

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
  const fileName = `${Date.now()}-${randomUUID()}.${decodedImage.fileExtension}`;
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
  await mkdir(gamesUploadsDirectory, { recursive: true });

  const fileName = `${Date.now()}-${randomUUID()}.${decodedImage.fileExtension}`;
  const filePath = path.join(gamesUploadsDirectory, fileName);

  await writeFile(filePath, decodedImage.buffer);

  return `${publicPathPrefix}/${fileName}`;
}

export async function resolveGameImageUrl(imageValue) {
  if (imageValue === undefined) {
    return undefined;
  }

  if (imageValue === null || imageValue === "") {
    return null;
  }

  if (typeof imageValue !== "string") {
    const error = new Error("image_url must be a string");
    error.statusCode = 400;
    throw error;
  }

  const trimmedImageValue = imageValue.trim();
  const decodedImage = decodeImageDataUrl(trimmedImageValue);

  if (!decodedImage) {
    if (isAbsoluteUrl(trimmedImageValue)) {
      return trimmedImageValue;
    }

    return ensureLocalUploadExists(trimmedImageValue);
  }

  if (env.aws.s3Bucket) {
    return uploadImageToS3(decodedImage);
  }

  if (env.gcs.bucketName) {
    return uploadImageToGcs(decodedImage);
  }

  return saveImageLocally(decodedImage);
}
