# Build from the repository root: docker compose -f deploy/docker-compose.yml build

FROM node:20-bookworm-slim AS web
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN AUTH_SECRET=build-only npm run build && npm prune --omit=dev

FROM python:3.12-slim-bookworm
ENV PIP_NO_CACHE_DIR=1 HF_HOME=/opt/huggingface

# CPU-only torch keeps the image far smaller than the default GPU build.
RUN pip install torch==2.11.0 --index-url https://download.pytorch.org/whl/cpu
COPY deploy/requirements.txt /tmp/requirements.txt
RUN pip install -r /tmp/requirements.txt

# Bake the search models into the image so the first question doesn't download them.
RUN python -c "from sentence_transformers import CrossEncoder, SentenceTransformer; SentenceTransformer('BAAI/bge-small-en-v1.5'); CrossEncoder('cross-encoder/ms-marco-MiniLM-L-6-v2')"

COPY --from=web /usr/local/bin/node /usr/local/bin/node
WORKDIR /app
COPY --from=web /app/.next ./.next
COPY --from=web /app/node_modules ./node_modules
COPY --from=web /app/public ./public
COPY --from=web /app/scripts/rag_user_pipeline.py ./scripts/rag_user_pipeline.py
COPY --from=web /app/package.json /app/next.config.mjs ./

RUN useradd --system --uid 10001 coursepilot \
  && mkdir -p data storage \
  && chown -R coursepilot:coursepilot data storage .next

ENV NODE_ENV=production PORT=3000 RAG_PYTHON_BIN=python HF_HUB_OFFLINE=1
USER coursepilot
EXPOSE 3000
CMD ["node", "node_modules/next/dist/bin/next", "start", "-H", "0.0.0.0"]
