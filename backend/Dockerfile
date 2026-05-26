FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/package-lock.json ./backend/
RUN npm ci
RUN npm --prefix backend ci

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/backend/node_modules ./backend/node_modules
COPY package.json package-lock.json ./
COPY backend/package.json backend/package-lock.json ./backend/
COPY backend/tsconfig.json ./backend/tsconfig.json
COPY backend/src ./backend/src
RUN npm --prefix backend run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app/backend
ENV NODE_ENV=production
ENV PORT=4000
ENV UPLOAD_DIR=/app/storage/uploads
ENV EXPORT_DIR=/app/storage/exports
RUN mkdir -p /app/storage/uploads /app/storage/exports
COPY --from=build /app/backend/package.json ./package.json
COPY --from=build /app/backend/node_modules ./node_modules
COPY --from=build /app/backend/dist ./dist
EXPOSE 4000
CMD ["node","dist/server.js"]
