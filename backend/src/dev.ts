// Script de desarrollo que asegura la carga correcta de variables de entorno
import dotenv from 'dotenv';
import path from 'path';

// Cargar variables de entorno desde el archivo .env
const envPath = path.resolve(__dirname, '../.env');
console.log('🔍 Cargando variables de entorno desde:', envPath);

const result = dotenv.config({ path: envPath });

if (result.error) {
  console.error('❌ Error cargando archivo .env:', result.error);
} else {
  console.log('✅ Variables de entorno cargadas correctamente');
}

// Verificar variables críticas
const requiredVars = ['GEMINI_API_KEY', 'JWT_SECRET', 'MONGODB_URI'];
const missingVars = requiredVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ Variables de entorno faltantes:', missingVars);
  process.exit(1);
}

console.log('📋 Variables de entorno verificadas:');
requiredVars.forEach(varName => {
  const value = process.env[varName];
  console.log(`  ${varName}: ${value ? '✅ Configurada' : '❌ Faltante'}`);
});

// Ahora importar y ejecutar el servidor
console.log('🚀 Iniciando servidor...');
require('./server');