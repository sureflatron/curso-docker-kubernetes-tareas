# Arquitectura - Proyecto Integrador v2.0

Este documento describe la arquitectura técnica del Proyecto Integrador, incluyendo diagramas de componentes, flujos de datos, decisiones de diseño y el patrón BFF (Backend-for-Frontend) implementado.

---

## Visión General del Sistema

El Proyecto Integrador es una aplicación full-stack que implementa un patrón de microservicios con API Gateway, cache distribuido y frontend desacoplado.

### Stack Tecnológico

- **Frontend**: Angular 17 + Nginx (con BFF pattern)
- **API Gateway**: Kong 3.4 (Docker Compose) / NGINX Ingress (Kubernetes)
- **Backend**: Spring Boot 3.5.6 (Java 17)
- **Cache**: Redis 7
- **Base de Datos**: PostgreSQL 15
- **Containerización**: Docker + Docker Compose + Kubernetes

---

## Diagrama de Arquitectura

```mermaid
graph TB
    subgraph "Cliente"
        Browser[Navegador Web]
    end

    subgraph "Capa de Presentación"
        Angular[Angular Frontend<br/>:4200<br/>nginx:alpine]
    end

    subgraph "API Gateway"
        Kong[Kong Gateway<br/>:8000 Proxy<br/>:8001 Admin<br/>:8002 Manager]
    end

    subgraph "Capa de Aplicación"
        App[Spring Boot API<br/>:8080<br/>Java 17 JRE Alpine]
    end

    subgraph "Capa de Datos"
        Redis[(Redis Cache<br/>:6379<br/>TTL: 60s)]
        DB[(PostgreSQL<br/>:5432<br/>apidb)]
    end

    subgraph "Infraestructura Kong"
        KongDB[(Kong Database<br/>PostgreSQL)]
    end

    Browser -->|HTTP| Angular
    Angular -->|REST API| Kong
    Kong -->|Routing| App
    App -->|Cache Check| Redis
    App -->|Persist| DB
    Kong -.->|Config| KongDB

    style Browser fill:#e1f5ff
    style Angular fill:#b3e5fc
    style Kong fill:#81d4fa
    style App fill:#4fc3f7
    style Redis fill:#ffe0b2
    style DB fill:#ffb74d
    style KongDB fill:#ffcc80
```

---

## Diagrama de Contenedores Docker

```mermaid
graph TB
    subgraph Network["Docker Network: app-network"]
        subgraph Frontend_Layer["Frontend Layer"]
            FE[angular-frontend<br/>Image: custom<br/>Port: 4200:80]
        end

        subgraph Gateway_Layer["Gateway Layer"]
            KONG[kong-gateway<br/>Image: kong:3.4<br/>Ports: 8000,8001,8002]
            KONGDB[(kong-postgres<br/>Image: postgres:15-alpine<br/>Internal)]
        end

        subgraph App_Layer["Application Layer"]
            APP[springboot-api<br/>Image: custom<br/>Port: 8080]
        end

        subgraph Data_Layer["Data Layer"]
            REDIS[(redis-cache<br/>Image: redis:7-alpine<br/>Port: 6379)]
            POSTGRES[(postgres-db<br/>Image: postgres:15-alpine<br/>Port: 5432)]
        end
    end

    FE -.->|depends_on| KONG
    APP -.->|depends_on| REDIS
    APP -.->|depends_on| POSTGRES
    KONG -.->|depends_on| KONGDB

    FE -->|HTTP| KONG
    KONG -->|Proxy| APP
    APP -->|Cache| REDIS
    APP -->|Persist| POSTGRES

    style FE fill:#b3e5fc
    style KONG fill:#81d4fa
    style APP fill:#4fc3f7
    style REDIS fill:#ffe0b2
    style POSTGRES fill:#ffb74d
    style KONGDB fill:#ffcc80
```

---

## Flujo de Datos - Operación GET con Cache

```mermaid
sequenceDiagram
    participant C as Cliente<br/>(Browser)
    participant F as Angular<br/>Frontend
    participant K as Kong<br/>Gateway
    participant A as Spring Boot<br/>API
    participant R as Redis<br/>Cache
    participant D as PostgreSQL<br/>Database

    C->>F: GET /users
    F->>K: GET /api/users
    K->>A: Forward request

    A->>R: GET users:all

    alt Cache HIT
        R-->>A: Return cached data
        Note over A,R: Cache válido (< 60s)
        A-->>K: 200 OK + JSON
        Note over A: Log: Cache HIT
    else Cache MISS
        R-->>A: null (no existe)
        A->>D: SELECT * FROM users
        D-->>A: ResultSet
        A->>R: SETEX users:all 60 [data]
        Note over R: TTL: 60 segundos
        A-->>K: 200 OK + JSON
        Note over A: Log: Cache MISS
    end

    K-->>F: 200 OK + JSON
    F-->>C: Render users list
```

