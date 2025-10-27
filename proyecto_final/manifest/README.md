# Proyecto Integrador v2.0 - Kubernetes

**Versión:** v2.0
**Stack:** Spring Boot + PostgreSQL + Redis + Angular
**Objetivo:** Despliegue completo en Kubernetes con ConfigMaps, Secrets, StatefulSets, Ingress y HPA

---

## Documentación

- **[DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)** - Guía completa de despliegue para minikube
- **[DEPLOYMENT_GUIDE_MICROK8S.md](DEPLOYMENT_GUIDE_MICROK8S.md)** - Guía completa de despliegue para microk8s
- **README.md** (este archivo) - Documentación completa con arquitectura, conceptos y validaciones

---

## Características

Esta versión integra **todos los conceptos** de Kubernetes enseñados en las Clases 6, 7 y 8:

### Clase 6 - Introducción a Kubernetes
- **Deployments:** API (2 réplicas), Redis (1 réplica), Frontend (2 réplicas)
- **Services:** ClusterIP para comunicación interna
- **Health Probes:** Liveness, readiness y startup en todos los componentes
- **Resource Requests/Limits:** Definidos en todos los pods

### Clase 7 - Configuración y Persistencia
- **ConfigMaps:** Configuración de la API (DB, Redis, Spring Boot)
- **Secrets:** Credenciales de PostgreSQL
- **StatefulSet:** PostgreSQL con identidad estable (postgres-0)
- **PersistentVolumeClaim:** 1Gi para datos de PostgreSQL
- **Headless Service:** Para acceso estable al StatefulSet

### Clase 8 - Ingress y Escalado
- **Ingress:** Path-based routing (`/` → frontend, `/api` → backend)
- **HPA:** Escalado automático de la API (min=2, max=5, CPU=70%)
- **Metrics Server:** Para métricas de CPU/memoria

---

## Arquitectura

```
┌──────────────────────────────────────────────────────────────┐
│                    Kubernetes Cluster                         │
├──────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌─────────────┐                                              │
│  │   Ingress   │  (NGINX)                                     │
│  │ app-ingress │                                              │
│  └──────┬──────┘                                              │
│         │                                                      │
│    ┌────┴────┐                                                │
│    │         │                                                │
│    ▼         ▼                                                │
│  ┌────┐   ┌────┐        ┌────────────┐   ┌──────────┐       │
│  │ F1 │   │ A1 │◄───────┤ api-config │   │postgres- │       │
│  │ F2 │   │ A2 │        │ (ConfigMap)│   │ secret   │       │
│  └─┬──┘   └─┬──┘        └────────────┘   └────┬─────┘       │
│    │        │                                   │             │
│    │        ├───────────────────────────────────┘             │
│    │        │                                                 │
│    │        ▼                                                 │
│    │     ┌────────┐      ┌──────────────┐                    │
│    │     │postgres│◄─────┤ postgres-    │                    │
│    │     │   -0   │      │ headless     │                    │
│    │     │(StatefulSet)  │(clusterIP:   │                    │
│    │     └───┬────┘      │   None)      │                    │
│    │         │           └──────────────┘                    │
│    │         ▼                                                │
│    │     ┌────────┐                                           │
│    │     │  PVC   │ (1Gi persistent storage)                 │
│    │     └────────┘                                           │
│    │                                                          │
│    │        ▼                                                 │
│    │     ┌────────┐      ┌──────────────┐                    │
│    └────►│ Redis  │◄─────┤redis-service │                    │
│          │  pod   │      │  (ClusterIP) │                    │
│          └────────┘      └──────────────┘                    │
│                                                                │
│  ┌──────────────────────────────────────────────┐            │
│  │         HPA (api-hpa)                         │            │
│  │  - Min: 2 replicas                            │            │
│  │  - Max: 5 replicas                            │            │
│  │  - Target: 70% CPU, 80% Memory                │            │
│  └──────────────────────────────────────────────┘            │
│                                                                │
└──────────────────────────────────────────────────────────────┘

Leyenda:
  F1, F2 = Frontend pods (nginx con Angular)
  A1, A2 = API pods (Spring Boot)
```

