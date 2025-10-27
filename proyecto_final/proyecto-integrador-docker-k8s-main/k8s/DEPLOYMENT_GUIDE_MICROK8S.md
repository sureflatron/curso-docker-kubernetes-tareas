# Guía de Despliegue Manual - Kubernetes (microk8s)

Esta guía presenta el proceso **paso a paso** para desplegar el Proyecto Integrador v2.0 en **microk8s**.

---

## Requisitos Previos

### 1. Verificar que microk8s esté corriendo

```bash
microk8s status
```

**Salida esperada:**
```
microk8s is running
```

Si no está corriendo:
```bash
microk8s start
```

### 2. Verificar conectividad del cluster

```bash
microk8s kubectl cluster-info
```

**O crear alias (recomendado):**
```bash
alias kubectl='microk8s kubectl'
kubectl cluster-info
```

**Nota:** En el resto de esta guía asumiré que tienes el alias configurado. Si no lo tienes, reemplaza `kubectl` por `microk8s kubectl`.

### 3. Habilitar Ingress Controller

```bash
microk8s enable ingress
```

**Verificar:**
```bash
kubectl get pods -n ingress
```

**Salida esperada:**
```
NAME                                      READY   STATUS    RESTARTS   AGE
nginx-ingress-microk8s-controller-xxx     1/1     Running   0          30s
```

**Nota:** En microk8s, el namespace es `ingress`, no `ingress-nginx`.

### 4. Habilitar Metrics Server (para HPA)

```bash
microk8s enable metrics-server
```

**Verificar:**
```bash
kubectl get deployment metrics-server -n kube-system
```

### 5. Habilitar DNS (si no está habilitado)

```bash
microk8s enable dns
```

### 6. Habilitar Storage (si no está habilitado)

```bash
microk8s enable storage
```

**Verificar StorageClass:**
```bash
kubectl get storageclass
```

**Salida esperada:**
```
NAME                          PROVISIONER            RECLAIMPOLICY   VOLUMEBINDINGMODE   AGE
microk8s-hostpath (default)   microk8s.io/hostpath   Delete          Immediate           5m
```

### 7. Habilitar MetalLB (Opcional pero recomendado)

MetalLB proporciona IPs externas reales para el Ingress, simulando un entorno cloud.

**Sin MetalLB:** El Ingress solo será accesible desde el host (localhost o IP del nodo)

**Con MetalLB:** El Ingress obtendrá una IP externa accesible desde cualquier máquina en la red local

```bash
# Habilitar MetalLB con un rango de IPs de tu red local
microk8s enable metallb:192.168.1.200-192.168.1.210
```

**Importante:** Debes usar un rango de IPs válido en tu red local que NO esté usado por DHCP.

**Para identificar tu red:**
```bash
ip a show eth0
# Busca la línea con "inet", ejemplo: inet 192.168.1.50/24
# Si tu IP es 192.168.1.50/24, tu red es 192.168.1.0/24
# Usa un rango alto: 192.168.1.200-192.168.1.210
```

**Otros ejemplos de rangos:**
- Red `10.0.0.0/24` → Rango: `10.0.0.100-10.0.0.110`
- Red `172.16.0.0/24` → Rango: `172.16.0.200-172.16.0.210`

**Verificar:**
```bash
kubectl get ipaddresspool -n metallb-system
```

**Nota:** Si no habilitas MetalLB, sigue la guía normalmente. El acceso será via localhost o IP del nodo sin IP externa dedicada.

### 8. Preparar las Imágenes Docker

Tienes **4 opciones** para manejar las imágenes en microk8s:

#### Opción A: Usar imágenes públicas de Docker Hub (Recomendado)

```bash
# No requiere acción, Kubernetes descargará automáticamente:
# - alefiengo/springboot-api:v2.0
# - alefiengo/angular-frontend:v2.0
# - postgres:15-alpine
# - redis:7-alpine
```

**Ventaja:** Más simple, no requiere preparación local.

**Desventaja:** Requiere conexión a internet, puede tardar en la primera descarga.

#### Opción B: Importar imágenes desde Docker local

**Desde el directorio raíz del proyecto:**

