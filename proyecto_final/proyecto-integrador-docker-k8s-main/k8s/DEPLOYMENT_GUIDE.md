# Guía de Despliegue Manual - Kubernetes (minikube)

Esta guía presenta el proceso **paso a paso** para desplegar el Proyecto Integrador v2.0 en **minikube**.

**Nota:** Si usas microk8s, consulta [DEPLOYMENT_GUIDE_MICROK8S.md](DEPLOYMENT_GUIDE_MICROK8S.md).

---

## Requisitos Previos

### 1. Verificar que minikube esté corriendo

```bash
minikube status
```

**Salida esperada:**
```
minikube
type: Control Plane
host: Running
kubelet: Running
apiserver: Running
kubeconfig: Configured
```

Si no está corriendo:
```bash
minikube start
```

### 2. Verificar conectividad del cluster

```bash
kubectl cluster-info
```

**Salida esperada:**
```
Kubernetes control plane is running at https://...
CoreDNS is running at https://...
```

### 3. Habilitar Ingress Controller

```bash
minikube addons enable ingress
```

**Verificar:**
```bash
kubectl get pods -n ingress-nginx
```

**Salida esperada:**
```
NAME                                        READY   STATUS    RESTARTS   AGE
ingress-nginx-controller-xxx                1/1     Running   0          30s
```

Esperar a que los pods estén `Running`.

### 4. Habilitar Metrics Server (para HPA)

```bash
minikube addons enable metrics-server
```

**Verificar:**
```bash
kubectl get deployment metrics-server -n kube-system
```

**Salida esperada:**
```
NAME             READY   UP-TO-DATE   AVAILABLE   AGE
metrics-server   1/1     1            1           30s
```

### 5. Preparar las Imágenes Docker

Tienes **3 opciones** para manejar las imágenes:

#### Opción A: Usar imágenes públicas de Docker Hub (Recomendado para clase)

```bash
# No requiere acción, Kubernetes descargará automáticamente:
# - alefiengo/springboot-api:v2.0
# - alefiengo/angular-frontend:v2.0
# - postgres:15-alpine
# - redis:7-alpine
```

**Ventaja:** Más simple, no requiere build local.

**Desventaja:** Requiere conexión a internet, puede tardar en la primera descarga.

#### Opción B: Construir y cargar imágenes locales en minikube

**Desde el directorio raíz del proyecto:**

```bash
# Navegar al directorio del proyecto
cd /ruta/al/proyecto-integrador-docker-k8s/

# Construir imágenes localmente
docker build -t alefiengo/springboot-api:v2.0 .
docker build -t alefiengo/angular-frontend:v2.0 ./frontend/

# Cargar imágenes en minikube
minikube image load alefiengo/springboot-api:v2.0
minikube image load alefiengo/angular-frontend:v2.0
```

**Verificar que las imágenes estén en minikube:**
```bash
minikube image ls | grep alefiengo
```

**Ventaja:** Funciona sin internet, las imágenes están cacheadas localmente.

**Desventaja:** Requiere tener Docker Desktop corriendo y build local.

#### Opción C: Construir directamente dentro del daemon de minikube

**Desde el directorio raíz del proyecto:**

```bash
# Configurar terminal para usar el Docker daemon de minikube
eval $(minikube docker-env)

# Construir directamente en minikube (no usa Docker Desktop)
docker build -t alefiengo/springboot-api:v2.0 .
docker build -t alefiengo/angular-frontend:v2.0 ./frontend/

# Verificar
docker images | grep alefiengo

# Cuando termines, volver al daemon local
eval $(minikube docker-env -u)
```

**Ventaja:** No usa Docker Desktop, las imágenes quedan directamente en minikube.

**Desventaja:** Requiere reconstruir si borras minikube.

#### Opción D: Construir y publicar tus propias imágenes en Docker Hub

Si modificaste el código y quieres publicar tus propias imágenes:

**Desde el directorio raíz del proyecto:**

```bash
# 1. Login en Docker Hub
docker login

# 2. Construir imágenes con tu username
docker build -t tu-usuario/springboot-api:v2.0 .
docker build -t tu-usuario/angular-frontend:v2.0 ./frontend/

# 3. Publicar a Docker Hub
docker push tu-usuario/springboot-api:v2.0
docker push tu-usuario/angular-frontend:v2.0

# 4. Actualizar los manifests para usar tus imágenes
# Editar los archivos:
# - k8s/05-backend/api-deployment.yaml
# - k8s/06-frontend/frontend-deployment.yaml
# Reemplazar "alefiengo" por "tu-usuario"
```

