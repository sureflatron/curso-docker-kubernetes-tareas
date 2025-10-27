# Stage 1: Build con Maven
FROM maven:3.9.6-eclipse-temurin-17-alpine AS build

# Establecer directorio de trabajo
WORKDIR /app

# Copiar archivos de configuración de Maven
COPY pom.xml ./

# Descargar dependencias (aprovecha cache de Docker)
RUN mvn dependency:go-offline -B

# Copiar código fuente
COPY src ./src

# Compilar y empaquetar la aplicación
RUN mvn clean package -DskipTests

# Stage 2: Runtime con JRE
FROM eclipse-temurin:17-jre-alpine

# Metadata y labels de seguridad
LABEL maintainer="alefiengo" \
      version="2.0.0" \
      description="Spring Boot API - Proyecto Integrador desplegado en Kubernetes" \
      security.scan="trivy" \
      security.non-root="true"

# Crear usuario no-root
RUN addgroup -g 1001 -S spring && \
    adduser -S spring -u 1001

# Establecer directorio de trabajo
WORKDIR /app

# Copiar JAR desde stage de build
COPY --from=build /app/target/*.jar app.jar

# Cambiar ownership al usuario spring
RUN chown -R spring:spring /app

# Cambiar a usuario no-root
USER spring

# Exponer puerto
EXPOSE 8080

# Variables de entorno para optimización JVM
ENV JAVA_OPTS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0 -XX:+UseG1GC -XX:+DisableExplicitGC"

# Health check usando actuator
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/actuator/health || exit 1

# Comando para iniciar la aplicación con optimizaciones
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