```bash
# Navegar al directorio del proyecto
cd /ruta/al/proyecto-integrador-docker-k8s/

# Construir imágenes localmente con Docker
docker build -t alefiengo/springboot-api:v2.0 .
docker build -t alefiengo/angular-frontend:v2.0 ./frontend/

# Exportar imágenes a tar
docker save alefiengo/springboot-api:v2.0 > api.tar
docker save alefiengo/angular-frontend:v2.0 > frontend.tar

# Importar en microk8s
microk8s ctr image import api.tar
microk8s ctr image import frontend.tar

# Limpiar archivos temporales
rm api.tar frontend.tar
```

**Verificar que las imágenes estén en microk8s:**
```bash
sudo microk8s ctr images ls | grep alefiengo
```

**Nota:** El comando `microk8s ctr` puede requerir `sudo` dependiendo de la configuración de permisos del sistema.

**Ventaja:** Funciona sin internet, las imágenes están cacheadas localmente.

**Desventaja:** Proceso de export/import más largo.

#### Opción C: Usar el registry local de microk8s

**Habilitar registry local:**

```bash
# Habilitar addon de registry
microk8s enable registry
```

**Desde el directorio raíz del proyecto:**

```bash
# Construir imágenes localmente
docker build -t alefiengo/springboot-api:v2.0 .
docker build -t alefiengo/angular-frontend:v2.0 ./frontend/

# Re-tagear para el registry local
docker tag alefiengo/springboot-api:v2.0 localhost:32000/springboot-api:v2.0
docker tag alefiengo/angular-frontend:v2.0 localhost:32000/angular-frontend:v2.0

# Publicar al registry local de microk8s
docker push localhost:32000/springboot-api:v2.0
docker push localhost:32000/angular-frontend:v2.0

# Actualizar los manifests para usar las imágenes del registry local
# Editar:
# - k8s/05-backend/api-deployment.yaml
# - k8s/06-frontend/frontend-deployment.yaml
# Cambiar "alefiengo/..." por "localhost:32000/..."
```

**Ventaja:** Registry local accesible desde microk8s, rápido para iteraciones.

**Desventaja:** Requiere modificar manifests.

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

**¿Cuál opción debo usar?**

Usa esta guía de decisión:

```
┌─────────────────────────────────────────┐
│ ¿Es tu PRIMERA VEZ desplegando?         │
│                                          │
│ ✅ Sí → Opción A                        │
│   (imágenes públicas, más simple)       │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ ¿Modificaste el código del proyecto?    │
│                                          │
│ ✅ Sí → Opción D                        │
│   (publica tus propias imágenes)        │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ ¿Estás SIN INTERNET o conexión lenta?   │
│                                          │
│ ✅ Sí → Opción B                        │
│   (importar desde Docker local)         │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ ¿Estás DESARROLLANDO activamente         │
│ (muchos rebuilds/iteraciones)?           │
│                                          │
│ ✅ Sí → Opción C                        │
│   (registry local de microk8s)          │
└─────────────────────────────────────────┘
```

**Resumen:**
- **Opción A:** Primera vez, usar imágenes públicas → Más simple
- **Opción B:** Sin internet o imágenes locales → Importar con tar
- **Opción C:** Desarrollo activo con muchos cambios → Registry local
- **Opción D:** Código modificado para compartir → Publicar en Docker Hub

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

**Nota:** Los manifests están organizados por tipo de recurso (storage, databases), no por orden de aplicación. Los números de carpeta son solo para organización.

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
- `ImagePullBackOff` → Imagen no existe en Docker Hub o registry
- `CrashLoopBackOff` → Error en la aplicación (revisar logs)
- Pods stuck en `Pending` → Recursos insuficientes

**Solución para ImagePullBackOff (si usas imágenes locales):**
```bash
# Opción 1: Importar imagen desde Docker local
docker save alefiengo/springboot-api:v2.0 > api.tar
microk8s ctr image import api.tar
rm api.tar

# Opción 2: Usar registry local de microk8s
microk8s enable registry
docker tag alefiengo/springboot-api:v2.0 localhost:32000/springboot-api:v2.0
docker push localhost:32000/springboot-api:v2.0
# Luego actualizar deployment para usar localhost:32000/springboot-api:v2.0
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
# Importar imagen local
docker save alefiengo/angular-frontend:v2.0 > frontend.tar
microk8s ctr image import frontend.tar
rm frontend.tar
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
NAME          CLASS   HOSTS   ADDRESS     PORTS   AGE
app-ingress   nginx   *       127.0.0.1   80      10s
```

