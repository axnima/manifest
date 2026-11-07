FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends python3 poppler-utils ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --chown=node:node public/ ./public/
COPY --chown=node:node scripts/ ./scripts/
RUN mkdir -p .local-artifacts && chown node:node .local-artifacts
ENV BIND_HOST=0.0.0.0 PORT=10000 PYTHONUNBUFFERED=1
USER node
EXPOSE 10000
CMD ["python3", "scripts/server.py"]
