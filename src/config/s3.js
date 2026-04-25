import { S3Client } from "@aws-sdk/client-s3";
import { env } from "./env.js";

const s3ClientOptions = {
  region: env.aws.region,
};

if (env.aws.accessKeyId && env.aws.secretAccessKey) {
  s3ClientOptions.credentials = {
    accessKeyId: env.aws.accessKeyId,
    secretAccessKey: env.aws.secretAccessKey,
  };
}

export const s3Client = new S3Client(s3ClientOptions);
