# 🚀 Guía de Inicio Rápido - Dashboard Platform

## ✅ **¡La plataforma está lista!**

Tu plataforma completa de dashboards dinámicos con IA Gemini ha sido generada exitosamente.

## 📋 **Pasos para Ejecutar**

### 1. **Instalar Dependencias**
```bash
# Instalar dependencias del backend
cd backend
npm install

# Instalar dependencias del frontend
cd ../frontend
npm install

# Volver al directorio raíz
cd ..
```

### 2. **Configurar MongoDB**

**Opción A: Con Docker (Recomendado)**
```bash
# Iniciar solo MongoDB
docker-compose up mongodb -d
```

**Opción B: MongoDB Local**
- Instalar MongoDB en tu sistema
- Ejecutar: `mongod --dbpath /path/to/data`

### 3. **Iniciar la Aplicación**

**Opción A: Desarrollo**
```bash
# Terminal 1: Backend
cd backend
npm run dev

# Terminal 2: Frontend
cd frontend
npm run dev
```

**Opción B: Con Docker (Producción)**
```bash
docker-compose up -d
```

### 4. **Acceder a la Aplicación**
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000
- **Health Check**: http://localhost:5000/health

## 🎯 **Flujo de Usuario**

1. **Visita** http://localhost:3000
2. **Regístrate** con tu email y contraseña
3. **Crea un proyecto** con nombre y descripción
4. **Sube archivos** (CSV, JSON, Excel)
5. **Analiza con IA** - Gemini procesará automáticamente
6. **Ve los dashboards** generados dinámicamente
7. **Revisa la documentación** automática

## 🔧 **Configuración**

### Variables de Entorno (Ya configuradas)

**Backend (.env):**
- MongoDB: `mongodb://localhost:27017/dashboard-platform`
- Gemini API: `AIzaSyAoF1cm2X9C5bOrqEZuIT2tZVN6-cV5aAI`
- JWT Secret: Configurado para desarrollo

**Frontend (.env.local):**
- API URL: `http://localhost:5000/api`

## 🚨 **Solución de Problemas**

### Error de MongoDB
```bash
# Si MongoDB no está ejecutándose
docker-compose up mongodb -d
# O instalar MongoDB localmente
```

### Error de Puerto Ocupado
```bash
# Cambiar puertos en .env si es necesario
PORT=5001  # Backend
# Frontend usa puerto 3000 por defecto
```

### Error de Dependencias
```bash
# Limpiar e instalar de nuevo
rm -rf node_modules package-lock.json
npm install
```

## 📊 **Características Implementadas**

✅ **Landing Page** - Página de inicio atractiva  
✅ **Autenticación** - Registro y login completo  
✅ **Dashboard Principal** - Vista general de proyectos  
✅ **Gestión de Proyectos** - CRUD completo  
✅ **Subida de Archivos** - CSV, JSON, Excel  
✅ **IA Gemini** - Análisis automático de datos  
✅ **Visualizaciones Dinámicas** - Gráficos generados por IA  
✅ **Documentación Automática** - Reportes inteligentes  
✅ **API REST Completa** - Backend robusto  
✅ **Base de Datos MongoDB** - Almacenamiento optimizado  
✅ **Seguridad** - JWT, validación, rate limiting  

## 🎉 **¡Listo para Usar!**

Tu plataforma de dashboards dinámicos está completamente funcional. Los usuarios pueden:

- Registrarse y crear cuentas
- Subir datos en múltiples formatos
- Obtener análisis automático con IA Gemini
- Ver dashboards generados dinámicamente
- Acceder a documentación automática
- Gestionar múltiples proyectos

**¡Disfruta creando dashboards inteligentes! 🚀**

---

**Soporte**: Si encuentras algún problema, revisa los logs en la consola o contacta al equipo de desarrollo.