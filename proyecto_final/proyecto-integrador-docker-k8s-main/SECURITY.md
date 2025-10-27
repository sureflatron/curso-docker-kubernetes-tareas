# Seguridad - Proyecto Integrador v1.3

Este documento describe las medidas de seguridad implementadas en la versión 1.3 del Proyecto Integrador.

---

## Buenas Prácticas Aplicadas

### 1. Multi-Stage Build

**Beneficio:** Reduce superficie de ataque al incluir solo archivos necesarios en imagen final.

```dockerfile
FROM maven:3.9.6-eclipse-temurin-17-alpine AS build
# ... compilación ...

FROM eclipse-temurin:17-jre-alpine
# Solo JRE + JAR compilado
```

**Resultado:**
- Stage build: ~800MB (con Maven + herramientas)
- Stage final: ~200MB (solo JRE + app)

### 2. Usuario Non-Root

**Beneficio:** Previene escalación de privilegios si el container es comprometido.

```dockerfile
RUN addgroup -g 1001 -S spring && \
    adduser -S spring -u 1001
USER spring
```

**Verificar:**
```bash
docker exec <container-id> whoami
# Salida: spring (no root)
```

### 3. Imagen Base Alpine

**Beneficio:** Superficie mínima de ataque, menos vulnerabilidades.

- `eclipse-temurin:17-jre-alpine` en lugar de `eclipse-temurin:17-jre`
- Reducción de ~400MB
- Menos paquetes instalados = menos CVEs

### 4. Health Check

**Beneficio:** Detecta containers no saludables automáticamente.

```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/actuator/health || exit 1
```

### 5. Optimización JVM para Containers

**Beneficio:** Uso eficiente de memoria asignada al container.

```dockerfile
ENV JAVA_OPTS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0 -XX:+UseG1GC -XX:+DisableExplicitGC"
```

**Explicación:**
- `+UseContainerSupport`: JVM detecta límites del container
- `MaxRAMPercentage=75.0`: Usa máximo 75% de RAM asignada
- `+UseG1GC`: Garbage Collector optimizado
- `+DisableExplicitGC`: Previene `System.gc()` explícito

### 6. Labels de Metadata

**Beneficio:** Trazabilidad y auditoría.

```dockerfile
LABEL maintainer="alefiengo" \
      version="1.3.0" \
      security.scan="trivy" \
      security.non-root="true"
```

---

## Escaneo de Vulnerabilidades

### Usar Trivy

```bash
# Escanear imagen
docker build -t springboot-api:1.3 .
trivy image springboot-api:1.3

# Solo vulnerabilidades críticas
trivy image --severity CRITICAL,HIGH springboot-api:1.3

# Generar reporte
trivy image -f json -o security-report.json springboot-api:1.3
```

### Resultados Esperados (v1.3)

| Severidad | Cantidad Aproximada |
|-----------|---------------------|
| CRITICAL  | 0-2 |
| HIGH      | 2-5 |
| MEDIUM    | 5-15 |
| LOW       | 10-30 |

**Nota:** Números varían según actualizaciones de base de datos CVE.

### Interpretar Resultados

1. **CRITICAL/HIGH con fix disponible:** Actualizar base image
2. **CRITICAL/HIGH sin fix:** Evaluar si afecta tu aplicación
3. **MEDIUM/LOW:** Monitorear y actualizar en próximo release

---

## Comparativa de Versiones

| Aspecto | v1.2 | v1.3 | Mejora |
|---------|------|------|--------|
| Tamaño imagen | ~250MB | ~200MB | -20% |
| Usuario | non-root | non-root | - |
| Healthcheck | Si | Si mejorado | +timeout |
| JVM optimization | No | Si | Nueva |
| Labels seguridad | No | Si | Nueva |
| Scan Trivy | No documentado | Si | Nueva |

---

## Checklist de Seguridad

Antes de deploy a producción:

- [ ] Escanear con Trivy (0 CRITICAL)
- [ ] Verificar usuario non-root
- [ ] Health check funciona
- [ ] Secrets en variables de entorno (no hardcoded)
- [ ] HTTPS configurado (Kong/Nginx)
- [ ] Rate limiting en API Gateway
- [ ] Logs no contienen datos sensibles
- [ ] Actuator endpoints protegidos

---

## Recomendaciones Adicionales

### Para Producción

1. **Secrets Management:**
   ```yaml
   # docker-compose.yml
   services:
     app:
       environment:
         - SPRING_DATASOURCE_PASSWORD_FILE=/run/secrets/db_password
       secrets:
         - db_password
   secrets:
     db_password:
       file: ./secrets/db_password.txt
   ```

2. **Read-Only Filesystem:**
   ```yaml
   services:
     app:
       read_only: true
       tmpfs:
         - /tmp
   ```

3. **Resource Limits:**
   ```yaml
   services:
     app:
       deploy:
         resources:
           limits:
             cpus: '1.0'
             memory: 512M
   ```

4. **Network Segmentation:**
   ```yaml
   networks:
     frontend:
       internal: false
     backend:
       internal: true
   ```

---

## Recursos

- [OWASP Docker Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Docker_Security_Cheat_Sheet.html)
- [CIS Docker Benchmark](https://www.cisecurity.org/benchmark/docker)
- [Trivy Documentation](https://aquasecurity.github.io/trivy/)
- [Spring Boot Security Best Practices](https://docs.spring.io/spring-boot/docs/current/reference/html/actuator.html#actuator.endpoints.security)
