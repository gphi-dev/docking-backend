import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { env } from "../config/env.js";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const uploadsDirectory = path.resolve(currentDirectory, "../../public/uploads/games");
const publicPathPrefix = "/uploads/games";
const gcsPublicHost = "https://storage.googleapis.com";

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
      cacheControl: "public, max-age=31536000, immutable",
    },
    resumable: false,
  });

  return buildGcsPublicUrl(filePath);
}

async function saveImageLocally(decodedImage) {
  await mkdir(uploadsDirectory, { recursive: true });

  const fileName = `${Date.now()}-${randomUUID()}.${decodedImage.fileExtension}`;
  const filePath = path.join(uploadsDirectory, fileName);

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
    return trimmedImageValue;
  }

  if (env.gcs.bucketName) {
    return uploadImageToGcs(decodedImage);
  }

  return saveImageLocally(decodedImage);
}