---

## Flujo de Datos - Operación POST (Invalidación de Cache)

```mermaid
sequenceDiagram
    participant C as Cliente<br/>(Browser)
    participant F as Angular<br/>Frontend
    participant K as Kong<br/>Gateway
    participant A as Spring Boot<br/>API
    participant R as Redis<br/>Cache
    participant D as PostgreSQL<br/>Database

    C->>F: Submit new user
    F->>K: POST /api/users<br/>{nombre, email}
    K->>A: Forward request

    A->>D: INSERT INTO users...
    D-->>A: User created (ID)

    A->>R: DEL users:all
    Note over A,R: Invalidar cache
    R-->>A: OK

    A-->>K: 201 Created + JSON
    Note over A: Log: Cache EVICT
    K-->>F: 201 Created + JSON
    F-->>C: Show success message
```

---

## Arquitectura Multi-Stage Build

```mermaid
graph LR
    subgraph "Stage 1: Build (Maven)"
        M1[maven:3.9.6-alpine]
        M2[Copy pom.xml]
        M3[mvn dependency]
        M4[Copy src/]
        M5[mvn package]
        M6[target/*.jar]

        M1 --> M2
        M2 --> M3
        M3 --> M4
        M4 --> M5
        M5 --> M6
    end

    subgraph "Stage 2: Runtime (JRE)"
        R1[eclipse-temurin:17-jre-alpine]
        R2[Create non-root user]
        R3[COPY --from=build]
        R4[Set JAVA_OPTS]
        R5[HEALTHCHECK]
        R6[Final Image<br/>~200MB]

        R1 --> R2
        R2 --> R3
        R3 --> R4
        R4 --> R5
        R5 --> R6
    end

    M6 -.->|Copy JAR only| R3

    style M1 fill:#f9f,stroke:#333
    style M6 fill:#fcf,stroke:#333
    style R1 fill:#9f9,stroke:#333
    style R6 fill:#6f6,stroke:#333,stroke-width:3px
```

**Beneficios:**
- Stage 1 (~800MB): Descartado después del build
- Stage 2 (~200MB): Imagen final optimizada
- Reducción: **75% del tamaño**

---

## Capas de la Imagen Docker

```mermaid
graph TB
    subgraph "Imagen Final: springboot-api:1.3"
        L1[Base: eclipse-temurin:17-jre-alpine<br/>~150MB]
        L2[Sistema: adduser + permisos<br/>~5MB]
        L3[Aplicación: app.jar<br/>~45MB]
        L4[Metadata: LABELS + ENV<br/>< 1MB]
        L5[Health Check: wget config<br/>< 1MB]

        L1 --> L2
        L2 --> L3
        L3 --> L4
        L4 --> L5
    end

    style L1 fill:#e3f2fd
    style L2 fill:#bbdefb
    style L3 fill:#90caf9
    style L4 fill:#64b5f6
    style L5 fill:#42a5f5
```

---

## Red Docker: app-network

```mermaid
graph TB
    subgraph "Docker Network: app-network (bridge)"
        subgraph "DNS Interno"
            DNS[Docker DNS<br/>Name Resolution]
        end

        APP[springboot-api]
        FE[angular-frontend]
        KONG[kong-gateway]
        DB[postgres-db]
        REDIS[redis-cache]
        KONGDB[kong-postgres]

        APP -.->|Resolve: db| DNS
        APP -.->|Resolve: redis| DNS
        KONG -.->|Resolve: app| DNS
        KONG -.->|Resolve: kong-db| DNS

        APP -->|jdbc:postgresql://db:5432| DB
        APP -->|redis://redis:6379| REDIS
        KONG -->|http://app:8080| APP
        FE -->|http://kong:8000| KONG
    end

    Host[Host Network<br/>Mapped Ports]

    Host -->|8080| APP
    Host -->|4200| FE
    Host -->|8000,8001,8002| KONG
    Host -->|5432| DB
    Host -->|6379| REDIS

    style DNS fill:#fff9c4
    style Host fill:#f3e5f5
```