**Ventaja:** Tus imágenes personalizadas accesibles desde cualquier cluster.

**Desventaja:** Requiere cuenta de Docker Hub y modificar manifests.

---

**Recomendación para la clase:**

- **Opción A** si tienes las imágenes públicas en Docker Hub (más profesional, sin preparación)
- **Opción B o C** si estás desarrollando localmente o sin internet
- **Opción D** si modificaste el código y quieres publicar tus propias imágenes

---

## Paso 0: Namespace

```bash
cd k8s/
kubectl apply -f 00-namespace/namespace.yaml
```

**Verificar:**
```bash
kubectl get namespace proyecto-integrador
```

---

## Paso 1: Configuración (ConfigMaps y Secrets)

```bash
kubectl apply -f 01-configmaps/api-config.yaml
kubectl apply -f 01-configmaps/frontend-config.yaml
kubectl apply -f 02-secrets/postgres-secret.yaml
```

**Verificar:**
```bash
kubectl get configmaps -n proyecto-integrador
kubectl get secrets -n proyecto-integrador
```

**Salida esperada:**
```
NAME            DATA   AGE
api-config      10     5s
frontend-config 1      5s

NAME              TYPE     DATA   AGE
postgres-secret   Opaque   3      5s
```

---

## Paso 2: Base de Datos (PostgreSQL con StatefulSet)

### 2.1 Crear Headless Service

```bash
kubectl apply -f 04-databases/postgres-headless.yaml
```

**Verificar:**
```bash
kubectl get svc -n proyecto-integrador | grep postgres
```

### 2.2 Crear StatefulSet con PersistentVolumeClaim

```bash
kubectl apply -f 03-storage/postgres-statefulset.yaml
```

**Verificar:**
```bash
kubectl get statefulset -n proyecto-integrador
kubectl get pods -n proyecto-integrador | grep postgres
kubectl get pvc -n proyecto-integrador
```

### 2.3 Esperar a que PostgreSQL esté listo

```bash
kubectl wait --for=condition=ready --timeout=120s pod/postgres-0 -n proyecto-integrador
```

**Si falla o tarda mucho:**
```bash
# Ver estado del pod
kubectl get pod postgres-0 -n proyecto-integrador

# Ver eventos
kubectl describe pod postgres-0 -n proyecto-integrador

# Ver logs
kubectl logs postgres-0 -n proyecto-integrador
```

**Estados comunes:**
- `Pending` → Esperando PVC (normal, espera 1-2 min)
- `ContainerCreating` → Descargando imagen (espera)
- `Running` → ✅ Listo
- `CrashLoopBackOff` → ❌ Error (revisar logs)

---

## Paso 3: Cache (Redis)

```bash
kubectl apply -f 04-databases/redis-deployment.yaml
kubectl apply -f 04-databases/redis-service.yaml
```

**Verificar:**
```bash
kubectl get deployment redis -n proyecto-integrador
kubectl get pods -n proyecto-integrador | grep redis
```

**Esperar a que esté listo:**
```bash
kubectl wait --for=condition=available --timeout=60s deployment/redis -n proyecto-integrador
```

---

## Paso 4: Backend (Spring Boot API)

### 4.1 Desplegar API

```bash
kubectl apply -f 05-backend/api-deployment.yaml
kubectl apply -f 05-backend/api-service.yaml
```

**Verificar:**
```bash
kubectl get deployment api -n proyecto-integrador
kubectl get pods -n proyecto-integrador | grep api
kubectl get svc api-service -n proyecto-integrador
```

### 4.2 Esperar a que la API esté lista (puede tomar 2-3 minutos)

```bash
kubectl wait --for=condition=available --timeout=180s deployment/api -n proyecto-integrador
```

**Si falla:**
```bash
# Ver estado de los pods
kubectl get pods -l app=api -n proyecto-integrador

# Ver logs en tiempo real
kubectl logs -l app=api -n proyecto-integrador --tail=50 -f

# Ver eventos del deployment
kubectl describe deployment api -n proyecto-integrador
```

**Errores comunes:**
- `ImagePullBackOff` → Imagen no existe en Docker Hub
- `CrashLoopBackOff` → Error en la aplicación (revisar logs)
- Pods stuck en `Pending` → Recursos insuficientes

**Solución para ImagePullBackOff:**
```bash
# Opción 1: Cargar imagen desde Docker local (minikube)
minikube image load alefiengo/springboot-api:v2.0

# Opción 2: Construir en minikube
eval $(minikube docker-env)
docker build -t alefiengo/springboot-api:v2.0 ../
```

---

## Paso 5: Frontend (Angular)

