# --- Étape 1 : Builder pour les dépendances Python ---
FROM python:3.11-slim AS builder

WORKDIR /build

# Installer les dépendances système pour compiler certains packages
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

# Copier et installer les dépendances Python
COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# --- Étape 2 : Image finale ---
FROM python:3.11-slim

WORKDIR /app

# Installer uniquement les dépendances système nécessaires
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copier les packages Python depuis le builder
COPY --from=builder /root/.local /root/.local

# Copier le code source
COPY . ./

# Mettre à jour PATH
ENV PATH=/root/.local/bin:$PATH

# Créer un utilisateur non-root pour la sécurité
RUN addgroup --system --gid 1001 appgroup && \
    adduser --system --uid 1001 --gid 1001 appuser && \
    chown -R appuser:appgroup /app

USER appuser

EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Démarrer l'application FastAPI
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]