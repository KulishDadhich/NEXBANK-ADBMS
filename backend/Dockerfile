FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci --ignore-scripts
COPY backend backend
COPY database database
RUN npm run build -w backend
ENV NODE_ENV=production
USER node
EXPOSE 4000
CMD ["node","backend/dist/server.js"]
