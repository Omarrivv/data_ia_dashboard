#!/bin/bash

# Dashboard Platform Setup Script
echo "🚀 Configurando Dashboard Platform..."

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Función para imprimir mensajes
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Verificar si Node.js está instalado
if ! command -v node &> /dev/null; then
    print_error "Node.js no está instalado. Por favor instala Node.js 18+ antes de continuar."
    exit 1
fi

# Verificar versión de Node.js
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    print_error "Se requiere Node.js 18 o superior. Versión actual: $(node -v)"
    exit 1
fi

print_success "Node.js $(node -v) detectado"

# Verificar si MongoDB está instalado o Docker está disponible
if ! command -v mongod &> /dev/null && ! command -v docker &> /dev/null; then
    print_error "Se requiere MongoDB o Docker para ejecutar la base de datos."
    exit 1
fi

# Crear archivos de configuración si no existen
print_status "Configurando archivos de entorno..."

# Backend .env
if [ ! -f "backend/.env" ]; then
    cp backend/.env.example backend/.env
    print_success "Archivo backend/.env creado"
else
    print_warning "backend/.env ya existe"
fi

# Frontend .env.local
if [ ! -f "frontend/.env.local" ]; then
    cp frontend/.env.local.example frontend/.env.local
    print_success "Archivo frontend/.env.local creado"
else
    print_warning "frontend/.env.local ya existe"
fi

# Instalar dependencias
print_status "Instalando dependencias..."

# Root dependencies
if [ -f "package.json" ]; then
    npm install
    print_success "Dependencias raíz instaladas"
fi

# Backend dependencies
print_status "Instalando dependencias del backend..."
cd backend
npm install
cd ..
print_success "Dependencias del backend instaladas"

# Frontend dependencies
print_status "Instalando dependencias del frontend..."
cd frontend
npm install
cd ..
print_success "Dependencias del frontend instaladas"

# Crear directorio de uploads
mkdir -p backend/uploads
print_success "Directorio de uploads creado"

# Verificar configuración de Gemini API
print_status "Verificando configuración..."

if grep -q "AIzaSyAoF1cm2X9C5bOrqEZuIT2tZVN6-cV5aAI" backend/.env; then
    print_warning "Usando API key de Gemini de ejemplo. Considera cambiarla en producción."
fi

# Mostrar instrucciones finales
echo ""
print_success "¡Configuración completada!"
echo ""
echo -e "${BLUE}📋 Próximos pasos:${NC}"
echo ""
echo "1. 🗄️  Iniciar MongoDB:"
echo "   - Con Docker: docker-compose up mongodb -d"
echo "   - Local: mongod --dbpath /path/to/data"
echo ""
echo "2. 🚀 Iniciar la aplicación:"
echo "   - Desarrollo: npm run dev"
echo "   - Producción: docker-compose up -d"
echo ""
echo "3. 🌐 Acceder a la aplicación:"
echo "   - Frontend: http://localhost:3000"
echo "   - Backend API: http://localhost:5000"
echo ""
echo -e "${GREEN}¡Listo para crear dashboards inteligentes! 🎉${NC}"