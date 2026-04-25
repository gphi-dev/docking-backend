# docking-backend

## Production frontend login setup

The backend already exposes `POST /api/auth/login`.

If the deployed frontend sends requests to its own host, such as:

```text
https://docking-frontend-635955947416.asia-east1.run.app/api/auth/login
```

the request can fail with `405 Method Not Allowed` because it is hitting the frontend Cloud Run service instead of this backend service.

Use the backend Cloud Run URL as the frontend API base URL in production:

```text
VITE_API_BASE_URL=https://<backend-service>.asia-east1.run.app
```

Set backend CORS origins without a trailing slash:

```text
CORS_ORIGINS=https://docking-frontend-635955947416.asia-east1.run.app
```

The backend now normalizes trailing slashes in `CORS_ORIGINS`, but the no-slash form should still be the default deployment value.

Then the frontend should call:

```text
POST ${VITE_API_BASE_URL}/api/auth/login
```

This repository's Cloud Build deployment now sets `CORS_ORIGINS` for the frontend origin so cross-origin requests from the deployed frontend are allowed.

## Production game image uploads

Cloud Run containers have an ephemeral filesystem. Local uploads under `/uploads/games`
can work after deployment, but files can disappear when instances restart or scale.

For durable production image uploads, configure S3:

```text
AWS_ACCESS_KEY_ID=<set in Secret Manager or local .env>
AWS_SECRET_ACCESS_KEY=<set in Secret Manager or local .env>
AWS_REGION=ap-southeast-1
AWS_S3_BUCKET=gphi-docking-public
AWS_S3_PUBLIC_URL=https://gphi-docking-public.s3.ap-southeast-1.amazonaws.com
```

For Cloud Run, store `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` as Secret
Manager secrets with those exact names. The Cloud Build deploy step injects them
with `--update-secrets`.

When `AWS_S3_BUCKET` is set, the backend stores game images in S3 and returns the
public S3 URL. If S3 is not configured, the backend falls back to GCS when
`GCS_BUCKET_NAME` is set, then finally to local container storage.
