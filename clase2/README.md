# Clase 2 - Dockerización de Mi Aplicación

## Aplicación

**Lenguaje:** Node.js
**Framework:** Express
**Descripción:** API REST para gestión de usuarios

**Endpoints:**
| Método     | Ruta         | Descripción                | Requiere Token | Solo Admin |
| :--------- | :----------- | :------------------------- | :------------- | :--------- |
| **POST**   | `/login`     | Inicia sesión y genera JWT | ❌              | ❌          |
| **GET**    | `/users`     | Lista todos los usuarios   | ✅              | 🔸 Parcial |
| **POST**   | `/users`     | Crea un nuevo usuario      | ✅              | ✅          |
| **GET**    | `/users/:id` | Muestra un usuario por ID  | ✅              | 🔸 Parcial |
| **PUT**    | `/users/:id` | Modifica usuario existente | ✅              | ✅          |
| **DELETE** | `/users/:id` | Elimina usuario existente  | ✅              | ✅          |


## Dockerfile

```dockerfile
# =========================
# 🏗️ Stage 1: Build
# =========================
FROM node:18-alpine AS build

# Establecer directorio de trabajo
WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar todas las dependencias (incluye dev)
RUN npm ci

# Copiar el código fuente
COPY . .

# Si hay un paso de build (por ejemplo, transpilar TypeScript o compilar assets)
# RUN npm run build


# =========================
# 🚀 Stage 2: Production
# =========================
FROM node:18-alpine AS production

# Establecer variables de entorno
ENV NODE_ENV=production \
    PORT=4000

# Crear un usuario no-root por seguridad
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Directorio de trabajo
WORKDIR /app

# Copiar solo los archivos necesarios desde el build
COPY --from=build /app/package*.json ./
COPY --from=build /app/src ./src
COPY --from=build /app/.env ./

# Instalar solo dependencias de producción
RUN npm ci --omit=dev

# Cambiar a usuario no-root
USER appuser

# Exponer puerto
EXPOSE 4000

# Añadir metadata
LABEL maintainer="Tu Nombre <tuemail@ejemplo.com>" \
      version="1.0" \
      description="Node.js API con multi-stage build, non-root user y buenas prácticas Docker"

# (Opcional) Healthcheck para monitorear el estado del contenedor
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:${PORT}/health || exit 1

# Comando para ejecutar la app
CMD ["node", "src/index.js"]

```

**Explicación:**

| Stage | Propósito |
|-------|-----------|
| Build | Instalar todas las dependencias... |
| Production | Solo runtime... |

## Build

```bash
docker build -t prueba-nur:latest .
```

**Salida:**
```
[+] Building 11.8s (17/17) FINISHED                                                                                                                                                         docker:desktop-linux
 => [internal] load build definition from Dockerfile                                                                                                                                                        0.1s
 => => transferring dockerfile: 1.60kB                                                                                                                                                                      0.0s
 => [internal] load metadata for docker.io/library/node:18-alpine                                                                                                                                           1.8s
 => [auth] library/node:pull token for registry-1.docker.io                                                                                                                                                 0.0s
 => [internal] load .dockerignore                                                                                                                                                                           0.0s
 => => transferring context: 137B                                                                                                                                                                           0.0s
 => CACHED [build 1/5] FROM docker.io/library/node:18-alpine@sha256:8d6421d663b4c28fd3ebc498332f249011d118945588d0a35cb9bc4b8ca09d9e                                                                        0.0s
 => [internal] load build context                                                                                                                                                                           0.1s
 => => transferring context: 85.88kB                                                                                                                                                                        0.0s
 => [production 2/7] RUN addgroup -S appgroup && adduser -S appuser -G appgroup                                                                                                                             0.8s
 => CACHED [build 2/5] WORKDIR /app                                                                                                                                                                         0.0s
 => [build 3/5] COPY package*.json ./                                                                                                                                                                       0.1s
 => [build 4/5] RUN npm ci                                                                                                                                                                                  5.5s
 => [production 3/7] WORKDIR /app                                                                                                                                                                           0.1s
 => [build 5/5] COPY . .                                                                                                                                                                                    0.0s
 => [production 4/7] COPY --from=build /app/package*.json ./                                                                                                                                                0.1s
 => [production 5/7] COPY --from=build /app/src ./src                                                                                                                                                       0.1s
 => [production 6/7] COPY --from=build /app/.env ./                                                                                                                                                         0.1s
 => [production 7/7] RUN npm ci --omit=dev                                                                                                                                                                  3.4s
 => exporting to image                                                                                                                                                                                      0.2s
 => => exporting layers                                                                                                                                                                                     0.2s
 => => writing image sha256:95292163953f652f10d38cb094074c79279d33146082f55af97192d36c50b293                                                                                                                0.0s
 => => naming to docker.io/library/prueba-nur:latest                                                                                                                                                        0.0s

View build details: docker-desktop://dashboard/build/desktop-linux/desktop-linux/ht4fm8f80lgqnir3ynbuezizc

What's next:
    View a summary of image vulnerabilities and recommendations → docker scout quickview
```

