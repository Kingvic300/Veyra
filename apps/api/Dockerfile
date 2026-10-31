# Build from the repository root: docker build -f apps/api/Dockerfile .
FROM node:24-alpine AS build
WORKDIR /repo
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages ./packages
COPY chains/starknet/adapter ./chains/starknet/adapter
COPY apps/api ./apps/api
RUN npm ci --workspace @veyra/api --include-workspace-root \
 && npm run build -w @veyra/core -w @veyra/chain-adapter -w @veyra/starknet-adapter -w @veyra/api \
 && npm prune --omit=dev --workspace @veyra/api --include-workspace-root

FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=build /repo /repo
USER node
EXPOSE 4000
WORKDIR /repo/apps/api
CMD ["node", "dist/main.js"]
