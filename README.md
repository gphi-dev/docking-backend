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

Game image uploads are stored in S3. Send `image_url` as a base64
`data:image/...;base64,...` value to `POST /api/games` or `PUT /api/games/:gameId`;
the API stores the object under `images/` and saves the public S3 URL.

Required environment:

```text
AWS_ACCESS_KEY_ID=<set in Secret Manager or local .env>
AWS_SECRET_ACCESS_KEY=<set in Secret Manager or local .env>
AWS_REGION=ap-southeast-1
AWS_S3_BUCKET=gphi-docking-public
AWS_S3_PUBLIC_URL=https://gphi-docking-public.s3.ap-southeast-1.amazonaws.com
```