**Características:**
- DNS automático por nombre de container
- Comunicación interna sin exponer puertos
- Aislamiento de red completo

---

## Volúmenes Persistentes

```mermaid
graph LR
    subgraph "Docker Host"
        subgraph "Named Volumes"
            V1[postgres-data]
            V2[redis-data]
            V3[kong-data]
        end

        subgraph "Containers"
            C1[postgres-db]
            C2[redis-cache]
            C3[kong-postgres]
        end

        V1 -.->|Mount| C1
        V2 -.->|Mount| C2
        V3 -.->|Mount| C3

        C1 -->|/var/lib/postgresql/data| V1
        C2 -->|/data| V2
        C3 -->|/var/lib/postgresql/data| V3
    end

    style V1 fill:#ffccbc
    style V2 fill:#ffe0b2
    style V3 fill:#fff9c4
```

**Persistencia:**
- `postgres-data`: Base de datos principal (apidb)
- `redis-data`: Cache AOF (Append-Only File)
- `kong-data`: Configuración de Kong

---

## Seguridad: Capas de Protección

```mermaid
graph TB
    subgraph "Modelo de Seguridad"
        L1[1. Network Isolation<br/>app-network aislada]
        L2[2. API Gateway<br/>Kong + CORS + Rate Limiting]
        L3[3. Non-Root User<br/>spring:1001]
        L4[4. Health Checks<br/>Actuator endpoints]
        L5[5. Imagen Alpine<br/>Superficie mínima]
        L6[6. Vulnerability Scanning<br/>Trivy CVE detection]

        L1 --> L2
        L2 --> L3
        L3 --> L4
        L4 --> L5
        L5 --> L6
    end

    style L1 fill:#c8e6c9
    style L2 fill:#a5d6a7
    style L3 fill:#81c784
    style L4 fill:#66bb6a
    style L5 fill:#4caf50
    style L6 fill:#388e3c
```

---

## Proceso de Inicialización

```mermaid
sequenceDiagram
    participant DC as docker compose up
    participant Net as app-network
    participant KDB as kong-postgres
    participant KB as kong-bootstrap
    participant K as kong-gateway
    participant DB as postgres-db
    participant R as redis-cache
    participant A as springboot-api
    participant F as angular-frontend

    DC->>Net: Create network

    par Databases
        DC->>KDB: Start
        DC->>DB: Start
        DC->>R: Start
    end

    Note over KDB: Wait for health check
    KDB-->>KB: Healthy

    DC->>KB: Start (migrations)
    KB->>KDB: Bootstrap Kong schema
    Note over KB: Exit 0

    KB-->>K: Migrations completed
    DC->>K: Start

    par Application Layer
        DC->>A: Start
        Note over A: Wait for DB + Redis
        A->>DB: Test connection
        A->>R: Test connection
    end

    K-->>F: Gateway ready
    DC->>F: Start

    Note over F: All services healthy
```

---

## Endpoints y Responsabilidades

| Servicio | Puerto | Responsabilidad | Health Check |
|----------|--------|-----------------|--------------|
| **angular-frontend** | 4200 | Interfaz de usuario, presentación | nginx health |
| **kong-gateway** | 8000 | Proxy público (entrada principal) | kong health |
| **kong-gateway** | 8001 | Admin API (configuración) | - |
| **kong-gateway** | 8002 | Kong Manager OSS (UI admin) | - |
| **springboot-api** | 8080 | Lógica de negocio, CRUD | /actuator/health |
| **postgres-db** | 5432 | Persistencia de datos | pg_isready |
| **redis-cache** | 6379 | Cache de consultas (TTL: 60s) | redis-cli ping |
| **kong-postgres** | 5432 | Configuración de Kong | pg_isready |

---

## Patrones de Diseño Implementados

### 1. API Gateway Pattern
- **Implementación**: Kong Gateway
- **Beneficio**: Punto único de entrada, CORS, rate limiting, logging centralizado

### 2. Cache-Aside Pattern
- **Implementación**: Spring Cache + Redis
- **Flujo**:
  1. Check cache
  2. If miss → query DB + store in cache
  3. If hit → return from cache

### 3. Multi-Stage Build Pattern
- **Implementación**: Dockerfile con 2 stages
- **Beneficio**: Imágenes pequeñas, seguras y rápidas

