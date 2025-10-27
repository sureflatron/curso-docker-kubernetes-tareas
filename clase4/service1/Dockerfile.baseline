FROM node:18-alpine

# Crear directorio de la app
WORKDIR /usr/src/app

# Instalar dependencias
COPY package.json package-lock.json* ./
RUN npm ci --only=production || npm install --only=production

# Copiar código
COPY server.js ./

EXPOSE 5000
CMD ["node", "server.js"]