**Nota:** El campo `ADDRESS` puede tardar 30-60 segundos en aparecer. En microk8s suele ser `127.0.0.1` o la IP de la máquina.

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
service/api-service    ClusterIP   10.152.183.45    <none>        8080/TCP   5m
service/frontend-service ClusterIP 10.152.183.56   <none>        80/TCP     3m
service/postgres-headless ClusterIP None           <none>        5432/TCP   8m
service/redis-service  ClusterIP   10.152.183.67    <none>        6379/TCP   6m

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

### Cómo funciona el Ingress en microk8s

En microk8s, el Ingress Controller expone los puertos 80 y 443 **directamente en el host** usando `hostPort`. Esto significa que NO necesitas port-forward para acceder a través del Ingress.

**Verificar que el Ingress Controller esté corriendo:**
```bash
kubectl get pods -n ingress
```

**Salida esperada:**
```
NAME                                      READY   STATUS    RESTARTS   AGE
nginx-ingress-microk8s-controller-xxx     1/1     Running   0          10m
```

---

### Opción 1: Acceso desde WSL2/Linux (Directo)

Si estás ejecutando comandos desde la terminal de WSL2 o Linux nativo:

```bash
# Acceder directamente por localhost
curl http://localhost/api/greeting
curl http://localhost/

# O abrir en navegador dentro de WSL2 (si tienes GUI)
xdg-open http://localhost/
```

**Endpoints disponibles:**
- **Frontend:** http://localhost/
- **API Greeting:** http://localhost/api/greeting
- **API Users:** http://localhost/api/users
- **Health Check:** http://localhost/actuator/health

---

### Opción 2: Acceso desde Windows (Navegador)

Si microk8s corre en WSL2 y quieres acceder desde el navegador en Windows, tienes 2 sub-opciones:

#### Opción 2A: Usar IP de WSL2 (Recomendado)

**1. Obtener la IP de WSL2:**
```bash
# Desde WSL2
ip a show eth0 | grep inet | grep -v inet6 | awk '{print $2}' | cut -d/ -f1
```

Ejemplo de salida: `172.29.184.216`

**2. Acceder desde el navegador en Windows:**
- **Frontend:** http://172.29.184.216/
- **API Greeting:** http://172.29.184.216/api/greeting
- **API Users:** http://172.29.184.216/api/users
- **Health Check:** http://172.29.184.216/actuator/health

#### Opción 2B: Configurar Port Forwarding en Windows

Si prefieres usar `http://localhost:8080/` desde Windows:

**Configurar en PowerShell (como Administrador):**
```powershell
# Reemplaza 172.29.184.216 con tu IP de WSL2
netsh interface portproxy add v4tov4 listenport=8080 listenaddress=0.0.0.0 connectport=80 connectaddress=172.29.184.216
```

**Acceder:**
- http://localhost:8080/
- http://localhost:8080/api/greeting

**Para eliminar el port forwarding:**
```powershell
netsh interface portproxy delete v4tov4 listenport=8080 listenaddress=0.0.0.0
```

---

### Opción 3: Acceso desde Otra Máquina en la Red

Si necesitas acceder desde otra computadora en tu red local (o si habilitaste MetalLB):

#### Con MetalLB habilitado:

```bash
# Ver la IP externa asignada
kubectl get ingress -n proyecto-integrador
```

**Salida esperada:**
```
NAME          CLASS   HOSTS   ADDRESS       PORTS   AGE
app-ingress   nginx   *       192.168.1.200 80      5m
```

**Acceder desde cualquier máquina en la red:**
- http://192.168.1.200/
- http://192.168.1.200/api/greeting

#### Sin MetalLB:

**Obtener la IP de la máquina donde corre microk8s:**
```bash
ip a show eth0
```

**Acceder desde el navegador:**
```
http://<IP-del-host>/
http://<IP-del-host>/api/greeting
```

---

### Opción 4: Port Forward a Pod Específico (Solo Debugging)

Si el Ingress no funciona o necesitas hacer debugging directo a un pod:

```bash
# Port-forward al frontend
kubectl port-forward -n proyecto-integrador svc/frontend-service 8080:80

# Port-forward al backend
kubectl port-forward -n proyecto-integrador svc/api-service 8081:8080
```