### 4. Health Check Pattern
- **Implementación**: Spring Actuator + Docker HEALTHCHECK
- **Beneficio**: Auto-healing, monitoring

### 5. Service Mesh (Light)
- **Implementación**: Docker Compose + custom network
- **Beneficio**: Service discovery, DNS interno

### 6. Backend-for-Frontend (BFF) Pattern
- **Implementación**: nginx como proxy dentro del contenedor frontend
- **Beneficio**: Comunicación DNS interna, configuración por entorno, arquitectura pedagogicamente correcta

---

## Patrón BFF (Backend-for-Frontend)

El frontend implementa el patrón **Backend-for-Frontend (BFF)** usando nginx como capa proxy para comunicarse con el backend mediante DNS interno.

### Motivación

Las aplicaciones Angular (SPAs) se ejecutan en el navegador del usuario, no dentro del contenedor. Esto presenta un desafío arquitectónico:

**Problema:**
- El código Angular se ejecuta en el navegador (cliente)
- El navegador NO puede resolver DNS internos de Docker/Kubernetes
- Hardcodear URLs (`http://localhost:8000`) solo funciona en desarrollo local
- `window.location.origin` funciona pero no demuestra la potencia del DNS interno

**Solución - BFF Pattern:**
- nginx dentro del contenedor frontend actúa como proxy
- El código Angular llama a rutas relativas (`/api/users`)
- nginx recibe la petición y la reenvía al backend usando DNS interno
- Configuración por entorno mediante variables de entorno

### Arquitectura BFF

```mermaid
graph TB
    subgraph "Browser (Cliente)"
        Angular[Angular App<br/>Ejecutándose en navegador]
    end

    subgraph "Container: Frontend"
        Nginx[nginx BFF Proxy<br/>Puerto 80]
        Static[Static Files<br/>/usr/share/nginx/html]
    end

    subgraph "Docker Compose"
        Kong[Kong Gateway<br/>kong:8000]
    end

    subgraph "Kubernetes"
        ApiService[api-service<br/>DNS interno]
    end

    Angular -->|"GET /api/users<br/>(ruta relativa)"| Nginx
    Nginx -->|"Sirve"| Static
    Nginx -->|"proxy_pass<br/>$API_BACKEND_URL"| Kong
    Nginx -.->|"En K8s"| ApiService

    style Angular fill:#e1f5fe
    style Nginx fill:#4fc3f7
    style Kong fill:#81d4fa
    style ApiService fill:#81d4fa
```

### Flujo de Comunicación

**Docker Compose:**
```
Browser → http://localhost:4200/api/users
  ↓
nginx BFF (dentro del contenedor frontend)
  ↓
proxy_pass → http://kong:8000/api/users (DNS interno)
  ↓
Kong Gateway → http://app:8080/api/users (DNS interno)
  ↓
Spring Boot API
```

**Kubernetes:**
```
Browser → http://<ingress-ip>/api/users
  ↓
Ingress Controller → frontend-service
  ↓
nginx BFF (dentro del pod frontend)
  ↓
proxy_pass → http://api-service.proyecto-integrador.svc.cluster.local:8080/api/users (DNS interno)
  ↓
Spring Boot API
```

### Configuración BFF

**nginx.conf.template:**
```nginx
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    # Frontend SPA (Angular)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # BFF Proxy: /api → Backend
    location /api {
        proxy_pass ${API_BACKEND_URL};
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # BFF Proxy: /actuator → Backend health
    location /actuator {
        proxy_pass ${API_BACKEND_URL};
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
}
```

**Dockerfile (envsubst para variables):**
```dockerfile
FROM nginx:1.25-alpine
RUN apk add --no-cache gettext

COPY nginx.conf.template /etc/nginx/templates/default.conf.template
ENV API_BACKEND_URL=http://localhost:8000

CMD ["/bin/sh", "-c", "envsubst '${API_BACKEND_URL}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
```

**docker-compose.yml:**
```yaml
frontend:
  environment:
    - API_BACKEND_URL=http://kong:8000
```

**Kubernetes ConfigMap:**
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: frontend-config
data:
  API_BACKEND_URL: "http://api-service.proyecto-integrador.svc.cluster.local:8080"
