# PostgreSQL en Kubernetes – Clase 7

**Curso:** Docker & Kubernetes – Clase 7  
**Estudiante:** Miguel Claure Villca

Despliegue de PostgreSQL usando **Namespace**, **ConfigMap**, **Secret**, **StatefulSet** con **PVC** y **Headless Service** (descubrimiento estable). Demostración de **persistencia** tras recreación del pod.

---

## Pasos


## Descarga
```bash
# Clonar repositorio
git clone https://github.com/sureflatron/curso-docker-kubernetes-tareas.git

#Ingreasar a la tarea
cd curso-docker-kubernetes-tareas/clase7

```

1) Namespace
```bash
kubectl apply -f k8s/namespace.yaml
kubectl config set-context --current --namespace=tarea-clase7
```
![Docker Images](./screenshots/one.png) 

2) ConfigMap & Secret
```bash
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secret.yaml   # (creado a partir de secret.yaml.example)
```
![Docker Images](./screenshots/two.png) 
3) Services
```bash
kubectl apply -f k8s/postgres-headless.yaml

```
![Docker Images](./screenshots/tree.png) 

4) StatefulSet
```bash
kubectl apply -f k8s/postgres-statefulset.yaml
```
![Docker Images](./screenshots/four.png) 
5) Verificación
```bash
kubectl get all -n tarea-clase7
kubectl get pvc -n tarea-clase7
kubectl describe sts postgres -n tarea-clase7
kubectl logs statefulset/postgres -n tarea-clase7 --tail=80
```
![Docker Images](./screenshots/five.png) 
6) Probar PostgreSQL
```bash
kubectl exec -it -n tarea-clase7 postgres-0 -- psql -U admin -d mibasedatos
```
En `psql`:
```sql
CREATE TABLE estudiantes (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100),
  carrera VARCHAR(100)
);
INSERT INTO estudiantes (nombre, carrera) VALUES
  ('Juan Perez','Ingeniería de Sistemas'),
  ('Maria Lopez','Ingeniería de Sistemas'),
  ('Carlos Gomez','Ingeniería de Sistemas');
SELECT * FROM estudiantes;
```
Salir: `\q`
![Docker Images](./screenshots/six.png) 

7) Persistencia (auto-healing)
```bash
kubectl delete pod -n tarea-clase7 postgres-0
kubectl get pods -n tarea-clase7 -w
# cuando vuelva a Running
kubectl exec -it -n tarea-clase7 postgres-0 -- psql -U admin -d mibasedatos -c "SELECT * FROM estudiantes;"
```
![Docker Images](./screenshots/seven.png) 
---

## Comandos útiles
```bash
# Vistas rápidas\ kubectl get all -n tarea-clase7
kubectl get pvc -n tarea-clase7
kubectl get configmap,secret -n tarea-clase7

```
![Docker Images](./screenshots/comandos_utiles.png) 
---

## Troubleshooting

### PVC en Pending
```bash
minikube addons list | grep storage
minikube addons enable storage-provisioner
```
Reintenta: `kubectl delete pvc -n tarea-clase7 --all && kubectl apply -f k8s/postgres-statefulset.yaml`
![Docker Images](./screenshots/pvc.png) 

### El pod no está listo (readiness)
- Inspecciona logs:
```bash
kubectl logs -n tarea-clase7 statefulset/postgres --tail=100
kubectl describe pod -n tarea-clase7 postgres-0
```
![Docker Images](./screenshots/logs.png) 
- Confirma variables:
```bash
kubectl exec -it -n tarea-clase7 postgres-0 -- env | grep -E "POSTGRES_|PGDATA"
```
![Docker Images](./screenshots/logs2.png) 
### Cambiar contraseña / usuario
- Edita `k8s/secret.yaml` (local) y aplica:
```bash
kubectl apply -f k8s/secret.yaml
kubectl rollout restart statefulset/postgres -n tarea-clase7
```
![Docker Images](./screenshots/password.png) 
---

## Limpieza
```bash
kubectl delete namespace tarea-clase7
kubectl get ns | grep tarea-clase7 || echo "Eliminado"
```

![Docker Images](./screenshots/limpieza.png) 