**Acceder:**
- http://localhost:8080/ (frontend)
- http://localhost:8081/api/greeting (backend directo)

---

## Actualizar la Aplicación Después de Modificar el Código

Cuando modificas el código (backend o frontend) y necesitas actualizar la aplicación en Kubernetes, sigue estos pasos:

### Escenario: Modificaste el código y lo publicaste en Docker Hub con el mismo tag

**Problema:** Kubernetes usa imágenes cacheadas y no descarga la nueva versión.

**Solución:**

#### 1. Eliminar imágenes cacheadas en microk8s

```bash
# Listar imágenes cacheadas
sudo microk8s ctr images ls | grep alefiengo

# Eliminar por tag (si aparecen)
sudo microk8s ctr images rm docker.io/alefiengo/angular-frontend:v2.0
sudo microk8s ctr images rm docker.io/alefiengo/springboot-api:v2.0

# O eliminar por digest SHA256 (si solo aparecen digests)
sudo microk8s ctr images rm docker.io/alefiengo/angular-frontend@sha256:xxxx...
sudo microk8s ctr images rm docker.io/alefiengo/springboot-api@sha256:xxxx...
```

**Nota:** Es normal que después de eliminar por tag, las imágenes sigan apareciendo identificadas por su SHA256 digest. Elimínalas usando el digest completo.

#### 2. Forzar que Kubernetes descargue las nuevas imágenes

```bash
# Opción A: Rollout restart (recomendado)
kubectl rollout restart deployment/frontend -n proyecto-integrador
kubectl rollout restart deployment/api -n proyecto-integrador

# Opción B: Borrar pods manualmente
kubectl delete pods -n proyecto-integrador -l app=frontend
kubectl delete pods -n proyecto-integrador -l app=api
```

#### 3. Verificar que los nuevos pods se crearon y están corriendo

```bash
# Ver el estado del rollout
kubectl rollout status deployment/frontend -n proyecto-integrador
kubectl rollout status deployment/api -n proyecto-integrador

# Ver los pods
kubectl get pods -n proyecto-integrador -w
```

#### 4. Verificar que las imágenes se descargaron de nuevo

```bash
# Ver eventos de pull
kubectl get events -n proyecto-integrador --sort-by='.lastTimestamp' | grep -i pull

# Describir un pod para ver la imagen
kubectl describe pod -n proyecto-integrador -l app=frontend | grep Image:
```

### Alternativa: Cambiar el tag de la imagen

**Mejor práctica:** En lugar de reusar el mismo tag (`v2.0`), usa tags únicos por versión:

```bash
# 1. Construir con nuevo tag
docker build -t tu-usuario/springboot-api:v2.1 .
docker build -t tu-usuario/angular-frontend:v2.1 ./frontend/

# 2. Publicar
docker push tu-usuario/springboot-api:v2.1
docker push tu-usuario/angular-frontend:v2.1

# 3. Actualizar deployment
kubectl set image deployment/api api=tu-usuario/springboot-api:v2.1 -n proyecto-integrador
kubectl set image deployment/frontend frontend=tu-usuario/angular-frontend:v2.1 -n proyecto-integrador

# 4. Verificar rollout
kubectl rollout status deployment/api -n proyecto-integrador
kubectl rollout status deployment/frontend -n proyecto-integrador
```

**Ventaja:** No necesitas eliminar imágenes cacheadas, Kubernetes automáticamente descarga la nueva versión.

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
# Si estás en WSL2/Linux:
while true; do curl http://localhost/api/users; sleep 0.1; done

# Si estás en Windows con port-forward configurado:
while true; do curl http://localhost:8080/api/users; sleep 0.1; done

# O usando la IP de WSL2 desde Windows:
while true; do curl http://172.29.184.216/api/users; sleep 0.1; done

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

**Causa:** Las imágenes no están disponibles en el registry.

**Solución:**
```bash
# Ver qué imagen está fallando
kubectl describe pod <pod-name> -n proyecto-integrador

# Opción 1: Importar desde Docker local
docker save alefiengo/springboot-api:v2.0 > api.tar
microk8s ctr image import api.tar
rm api.tar

# Opción 2: Usar registry local de microk8s
microk8s enable registry
docker tag alefiengo/springboot-api:v2.0 localhost:32000/springboot-api:v2.0
docker push localhost:32000/springboot-api:v2.0

# Luego actualizar el deployment:
kubectl set image deployment/api api=localhost:32000/springboot-api:v2.0 -n proyecto-integrador
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

### Problema: PVC en Pending

**Causa:** StorageClass no está habilitado.

**Solución:**
```bash
# Habilitar storage
microk8s enable storage