```

### Ventajas del Patrón BFF

| Aspecto | Sin BFF (hardcoded) | Con BFF |
|---------|---------------------|---------|
| **Comunicación** | `http://localhost:8000` | DNS interno (`kong:8000`, `api-service`) |
| **Portabilidad** | Solo funciona en local | Funciona en Docker Compose y K8s |
| **Configuración** | Hardcoded en código TS | Variable de entorno |
| **Seguridad** | Expone URLs internas | URLs internas ocultas |
| **Pedagógico** | No demuestra DNS | Demuestra DNS interno correctamente |
| **12-Factor App** | No cumple | Cumple (configuración externa) |

### Comparación con Otras Soluciones

**Opción A: window.location.origin (descartada)**
```typescript
// ❌ Funciona pero no es pedagógicamente correcto
private apiUrl = `${window.location.origin}/api/users`;
```
- Funciona en ambos entornos
- NO demuestra comunicación DNS interna
- NO enseña el patrón BFF

**Opción B: BFF Pattern (implementada)**
```typescript
// ✅ Pedagógicamente correcto
private apiUrl = '/api/users';  // Ruta relativa
```
- nginx BFF maneja el routing
- Comunicación DNS interna (enseñanza clave)
- Configuración por entorno
- Patrón profesional de microservicios

### Limitaciones de SPAs

Es importante entender por qué las SPAs no pueden usar DNS interno directamente:

**Backend → Backend (Java → PostgreSQL):**
```java
// ✅ Funciona: Se ejecuta DENTRO del contenedor
jdbc:postgresql://postgres-0.postgres-headless:5432/apidb
```

**Frontend → Backend (Angular → API):**
```typescript
// ❌ NO funciona: Angular se ejecuta en el NAVEGADOR del usuario
http://api-service.proyecto-integrador.svc.cluster.local:8080/api/users

// ✅ Funciona: Ruta relativa, nginx BFF hace el proxy
/api/users
```

**El navegador del usuario:**
- No está dentro del cluster de Docker/Kubernetes
- No tiene acceso al DNS interno
- Solo puede resolver DNS públicos

---

## Arquitectura Kubernetes (v2.0)

### Diagrama de Recursos Kubernetes

```mermaid
graph TB
    subgraph "Namespace: proyecto-integrador"
        subgraph "Ingress Layer"
            ING[Ingress<br/>app-ingress<br/>Path-based routing]
        end

        subgraph "Frontend Layer"
            FESVC[Service: frontend-service<br/>ClusterIP]
            FEDEP[Deployment: frontend<br/>replicas: 2]
            FEPOD1[Pod: frontend-xxx<br/>nginx + Angular]
            FEPOD2[Pod: frontend-yyy<br/>nginx + Angular]
            FECM[ConfigMap: frontend-config<br/>API_BACKEND_URL]
        end

        subgraph "Backend Layer"
            APISVC[Service: api-service<br/>ClusterIP :8080]
            APIDEP[Deployment: api<br/>replicas: 2-5]
            APIPOD1[Pod: api-xxx<br/>Spring Boot]
            APIPOD2[Pod: api-yyy<br/>Spring Boot]
            APIHPA[HPA: api-hpa<br/>min:2 max:5<br/>CPU: 70%]
            APICM[ConfigMap: api-config<br/>DB, Redis config]
        end

        subgraph "Data Layer"
            PGSVC[Service: postgres-headless<br/>Headless]
            PGSTS[StatefulSet: postgres<br/>replicas: 1]
            PGPOD[Pod: postgres-0<br/>PostgreSQL 15]
            PGPVC[PVC: postgres-data-postgres-0<br/>1Gi]
            PGSEC[Secret: postgres-secret<br/>credentials]

            RDSVC[Service: redis-service<br/>ClusterIP :6379]
            RDDEP[Deployment: redis<br/>replicas: 1]
            RDPOD[Pod: redis-xxx<br/>Redis 7]
        end

        ING --> FESVC
        ING --> APISVC

        FESVC --> FEDEP
        FEDEP --> FEPOD1
        FEDEP --> FEPOD2
        FECM -.->|env| FEDEP

        APISVC --> APIDEP
        APIDEP --> APIPOD1
        APIDEP --> APIPOD2
        APIHPA -.->|scale| APIDEP
        APICM -.->|env| APIDEP
        PGSEC -.->|env| APIDEP

        FEPOD1 -->|DNS: api-service| APISVC
        FEPOD2 -->|DNS: api-service| APISVC

        APIPOD1 --> PGSVC
        APIPOD1 --> RDSVC
        APIPOD2 --> PGSVC
        APIPOD2 --> RDSVC

        PGSVC --> PGSTS
        PGSTS --> PGPOD
        PGPOD --> PGPVC

        RDSVC --> RDDEP
        RDDEP --> RDPOD
    end

    subgraph "Namespace: ingress-nginx"
        INGCTRL[Ingress Controller<br/>nginx-ingress-controller<br/>Port: 80, 443]
    end

    INGCTRL -->|routes| ING

    User[Usuario] -->|HTTP| INGCTRL

    style User fill:#e1f5ff
    style ING fill:#fff9c4
    style FESVC fill:#b3e5fc
    style APISVC fill:#81d4fa
    style FEDEP fill:#b3e5fc
    style APIDEP fill:#4fc3f7
    style PGSTS fill:#ffb74d
    style RDDEP fill:#ffe0b2
    style APIHPA fill:#a5d6a7
    style FECM fill:#fff9c4
    style APICM fill:#fff9c4
    style PGSEC fill:#ffccbc
```