---

## Prerrequisitos

### Software necesario
- **minikube** instalado y corriendo
- **kubectl** configurado
- **Docker** (para construir imágenes)

### Verificar instalación

```bash
# Verificar minikube
minikube status

# Verificar kubectl
kubectl version --client
kubectl cluster-info

# Verificar Docker
docker --version
```

---

## Resumen del Flujo Completo de Despliegue

Para desplegar el Proyecto Integrador en Kubernetes desde cero, sigue estos pasos:

1. **Habilitar addons de minikube** (ingress, metrics-server)
2. **Construir imágenes Docker** (backend y frontend)
3. **Publicar en Docker Hub** (RECOMENDADO) o cargar en minikube (solo dev)
4. **Limpiar cluster** (si hay deployment anterior)
5. **Ejecutar script de deployment** (`./deploy.sh`)
6. **Verificar recursos** con `kubectl get all -n proyecto-integrador`
7. **Probar endpoints** via Ingress o port-forward

**Tiempo estimado:** 15-20 minutos (incluye espera de pods y publicación)

**Nota importante:** Todos los recursos se despliegan en el namespace `proyecto-integrador`. Siempre usa el flag `-n proyecto-integrador` en comandos kubectl.

---

## Paso 1: Construir Imágenes Docker

### 1.1 Construir imagen del backend (Spring Boot)

```bash
# Desde el directorio raíz del proyecto integrador
cd /ruta/proyecto-integrador-docker-k8s

# Construir imagen del backend
docker build -t alefiengo/springboot-api:v2.0 .
```

### 1.2 Construir imagen del frontend (Angular)

```bash
# Desde el directorio frontend/
cd frontend
docker build -t alefiengo/angular-frontend:v2.0 .
cd ..
```

### 1.3 Publicar en Docker Hub (RECOMENDADO)

**Este es el método correcto para producción y clusters reales:**

```bash
# Login en Docker Hub
docker login

# Publicar imagen del backend
docker push alefiengo/springboot-api:v2.0

# Publicar imagen del frontend
docker push alefiengo/angular-frontend:v2.0

# Verificar que estén publicadas
# Visitar: https://hub.docker.com/r/alefiengo/springboot-api/tags
# Visitar: https://hub.docker.com/r/alefiengo/angular-frontend/tags
```

**Ventajas:**
- Funciona en cualquier cluster de Kubernetes
- Imágenes disponibles desde cualquier lugar
- Kubernetes pull automático desde Docker Hub
- Método estándar en producción

### 1.4 Alternativo: Cargar imágenes en minikube (Solo desarrollo local)

**Solo usa este método si:**
- No tienes cuenta en Docker Hub
- Estás probando en desarrollo local
- No quieres publicar las imágenes públicamente

```bash
# Cargar imágenes en minikube
minikube image load alefiengo/springboot-api:v2.0
minikube image load alefiengo/angular-frontend:v2.0

# Verificar que estén cargadas
minikube image ls | grep alefiengo
```

**Desventajas:**
- Solo funciona en tu minikube local
- Necesitas recargar las imágenes si reinicias minikube
- No es escalable a clusters reales

---

## Paso 2: Preparar el Cluster

### 2.1 Limpiar deployment anterior (si existe)

**IMPORTANTE:** Si ya desplegaste una versión anterior, límpiala primero:

```bash
# Ver recursos actuales
kubectl get all
kubectl get ingress
kubectl get pvc

# Limpiar todo (si necesario)
kubectl delete deployment --all
kubectl delete service --all
kubectl delete ingress --all
kubectl delete hpa --all
kubectl delete statefulset --all
kubectl delete pvc --all
kubectl delete configmap --all
kubectl delete secret --all

# Verificar que solo quede el service 'kubernetes'
kubectl get all
```

### 2.2 Verificar minikube

```bash
# Verificar que minikube esté corriendo
minikube status

# Si no está corriendo, iniciarlo
minikube start
```

---

## Paso 3: Desplegar en Kubernetes

