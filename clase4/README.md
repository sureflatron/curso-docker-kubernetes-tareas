# docker-microservicios-clase4

Aplicación de **microservicios** con **API Gateway (Nginx)**, **Backend Node.js**,
**Redis como cache**, **MongoDB** como base de datos y **Frontend** estático.

## 🧠 Objetivo
Demostrar un flujo end-to-end: Frontend → Gateway → Backend → Redis/Mongo con **cache HIT/MISS** e **invalidación**.

---

## 🏗️ Arquitectura

```
[ Cliente ]
     |
     v     (http://localhost:8080)
+------------+
|  Gateway   |  Nginx (puerto 8080)
|  /api/* -> backend:5000
|  /      -> frontend:80
+------------+
     |                      | /api            \  /
     v                  \/
+------------+      +---------+
|  Backend   |<---->|  Redis  |
| Node.js    |      |  Cache  |
+------------+      +---------+
     |
     v
+------------+
|  MongoDB   |
|  Persist.  |
+------------+
```

Red: `appnet` (bridge). Volumen: `mongo_data` (persistencia).

---

## 📦 Servicios

| Servicio | Tecnología | Puerto | Descripción |
|----------|------------|--------|-------------|
| gateway  | Nginx      | 8080   | API Gateway (reverse proxy) |
| backend  | Node.js    | 5000   | API principal de posts |
| redis    | Redis      | 6379   | Cache en memoria |
| db       | MongoDB    | 27017  | Base de datos |
| frontend | Nginx      | 80     | Sitio estático |

---

## 🚀 Instrucciones de Uso

```bash
# Clonar repositorio
git clone <tu-repo> docker-microservicios-clase4
cd docker-microservicios-clase4

# Levantar servicios
docker compose up -d --build

# Verificar estado
docker compose ps

# Ver logs del backend (cache HIT/MISS)
docker compose logs -f backend

# Acceder a la app
open http://localhost:8080    # (Windows: start, Linux: xdg-open)
```

---

## 🔌 Endpoints de la API

- **GET /api/health**  
  Estado del backend, Redis y DB.  
  **Response:** `{ "status": "ok" }`

- **GET /api/posts**  
  Lista todos los posts (usa cache con TTL=60s).  
  **Response:** `{ "source": "cache|database", "data": [ ... ] }`

- **GET /api/posts/:id**  
  Devuelve un post por id (cache por 120s).  
  **Response:** `{ "source": "cache|database", "data": { ... } }`

- **POST /api/posts**  
  Crea un post. **Invalida** `posts:all` y la clave del nuevo `posts:<id>`.  
  **Request:** `{ "title": "Test", "content": "..." }`  
  **Response:** `{ "ok": true, "id": "<ObjectId>", "data": { ... } }`

- **POST /api/seed** *(solo demo)*  
  Inserta 2 posts si la colección está vacía e invalida el cache de lista.

---

## 🧪 Pruebas a Realizar

### 1) Cache Hit/Miss
```bash
# MISS (primera vez)
curl -s http://localhost:8080/api/posts | jq .source

# HIT (segunda vez, dentro de 60s)
curl -s http://localhost:8080/api/posts | jq .source
```
Observa en `docker compose logs -f backend` las líneas **"Cache MISS"** y **"Cache HIT"**.

### 2) Invalidación de Cache
```bash
curl -s -X POST http://localhost:8080/api/posts   -H "Content-Type: application/json"   -d '{"title":"Test","content":"..."}' | jq

# Debe regenerar desde DB (MISS) tras crear
curl -s http://localhost:8080/api/posts | jq .source
```

### 3) Persistencia de Datos
```bash
# Crear datos
curl -s -X POST http://localhost:8080/api/posts   -H "Content-Type: application/json"   -d '{"title":"Persistencia","content":"Mongo volumen"}'

# Reiniciar servicios
docker compose down
docker compose up -d

# Verificar que persisten
curl -s http://localhost:8080/api/posts | jq .data | wc -c
```

### 4) Gateway Routing
```bash
curl -i http://localhost:8080/gateway/health
curl -i http://localhost:8080/api/health
# Frontend
curl -I http://localhost:8080/
```

---

## 📚 Tecnologías
- Docker & Docker Compose
- Nginx (reverse proxy / gateway)
- Node.js + Express
- MongoDB + Mongoose
- Redis (ioredis)

---

## 🖼️ Capturas de Pantalla (colócalas en `docs/screenshots/`)
- Frontend funcionando
- `docker compose ps`
- Logs con conexión a Redis y DB
- Respuesta con `"source":"cache"`
- Respuesta con `"source":"database"`

---

## ✅ Checklist antes de entregar
- [ ] `docker compose up -d` sin errores
- [ ] Frontend accesible en `http://localhost:8080`
- [ ] APIs responden OK
- [ ] Cache HIT/MISS visible en logs
- [ ] Datos persisten tras reinicio
- [ ] README completo y claro
- [ ] Screenshots en `docs/screenshots/`
