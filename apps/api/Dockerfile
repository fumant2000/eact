# Une seule image pour `api` (dist/main.js) et `worker` (dist/worker.js) — ADR 0001.
# Contexte de build : racine du monorepo.
FROM node:22-alpine AS build
RUN apk add --no-cache openssl
WORKDIR /repo
COPY package.json package-lock.json* ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN npm install --workspace @eact/shared --workspace @eact/api
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm run build -w @eact/shared \
 && npm run prisma:generate -w @eact/api \
 && npm run build -w @eact/api \
 && mkdir -p apps/api/node_modules

FROM node:22-alpine
RUN apk add --no-cache openssl
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=build /repo/node_modules node_modules
COPY --from=build /repo/packages/shared packages/shared
COPY --from=build /repo/apps/api/node_modules apps/api/node_modules
COPY --from=build /repo/apps/api/package.json apps/api/package.json
COPY --from=build /repo/apps/api/prisma apps/api/prisma
COPY --from=build /repo/apps/api/dist apps/api/dist
WORKDIR /repo/apps/api
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
