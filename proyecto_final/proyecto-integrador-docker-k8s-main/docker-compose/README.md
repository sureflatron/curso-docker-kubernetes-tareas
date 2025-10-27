# Docker Compose Deployment (v1.2 - v1.3)

Esta guía cubre el despliegue del Proyecto Integrador usando Docker Compose para las versiones 1.2 y 1.3 del curso.

**Versiones:**
- **v1.2:** Spring Boot + PostgreSQL + Redis + Angular + Kong Gateway
- **v1.3:** + Seguridad y optimizaciones (Trivy scan)

---

## Stack Tecnológico

- **Framework:** Spring Boot 3.5.6
- **Java:** 17
- **Build:** Maven 3.9.6
- **Base de datos:** PostgreSQL 15
- **Cache:** Redis 7
- **Frontend:** Angular 17
- **API Gateway:** Kong 3.4

---

## Arquitectura

```
Cliente (navegador)
    |
    v
Angular Frontend :4200 (nginx + BFF)
    |
    v
Kong API Gateway :8000
    |
    +-- /api/* → Spring Boot :8080
                       |
                       +-- Redis Cache :6379
                       |
                       +-- PostgreSQL :5432
```

### Servicios

| Servicio | Puerto | Descripción |
|----------|--------|-------------|
| **app** | 8080 | Spring Boot REST API |
| **db** | 5432 | PostgreSQL database |
| **redis** | 6379 | Redis cache |
| **frontend** | 4200 | Angular frontend (nginx) |
| **kong** | 8000, 8001, 8002 | Kong API Gateway |
| **kong-db** | - | PostgreSQL para Kong |

---

## Inicio Rápido

### 1. Levantar Stack Completo

```bash
# Construir y levantar todos los servicios
docker compose up -d --build

# Ver logs
docker compose logs -f

# Ver estado de servicios
docker compose ps
```

### 2. Configurar Kong Gateway (REQUERIDO en primer inicio)

```bash
# Crear Service
curl -X POST http://localhost:8001/services \
  --data name=springboot-api \
  --data url=http://app:8080

# Crear Route
curl -X POST http://localhost:8001/services/springboot-api/routes \
  --data "paths[]=/api" \
  --data "name=api-route" \
  --data "strip_path=false"

# Habilitar CORS
curl -X POST http://localhost:8001/services/springboot-api/plugins \
  --data "name=cors" \
  --data "config.origins=http://localhost:4200" \
  --data "config.methods[]=GET" \
  --data "config.methods[]=POST" \
  --data "config.methods[]=PUT" \
  --data "config.methods[]=DELETE" \
  --data "config.methods[]=OPTIONS" \
  --data "config.headers[]=Accept" \
  --data "config.headers[]=Content-Type" \
  --data "config.credentials=true"
```

### 3. Acceder a la Aplicación

- **Frontend Angular**: http://localhost:4200
- **Kong API Gateway**: http://localhost:8000/api/users
- **Kong Admin API**: http://localhost:8001
- **Kong Manager OSS**: http://localhost:8002
- **Spring Boot directo**: http://localhost:8080/api/users

---

## Endpoints Disponibles

### API Endpoints

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/` | Página de bienvenida |
| GET | `/api/greeting` | Mensaje de saludo con timestamp |
| GET | `/api/info` | Información de la aplicación |
| GET | `/api/users` | Listar todos los usuarios (con cache) |
| GET | `/api/users/{id}` | Obtener usuario por ID (con cache) |
| POST | `/api/users` | Crear nuevo usuario (invalida cache) |
| PUT | `/api/users/{id}` | Actualizar usuario (invalida cache) |
| DELETE | `/api/users/{id}` | Eliminar usuario (invalida cache) |

### Actuator Endpoints

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/actuator/health` | Health check de la aplicación |
| GET | `/actuator/info` | Metadata de la aplicación |

---

## Uso de la Aplicación

### Probar API via Kong Gateway

```bash
# Crear usuario
curl -X POST http://localhost:8000/api/users \
  -H "Content-Type: application/json" \
  -d '{"nombre": "Juan Pérez", "email": "juan@example.com"}'

# Listar usuarios (Cache MISS en primera vez)
curl http://localhost:8000/api/users

# Listar usuarios (Cache HIT en segunda vez)
curl http://localhost:8000/api/users

# Obtener usuario por ID
curl http://localhost:8000/api/users/1

# Actualizar usuario
curl -X PUT http://localhost:8000/api/users/1 \
  -H "Content-Type: application/json" \
  -d '{"nombre": "Juan Pérez Updated", "email": "juan.updated@example.com"}'

# Eliminar usuario
curl -X DELETE http://localhost:8000/api/users/1
```

### Conectarse a PostgreSQL

```bash
# Desde el host
docker compose exec db psql -U curso -d apidb

# Dentro de psql
\dt                           # Listar tablas
SELECT * FROM users;          # Ver usuarios
\q                            # Salir
```

### Verificar Cache en Logs

```bash
# Ver logs del backend para confirmar cache
docker compose logs -f app | grep Cache

# Salida esperada:
# Cache MISS: Consultando base de datos (primera vez)
# (sin logs en segunda consulta = Cache HIT)
# Cache EVICT: Invalidando cache (al crear/actualizar/eliminar)
```

---

## Cache con Redis

La aplicación implementa cache-aside pattern con Spring Cache:

- **GET /api/users**: Lista cacheada por 60 segundos
- **GET /api/users/{id}**: Usuario individual cacheado
- **POST/PUT/DELETE**: Invalidan cache automáticamente

---

## Kong API Gateway

- **Puerto 8000**: Proxy público (usado por frontend y clientes)
- **Puerto 8001**: Admin API (configuración)
- **Puerto 8002**: Kong Manager OSS (interfaz web)

**Nota:** La configuración inicial de Kong (service, route, CORS) es **requerida** en el primer inicio.

---

## Frontend Angular

Interfaz web completa con CRUD de usuarios:

- **URL**: http://localhost:4200
- **Features**:
  - Listado de usuarios
  - Crear nuevo usuario
  - Eliminar usuario
  - Mensajes de error/éxito
  - Enlaces a documentación de arquitectura

**Nota**: El frontend consume la API a través de Kong (:8000), no directamente desde Spring Boot (:8080).

---

## Limpieza

```bash
# Detener servicios (mantiene volúmenes)
docker compose down

# Detener y eliminar volúmenes (CUIDADO: elimina datos)
docker compose down -v
```

---

## Recursos

- [Spring Boot Documentation](https://docs.spring.io/spring-boot/docs/current/reference/html/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Kong Gateway Documentation](https://docs.konghq.com/)
- [Angular Documentation](https://angular.io/docs)

---

**Versión:** 1.3.0
**Autor:** Alejandro Fiengo (alefiengo)
**Curso:** Docker & Kubernetes - iQuattro
