# 🚀 Dashboard Platform — Documentación Completa del Proyecto

> Plataforma SaaS para análisis inteligente de datos y generación automática de dashboards usando IA (Gemini).

---

## ÍNDICE

1. [Arquitectura del Proyecto](#1-arquitectura-del-proyecto)
2. [Explicación de Carpetas](#2-explicación-de-carpetas)
3. [Explicación Archivo por Archivo](#3-explicación-archivo-por-archivo)
4. [Explicación Línea por Línea](#4-explicación-línea-por-línea)
5. [Librerías Usadas](#5-librerías-usadas)
6. [Explicación para No Programadores](#6-explicación-para-no-programadores)
7. [Documentación Técnica Profesional](#7-documentación-técnica-profesional)
8. [README para GitHub](#8-readme-para-github)
9. [Manual de Usuario](#9-manual-de-usuario)
10. [Análisis Profesional del Proyecto](#10-análisis-profesional-del-proyecto)

---

# 1. ARQUITECTURA DEL PROYECTO

## Tipo de Arquitectura

El proyecto usa una arquitectura **Cliente-Servidor en capas** (Layered Client-Server), también conocida como arquitectura **MVC extendida** (Model-View-Controller), distribuida en dos aplicaciones separadas:

```
┌─────────────────────────────────────────────────────────────────────┐
│                          USUARIO (Navegador)                        │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │ HTTP / REST
┌──────────────────────────────────▼──────────────────────────────────┐
│                    FRONTEND — Next.js (Puerto 3000)                 │
│                                                                     │
│  Páginas (App Router)  →  Componentes  →  Hooks / Context          │
│  React Query (caché)   →  Axios (HTTP)  →  Tailwind CSS (estilos)  │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │ REST API (JSON)
┌──────────────────────────────────▼──────────────────────────────────┐
│                    BACKEND — Express.js (Puerto 5000)               │
│                                                                     │
│  Routes  →  Middleware  →  Controllers (dentro de routes)          │
│  Models (Mongoose)      →  Services (Gemini)                       │
└──────────────┬───────────────────────────┬──────────────────────────┘
               │                           │
┌──────────────▼──────────┐   ┌────────────▼────────────────────────┐
│  MongoDB (Puerto 27017) │   │  Google Gemini API (Internet)       │
│  Base de datos NoSQL    │   │  Análisis de datos con IA           │
└─────────────────────────┘   └─────────────────────────────────────┘
```

## Flujo Completo de Datos

### Flujo de Autenticación

```
Usuario ingresa email/contraseña
         ↓
Frontend → POST /api/auth/login
         ↓
Backend valida con Joi
         ↓
Busca usuario en MongoDB
         ↓
Compara contraseña con bcrypt
         ↓
Genera JWT (expira en 7 días)
         ↓
Devuelve { user, token }
         ↓
Frontend guarda token en localStorage
         ↓
Cada petición futura incluye: Authorization: Bearer <token>
```

### Flujo de Análisis con IA

```
Usuario sube CSV/Excel/JSON
         ↓
Frontend → POST /api/upload/:projectId (archivo en RAM con multer memoryStorage)
         ↓
Backend parsea archivo desde buffer (sin tocar disco)
         ↓
Extrae datos + genera metadatos (columnas, tipos, filas)
         ↓
Guarda data en MongoDB dentro del proyecto
         ↓
Usuario hace clic en "Analizar con IA"
         ↓
Frontend → POST /api/projects/:id/analyze
         ↓
Backend extrae dataset de MongoDB
         ↓
Arma prompt con metadatos + muestra de datos
         ↓
Envía a Google Gemini API → recibe insights JSON
         ↓
Genera documentación HTML (otro prompt a Gemini)
         ↓
Genera dashboard con widgets (charts) automáticamente
         ↓
Guarda todo en MongoDB (proyecto.dashboard + proyecto.documentation)
         ↓
Frontend refresca datos con React Query
         ↓
Muestra dashboard interactivo + documentación
```

## Cómo Funciona la Autenticación

1. **Registro/Login**: El usuario envía credenciales → backend verifica → genera JWT firmado con `JWT_SECRET`.
2. **Protección de rutas**: Cada ruta privada del backend tiene el middleware `authenticate` que:
   - Lee el header `Authorization: Bearer <token>`
   - Verifica y decodifica el JWT
   - Busca el usuario en MongoDB
   - Adjunta `req.user` al request para que los controllers lo usen
3. **Frontend**: Guarda el token en `localStorage`, lo inyecta automáticamente en cada petición via interceptor de axios.

## Cómo Funciona la Base de Datos

MongoDB con **2 colecciones**:

- **`users`**: Usuarios registrados. La contraseña se hashea con bcrypt antes de guardar (nunca se guarda en texto plano).
- **`projects`**: Proyectos de cada usuario. Cada proyecto contiene embebido sus datasets, dashboard y documentación. Se usa **embedding** (datos del dashboard dentro del proyecto) en vez de referencias separadas porque un dashboard no existe sin su proyecto.

---

# 2. EXPLICACIÓN DE CARPETAS

## Raíz del Proyecto
```
sass_marzo_2026/
├── backend/           ← Servidor API (Node.js + Express + TypeScript)
├── frontend/          ← Aplicación web (Next.js + React + TypeScript)
├── scripts/           ← Scripts de inicialización (MongoDB seed, shell setup)
├── shared/            ← Tipos TypeScript compartidos entre backend y frontend
├── docker-compose.yml ← Orquestación de contenedores para producción
└── README.md
```

## Estructura del Backend

```
backend/
├── src/
│   ├── config/         ← CONFIGURACIÓN: conexión a bases de datos externas
│   ├── middleware/     ← INTERCEPTORES: código que corre ANTES de cada ruta
│   ├── models/         ← ESQUEMAS: define cómo se guardan los datos en MongoDB
│   ├── routes/         ← RUTAS + CONTROLLERS: define los endpoints de la API
│   ├── services/       ← SERVICIOS EXTERNOS: lógica de integración con Gemini
│   ├── types/          ← CONTRATOS: interfaces TypeScript del dominio
│   ├── server.ts       ← PUNTO DE ENTRADA: arranca el servidor
│   └── dev.ts          ← SCRIPT DE DESARROLLO: helper para cargar .env
```

### `config/` — Por qué existe
Separa la lógica de configuración de la lógica de negocio. Si cambias de MongoDB a PostgreSQL, solo tocas este archivo. Principio: **Single Responsibility**.

### `middleware/` — Por qué existe
Los middlewares son funciones que interceptan las peticiones HTTP antes de llegar a la ruta. Son transversales: aplican a muchas rutas. Si los mezclas con las rutas, duplicas código. Aquí viven dos responsabilidades clave: **autenticación** y **manejo centralizado de errores**.

### `models/` — Por qué existe
Define la estructura de los datos (esquemas Mongoose). Es la capa **M** del MVC. Concentra todas las reglas de datos: validaciones, transformaciones, índices, métodos de instancia.

### `routes/` — Por qué existe
Define los endpoints HTTP y contiene la lógica de negocio de cada operación (en proyectos pequeños-medianos, el controller vive dentro del route handler). Es la capa **C** del MVC.

### `services/` — Por qué existe
Aísla integraciones con APIs externas. Si Google cambia su API de Gemini, solo tocas este archivo. Esto es el patrón **Service Layer**: la lógica de negocio compleja vive aquí, no dentro de los routes.

### `types/` — Por qué existe
TypeScript necesita conocer la forma de los datos en tiempo de compilación. Centralizar los tipos evita duplicación y garantiza consistencia entre todos los archivos del backend.

## Estructura del Frontend

```
frontend/
├── src/
│   ├── app/            ← PÁGINAS: App Router de Next.js 14 (cada carpeta = URL)
│   ├── components/     ← COMPONENTES REUTILIZABLES: piezas de UI
│   ├── contexts/       ← ESTADO GLOBAL: datos compartidos entre páginas (Auth)
│   ├── hooks/          ← LÓGICA REUTILIZABLE: funciones custom para componentes
│   ├── lib/            ← UTILIDADES: cliente HTTP (axios) configurado
│   └── types/          ← CONTRATOS: interfaces TypeScript del frontend
```

### `app/` — Por qué existe
Next.js 14 usa **App Router**: cada carpeta es una URL. `app/dashboard/projects/[id]/page.tsx` = `/dashboard/projects/123`. Esto elimina la necesidad de configurar un router manualmente.

### `contexts/` — Por qué existe
El estado del usuario autenticado se necesita en MUCHAS páginas simultáneamente. React Context permite compartir ese estado sin pasar props por 10 niveles de componentes (problema conocido como "prop drilling").

### `lib/` — Por qué existe
Centraliza la instancia de axios con su configuración base (URL, timeout, interceptores de token). Si el día de mañana cambias la URL del backend, solo tocas un archivo.

---

# 3. EXPLICACIÓN ARCHIVO POR ARCHIVO

## `backend/src/config/database.ts`

**Qué hace**: Gestiona la conexión a MongoDB usando Mongoose.

**Por qué existe**: Necesitas conectar a MongoDB una sola vez al arrancar el servidor. Si la conexión falla, el servidor no debe arrancar (por eso `process.exit(1)`).

**Cómo se conecta**: Es importado por `server.ts` que llama `connectDB()` antes de registrar las rutas.

**Problema que resuelve**: Centraliza la lógica de conexión, desconexión y reconexión automática. Si MongoDB se cae y vuelve, el evento `reconnected` lo detecta.

---

## `backend/src/middleware/auth.ts`

**Qué hace**: Verifica que el usuario que hace una petición tiene un JWT válido.

**Por qué existe**: Sin este middleware, cualquier persona podría acceder a los datos de cualquier usuario. Es el "portero" de las rutas privadas.

**Cómo se conecta**: Se importa en cada archivo de rutas: `router.use(authenticate)`. Adjunta `req.user` para que los handlers sepan quién está haciendo la petición.

**Problema que resuelve**: Autenticación stateless — no necesita sesiones ni cookies. El token viaja en cada petición y se verifica en milisegundos.

---

## `backend/src/middleware/errorHandler.ts`

**Qué hace**: Captura TODOS los errores del servidor y devuelve respuestas HTTP consistentes.

**Por qué existe**: Sin él, cada route tendría su propio try/catch con su propio formato de error. Con él, solo necesitas hacer `throw createError('mensaje', 404)` desde cualquier punto y este middleware lo atrapa.

**Cómo se conecta**: Se registra en `server.ts` como el ÚLTIMO middleware con `app.use(errorHandler)`. Express lo llama cuando un handler pasa un error a `next(error)` o cuando `asyncHandler` lo captura.

**Errores que maneja**:
- Validación Mongoose → 400
- ID inválido (CastError) → 400
- Email duplicado (código 11000) → 400
- JWT inválido/expirado → 401
- Archivo muy grande → 413
- Cualquier otro → 500

---

## `backend/src/models/User.ts`

**Qué hace**: Define el esquema del usuario en MongoDB y sus comportamientos.

**Por qué existe**: MongoDB no tiene esquema por defecto (es "schemaless"). Mongoose agrega validaciones, tipos y métodos a los documentos.

**Características clave**:
- `select: false` en `password` → la contraseña nunca se devuelve en queries por defecto
- `pre('save')` → hashea automáticamente la contraseña antes de guardarla (bcrypt con 12 rondas)
- `comparePassword()` → método de instancia para verificar contraseñas en el login
- `toJSON.transform` → elimina `__v` y `password` al serializar a JSON

**Problema que resuelve**: Garantiza que nunca se guarden contraseñas en texto plano y que nunca se expongan en las respuestas API.

---

## `backend/src/models/Project.ts`

**Qué hace**: Define la estructura completa de un proyecto con sus datasets, dashboard y documentación embebidos.

**Por qué existe**: Agrupa en un solo documento de MongoDB todo lo relacionado a un proyecto. Esto se llama **embedding** y reduce el número de queries necesarias.

**Esquemas embebidos**:
- `datasetSchema` → cada archivo subido (datos + metadatos)
- `widgetSchema` → cada gráfico del dashboard
- `dashboardSchema` → colección de widgets + layout
- `projectSchema` → todo lo anterior + info del proyecto

**Método `getStats()`**: Calcula estadísticas del proyecto (total filas, tamaño, si tiene dashboard/docs) sin hacer queries adicionales.

---

## `backend/src/services/geminiService.ts`

**Qué hace**: Toda la inteligencia artificial del sistema. Habla con la API de Google Gemini para:
1. Analizar datasets y generar insights
2. Generar documentación HTML del proyecto
3. Generar configuración de widgets/dashboard

**Por qué existe**: Aísla la complejidad de las prompts y el parsing de respuestas de Gemini. Si mañana cambias a OpenAI, solo reescribes este archivo.

**Cómo funciona internamente**:
1. Construye un prompt con los metadatos del dataset (columnas, tipos, muestra de datos)
2. Envía a Gemini y recibe texto/JSON
3. Parsea la respuesta (con fallback si el JSON viene con ` ```json ` markers)
4. Si Gemini da error de cuota, genera un análisis de respaldo sin IA

---

## `backend/src/server.ts`

**Qué hace**: Es el punto de entrada del backend. Configura y arranca Express.

**Orden de configuración** (el orden importa en Express):
1. `dotenv.config()` → carga .env PRIMERO
2. `helmet()` → headers de seguridad
3. `cors()` → permite peticiones desde el frontend
4. `rateLimit()` → limita a 100 req/15min por IP
5. `morgan()` → logging de peticiones
6. `express.json()` → parsea body JSON
7. Rutas de la API
8. `errorHandler` → captura errores (SIEMPRE al final)

---

## `backend/src/dev.ts`

**Qué hace**: Script auxiliar que carga el `.env` con la ruta absoluta correcta antes de iniciar el servidor en desarrollo.

**Por qué existe**: Cuando `nodemon` ejecuta TypeScript, el `process.cwd()` puede no ser la carpeta correcta. Este script asegura que las variables de entorno se carguen desde `backend/.env` sin importar desde dónde se ejecute.

**Problema que resuelve**: El bug clásico de "GEMINI_API_KEY no encontrada" en desarrollo cuando el .env está en el lugar correcto pero no se carga.

---

## `backend/src/types/index.ts`

**Qué hace**: Define todas las interfaces TypeScript del dominio del sistema.

**Por qué existe**: TypeScript necesita saber la "forma" de cada objeto en tiempo de compilación. Centralizar los tipos evita inconsistencias: si cambias `User`, lo cambias en un solo lugar y TypeScript te avisa en todo el código donde se usa.

**Interfaces clave**:
- `ApiResponse<T>` → todas las respuestas de la API tienen la misma estructura
- `Dataset`, `Widget`, `Dashboard` → contratos del dominio de datos
- `GeminiAnalysisResult` → lo que devuelve el análisis de IA
- `ProjectStatus` (enum) → DRAFT, ANALYZING, READY, ERROR

---

## `backend/src/routes/auth.ts`

**Qué hace**: Endpoints de autenticación.

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/auth/register` | Registro de nuevo usuario |
| POST | `/api/auth/login` | Login, devuelve JWT |
| GET | `/api/auth/me` | Perfil del usuario autenticado |
| PUT | `/api/auth/profile` | Actualizar nombre/email |
| POST | `/api/auth/change-password` | Cambiar contraseña |

**Validación**: Joi valida los datos de entrada antes de tocar la base de datos.

---

## `backend/src/routes/projects.ts`

**Qué hace**: CRUD de proyectos + análisis con IA.

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/projects` | Listar proyectos (paginado, búsqueda) |
| POST | `/api/projects` | Crear proyecto |
| GET | `/api/projects/:id` | Obtener proyecto completo |
| PUT | `/api/projects/:id` | Actualizar nombre/descripción |
| DELETE | `/api/projects/:id` | Eliminar proyecto |
| POST | `/api/projects/:id/analyze` | **Analizar con Gemini** |

---

## `backend/src/routes/upload.ts`

**Qué hace**: Subida y gestión de archivos de datos (CSV, JSON, Excel).

**Cómo funciona**:
1. `multer.memoryStorage()` → el archivo va a RAM, nunca al disco
2. Parsea el buffer según tipo (CSV desde stream, JSON desde string, Excel con XLSX.read)
3. Genera metadatos: columnas, tipos de datos, estadísticas básicas
4. Guarda los datos (máx 1000 filas) en MongoDB dentro del proyecto

---

## `frontend/src/lib/api.ts`

**Qué hace**: Cliente HTTP centralizado. Define todas las llamadas al backend.

**Interceptores**:
- **Request**: Inyecta `Authorization: Bearer <token>` en cada petición
- **Response**: Si llega 401, borra el token y redirige al login

---

## `frontend/src/contexts/AuthContext.tsx`

**Qué hace**: Estado global de autenticación accesible desde cualquier componente.

**Flujo al cargar la app**:
1. Lee token de `localStorage`
2. Verifica que sigue siendo válido llamando `GET /api/auth/me`
3. Si es válido → usuario autenticado
4. Si no → limpia localStorage

---

# 4. EXPLICACIÓN LÍNEA POR LÍNEA

## `backend/src/server.ts` — Línea por Línea

```typescript
import dotenv from 'dotenv';
```
Importa la librería `dotenv`. Sin esta línea, `process.env.JWT_SECRET` sería `undefined` porque Node.js no lee archivos `.env` por defecto.

```typescript
dotenv.config();
```
Ejecuta la carga del `.env` INMEDIATAMENTE, antes que cualquier otro import que pueda necesitar las variables. Si se pusiera después de los imports, algunos módulos arrancarían sin las variables.

```typescript
import express from 'express';
```
Importa el framework web. Express es el núcleo que maneja el ciclo petición→middleware→respuesta.

```typescript
import cors from 'cors';
```
CORS (Cross-Origin Resource Sharing). Los navegadores bloquean por seguridad las peticiones desde `localhost:3000` hacia `localhost:5000`. Este middleware las permite explícitamente. Sin él, el frontend vería un error "Blocked by CORS policy".

```typescript
import helmet from 'helmet';
```
Agrega ~15 headers HTTP de seguridad automáticamente (X-Frame-Options, Content-Security-Policy, etc.). Protege contra clickjacking, XSS reflejado y sniffing de tipos MIME.

```typescript
import compression from 'compression';
```
Comprime las respuestas con gzip. Reduce el tamaño de los JSON en ~70%. Acelera la app especialmente en conexiones lentas.

```typescript
import morgan from 'morgan';
```
Logger de peticiones HTTP. En desarrollo muestra: `POST /api/auth/login 200 45ms`. Imprescindible para debugging.

```typescript
import rateLimit from 'express-rate-limit';
```
Limita el número de peticiones por IP. Protege contra ataques de fuerza bruta al login y DDoS.

```typescript
const app = express();
```
Crea la instancia de la aplicación Express. Es el objeto central al que se adjuntan todos los middlewares y rutas.

```typescript
const PORT = process.env.PORT || 5000;
```
Lee el puerto de las variables de entorno. En producción (Railway, Heroku) el puerto es asignado dinámicamente por la plataforma. El fallback `5000` es para desarrollo local.

```typescript
connectDB();
```
Conecta a MongoDB. Si falla, `connectDB` llama `process.exit(1)` y el proceso termina. Principio: fail fast — mejor no arrancar que funcionar sin persistencia.

```typescript
app.use(helmet());
```
`app.use()` registra un middleware global: se ejecuta en TODAS las peticiones que lleguen al servidor.

```typescript
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
```
Solo permite peticiones desde la URL definida en `.env`. `credentials: true` es necesario para que el navegador envíe el header `Authorization`.

```typescript
const limiter = rateLimit({ windowMs: 900000, max: 100 });
app.use('/api/', limiter);
```
Máximo 100 peticiones por IP en 15 minutos (900000ms = 15 * 60 * 1000). Solo aplica a rutas `/api/`, no a archivos estáticos.

```typescript
app.use(express.json({ limit: '10mb' }));
```
Parsea el body de las peticiones con `Content-Type: application/json`. Sin esto, `req.body` sería `undefined`. El límite de 10mb previene payloads maliciosos gigantes.

```typescript
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/dashboards', dashboardRoutes);
app.use('/api/upload', uploadRoutes);
```
Registra los grupos de rutas. `POST /api/auth/login` llama al handler de login definido en `authRoutes`. El orden importa si hay conflictos de paths.

```typescript
app.use(errorHandler);
```
El error handler SIEMPRE va al final. Express lo identifica como error handler porque tiene 4 parámetros `(err, req, res, next)`. Captura cualquier error que llegue via `next(error)` o sea lanzado dentro de `asyncHandler`.

---

## `backend/src/middleware/auth.ts` — Línea por Línea

```typescript
declare global {
  namespace Express {
    interface Request {
      user?: UserDocument;
    }
  }
}
```
**Module augmentation**: extiende el tipo `Request` de Express para agregarle la propiedad `user`. Sin esto TypeScript daría error de compilación cuando escribas `req.user` en los handlers.

```typescript
const authHeader = req.header('Authorization');
if (!authHeader || !authHeader.startsWith('Bearer ')) { ... }
```
Lee el header de autorización. Si no existe o no tiene el formato correcto (`Bearer xxx`), rechaza con 401 inmediatamente.

```typescript
const token = authHeader.substring(7);
```
Elimina los primeros 7 caracteres (`"Bearer "`) para quedarse solo con el token JWT. Índice 7 = longitud de "Bearer ".

```typescript
const decoded = jwt.verify(token, process.env.JWT_SECRET) as JwtPayload;
```
Verifica criptográficamente la firma del token. Si fue alterado, está expirado, o la firma no coincide, lanza una excepción. Si es válido, devuelve el payload decodificado `{ userId, email }`.

```typescript
const user = await User.findById(decoded.userId);
if (!user) { res.status(401).json(...); return; }
```
Aunque el token sea válido, el usuario podría haber sido eliminado de la BD. Este query es la segunda verificación de seguridad.

```typescript
req.user = user;
next();
```
Adjunta el usuario completo al objeto request (disponible en todos los handlers siguientes) y pasa el control al siguiente middleware/handler.

---

## `backend/src/models/User.ts` — Línea por Línea

```typescript
password: {
  type: String,
  select: false
}
```
`select: false` es la protección por defecto: cuando hagas `User.find()`, el campo `password` no se incluye en el resultado aunque exista en la BD. Previene exposición accidental.

```typescript
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
```
Hook pre-save. `isModified` devuelve `true` solo si el campo `password` cambió en esta operación. Sin esta condición, re-hashearías la contraseña cada vez que el usuario actualice su nombre.

```typescript
const salt = await bcrypt.genSalt(12);
this.password = await bcrypt.hash(this.password, salt);
```
`genSalt(12)` genera un salt único aleatorio con factor de trabajo 2^12. El hash resultante es diferente cada vez aunque sea la misma contraseña. Hace que los ataques de rainbow table sean inviables y los de fuerza bruta extremadamente lentos.

```typescript
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};
```
`bcrypt.compare` hashea la contraseña candidata con el mismo salt del hash guardado y compara. Nunca comparas en texto plano. Es el método correcto para verificar contraseñas hasheadas.

---

# 5. LIBRERÍAS USADAS

## Backend (`backend/package.json`)

| Librería | Para qué sirve | Por qué se usa en este proyecto |
|----------|----------------|----------------------------------|
| **express** | Framework HTTP para Node.js | Maneja rutas, middlewares y el ciclo petición-respuesta. Estándar de la industria |
| **mongoose** | ODM para MongoDB | Agrega esquemas, validaciones y métodos a MongoDB. Sin él harías queries crudos |
| **bcryptjs** | Hasheo de contraseñas | Algoritmo diseñado para ser lento. Protege contraseñas contra fuerza bruta |
| **jsonwebtoken** | JWT: firma y verificación | Autenticación stateless. El token porta la identidad sin necesitar sesiones en servidor |
| **cors** | Política CORS | Sin él el navegador bloquea las peticiones del frontend al backend |
| **helmet** | Headers de seguridad HTTP | ~15 headers de seguridad en una sola línea |
| **express-rate-limit** | Limitación de peticiones por IP | Protege el login y las rutas de IA contra abuso |
| **multer** | Subida de archivos multipart | Maneja `Content-Type: multipart/form-data` para archivos CSV/Excel |
| **csv-parser** | Parseo de CSV como stream | Convierte cada línea del CSV en un objeto JavaScript |
| **xlsx** | Lectura/escritura de Excel | Lee `.xls` y `.xlsx` y los convierte a arrays de objetos |
| **joi** | Validación de datos de entrada | Valida y sanitiza el body de las peticiones antes de procesarlas |
| **dotenv** | Variables de entorno | Lee el archivo `.env` y lo inyecta en `process.env` |
| **compression** | Compresión gzip | Reduce el tamaño de respuestas JSON en ~70% |
| **morgan** | Logger de peticiones HTTP | `GET /api/projects 200 15ms` — imprescindible para debugging |
| **@google/generative-ai** | SDK oficial de Google Gemini | Cliente para la API de IA que analiza los datasets |

## Frontend (`frontend/package.json`)

| Librería | Para qué sirve | Por qué se usa en este proyecto |
|----------|----------------|----------------------------------|
| **next** | Framework React (SSR, App Router) | Routing automático por carpetas, optimizaciones de rendimiento, SSR |
| **react / react-dom** | Librería de UI basada en componentes | Base de todo el frontend. Virtual DOM + componentes declarativos |
| **@tanstack/react-query** | Caché y sincronización estado servidor | Maneja loading/error/success, evita peticiones duplicadas, invalida caché |
| **axios** | Cliente HTTP | Interceptores para token + transformación automática de JSON |
| **tailwindcss** | CSS utility-first | Estilos directamente en JSX sin escribir CSS separado |
| **framer-motion** | Animaciones declarativas | Modal de carga animado, transiciones de página |
| **recharts** | Gráficos (basados en D3) | BarChart, LineChart, PieChart, AreaChart — los widgets del dashboard |
| **react-hot-toast** | Notificaciones toast | "Análisis completado ✓" — no intrusivas, desaparecen solas |
| **react-dropzone** | Zona drag & drop para archivos | UI para arrastrar el CSV directamente al navegador |
| **react-hook-form** | Formularios sin re-renders | Login/registro sin lag en cada keystroke |
| **zod** | Validación de schemas | Valida datos del formulario en el cliente antes de enviar |
| **@heroicons/react** | Iconos SVG | Set de iconos del equipo de Tailwind CSS, consistente con el diseño |
| **@radix-ui/** | Componentes headless accesibles | Dialogs, dropdowns, tabs con accesibilidad correcta (ARIA) |
| **lucide-react** | Iconos SVG alternativos | Complementa heroicons |
| **class-variance-authority** | Variantes de clases CSS | Para crear variantes de componentes (button primary/secondary/danger) |

---

# 6. EXPLICACIÓN PARA NO PROGRAMADORES

## Para un Inversionista

Imagina una empresa que tiene datos de ventas, clientes o inventario en archivos Excel. Normalmente necesitan contratar a un analista de datos que tarda días o semanas en crear reportes y gráficos personalizados.

**Dashboard Platform** hace ese trabajo en menos de 60 segundos usando Inteligencia Artificial. El usuario sube su Excel o CSV, y la IA genera automáticamente:
- Un **dashboard interactivo** con los gráficos más relevantes para sus datos
- Un **reporte detallado** explicando patrones, tendencias y anomalías
- Un **asistente de chat** para hacer preguntas sobre los datos en lenguaje natural

**Modelo de negocio**: SaaS (Software as a Service) — suscripción mensual por acceso. Como Notion o Google Analytics, pero para análisis de cualquier tipo de datos empresariales.

**Ventaja competitiva**: No requiere conocimiento técnico. Cualquier persona del área de ventas, marketing o finanzas puede usar el sistema sin contratar consultores.

---

## Para una Persona que No Sabe Programar

Piensa en el sistema como un **restaurante**:

- **El Frontend (Next.js)** es el **salón comedor**: lo que ves — las mesas, el menú, los platos presentados. Es la interfaz visual en el navegador.

- **El Backend (Express)** es la **cocina**: no la ves, pero es donde se prepara todo. Cuando pides "analizar datos", la cocina recibe la orden, prepara todo y te devuelve el resultado.

- **MongoDB** es la **despensa**: guarda todos los ingredientes (tus datos). Cuando cierras el navegador y vuelves mañana, tus proyectos siguen ahí porque están guardados en la despensa.

- **Google Gemini AI** es el **chef especialista externo**: la cocina le manda tus ingredientes (datos), él los analiza con su expertise y devuelve una receta (insights y gráficos).

- **El JWT (token)** es tu **número de mesa**: cuando llegas al restaurante, te asignan un número. Cada vez que pides algo, el mesero verifica tu número para saber que eres tú. Si pasan 7 días, el número expira y tienes que pedir uno nuevo (volver a iniciar sesión).

---

# 7. DOCUMENTACIÓN TÉCNICA PROFESIONAL

## Descripción del Sistema

Dashboard Platform es una aplicación web SaaS que permite a usuarios no técnicos analizar datasets (CSV, JSON, Excel) y obtener dashboards interactivos y documentación técnica generados automáticamente mediante IA (Google Gemini 2.5 Flash-Lite).

## Stack Tecnológico

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Runtime | Node.js | 18+ |
| Backend Framework | Express.js | 4.18 |
| Backend Language | TypeScript | 5.3 |
| Frontend Framework | Next.js | 14.2 |
| Frontend Language | TypeScript + React | 18.2 |
| Base de Datos | MongoDB | 6+ |
| ODM | Mongoose | 8.0 |
| IA | Google Gemini 2.5 Flash-Lite | - |
| Autenticación | JWT (jsonwebtoken) | 9.0 |
| Containerización | Docker + Docker Compose | - |

## Endpoints de la API

### Autenticación (`/api/auth`)

| Método | Ruta | Auth | Body | Descripción |
|--------|------|------|------|-------------|
| POST | `/register` | ❌ | `{name, email, password}` | Registro de usuario |
| POST | `/login` | ❌ | `{email, password}` | Login → retorna JWT |
| GET | `/me` | ✅ | - | Perfil del usuario actual |
| PUT | `/profile` | ✅ | `{name?, email?}` | Actualizar perfil |
| POST | `/change-password` | ✅ | `{currentPassword, newPassword}` | Cambiar contraseña |

### Proyectos (`/api/projects`)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/` | ✅ | Listar proyectos (params: page, limit, search, status) |
| POST | `/` | ✅ | Crear proyecto `{name, description}` |
| GET | `/:id` | ✅ | Obtener proyecto completo con datasets y dashboard |
| PUT | `/:id` | ✅ | Actualizar `{name?, description?}` |
| DELETE | `/:id` | ✅ | Eliminar proyecto |
| POST | `/:id/analyze` | ✅ | **Analizar datasets con Gemini AI** |
| POST | `/:id/chat` | ✅ | Chat sobre un widget específico |
| GET | `/:id/dashboard` | ✅ | Obtener datos del dashboard |
| GET | `/:id/documentation` | ✅ | Obtener documentación HTML |

### Uploads (`/api/upload`)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/:projectId` | ✅ | Subir archivo (multipart/form-data, campo: `file`) |
| GET | `/:projectId/datasets` | ✅ | Listar datasets del proyecto |
| GET | `/:projectId/datasets/:datasetId` | ✅ | Obtener dataset con datos |
| DELETE | `/:projectId/datasets/:datasetId` | ✅ | Eliminar dataset |

### Formato de Respuesta Estándar

```json
{
  "success": true,
  "data": { ... },
  "message": "Descripción opcional"
}
```

En caso de error:
```json
{
  "success": false,
  "message": "Descripción del error"
}
```

## Seguridad

| Medida | Implementación | Detalle |
|--------|---------------|---------|
| Autenticación | JWT HMAC-SHA256 | Expira en 7 días |
| Contraseñas | bcrypt | Salt factor 12 (2^12 iteraciones) |
| Headers HTTP | helmet | 15+ headers de seguridad |
| Rate Limiting | express-rate-limit | 100 req/15min por IP en `/api/` |
| CORS | cors | Solo permite origen del frontend |
| Validación inputs | Joi | Valida todos los body antes de procesar |
| Datos sensibles | Mongoose `select: false` | `password` nunca se devuelve en queries |
| Aislamiento de datos | Filtro por `userId` | Un usuario nunca accede a datos de otro |

## Variables de Entorno

```bash
# Backend (.env)
MONGODB_URI=mongodb://localhost:27017/dashboard-platform
JWT_SECRET=secreto-super-seguro-minimo-32-caracteres
GEMINI_API_KEY=AIzaSy...  # Obtener en aistudio.google.com
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
RATE_LIMIT_WINDOW_MS=900000    # 15 minutos
RATE_LIMIT_MAX_REQUESTS=100
MAX_FILE_SIZE=10485760         # 10MB en bytes

# Frontend (.env.local)
NEXT_PUBLIC_API_URL=http://localhost:5000/api
```

---

# 8. README PARA GITHUB

```markdown
# Dashboard Platform 🚀

Plataforma SaaS de análisis de datos impulsada por IA. Sube tus archivos CSV, 
Excel o JSON y obtén dashboards interactivos y documentación técnica generados 
automáticamente con Google Gemini.

## ✨ Características

- 📊 **Dashboards automáticos** — 5+ gráficos generados por IA en segundos
- 📝 **Documentación automática** — Reportes HTML completos sobre tus datos  
- 🤖 **Chat con tus gráficos** — Pregúntale a la IA sobre cualquier visualización
- 📁 **Multi-formato** — CSV, JSON, Excel (.xls, .xlsx)
- 🔒 **Autenticación segura** — JWT + bcrypt
- 📱 **Responsive** — Funciona en desktop y móvil

## 🛠 Tecnologías

**Backend**: Node.js · Express · TypeScript · MongoDB · Mongoose · JWT · Gemini AI  
**Frontend**: Next.js 14 · React 18 · TypeScript · Tailwind CSS · Recharts · React Query

## 🚀 Instalación

### Prerrequisitos
- Node.js 18+
- MongoDB 6+ corriendo en localhost:27017
- API Key gratuita de Google AI Studio: https://aistudio.google.com

### 1. Backend
cd backend
cp .env.example .env       # Editar con tus credenciales
npm install
npm run dev                # Puerto 5000

### 2. Frontend  
cd frontend
npm install
npm run dev                # Puerto 3000

## 📁 Estructura

sass_marzo_2026/
├── backend/src/
│   ├── config/      # Conexión MongoDB
│   ├── middleware/  # Auth + Error Handler
│   ├── models/      # User, Project (Mongoose schemas)
│   ├── routes/      # auth, projects, upload, dashboards
│   ├── services/    # GeminiService (IA)
│   └── types/       # Interfaces TypeScript
└── frontend/src/
    ├── app/         # Páginas (Next.js App Router)
    ├── components/  # Componentes reutilizables
    ├── contexts/    # AuthContext
    └── lib/         # Cliente axios configurado

## 🔑 Variables de Entorno Requeridas

| Variable | Descripción |
|----------|-------------|
| MONGODB_URI | URL de conexión a MongoDB |
| JWT_SECRET | Secreto para firmar tokens (min 32 chars) |
| GEMINI_API_KEY | API Key de Google AI Studio (gratuita) |
| FRONTEND_URL | URL del frontend para CORS |

## 🐳 Deploy con Docker

docker-compose up -d

## 📄 Licencia

MIT
```

---

# 9. MANUAL DE USUARIO

## ¿Qué es Dashboard Platform?

Es una herramienta en línea que analiza tus datos de negocio automáticamente usando Inteligencia Artificial. Sin necesidad de saber programación ni estadística.

Sube tu archivo Excel o CSV → la IA genera en segundos:
- Gráficos interactivos (barras, líneas, torta, área)
- Un reporte escrito con los hallazgos más importantes
- Un asistente de chat para hacer preguntas sobre tus datos

---

## Paso 1: Crear una Cuenta

1. Abre el navegador y ve a `http://localhost:3000`
2. Haz clic en **"Registrarse"**
3. Completa:
   - **Nombre completo**
   - **Email**
   - **Contraseña** (mínimo 6 caracteres)
4. Haz clic en **"Crear cuenta"**
5. Serás redirigido automáticamente al dashboard

> Tu sesión dura 7 días. Después tendrás que volver a iniciar sesión.

---

## Paso 2: Crear un Proyecto

Un **proyecto** es un espacio de trabajo para un análisis específico.  
Ejemplo: "Ventas Q1 2026", "Inventario Marzo", "Análisis de Clientes".

1. En el dashboard principal, haz clic en **"Nuevo Proyecto"** (botón verde)
2. Ingresa:
   - **Nombre** (obligatorio) — ej: "Análisis de Ventas"
   - **Descripción** (opcional) — ej: "Ventas mensuales por región 2026"
3. Haz clic en **"Crear"**

---

## Paso 3: Subir tus Datos

1. Dentro del proyecto, ve a la pestaña **"Datasets"**
2. Arrastra tu archivo a la zona azul, o haz clic en ella para seleccionarlo
3. **Formatos aceptados**: CSV, Excel (.xls, .xlsx), JSON
4. **Tamaño máximo**: 10MB
5. Espera el mensaje de confirmación verde

**Requisitos del archivo:**
- La **primera fila** debe contener los nombres de las columnas
- Sin filas completamente vacías en el medio
- Nombres de columnas descriptivos (ej: `ventas_enero`, no `col1`)

---

## Paso 4: Analizar con IA

1. Con el dataset cargado, haz clic en el botón verde **"Analizar con IA"** (arriba a la derecha)
2. Aparece un **modal de carga** animado — la IA está procesando tus datos
3. El proceso toma entre **15 y 60 segundos** dependiendo del tamaño del archivo
4. Al terminar aparece una notificación de éxito
5. El proyecto ahora tiene:
   - **Dashboard** con gráficos interactivos
   - **Documentación** con el reporte

---

## Paso 5: Explorar el Dashboard

Ve a la pestaña **"Dashboard"**:

- **Haz clic en cualquier gráfico** para abrirlo en pantalla completa
- En la vista ampliada puedes:
  - Ver el gráfico en detalle con todos los datos
  - Cambiar entre vista de gráfico y vista de tabla
  - **Chatear con la IA**: pregunta cosas como:
    - "¿Por qué hay un pico en marzo?"
    - "¿Qué producto tiene más ventas?"
    - "Resume este gráfico en 3 puntos"
  - Exportar el gráfico como imagen PNG
- Presiona **Escape** o haz clic fuera del modal para cerrar

---

## Paso 6: Leer la Documentación

Ve a la pestaña **"Documentación"**:

Encontrarás un reporte completo que incluye:
- Descripción general del dataset
- Análisis columna por columna
- Hallazgos e insights clave
- Recomendaciones de negocio

Puedes imprimir el reporte con `Ctrl+P` para compartirlo.

---

## Preguntas Frecuentes

**¿Cuántos datasets puede tener un proyecto?**  
Sin límite definido, pero se recomienda máximo 5 para un rendimiento óptimo.

**¿Qué pasa si el análisis falla?**  
Verás un mensaje de error con la descripción del problema. Los errores más comunes son: archivo con formato incorrecto o API de Gemini sin cuota disponible.

**¿Puedo editar el nombre del proyecto después de crearlo?**  
Sí. Ve al proyecto y haz clic en el botón **"Editar"** (ícono de lápiz).

**¿Cómo elimino un dataset?**  
En la pestaña "Datasets", cada dataset tiene un ícono de basura para eliminarlo.

---

# 10. ANÁLISIS PROFESIONAL DEL PROYECTO

## Lo que está Bien Diseñado ✅

### Arquitectura y Estructura
- **Separación de responsabilidades clara**: config, middleware, models, routes, services correctamente separados. Fácil de mantener y extender.
- **Error handler centralizado**: patrón correcto del industria. Un solo lugar para manejar todos los errores, formato de respuesta consistente.
- **`asyncHandler` wrapper**: elegante. Evita duplicar try/catch en cada route handler. La ruta puede quedar así de limpia: `router.get('/', asyncHandler(async (req, res) => { ... }))`.
- **Tipos TypeScript compartidos en `shared/`**: evita divergencia entre frontend y backend. Si cambias el tipo `Dataset`, TypeScript te avisa en ambos lados.
- **Embedding de documentos en MongoDB**: guardar el dashboard y datasets dentro del proyecto es arquitectónicamente correcto — un dashboard no existe independientemente de su proyecto.
- **`memoryStorage` en multer**: decisión correcta. Los archivos nunca tocan el disco, son procesados en RAM y sus datos van a MongoDB. Esto hace que la app sea stateless y funcione bien en cualquier cloud.

### Seguridad
- bcrypt con salt 12 para contraseñas (nivel adecuado para aplicaciones de negocio)
- JWT con expiración de 7 días
- `select: false` en campo password — no puede exponerse accidentalmente
- helmet + rate limiting + CORS configurado correctamente
- Validación Joi en TODAS las rutas de entrada
- Aislamiento de datos: cada query filtra por `userId` → un usuario nunca puede ver los datos de otro

### Frontend
- React Query para gestión de estado del servidor: correcto. Manejo automático de loading/error/refetch.
- `AuthContext` bien implementado: verifica el token en cada arranque con `/api/auth/me`
- Interceptor de axios para el token: una sola línea gestiona la autenticación para TODA la app
- Modal de carga real para el análisis (no un spinner falso con setTimeout)

---

## Qué Necesita Mejorarse para Producción ⚠️

### 1. Datos del dataset guardados en el documento del proyecto (CRÍTICO)
Un documento MongoDB tiene límite de **16MB**. Los datasets con muchas columnas numéricas y 1000 filas pueden acercarse o superar ese límite fácilmente.

**Solución**: Crear una colección separada `datasets` con referencia `projectId`:
```
Project → { datasets: [ObjectId, ObjectId] }  // Solo referencias
Dataset → { projectId, data: [...], metadata: {...} }
```

### 2. `.env` con secrets reales potencialmente commiteado
Si el `.env` no está en `.gitignore`, la `GEMINI_API_KEY` y el `JWT_SECRET` podrían subirse al repositorio.

**Solución inmediata**:
```bash
echo ".env" >> .gitignore
```
Crear `.env.example` con valores de ejemplo (sin secrets reales).

### 3. Sin cola de jobs para el análisis de IA
El endpoint `POST /analyze` hace todo síncrono: analiza con Gemini, genera docs, genera dashboard, todo en una sola petición HTTP. Si 100 usuarios analizan a la vez, se crean 100 conexiones simultáneas a la API de Gemini.

**Solución**: Bull/BullMQ con Redis para procesar análisis en background.  
El endpoint devuelve inmediatamente `{ jobId: "xxx" }` y el frontend hace polling o recibe notificación por WebSocket cuando termina.

### 4. Sin refresh tokens
El JWT dura 7 días fijo. Si se compromete, el atacante tiene 7 días de acceso.

**Solución**: Access token de 15 minutos + refresh token de 30 días en cookie httpOnly.

### 5. Sin tests
El `package.json` tiene Jest configurado pero no hay ningún test escrito.

**Prioridad mínima**:
- Test unitario para `GeminiService.parseAnalysisResponse()` (lógica crítica y frágil)
- Test de integración para `POST /api/auth/login` y `POST /api/projects/:id/analyze`

### 6. Sin WebSockets para progreso del análisis
El análisis puede tardar 30-60 segundos. El usuario solo ve un spinner girando sin saber en qué paso está.

**Solución**: Socket.io o Server-Sent Events para emitir progreso:
```
[1/4] Leyendo dataset...
[2/4] Analizando con Gemini AI...
[3/4] Generando documentación...
[4/4] Construyendo dashboard...
✓ Completado!
```

### 7. Route handlers muy largos
En `routes/projects.ts`, el handler de `/analyze` hace ~80 líneas mezclando validación, lógica de negocio y respuesta HTTP.

**Patrón sugerido para escalar**:
```
routes/ → solo define el endpoint y delega
controllers/ → coordina el flujo (valida, llama servicios, responde)
services/ → lógica de negocio pura
repositories/ → acceso a datos (queries MongoDB)
```

---

## Hoja de Ruta para Llevarlo a Producción

| Prioridad | Tarea | Impacto |
|-----------|-------|---------|
| 🔴 Crítico | Mover `.env` a `.gitignore` | Seguridad |
| 🔴 Crítico | Separar colección de datasets | Estabilidad |
| 🟠 Alto | Implementar cola de jobs (Bull) | Escalabilidad |
| 🟠 Alto | Tests críticos (auth + analyze) | Confiabilidad |
| 🟡 Medio | Refresh tokens | Seguridad |
| 🟡 Medio | WebSockets para progreso | UX |
| 🟢 Bajo | Separar controllers de routes | Mantenibilidad |
| 🟢 Bajo | Redis caching | Performance |

---

## Evaluación Final

| Categoría | Puntuación | Comentario |
|-----------|-----------|--------------|
| Arquitectura base | 8/10 | Bien estructurada para MVP, clara y consistente |
| Seguridad | 7/10 | Buena base, falta refresh tokens y gestión de secrets |
| Escalabilidad | 5/10 | Necesita colas y caching para carga real |
| Calidad de código | 7/10 | Limpio y consistente, falta separar controllers |
| Tests | 1/10 | No hay tests implementados |
| Experiencia de usuario | 8/10 | Flujo claro, modal de carga, notificaciones |
| **Promedio** | **6/10** | **Sólido MVP — necesita hardening antes de producción real** |

> **Veredicto**: Este proyecto tiene arquitectura correcta, producto claro y código legible. Es un excelente MVP para validar el mercado. Para llevarlo a producción con usuarios reales y carga variable, las prioridades son: (1) datos fuera del documento de proyecto, (2) queue de jobs para la IA, (3) tests en rutas críticas y (4) secrets nunca en el repositorio.