---

### Flujo de Comunicación en Kubernetes

```mermaid
sequenceDiagram
    participant U as Usuario<br/>(Browser)
    participant I as Ingress<br/>Controller
    participant FS as frontend-service<br/>(ClusterIP)
    participant FP as Frontend Pod<br/>(nginx BFF)
    participant AS as api-service<br/>(ClusterIP)
    participant AP as API Pod<br/>(Spring Boot)
    participant RS as redis-service
    participant R as Redis Pod
    participant PS as postgres-headless
    participant PG as PostgreSQL Pod

    U->>I: GET /
    I->>FS: Route to frontend
    FS->>FP: Forward
    FP-->>U: HTML + JS

    U->>I: GET /api/users
    I->>FS: Route to frontend
    FS->>FP: Forward
    Note over FP: nginx BFF proxy

    FP->>AS: DNS: api-service.proyecto-integrador:8080/api/users
    AS->>AP: Load balance

    AP->>RS: DNS: redis-service:6379
    RS->>R: Forward
    R-->>AP: Cache MISS

    AP->>PS: DNS: postgres-0.postgres-headless:5432
    PS->>PG: Direct to pod
    PG-->>AP: User data

    AP->>RS: Cache SET
    AP-->>AS: Response
    AS-->>FP: Response
    FP-->>I: Response
    I-->>U: JSON data
```

---

### Comparación: Docker Compose vs Kubernetes

| Aspecto | Docker Compose (v1.3) | Kubernetes (v2.0) |
|---------|----------------------|-------------------|
| **API Gateway** | Kong (8000, 8001, 8002) | NGINX Ingress (80, 443) |
| **Frontend** | 1 container | Deployment (2 pods) |
| **Backend** | 1 container | Deployment (2-5 pods con HPA) |
| **PostgreSQL** | 1 container | StatefulSet (1 pod) |
| **Redis** | 1 container | Deployment (1 pod) |
| **Networking** | Bridge network (DNS interno) | Services (ClusterIP + DNS) |
| **Config** | Environment vars en compose | ConfigMaps + Secrets |
| **Persistencia** | Named volumes | PersistentVolumeClaims |
| **Escalado** | Manual (`docker compose up --scale`) | Automático (HPA) |
| **Health Checks** | Docker HEALTHCHECK | Liveness/Readiness/Startup Probes |
| **BFF Pattern** | nginx proxy (API_BACKEND_URL=kong:8000) | nginx proxy (API_BACKEND_URL=api-service:8080) |
| **Acceso externo** | Port mapping (4200, 8000, 8080) | Ingress (path-based routing) |

---

### Patrón BFF en Kubernetes

```mermaid
graph LR
    subgraph "Browser"
        B[Angular App]
    end

    subgraph "Pod: Frontend"
        N[nginx BFF<br/>:80]
        S[Static Files]
    end

    subgraph "DNS K8s"
        D[CoreDNS<br/>Service Discovery]
    end

    subgraph "Backend"
        API[api-service<br/>ClusterIP<br/>10.96.x.x:8080]
        P1[api-pod-1]
        P2[api-pod-2]
    end

    B -->|GET /api/users| N
    N -->|Resolve| D
    D -->|api-service.proyecto-integrador.svc.cluster.local| API
    API -->|Load balance| P1
    API -->|Load balance| P2

    style B fill:#e1f5fe
    style N fill:#4fc3f7
    style D fill:#fff9c4
    style API fill:#81d4fa
    style P1 fill:#4fc3f7
    style P2 fill:#4fc3f7
```

