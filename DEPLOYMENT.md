# 🚀 Guía de Despliegue - Dashboard Platform

Esta guía te ayudará a desplegar la plataforma de dashboards dinámicos en diferentes entornos.

## 📋 Prerrequisitos

- Node.js 18 o superior
- MongoDB 5.0 o superior
- Docker y Docker Compose (opcional)
- API Key de Gemini AI

## 🛠️ Configuración Inicial

### 1. Clonar el Repositorio

```bash
git clone <repository-url>
cd dashboard-platform
```

### 2. Ejecutar Script de Configuración

```bash
chmod +x scripts/setup.sh
./scripts/setup.sh
```

### 3. Configurar Variables de Entorno

#### Backend (.env)
```env
MONGODB_URI=mongodb://localhost:27017/dashboard-platform
JWT_SECRET=tu-jwt-secret-super-seguro-cambialo-en-produccion
GEMINI_API_KEY=tu-api-key-de-gemini
PORT=5000
NODE_ENV=production
FRONTEND_URL=http://localhost:3000
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
MAX_FILE_SIZE=10485760
UPLOAD_DIR=uploads
```

#### Frontend (.env.local)
```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
NEXT_PUBLIC_APP_NAME="Dashboard Platform"
NEXT_PUBLIC_APP_DESCRIPTION="Plataforma de dashboards dinámicos con IA"
NODE_ENV=production
```

## 🐳 Despliegue con Docker

### Desarrollo
```bash
# Iniciar solo la base de datos
docker-compose up mongodb -d

# Ejecutar en modo desarrollo
npm run dev
```

### Producción
```bash
# Construir y ejecutar todos los servicios
docker-compose up -d

# Ver logs
docker-compose logs -f

# Detener servicios
docker-compose down
```

## 🖥️ Despliegue Manual

### 1. Base de Datos MongoDB

#### Opción A: MongoDB Local
```bash
# Instalar MongoDB
# Ubuntu/Debian
sudo apt-get install mongodb

# macOS
brew install mongodb-community

# Iniciar MongoDB
mongod --dbpath /path/to/data
```

#### Opción B: MongoDB Atlas (Recomendado para producción)
1. Crear cuenta en [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Crear cluster
3. Obtener string de conexión
4. Actualizar `MONGODB_URI` en `.env`

### 2. Backend

```bash
cd backend

# Instalar dependencias
npm install

# Construir aplicación
npm run build

# Iniciar en producción
npm start
```

### 3. Frontend

```bash
cd frontend

# Instalar dependencias
npm install

# Construir aplicación
npm run build

# Iniciar en producción
npm start
```

## ☁️ Despliegue en la Nube

### Vercel (Frontend)

1. **Conectar repositorio:**
   - Ir a [Vercel](https://vercel.com)
   - Importar proyecto desde Git
   - Seleccionar carpeta `frontend`

2. **Configurar variables de entorno:**
   ```
   NEXT_PUBLIC_API_URL=https://tu-backend-url.com/api
   NEXT_PUBLIC_APP_NAME=Dashboard Platform
   NEXT_PUBLIC_APP_DESCRIPTION=Plataforma de dashboards dinámicos con IA
   ```

3. **Configurar build:**
   - Build Command: `npm run build`
   - Output Directory: `.next`
   - Install Command: `npm install`

### Railway/Render (Backend)

1. **Conectar repositorio:**
   - Crear nuevo servicio
   - Conectar con GitHub
   - Seleccionar carpeta `backend`

2. **Configurar variables de entorno:**
   ```
   MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/dashboard-platform
   JWT_SECRET=tu-jwt-secret-super-seguro
   GEMINI_API_KEY=tu-api-key-de-gemini
   PORT=5000
   NODE_ENV=production
   FRONTEND_URL=https://tu-frontend-url.vercel.app
   ```

3. **Configurar build:**
   - Build Command: `npm run build`
   - Start Command: `npm start`

### Heroku

1. **Preparar aplicación:**
   ```bash
   # Instalar Heroku CLI
   npm install -g heroku

   # Login
   heroku login

   # Crear aplicaciones
   heroku create dashboard-platform-api
   heroku create dashboard-platform-web
   ```

2. **Backend en Heroku:**
   ```bash
   cd backend
   
   # Configurar variables
   heroku config:set MONGODB_URI=mongodb+srv://... -a dashboard-platform-api
   heroku config:set JWT_SECRET=tu-secret -a dashboard-platform-api
   heroku config:set GEMINI_API_KEY=tu-api-key -a dashboard-platform-api
   
   # Deploy
   git subtree push --prefix backend heroku main
   ```

3. **Frontend en Heroku:**
   ```bash
   cd frontend
   
   # Configurar variables
   heroku config:set NEXT_PUBLIC_API_URL=https://dashboard-platform-api.herokuapp.com/api -a dashboard-platform-web
   
   # Deploy
   git subtree push --prefix frontend heroku main
   ```

## 🔧 Configuración de Producción

### Seguridad

1. **JWT Secret:**
   ```bash
   # Generar secret seguro
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```

2. **CORS:**
   - Configurar `FRONTEND_URL` correctamente
   - Restringir orígenes en producción

3. **Rate Limiting:**
   - Ajustar `RATE_LIMIT_MAX_REQUESTS` según necesidades
   - Implementar rate limiting por IP

### Performance

1. **MongoDB:**
   - Crear índices apropiados
   - Configurar connection pooling
   - Usar MongoDB Atlas para mejor performance

2. **Archivos:**
   - Configurar CDN para archivos estáticos
   - Implementar compresión de archivos
   - Limitar tamaño de uploads

3. **Caching:**
   - Implementar Redis para sesiones
   - Configurar cache de API responses
   - Usar CDN para assets estáticos

### Monitoreo

1. **Logs:**
   ```bash
   # Ver logs en Docker
   docker-compose logs -f backend
   docker-compose logs -f frontend
   
   # Ver logs en producción
   pm2 logs
   ```

2. **Health Checks:**
   - Backend: `GET /health`
   - Frontend: Configurar en load balancer

3. **Métricas:**
   - Implementar APM (New Relic, DataDog)
   - Monitorear uso de memoria y CPU
   - Alertas para errores críticos

## 🔄 Actualizaciones

### Desarrollo
```bash
# Actualizar dependencias
npm update

# Ejecutar tests
npm test

# Deploy
git push origin main
```

### Producción
```bash
# Backup de base de datos
mongodump --uri="mongodb://..." --out=backup/

# Deploy con Docker
docker-compose pull
docker-compose up -d

# Deploy manual
npm run build
pm2 restart all
```

## 🆘 Troubleshooting

### Problemas Comunes

1. **Error de conexión a MongoDB:**
   - Verificar string de conexión
   - Comprobar firewall/security groups
   - Validar credenciales

2. **Error de API Key de Gemini:**
   - Verificar que la key sea válida
   - Comprobar límites de uso
   - Revisar permisos de la API

3. **Error de CORS:**
   - Configurar `FRONTEND_URL` correctamente
   - Verificar headers de CORS
   - Comprobar protocolo (HTTP vs HTTPS)

### Logs Útiles

```bash
# Backend logs
tail -f backend/logs/error.log

# MongoDB logs
tail -f /var/log/mongodb/mongod.log

# Docker logs
docker-compose logs -f --tail=100
```

## 📞 Soporte

Para problemas de despliegue:
1. Revisar logs de aplicación
2. Verificar configuración de variables de entorno
3. Comprobar conectividad de red
4. Consultar documentación de la plataforma de hosting

---

**¡Tu plataforma de dashboards dinámicos está lista para transformar datos en insights! 🚀**