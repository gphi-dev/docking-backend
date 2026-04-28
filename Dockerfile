# Optimized for Google Cloud Run (stateless container, listen on PORT)
FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src

ENV NODE_ENV=production
ENV PORT=3306
ENV AWS_REGION=ap-southeast-1
ENV AWS_S3_BUCKET=gphi-docking-public
ENV AWS_S3_PUBLIC_URL=https://gphi-docking-public.s3.ap-southeast-1.amazonaws.com

USER node

EXPOSE 3306

CMD ["node", "src/index.js"]