### Opción A: Deployment automatizado (RECOMENDADO)

```bash
# Desde el directorio k8s/
cd k8s/
chmod +x deploy.sh
./deploy.sh
```

El script `deploy.sh`:
1. Verifica que el cluster esté accesible
2. Habilita NGINX Ingress Controller (si no está habilitado)
3. Habilita Metrics Server (si no está habilitado)
4. **Crea el namespace `proyecto-integrador`**
5. Despliega ConfigMaps y Secrets en el namespace
6. Despliega todos los componentes en orden correcto
7. Espera a que cada componente esté listo antes de continuar
8. Muestra el resumen de recursos desplegados

**Salida esperada del script:**
```
==========================================
Proyecto Integrador - Deployment en K8s
==========================================

✓ Conectado al cluster de Kubernetes
✓ NGINX Ingress Controller está disponible
✓ Metrics Server está disponible

==========================================
Paso 0: Namespace
==========================================
namespace/proyecto-integrador created
✓ Namespace 'proyecto-integrador' creado

[... deployment steps ...]

✓ Deployment finalizado con éxito!
```

### Opción B: Deployment manual paso a paso

```bash
# Desde el directorio k8s/

# 1. Habilitar addons necesarios
minikube addons enable ingress
minikube addons enable metrics-server

# Esperar a que addons estén listos
kubectl wait --for=condition=ready --timeout=60s -n ingress-nginx pod -l app.kubernetes.io/component=controller
kubectl wait --for=condition=ready --timeout=60s -n kube-system pod -l k8s-app=metrics-server

# 2. Crear namespace
kubectl apply -f 00-namespace/

# 3. Aplicar ConfigMaps y Secrets
kubectl apply -f 01-configmaps/
kubectl apply -f 02-secrets/

# 4. Desplegar PostgreSQL (StatefulSet)
kubectl apply -f 04-databases/postgres-headless.yaml
kubectl apply -f 03-storage/postgres-statefulset.yaml

# Esperar a que PostgreSQL esté listo
kubectl wait --for=condition=ready --timeout=120s pod/postgres-0 -n proyecto-integrador

# 5. Desplegar Redis
kubectl apply -f 04-databases/redis-deployment.yaml
kubectl apply -f 04-databases/redis-service.yaml

# Esperar a que Redis esté listo
kubectl wait --for=condition=available --timeout=60s deployment/redis -n proyecto-integrador

# 6. Desplegar Backend (API)
kubectl apply -f 05-backend/api-deployment.yaml
kubectl apply -f 05-backend/api-service.yaml

# Esperar a que API esté lista
kubectl wait --for=condition=available --timeout=180s deployment/api -n proyecto-integrador

# 7. Desplegar Frontend
kubectl apply -f 06-frontend/

# Esperar a que Frontend esté listo
kubectl wait --for=condition=available --timeout=60s deployment/frontend -n proyecto-integrador

# 8. Desplegar Ingress
kubectl apply -f 07-ingress/

# 9. Desplegar HPA
kubectl apply -f 05-backend/api-hpa.yaml
```

**IMPORTANTE:** Todos los recursos se despliegan en el namespace `proyecto-integrador`.

---

## Paso 4: Verificar el Despliegue

### 4.1 Ver el namespace

```bash
# Ver el namespace creado
kubectl get namespaces
kubectl get ns proyecto-integrador

# Salida esperada:
# NAME                  STATUS   AGE
# proyecto-integrador   Active   5m
```

### 4.2 Ver todos los recursos en el namespace

