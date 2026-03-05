# 🚀 Dashboard Platform - Plataforma de Dashboards Dinámicos con IA

Una plataforma completa para crear dashboards dinámicos e inteligentes usando IA Gemini. Los usuarios pueden subir datos (JSON, CSV, etc.) y la IA genera automáticamente visualizaciones y documentación.

## ✨ Características

- 🤖 **IA Gemini**: Análisis automático de datos y generación de insights
- 📊 **Dashboards Dinámicos**: Visualizaciones adaptativas e interactivas
- 🔐 **Autenticación Completa**: Registro, login y gestión de usuarios
- 📁 **Gestión de Proyectos**: Organización jerárquica de datos
- 📄 **Documentación Automática**: Reportes generados por IA
- 🎨 **UI Moderna**: Interfaz responsiva con Tailwind CSS
- 🔒 **Seguridad**: JWT, validación de archivos, rate limiting

## 🏗️ Arquitectura

```
dashboard-platform/
├── frontend/          # Next.js 14 + TypeScript
├── backend/           # Express + TypeScript + MongoDB
├── shared/            # Types compartidos
└── docs/              # Documentación
```

## 🚀 Inicio Rápido

### Prerrequisitos
- Node.js 18+
- MongoDB
- API Key de Gemini AI

### Instalación

1. **Clonar e instalar dependencias:**
```bash
git clone <repo>
cd dashboard-platform
npm run install:all
```

2. **Configurar variables de entorno:**
```bash
# Backend (.env)
MONGODB_URI=mongodb://localhost:27017/dashboard-platform
JWT_SECRET=tu-jwt-secret-super-seguro
GEMINI_API_KEY=AIzaSyAoF1cm2X9C5bOrqEZuIT2tZVN6-cV5aAI
PORT=5000

# Frontend (.env.local)
NEXT_PUBLIC_API_URL=http://localhost:5000/api
```

3. **Ejecutar en desarrollo:**
```bash
npm run dev
```

4. **Acceder a la aplicación:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000

## 📱 Flujo de Usuario

1. **Landing Page** - Información sobre la plataforma
2. **Registro/Login** - Autenticación de usuarios
3. **Dashboard Principal** - Vista general de proyectos
4. **Crear Proyecto** - Nuevo proyecto con nombre y descripción
5. **Subir Datos** - Archivos JSON, CSV, Excel
6. **IA Genera Dashboards** - Análisis automático con Gemini
7. **Visualizar y Documentar** - Dashboards interactivos y reportes

## 🛠️ Stack Tecnológico

### Frontend
- **Next.js 14** - Framework React con App Router
- **TypeScript** - Tipado estático
- **Tailwind CSS** - Estilos utilitarios
- **Shadcn/ui** - Componentes UI
- **Chart.js/Recharts** - Visualizaciones
- **React Query** - Gestión de estado servidor
- **React Hook Form + Zod** - Formularios y validación

### Backend
- **Node.js + Express** - Servidor API REST
- **TypeScript** - Tipado estático
- **MongoDB + Mongoose** - Base de datos NoSQL
- **JWT** - Autenticación
- **Multer** - Subida de archivos
- **Gemini AI** - Análisis inteligente de datos

## 🔧 Scripts Disponibles

```bash
npm run dev              # Desarrollo (frontend + backend)
npm run build            # Build producción
npm run start            # Producción
npm run install:all      # Instalar todas las dependencias
```

## 📊 API Endpoints

### Autenticación
- `POST /api/auth/register` - Registro de usuario
- `POST /api/auth/login` - Login de usuario
- `GET /api/auth/me` - Perfil del usuario

### Proyectos
- `GET /api/projects` - Listar proyectos del usuario
- `POST /api/projects` - Crear nuevo proyecto
- `GET /api/projects/:id` - Obtener proyecto específico
- `PUT /api/projects/:id` - Actualizar proyecto
- `DELETE /api/projects/:id` - Eliminar proyecto

### Datos y Dashboards
- `POST /api/projects/:id/upload` - Subir archivo de datos
- `GET /api/projects/:id/dashboard` - Obtener dashboard generado
- `POST /api/projects/:id/analyze` - Analizar datos con IA
- `GET /api/projects/:id/documentation` - Obtener documentación

## 🤖 Integración Gemini AI

La plataforma utiliza Gemini AI para:
- Análisis automático de datasets
- Detección de patrones y anomalías
- Generación de insights y narrativas
- Recomendaciones de visualizaciones
- Creación de documentación automática

## 🔒 Seguridad

- Autenticación JWT
- Validación de archivos subidos
- Rate limiting por usuario
- Sanitización de datos
- Protección CORS
- Headers de seguridad

## 📈 Próximas Funcionalidades

- [ ] Colaboración en tiempo real
- [ ] Exportación de dashboards
- [ ] Plantillas predefinidas
- [ ] Integración con APIs externas
- [ ] Alertas y notificaciones
- [ ] Análisis predictivo avanzado

## 🤝 Contribuir

1. Fork del proyecto
2. Crear rama feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit cambios (`git commit -am 'Agregar nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Crear Pull Request

## 📄 Licencia

MIT License - ver archivo [LICENSE](LICENSE) para detalles.

---

**Desarrollado con ❤️ usando IA Gemini y tecnologías modernas**