**ConfigMap frontend-config:**
```yaml
data:
  API_BACKEND_URL: "http://api-service.proyecto-integrador.svc.cluster.local:8080"
```

**Ventajas en K8s:**
- DNS interno automático
- Service discovery nativo
- Load balancing automático entre pods
- ConfigMap para configuración por entorno

---

### DNS en Kubernetes

```mermaid
graph TB
    subgraph "Pod: api-xxx"
        APP[Spring Boot<br/>Application]
    end

    subgraph "CoreDNS (kube-system)"
        DNS[DNS Server<br/>Service Discovery]
    end

    subgraph "Services"
        PGSVC[postgres-headless<br/>10.96.x.1:5432]
        RDSVC[redis-service<br/>10.96.x.2:6379]
        APISVC[api-service<br/>10.96.x.3:8080]
    end

    subgraph "Pods"
        PG[postgres-0]
        RD[redis-xxx]
        API2[api-yyy]
    end

    APP -->|1. Resolve postgres-headless| DNS
    DNS -->|2. Return 10.96.x.1| APP
    APP -->|3. Connect to 10.96.x.1:5432| PGSVC
    PGSVC -->|4. Forward| PG

    APP -->|Resolve redis-service| DNS
    DNS -->|Return ClusterIP| APP
    APP -->|Connect| RDSVC
    RDSVC -->|Forward| RD

    style DNS fill:#fff9c4
    style APP fill:#4fc3f7
    style PGSVC fill:#ffb74d
    style RDSVC fill:#ffe0b2
```

**DNS Names:**
- Short: `redis-service` (same namespace)
- FQDN: `redis-service.proyecto-integrador.svc.cluster.local`
- Headless: `postgres-0.postgres-headless.proyecto-integrador.svc.cluster.local`

---

### Health Probes en Acción

```mermaid
sequenceDiagram
    participant K as Kubelet
    participant P as Pod (api)
    participant A as App (Spring Boot)
    participant S as Service (api-service)

    Note over K,A: Startup Phase
    K->>P: startupProbe GET /actuator/health/liveness
    P->>A: Check
    A-->>P: 503 (still starting)
    P-->>K: Not ready
    Note over K: Wait 5s, retry

    K->>P: startupProbe
    P->>A: Check
    A-->>P: 200 OK
    P-->>K: Ready
    Note over K: Startup complete

    Note over K,S: Running Phase
    loop Every 10s
        K->>P: livenessProbe
        P->>A: Check /actuator/health/liveness
        A-->>K: 200 OK (alive)
    end

    loop Every 5s
        K->>P: readinessProbe
        P->>A: Check /actuator/health/readiness
        A-->>K: 200 OK (ready)
        K->>S: Include in endpoints
    end

    Note over A: Database down
    K->>P: readinessProbe
    P->>A: Check
    A-->>K: 503 (not ready)
    K->>S: Remove from endpoints
    Note over S: No traffic to this pod

    Note over A: Database recovered
    K->>P: readinessProbe
    A-->>K: 200 OK
    K->>S: Add back to endpoints
```

---

### HPA (Horizontal Pod Autoscaler) en Acción

```mermaid
graph TB
    subgraph "Metrics Collection"
        MS[Metrics Server<br/>kube-system]
        MS -->|Collect every 15s| PODS
    end

    subgraph "HPA Controller"
        HPA[HPA: api-hpa<br/>target: 70% CPU<br/>min: 2, max: 5]
    end

    subgraph "Deployment"
        DEP[Deployment: api<br/>replicas: ?]
    end

    subgraph "Pods"
        PODS[api pods<br/>CPU usage]
    end

    MS -->|Provide metrics| HPA
    HPA -->|Calculate desired replicas| HPA
    HPA -->|Scale| DEP
    DEP -->|Create/Delete| PODS

    style MS fill:#a5d6a7
    style HPA fill:#81c784
    style DEP fill:#4fc3f7
    style PODS fill:#90caf9
```

**Cálculo de réplicas:**
```
desiredReplicas = ceil(currentReplicas * (currentMetric / targetMetric))

Ejemplo:
- currentReplicas: 2
- currentCPU: 140% (promedio)
- targetCPU: 70%
- desiredReplicas = ceil(2 * (140 / 70)) = ceil(4) = 4 pods
```