```bash
kubectl get all -n proyecto-integrador

# Salida esperada:
# NAME                            READY   STATUS    RESTARTS   AGE
# pod/api-xxxxx                   1/1     Running   0          3m
# pod/api-yyyyy                   1/1     Running   0          3m
# pod/frontend-xxxxx              1/1     Running   0          2m
# pod/frontend-yyyyy              1/1     Running   0          2m
# pod/postgres-0                  1/1     Running   0          5m
# pod/redis-xxxxx                 1/1     Running   0          4m
#
# NAME                         TYPE        CLUSTER-IP       PORT(S)
# service/api-service          ClusterIP   10.96.123.45     8080/TCP
# service/frontend-service     ClusterIP   10.96.234.56     80/TCP
# service/postgres-headless    ClusterIP   None             5432/TCP
# service/redis-service        ClusterIP   10.96.222.33     6379/TCP
#
# NAME                       READY   UP-TO-DATE   AVAILABLE   AGE
# deployment.apps/api        2/2     2            2           3m
# deployment.apps/frontend   2/2     2            2           2m
# deployment.apps/redis      1/1     1            1           4m
#
# NAME                             READY   AGE
# statefulset.apps/postgres        1/1     5m
```

### 4.3 Ver ConfigMaps y Secrets

```bash
# Ver ConfigMaps
kubectl get configmaps -n proyecto-integrador
kubectl describe configmap api-config -n proyecto-integrador

# Ver Secrets (valores codificados en base64)
kubectl get secrets -n proyecto-integrador
kubectl describe secret postgres-secret -n proyecto-integrador
```

### 4.4 Ver Ingress

```bash
kubectl get ingress -n proyecto-integrador

# Salida esperada:
# NAME          CLASS   HOSTS   ADDRESS         PORTS   AGE
# app-ingress   nginx   *       192.168.49.2    80      2m
```

### 4.5 Ver HPA

```bash
kubectl get hpa -n proyecto-integrador

# Salida esperada:
# NAME      REFERENCE        TARGETS              MINPODS   MAXPODS   REPLICAS   AGE
# api-hpa   Deployment/api   5%/70%, 44%/80%      2         5         2          1m
```

### 4.6 Ver PersistentVolumeClaims

```bash
kubectl get pvc -n proyecto-integrador

# Salida esperada:
# NAME                          STATUS   VOLUME                                     CAPACITY
# postgres-storage-postgres-0   Bound    pvc-xxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx    1Gi
```

### 4.7 Ver logs de la API

```bash
# Ver logs de todos los pods de API
kubectl logs -l app=api --tail=50 -n proyecto-integrador

# Seguir logs en tiempo real
kubectl logs -l app=api -f -n proyecto-integrador

# Ver logs de un pod específico
kubectl logs <nombre-del-pod> -n proyecto-integrador
```

---

## Paso 5: Acceder a la Aplicación

### 5.1 Obtener URL del Ingress

**Opción 1: Via minikube tunnel (RECOMENDADO)**

```bash
# En una terminal separada, ejecutar:
minikube tunnel

# Dejar corriendo (requiere sudo password)
# En otra terminal, obtener la IP del Ingress:
kubectl get ingress app-ingress -n proyecto-integrador

# Acceder a:
# - Frontend: http://127.0.0.1/
# - API: http://127.0.0.1/api/greeting
# - Health: http://127.0.0.1/actuator/health
```

**Opción 2: Via minikube IP**

```bash
# Obtener IP de minikube
minikube ip
# Ejemplo: 192.168.49.2

# Acceder a:
# - Frontend: http://192.168.49.2/
# - API: http://192.168.49.2/api/greeting
# - Health: http://192.168.49.2/actuator/health
```

### 5.2 Probar endpoints de la API

```bash
# Health check
curl http://$(minikube ip)/actuator/health

# Greeting endpoint
curl http://$(minikube ip)/api/greeting

# Listar usuarios
curl http://$(minikube ip)/api/users

# Crear usuario
curl -X POST http://$(minikube ip)/api/users \
  -H "Content-Type: application/json" \
  -d '{"nombre": "Juan Pérez", "email": "juan@example.com"}'
```

### 5.3 Port-forward (alternativa para testing)

```bash
# Port-forward para acceso directo a la API
kubectl port-forward -n proyecto-integrador svc/api-service 8080:8080

# En otra terminal
curl http://localhost:8080/api/greeting
curl http://localhost:8080/actuator/health
```

---

## Paso 6: Validar Funcionalidades

### 6.1 Validar Persistencia de Datos (StatefulSet + PVC)