```bash
kubectl apply -f 06-frontend/frontend-deployment.yaml
kubectl apply -f 06-frontend/frontend-service.yaml
```

**Verificar:**
```bash
kubectl get deployment frontend -n proyecto-integrador
kubectl get pods -n proyecto-integrador | grep frontend
```

**Esperar:**
```bash
kubectl wait --for=condition=available --timeout=60s deployment/frontend -n proyecto-integrador
```

**Si falla (ImagePullBackOff):**
```bash
# Cargar imagen local
minikube image load alefiengo/angular-frontend:v2.0

# O construir en minikube
eval $(minikube docker-env)
cd ../frontend/
docker build -t alefiengo/angular-frontend:v2.0 .
cd ../k8s/
```

---

## Paso 6: Ingress (Routing HTTP)

```bash
kubectl apply -f 07-ingress/app-ingress.yaml
```

**Verificar:**
```bash
kubectl get ingress -n proyecto-integrador
```

**Salida esperada:**
```
NAME          CLASS   HOSTS   ADDRESS          PORTS   AGE
app-ingress   nginx   *       192.168.49.2     80      10s
```

**Nota:** El campo `ADDRESS` puede tardar 30-60 segundos en aparecer.

---

## Paso 7: HPA (Horizontal Pod Autoscaler)

```bash
kubectl apply -f 05-backend/api-hpa.yaml
```

**Verificar:**
```bash
kubectl get hpa -n proyecto-integrador
```

**Salida esperada:**
```
NAME      REFERENCE        TARGETS         MINPODS   MAXPODS   REPLICAS   AGE
api-hpa   Deployment/api   <unknown>/70%   2         5         0          10s
```

**Nota:** El campo `TARGETS` mostrará `<unknown>` por 30-60 segundos hasta que Metrics Server recolecte datos. Luego mostrará algo como `15%/70%`.

---

## Verificación Final: Estado de Todos los Recursos

```bash
kubectl get all -n proyecto-integrador
```

**Salida esperada:**
```
NAME                            READY   STATUS    RESTARTS   AGE
pod/api-xxx                     1/1     Running   0          5m
pod/api-yyy                     1/1     Running   0          5m
pod/frontend-xxx                1/1     Running   0          3m
pod/frontend-yyy                1/1     Running   0          3m
pod/postgres-0                  1/1     Running   0          8m
pod/redis-xxx                   1/1     Running   0          6m

NAME                   TYPE        CLUSTER-IP       EXTERNAL-IP   PORT(S)    AGE
service/api-service    ClusterIP   10.96.123.45     <none>        8080/TCP   5m
service/frontend-service ClusterIP 10.96.234.56    <none>        80/TCP     3m
service/postgres-headless ClusterIP None           <none>        5432/TCP   8m
service/redis-service  ClusterIP   10.96.345.67     <none>        6379/TCP   6m

NAME                       READY   UP-TO-DATE   AVAILABLE   AGE
deployment.apps/api        2/2     2            2           5m
deployment.apps/frontend   2/2     2            2           3m
deployment.apps/redis      1/1     1            1           6m

NAME                         DESIRED   CURRENT   READY   AGE
statefulset.apps/postgres    1         1         1       8m
```

**Verificar PVC:**
```bash
kubectl get pvc -n proyecto-integrador
```

**Verificar Ingress:**
```bash
kubectl get ingress -n proyecto-integrador
```

**Verificar HPA:**
```bash
kubectl get hpa -n proyecto-integrador
```

---

## Acceso a la Aplicación

### Opción 1: Port Forward (Recomendado para desarrollo)

```bash
kubectl port-forward -n ingress-nginx svc/ingress-nginx-controller 8080:80
```

**Dejar corriendo en una terminal**, luego acceder en el navegador:
- **Frontend:** http://localhost:8080/
- **API Greeting:** http://localhost:8080/api/greeting
- **API Users:** http://localhost:8080/api/users
- **Health Check:** http://localhost:8080/actuator/health

### Opción 2: Minikube Tunnel (Alternativa)

**En otra terminal:**
```bash
minikube tunnel
# Requiere privilegios (sudo), dejar corriendo
```

Luego acceder a:
- http://127.0.0.1/
- http://127.0.0.1/api/greeting
- http://127.0.0.1/api/users

### Opción 3: Cloud (DOKS, GKE, EKS, AKS)

Si estás en un cluster cloud, el Ingress Controller ya tiene una IP externa:

```bash
kubectl get svc -n ingress-nginx ingress-nginx-controller
```

Acceder directamente a la `EXTERNAL-IP` mostrada.

---