---

### Arquitectura de Networking

```mermaid
graph TB
    subgraph "External World"
        USER[Usuario<br/>Browser]
    end

    subgraph "Kubernetes Cluster"
        subgraph "Ingress Namespace"
            INGCTRL[Ingress Controller<br/>NodePort: 32228/32387]
        end

        subgraph "proyecto-integrador Namespace"
            ING[Ingress Resource<br/>app-ingress]

            subgraph "ClusterIP Services"
                FESVC[frontend-service<br/>10.96.x.1:80]
                APISVC[api-service<br/>10.96.x.2:8080]
                RDSVC[redis-service<br/>10.96.x.3:6379]
            end

            subgraph "Headless Service"
                PGSVC[postgres-headless<br/>None (no ClusterIP)]
            end

            subgraph "Pods"
                FE[frontend pods]
                API[api pods]
                PG[postgres-0<br/>Pod IP: 10.244.x.x]
                RD[redis pod]
            end
        end
    end

    USER -->|HTTP :80| INGCTRL
    INGCTRL -->|Routing rules| ING
    ING -.->|/ → frontend| FESVC
    ING -.->|/api → backend| APISVC

    FESVC -->|Round-robin| FE
    APISVC -->|Round-robin| API
    RDSVC -->|Forward| RD
    PGSVC -.->|Direct DNS to Pod IP| PG

    FE -->|BFF proxy| APISVC
    API --> RDSVC
    API --> PGSVC

    style USER fill:#e1f5ff
    style INGCTRL fill:#fff9c4
    style ING fill:#fff3cd
    style FESVC fill:#b3e5fc
    style APISVC fill:#81d4fa
    style PGSVC fill:#ffb74d
    style PG fill:#ff9800
```

---

## Evolución de Arquitectura

```mermaid
graph LR
    V10[v1.0<br/>Monolito<br/>In-Memory] --> V11[v1.1<br/>+ PostgreSQL<br/>Persistencia]
    V11 --> V12[v1.2<br/>+ Redis + Kong<br/>+ Angular]
    V12 --> V13[v1.3<br/>+ Seguridad<br/>+ Optimización]
    V13 -.-> V20[v2.0<br/>Kubernetes<br/>Migration]

    style V10 fill:#ffebee
    style V11 fill:#fff9c4
    style V12 fill:#e1f5fe
    style V13 fill:#c8e6c9
    style V20 fill:#f3e5f5
```

---

## Decisiones de Arquitectura

### ¿Por qué Kong y no Nginx?
- Admin API REST (fácil configuración)
- Plugins (CORS, rate limiting, auth)
- Kong Manager OSS (UI visual)
- Preparación para Kubernetes (Kong Ingress)

### ¿Por qué Redis y no Memcached?
- Persistencia (AOF)
- Estructuras de datos avanzadas
- Pub/Sub (futuro)
- Integración nativa con Spring

### ¿Por qué PostgreSQL y no MySQL?
- JSON nativo (extensibilidad futura)
- ACID completo
- Estándar en ecosistema Kong
- Open source sin restricciones

### ¿Por qué Alpine y no Ubuntu?
- Tamaño: 5MB vs 70MB base
- Superficie de ataque mínima
- Menos vulnerabilidades CVE
- Startup más rápido

---

## Métricas de Performance

| Métrica | Valor | Objetivo |
|---------|-------|----------|
| Startup time (cold) | ~15s | < 30s |
| Startup time (warm) | ~5s | < 10s |
| GET /api/users (cache hit) | ~10ms | < 50ms |
| GET /api/users (cache miss) | ~200ms | < 500ms |
| POST /api/users | ~150ms | < 300ms |
| Imagen Docker | ~200MB | < 300MB |
| Memoria (app) | ~400MB | < 512MB |

---

## Referencias

- [Spring Boot Documentation](https://docs.spring.io/spring-boot/)
- [Kong Gateway Documentation](https://docs.konghq.com/gateway/)
- [Redis Cache Docs](https://redis.io/docs/latest/)
- [Docker Multi-Stage Builds](https://docs.docker.com/build/building/multi-stage/)
- [PostgreSQL Best Practices](https://www.postgresql.org/docs/current/index.html)
- [Mermaid](https://mermaid.js.org/)

---

**Autor:** Alejandro Fiengo (alefiengo)
**Versión:** 2.0.0
**Última actualización:** Octubre 2025
