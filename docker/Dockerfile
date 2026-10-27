# syntax=docker/dockerfile:1

# --- Stage 1: build the React frontend ---------------------------------------------------------
FROM node:24-alpine AS frontend
WORKDIR /src/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# --- Stage 2: install Python dependencies (uv isn't needed in the final image) -----------------
FROM python:3.13-slim AS python-deps
COPY --from=ghcr.io/astral-sh/uv:0.11.32 /uv /usr/local/bin/uv
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never \
    UV_PROJECT_ENVIRONMENT=/app/.venv
WORKDIR /app/backend
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --locked --no-dev --extra postgres

# --- Stage 3: the application image ------------------------------------------------------------
FROM python:3.13-slim AS app
WORKDIR /app/backend
COPY --from=python-deps /app/.venv /app/.venv
COPY backend/ ./
COPY --from=frontend /src/frontend/dist /app/frontend
COPY --chmod=755 docker/entrypoint.sh /app/entrypoint.sh

ENV PATH=/app/.venv/bin:$PATH \
    PYTHONUNBUFFERED=1 \
    SUNFLECK_DATA_DIR=/data \
    SUNFLECK_STATIC_ROOT=/app/static \
    SUNFLECK_FRONTEND_DIR=/app/frontend

# Static files are collected at build time; the placeholder key is used only for this step.
RUN SECRET_KEY=build-only python manage.py collectstatic --noinput

RUN useradd --system --uid 1000 --home-dir /data sunfleck \
    && mkdir -p /data \
    && chown sunfleck /data
USER sunfleck
VOLUME /data
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/v1/health', timeout=4)"]

ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["web"]