## Comandos Útiles de Operación

### Ver logs en tiempo real

```bash
# API
kubectl logs -l app=api -n proyecto-integrador --tail=50 -f

# Frontend
kubectl logs -l app=frontend -n proyecto-integrador --tail=50 -f

# PostgreSQL
kubectl logs postgres-0 -n proyecto-integrador --tail=50 -f
```

### Ver estado de los pods

```bash
kubectl get pods -n proyecto-integrador -o wide
```

### Describir un recurso (para debugging)

```bash
kubectl describe pod <pod-name> -n proyecto-integrador
kubectl describe deployment api -n proyecto-integrador
kubectl describe hpa api-hpa -n proyecto-integrador
```

### Ejecutar comandos dentro de un pod

```bash
# Conectarse a PostgreSQL
kubectl exec -it postgres-0 -n proyecto-integrador -- psql -U admin -d apidb

# Ejecutar comando en el pod de la API
kubectl exec -it deployment/api -n proyecto-integrador -- env | grep SPRING
```

### Ver métricas de recursos

```bash
kubectl top nodes
kubectl top pods -n proyecto-integrador
```

### Probar HPA generando carga

```bash
# En otra terminal, generar tráfico
while true; do curl http://localhost:8080/api/users; sleep 0.1; done

# Ver HPA en acción
kubectl get hpa -n proyecto-integrador -w
```

### Escalar manualmente

```bash
kubectl scale deployment api --replicas=5 -n proyecto-integrador
kubectl get pods -n proyecto-integrador -w
```

---

## Troubleshooting Común

### Problema: Pods en ImagePullBackOff

**Causa:** Las imágenes no están en Docker Hub o minikube no puede accederlas.

**Solución:**
```bash
# Ver qué imagen está fallando
kubectl describe pod <pod-name> -n proyecto-integrador

# Cargar imagen desde Docker local
minikube image load alefiengo/springboot-api:v2.0
minikube image load alefiengo/angular-frontend:v2.0

# O construir directamente en minikube
eval $(minikube docker-env)
docker build -t alefiengo/springboot-api:v2.0 .
docker build -t alefiengo/angular-frontend:v2.0 ./frontend/
```

### Problema: API en CrashLoopBackOff

**Causa:** Error en la aplicación (conexión a DB, variables de entorno, etc.)

**Solución:**
```bash
# Ver logs
kubectl logs -l app=api -n proyecto-integrador --tail=100

# Revisar ConfigMaps y Secrets
kubectl get configmap api-config -n proyecto-integrador -o yaml
kubectl get secret postgres-secret -n proyecto-integrador -o yaml

# Verificar que PostgreSQL esté corriendo
kubectl get pod postgres-0 -n proyecto-integrador
```

### Problema: HPA muestra <unknown>/70%

**Causa:** Metrics Server aún no ha recolectado métricas.

**Solución:**
```bash
# Esperar 1-2 minutos
kubectl get hpa -n proyecto-integrador -w

# Verificar Metrics Server
kubectl get deployment metrics-server -n kube-system
kubectl top pods -n proyecto-integrador
```

### Problema: No puedo acceder a http://localhost:8080/

**Causa:** El port-forward no está corriendo o se detuvo.

**Solución:**
```bash
# Verificar que el port-forward esté activo
# Si no lo está, ejecutar de nuevo:
kubectl port-forward -n ingress-nginx svc/ingress-nginx-controller 8080:80
```

### Problema: Ingress sin ADDRESS

**Solución:**
```bash
# Esperar 1-2 minutos
kubectl get ingress -n proyecto-integrador -w

# Verificar que Ingress Controller esté corriendo
kubectl get pods -n ingress-nginx
```

---

## Limpieza (Eliminar todo)

```bash
# Opción 1: Eliminar el namespace completo (rápido)
kubectl delete namespace proyecto-integrador

# Opción 2: Eliminar recursos uno por uno (para demostración)
kubectl delete -f 07-ingress/
kubectl delete -f 06-frontend/
kubectl delete -f 05-backend/
kubectl delete -f 04-databases/
kubectl delete -f 03-storage/
kubectl delete -f 02-secrets/
kubectl delete -f 01-configmaps/
kubectl delete -f 00-namespace/

# Verificar
kubectl get all -n proyecto-integrador
```

**Nota:** Los PVC no se eliminan automáticamente. Si quieres eliminarlos:
```bash
kubectl delete pvc -n proyecto-integrador --all
```


---

**Autor:** Alejandro Fiengo (alefiengo)
**Versión:** 2.0.0
**Curso:** Docker & Kubernetes - iQuattro