```bash
# 1. Insertar datos en PostgreSQL
kubectl exec -it postgres-0 -n proyecto-integrador -- psql -U curso -d apidb

# Dentro de psql:
CREATE TABLE test (id SERIAL PRIMARY KEY, mensaje TEXT);
INSERT INTO test (mensaje) VALUES ('Estos datos deben persistir');
SELECT * FROM test;
\q

# 2. Eliminar el pod del StatefulSet
kubectl delete pod postgres-0 -n proyecto-integrador

# Kubernetes lo recreará automáticamente
kubectl get pods -w -n proyecto-integrador

# 3. Esperar a que postgres-0 vuelva a Running, luego verificar datos
kubectl exec -it postgres-0 -n proyecto-integrador -- psql -U curso -d apidb -c "SELECT * FROM test;"

# Resultado esperado: el dato sigue ahí
#  id |          mensaje
# ----+----------------------------
#   1 | Estos datos deben persistir
```

### 6.2 Validar ConfigMaps

```bash
# Ver variables de entorno del pod API
kubectl exec -l app=api -n proyecto-integrador -- env | grep -E 'DB_|REDIS_|SPRING_'

# Debería mostrar:
# DB_HOST=postgres-0.postgres-headless
# DB_PORT=5432
# REDIS_HOST=redis-service
# SPRING_PROFILES_ACTIVE=prod
```

### 6.3 Validar Health Probes

```bash
# Ver configuración de probes
kubectl describe pod -l app=api -n proyecto-integrador | grep -A10 "Liveness\|Readiness"

# Simular fallo (matar proceso dentro del pod)
kubectl exec -it <api-pod> -n proyecto-integrador -- kill 1

# Kubernetes debería reiniciar el pod automáticamente
kubectl get pods -l app=api -w -n proyecto-integrador
```

### 6.4 Validar HPA (Horizontal Pod Autoscaler)

```bash
# Ver estado actual del HPA
kubectl get hpa api-hpa -n proyecto-integrador

# Generar carga en la API
kubectl run -it load-generator --rm --image=busybox:1.28 --restart=Never -n proyecto-integrador -- /bin/sh -c \
  "while sleep 0.01; do wget -q -O- http://api-service:8080/api/greeting; done"

# En otra terminal, observar el escalado
watch kubectl get hpa api-hpa -n proyecto-integrador

# También ver los pods escalando
watch kubectl get pods -l app=api -n proyecto-integrador

# Resultado esperado:
# - CPU usage aumenta
# - HPA escala de 2 a 3, 4, 5 pods (según la carga)
# - Al detener la carga (Ctrl+C), HPA reduce a 2 pods después de ~5 min
```

### 6.5 Validar Ingress

```bash
# Ver configuración del Ingress
kubectl describe ingress app-ingress -n proyecto-integrador

# Probar rutas
curl http://$(minikube ip)/          # → Frontend
curl http://$(minikube ip)/api/greeting  # → API
curl http://$(minikube ip)/actuator/health  # → API
```

---

## Conceptos de Kubernetes Aplicados

### Deployments
- **api:** 2 réplicas (mínimo para HPA), con health probes y resources
- **frontend:** 2 réplicas con health probes
- **redis:** 1 réplica con health probes

### StatefulSets
- **postgres:** 1 réplica con identidad estable (`postgres-0`)
- **volumeClaimTemplates:** PVC de 1Gi para datos persistentes
- **Headless Service:** Para acceso DNS estable

### Services
- **ClusterIP:** Comunicación interna (api, frontend, redis)
- **Headless (ClusterIP: None):** Para StatefulSet (postgres)

### ConfigMaps
- **api-config:** Configuración de la API (DB, Redis, Spring Boot, Actuator)

### Secrets
- **postgres-secret:** Credenciales de PostgreSQL

### Ingress
- **app-ingress:** Path-based routing con NGINX Ingress Controller
- **Rutas:**
  - `/` → frontend-service:80
  - `/api` → api-service:8080
  - `/actuator` → api-service:8080

