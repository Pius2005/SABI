# syntax=docker/dockerfile:1
FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

# Install dependencies first so the layer is cached.
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci

# Application source.
COPY . .

# Build the PWA; the API serves apps/web/dist.
RUN npm run build && chown -R node:node /app

USER node
EXPOSE 4100

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4100)+'/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["npm", "start"]
