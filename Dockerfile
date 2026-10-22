# Open Eleven — une recette, deux images :
#   server : le serveur du jeu (Node)
#   web    : les pages du jeu servies par Caddy, qui relaie /api vers le serveur

# --- Assemblage --------------------------------------------------------------
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/content/package.json packages/content/
COPY packages/engine/package.json packages/engine/
COPY packages/server/package.json packages/server/
COPY packages/web/package.json packages/web/
RUN npm ci
COPY packages packages
RUN npm run build -w @open-eleven/web && npm run build -w @open-eleven/server

# --- Serveur -----------------------------------------------------------------
FROM node:24-alpine AS server
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY packages/content/package.json packages/content/
COPY packages/engine/package.json packages/engine/
COPY packages/server/package.json packages/server/
COPY packages/web/package.json packages/web/
RUN npm ci --omit=dev --workspace @open-eleven/server && npm cache clean --force
COPY --from=build /app/packages/server/dist packages/server/dist
COPY packages/server/migrations packages/server/migrations
COPY packages/server/scripts/import-supabase.js packages/server/scripts/
USER node
EXPOSE 3000
CMD ["node", "packages/server/dist/server.js"]

# --- Pages -------------------------------------------------------------------
FROM caddy:2-alpine AS web
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/packages/web/dist /srv