### HPA (Horizontal Pod Autoscaler)
- **api-hpa:** Escalado automático basado en CPU (70%) y memoria (80%)
- **Min/Max:** 2-5 réplicas
- **Behavior:** Scale-up rápido, scale-down lento (evita flapping)

### Health Probes
- **Liveness:** Reinicia el pod si falla
- **Readiness:** Quita del service si no está listo
- **Startup:** Para apps lentas al iniciar (evita que liveness mate el pod)

### Resource Requests/Limits
- Todos los pods tienen requests y limits definidos
- Necesario para HPA (calcula % sobre requests)

### Security Context
- **runAsNonRoot:** true
- **allowPrivilegeEscalation:** false
- **capabilities drop:** ALL

---

## Troubleshooting

### Pod postgres-0 en Pending

```bash
kubectl describe pod postgres-0

# Buscar eventos:
# - "FailedScheduling" → Verificar recursos disponibles en nodo
# - "FailedMount" → Problema con PVC

# Verificar PVC
kubectl get pvc
kubectl describe pvc postgres-data-postgres-0

# Verificar StorageClass
kubectl get storageclass

# En minikube, debería tener 'standard' como default
minikube addons list | grep storage-provisioner
```

### API en CrashLoopBackOff

```bash
# Ver logs del pod
kubectl logs -l app=api --tail=100

# Causas comunes:
# 1. No puede conectarse a PostgreSQL
#    - Verificar que postgres-0 esté Running
#    - Verificar initContainer wait-for-postgres

# 2. Configuración incorrecta
kubectl describe configmap api-config
kubectl describe secret postgres-secret

# 3. Imagen no encontrada
docker pull alefiengo/springboot-api:v2.0
```

### HPA muestra `<unknown>` en TARGETS

```bash
# Verificar Metrics Server
kubectl get pods -n kube-system | grep metrics-server

# Verificar métricas disponibles
kubectl top nodes
kubectl top pods

# Si Metrics Server no funciona, reiniciar addon
minikube addons disable metrics-server
minikube addons enable metrics-server

# Esperar 1-2 minutos y verificar
kubectl top pods
```

### Ingress sin ADDRESS

```bash
# Verificar Ingress Controller
kubectl get pods -n ingress-nginx

# Ver logs del controller
kubectl logs -n ingress-nginx deployment/ingress-nginx-controller

# Verificar addon
minikube addons list | grep ingress

# Si no está habilitado
minikube addons enable ingress

# Esperar 1-2 minutos
kubectl get ingress app-ingress -w
```

### Frontend no carga

```bash
# Verificar que pods estén Running
kubectl get pods -l app=frontend

# Ver logs
kubectl logs -l app=frontend

# Verificar Service
kubectl get endpoints frontend-service

# Probar acceso directo con port-forward
kubectl port-forward svc/frontend-service 8000:80

# Acceder a http://localhost:8000
```

### Redis no conecta

```bash
# Verificar que Redis esté Running
kubectl get pods -l app=redis

# Probar conexión desde pod de API
kubectl exec -it <api-pod> -- sh -c "nc -zv redis-service 6379"

# Ver logs de Redis
kubectl logs -l app=redis
```

---

## Comandos Útiles

### Escalar Deployments

```bash
# Escalar API manualmente
kubectl scale deployment api --replicas=3

# Ver el escalado
kubectl get pods -l app=api -w

# Escalar Frontend
kubectl scale deployment frontend --replicas=4
```

### Modificar ConfigMap

```bash
# Editar en vivo
kubectl edit configmap api-config

# Reiniciar deployment para aplicar cambios
kubectl rollout restart deployment api
```

### Ver uso de recursos

```bash
# Métricas de nodos
kubectl top nodes

# Métricas de pods
kubectl top pods

# Métricas de pods específicos
kubectl top pods -l app=api

# Ver uso de PVC
kubectl exec postgres-0 -- df -h /var/lib/postgresql/data
```

### Backup de PostgreSQL

```bash
# Dump de base de datos
kubectl exec postgres-0 -- pg_dump -U curso apidb > backup.sql

# Restaurar
cat backup.sql | kubectl exec -i postgres-0 -- psql -U curso apidb
```