**Tamaño final:** 131 MB

## Testing

![Docker Images](./screenshots/image.png)

```
docker run  -p 4000:4000 --name prueba-nur  -d prueba-nur:latest
```

![Container Running](./screenshots/docker.png)
![API Response](./screenshots/logs.png)

**LOGIN**
``` CURL

curl --request POST \
  --url http://localhost:4000/login \
  --header 'Content-Type: application/json' \
  --header 'User-Agent: insomnia/10.0.0' \
  --cookie JSESSIONID=44D23F47EB5FCB3086BCF6C875EC3B3A \
  --data '{
	"email": "admin@spsgroup.com.br",
	"password": "1234"
}'
```

**LISTAR**
``` CURL
curl --request GET \
  --url http://localhost:4000/users \
  --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImFkbWluQHNwc2dyb3VwLmNvbS5iciIsInR5cGUiOiJhZG1pbiIsImlhdCI6MTc1OTc2NjMyNH0.AO2JspytzDJQyX0QwiVGopdtmJQRWt2Q5-5vNLz553w' \
  --header 'Content-Type: application/json' \
  --header 'User-Agent: insomnia/10.0.0'
  ```

  **CREAR**
``` CURL
  curl --request POST \
  --url http://localhost:4000/users \
  --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImFkbWluQHNwc2dyb3VwLmNvbS5iciIsInR5cGUiOiJhZG1pbiIsImlhdCI6MTc1OTc2NjMyNH0.AO2JspytzDJQyX0QwiVGopdtmJQRWt2Q5-5vNLz553w' \
  --header 'Content-Type: application/json' \
  --header 'User-Agent: insomnia/10.0.0' \
  --cookie JSESSIONID=44D23F47EB5FCB3086BCF6C875EC3B3A \
  --data '	{
		"id": 2,
		"name": "Fiengo",
		"email": "fiengo@gmail.com",
		"type": "user",
		"password": "Fiengo"
	}'
```


**MODIFICAR**
``` CURL
curl --request PUT \
  --url http://127.0.0.1:4000/users/2 \
  --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImFkbWluQHNwc2dyb3VwLmNvbS5iciIsInR5cGUiOiJhZG1pbiIsImlhdCI6MTc1OTc2NjUwOH0.RbyJo8M9FS73_rRcuZxcYUbAj6WrfNMFfT-jVttwjRI' \
  --header 'Content-Type: application/json' \
  --header 'User-Agent: insomnia/10.0.0' \
  --data '	{
		"id": 2,
		"name": "yandel",
		"email": "yandel@spsgroup.com.br",
		"type": "admin",
		"password": "yandel123"
	}'
  ```
## Docker Hub

**URL:** https://hub.docker.com/r/sureflatron3/prueba-nur
![Docker CMD](screenshots/dockerhub.png)
![Docker Hub](screenshots/nur.png)

## Optimizaciones

- Multi-stage build: redujo de 320MB a 131MB
- Usuario non-root
- .dockerignore excluye node_modules

## Conclusiones

Aprendí a optimizar imágenes.
Aprendí a subir imagenes a Docker Hub