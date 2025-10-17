# -------- Stage 1: deps (aprovecha caché y evita toolchain en runtime) --------
FROM node:18-alpine AS deps
WORKDIR /app

# Solo manifiestos primero para maximizar caché
COPY package.json package-lock.json* ./

# Instala solo prod, sin auditoría y más rápido
RUN npm ci --omit=dev --no-audit --no-fund

# -------- Stage 2: runtime mínimo, non-root --------
FROM node:18-alpine
ENV NODE_ENV=production \
    PORT=5000

# Crea usuario/grupo no root determinísticos
RUN addgroup -S app -g 1001 && adduser -S app -G app -u 1001

WORKDIR /app

# Copia node_modules de la etapa de deps
COPY --from=deps /app/node_modules ./node_modules
# Copia tu app (si luego agregas más archivos, añade aquí)
COPY --chown=app:app server.js ./ 
COPY --chown=app:app package.json ./

# Labels útiles para trazabilidad/seguridad
LABEL org.opencontainers.image.title="mi-app" \
      org.opencontainers.image.description="Demo Node.js optimizada (alpine, non-root, multi-stage)" \
      org.opencontainers.image.version="1.0" \
      security.non-root="true"

# Permisos y usuario no root
RUN chown -R app:app /app
USER app

EXPOSE 5000

# (Opcional) Healthcheck si tienes /health en tu servidor
# HEALTHCHECK --interval=30s --timeout=3s --start-period=30s \
#   CMD node -e "require('http').get('http://localhost:'+(process.env.PORT||5000)+'/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "server.js"]