### Ver eventos del cluster

```bash
# Ver eventos recientes
kubectl get events --sort-by='.lastTimestamp'

# Ver eventos de un namespace
kubectl get events -n default

# Filtrar eventos de un pod
kubectl get events --field-selector involvedObject.name=postgres-0
```

---

## Limpieza

### Opción A: Eliminar el namespace completo (RECOMENDADO)

La forma más rápida de eliminar todos los recursos es eliminar el namespace:

```bash
# Eliminar el namespace (elimina TODO dentro de él)
kubectl delete namespace proyecto-integrador

# Verificar que se haya eliminado
kubectl get namespace
```

**IMPORTANTE:** Esto eliminará todos los recursos dentro del namespace, incluyendo PVCs. Los PersistentVolumes (PV) también se eliminarán si tienen política `Delete` (default en minikube).

### Opción B: Eliminar recursos individualmente

```bash
# Desde el directorio k8s/

# Eliminar recursos dentro del namespace
kubectl delete -f 05-backend/api-hpa.yaml
kubectl delete -f 07-ingress/
kubectl delete -f 06-frontend/
kubectl delete -f 05-backend/
kubectl delete -f 04-databases/
kubectl delete -f 03-storage/
kubectl delete -f 02-secrets/
kubectl delete -f 01-configmaps/

# IMPORTANTE: Eliminar PVCs manualmente (no se eliminan con StatefulSet)
kubectl delete pvc postgres-storage-postgres-0 -n proyecto-integrador

# Finalmente, eliminar el namespace
kubectl delete -f 00-namespace/

# Verificar que no queden recursos
kubectl get all -n proyecto-integrador
```

### Script de limpieza

```bash
# Crear script cleanup.sh
cat > cleanup.sh << 'EOF'
#!/bin/bash
echo "Eliminando recursos del Proyecto Integrador..."

# Opción 1: Eliminar namespace completo (rápido)
kubectl delete namespace proyecto-integrador 2>/dev/null || true

# Opción 2: Eliminar recursos individualmente (comentado)
# kubectl delete -f k8s/05-backend/api-hpa.yaml 2>/dev/null || true
# kubectl delete -f k8s/07-ingress/ 2>/dev/null || true
# kubectl delete -f k8s/06-frontend/ 2>/dev/null || true
# kubectl delete -f k8s/05-backend/ 2>/dev/null || true
# kubectl delete -f k8s/04-databases/ 2>/dev/null || true
# kubectl delete -f k8s/03-storage/ 2>/dev/null || true
# kubectl delete -f k8s/02-secrets/ 2>/dev/null || true
# kubectl delete -f k8s/01-configmaps/ 2>/dev/null || true
# kubectl delete pvc postgres-storage-postgres-0 -n proyecto-integrador 2>/dev/null || true
# kubectl delete -f k8s/00-namespace/ 2>/dev/null || true

echo "Limpieza completada"
kubectl get namespace | grep proyecto-integrador || echo "Namespace eliminado exitosamente"
EOF

chmod +x cleanup.sh
./cleanup.sh
```

---

## Recursos Adicionales

- [Kubernetes Docs - Deployments](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/)
- [Kubernetes Docs - StatefulSets](https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/)
- [Kubernetes Docs - Services](https://kubernetes.io/docs/concepts/services-networking/service/)
- [Kubernetes Docs - Ingress](https://kubernetes.io/docs/concepts/services-networking/ingress/)
- [Kubernetes Docs - ConfigMaps](https://kubernetes.io/docs/concepts/configuration/configmap/)
- [Kubernetes Docs - Secrets](https://kubernetes.io/docs/concepts/configuration/secret/)
- [Kubernetes Docs - HPA](https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/)
- [NGINX Ingress Controller](https://kubernetes.github.io/ingress-nginx/)
- [Metrics Server](https://github.com/kubernetes-sigs/metrics-server)

---

**Proyecto Integrador - Curso Docker & Kubernetes**
**Instructor:** Alejandro Fiengo (alefiengo)
**Instituto:** i-Quattro
