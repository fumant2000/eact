# Contexte de build : racine du monorepo.
FROM node:22-alpine AS build
WORKDIR /repo
COPY package.json package-lock.json* ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
RUN npm install --workspace @eact/shared --workspace @eact/web
COPY packages/shared packages/shared
COPY apps/web apps/web
RUN npm run build -w @eact/shared && npm run build -w @eact/web

FROM node:22-alpine
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /repo/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
