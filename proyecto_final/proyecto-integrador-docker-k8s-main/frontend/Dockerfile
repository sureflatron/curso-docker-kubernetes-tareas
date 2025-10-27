# Stage 1: Build Angular application
FROM node:18-alpine AS build

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (generates package-lock.json if missing)
RUN npm install

# Copy source code
COPY . .

# Build for production
RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:1.25-alpine

# Install gettext for envsubst
RUN apk add --no-cache gettext

# Opcional: Configurar timezone (descomenta si necesitas zona horaria específica)
# RUN apk add --no-cache tzdata
# ENV TZ=America/La_Paz
# RUN ln -sf /usr/share/zoneinfo/$TZ /etc/localtime && \
#     echo $TZ > /etc/timezone

# Copy built app from build stage
COPY --from=build /app/dist/angular-frontend /usr/share/nginx/html

# Copy nginx template (not final config)
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

# Set default API backend URL (will be overridden by environment variable)
ENV API_BACKEND_URL=http://localhost:8080

# Expose port 80
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:80/ || exit 1

# Substitute environment variables in nginx template and start nginx
CMD ["/bin/sh", "-c", "envsubst '${API_BACKEND_URL}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
