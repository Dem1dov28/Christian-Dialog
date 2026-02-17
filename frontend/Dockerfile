# Frontend Epochal Dialog — multi-stage build
FROM node:20-alpine AS builder

WORKDIR /app

# Build-time переменные для Vite (API URL и Google OAuth)
ARG VITE_API_BASE_URL=
ARG VITE_GOOGLE_CLIENT_ID=
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID

# Увеличиваем лимит памяти Node.js для сборки больших проектов
ENV NODE_OPTIONS="--max-old-space-size=4096"

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npm run build

# Production image with nginx
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
# Конфиг для SPA (fallback на index.html) и опционально proxy на backend
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
