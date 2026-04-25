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

For durable production image uploads, set `GCS_BUCKET_NAME` in the Cloud Build trigger
substitutions so the backend stores game images in Google Cloud Storage instead of the
container filesystem.
