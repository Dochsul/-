# API image: Node 22 (built-in SQLite), no npm dependencies, runs as a non-root user.
# Only what the API needs is copied: the server, the catalog/business config and the operational scripts.
# The static site is NOT part of this image (the public site lives in Tilda); the API origin serves only /api.
FROM node:22-slim

ENV NODE_ENV=production \
    NODE_OPTIONS=--disable-warning=ExperimentalWarning \
    PORT=8080
WORKDIR /app

COPY package.json ./
COPY server ./server
COPY src/config ./src/config
COPY scripts/backup.mjs scripts/restore.mjs scripts/export-accounting.mjs scripts/check-env.mjs scripts/verify-files.mjs ./scripts/

# Writable state lives only in these mounted volumes; the image filesystem can stay read-only.
RUN mkdir -p /app/data /app/private/products && chown -R node:node /app/data
USER node
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/index.mjs"]