# Verificar
kubectl get storageclass
kubectl get pvc -n proyecto-integrador
```

### Problema: No puedo acceder a http://localhost/

**Causa:** El Ingress Controller no está corriendo o el puerto 80 está ocupado.

**Solución:**
```bash
# 1. Verificar que el Ingress Controller esté corriendo
kubectl get pods -n ingress

# 2. Verificar que el pod esté Ready
kubectl describe pod -n ingress <pod-name>

# 3. Verificar que el puerto 80 no esté ocupado por otro proceso
sudo lsof -i :80
# O en Windows/WSL2:
netstat -ano | grep :80

# 4. Verificar el Ingress resource
kubectl get ingress -n proyecto-integrador
kubectl describe ingress app-ingress -n proyecto-integrador

# 5. Si nada funciona, hacer port-forward directo al frontend
kubectl port-forward -n proyecto-integrador svc/frontend-service 8080:80
```

### Problema: DNS no funciona dentro de los pods

**Causa:** DNS addon no está habilitado.

**Solución:**
```bash
microk8s enable dns

# Verificar
kubectl get pods -n kube-system | grep coredns
```

---

## Limpieza (Eliminar todo)

```bash
# Opción 1: Eliminar el namespace completo (rápido)
kubectl delete namespace proyecto-integrador

# Opción 2: Eliminar recursos uno por uno
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

## Diferencias Clave: microk8s vs minikube

| Aspecto | microk8s | minikube |
|---------|----------|----------|
| **Comando base** | `microk8s kubectl` | `kubectl` |
| **Namespace Ingress** | `ingress` | `ingress-nginx` |
| **Ingress Type** | DaemonSet con hostPort (puerto 80 en host) | Service + Tunnel |
| **Acceso Ingress** | http://localhost/ (directo) | http://localhost/ (requiere `minikube tunnel`) |
| **Port Forward Ingress** | ❌ NO necesario (ya está en puerto 80) | ✅ Alternativa si no usas tunnel |
| **Habilitar addons** | `microk8s enable <addon>` | `minikube addons enable <addon>` |
| **StorageClass** | `microk8s-hostpath` | `standard` |
| **Registry local** | `microk8s enable registry` | `minikube addons enable registry` |
| **Importar imágenes** | `microk8s ctr image import` | `minikube image load` |

---

## Comandos microk8s Específicos

### Ver addons habilitados

```bash
microk8s status
```

### Habilitar/Deshabilitar addons

```bash
microk8s enable dns storage ingress metrics-server registry
microk8s disable registry
```

### Ver imágenes importadas

```bash
sudo microk8s ctr images ls | grep alefiengo
```

### Acceso directo a kubectl (crear alias permanente)

```bash
echo "alias kubectl='microk8s kubectl'" >> ~/.bashrc
source ~/.bashrc
```

### Configurar kubectl standalone para usar microk8s

```bash
microk8s config > ~/.kube/config
# Ahora puedes usar kubectl directamente
```

### Ver configuración de microk8s

```bash
microk8s inspect
```

---

## Consejos para Producción con microk8s

1. **Usar registry local** para desarrollo:
   ```bash
   microk8s enable registry
   docker tag imagen:tag localhost:32000/imagen:tag
   docker push localhost:32000/imagen:tag
   ```

2. **Configurar alias permanente:**
   ```bash
   echo "alias kubectl='microk8s kubectl'" >> ~/.bashrc
   ```

3. **Habilitar solo los addons necesarios** (microk8s es más ligero que minikube)

4. **Usar MetalLB** si necesitas LoadBalancers reales:
   ```bash
   microk8s enable metallb:10.64.140.43-10.64.140.49
   ```

5. **Considerar high availability** para producción:
   ```bash
   microk8s add-node
   # En otro nodo: microk8s join <token>
   ```

---

**Autor:** Alejandro Fiengo (alefiengo)
**Versión:** 2.0.0 (microk8s)
**Curso:** Docker & Kubernetes - i-Quattro
