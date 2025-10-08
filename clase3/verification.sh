# verification.sh
#!/bin/bash
echo "✅ Servicios corriendo:"
docker compose ps

echo "🔗 Redes:"
docker network ls | grep app-network

echo "💾 Volúmenes:"
docker volume ls | grep db-data

echo "🌐 Web accesible en: http://localhost:8080"
echo "🗄️ Adminer en: http://localhost:8081"