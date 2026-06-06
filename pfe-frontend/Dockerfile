# --- Étape 1 : Build React ---
FROM node:20-alpine AS builder

WORKDIR /build

# Copier les fichiers de dépendances
COPY package*.json ./

# Installer les dépendances (npm install au lieu de npm ci)
RUN npm install && npm cache clean --force

# Copier le code source
COPY . ./

# Build de l'application React
RUN npm run build

# --- Étape 2 : Production avec Nginx ---
FROM nginx:alpine

# Copier la configuration Nginx personnalisée
RUN echo 'server { \
    listen 80; \
    server_name _; \
    root /usr/share/nginx/html; \
    index index.html; \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
    location /api/ { \
        proxy_pass https://trustsign-backend.onrender.com/api/; \
        proxy_set_header Host $host; \
        proxy_set_header X-Real-IP $remote_addr; \
    } \
    location /ia/ { \
        proxy_pass https://trustsign-ia.onrender.com/; \
        proxy_set_header Host $host; \
    } \
}' > /etc/nginx/conf.d/default.conf

# Copier les fichiers buildés
COPY --from=builder /build/build /usr/share/nginx/html

# Nettoyer les fichiers inutiles
RUN rm -rf /usr/share/nginx/html/*.map

EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]