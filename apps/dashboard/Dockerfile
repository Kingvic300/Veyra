# Build from the repository root: docker build -f apps/dashboard/Dockerfile .
FROM node:24-alpine AS build
WORKDIR /repo
ARG NEXT_PUBLIC_VEYRA_API_URL=http://localhost:4000/v1
ENV NEXT_PUBLIC_VEYRA_API_URL=$NEXT_PUBLIC_VEYRA_API_URL
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/dashboard ./apps/dashboard
RUN npm ci --workspace @veyra/dashboard --include-workspace-root \
 && npm run build -w @veyra/core -w @veyra/chain-adapter -w @veyra/sdk -w @veyra/dashboard

FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=build /repo /repo
USER node
EXPOSE 3000
WORKDIR /repo/apps/dashboard
CMD ["npx", "next", "start", "--port", "3000"]
