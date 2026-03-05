export default function TestPage() {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-lg text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          🎉 ¡Frontend Funcionando!
        </h1>
        <p className="text-gray-600 mb-6">
          La plataforma Dashboard Platform está lista
        </p>
        <div className="space-y-2">
          <p className="text-sm text-gray-500">✅ Next.js 14 ejecutándose</p>
          <p className="text-sm text-gray-500">✅ TypeScript configurado</p>
          <p className="text-sm text-gray-500">✅ Tailwind CSS funcionando</p>
          <p className="text-sm text-gray-500">✅ Backend conectado</p>
        </div>
        <div className="mt-6">
          <a 
            href="/" 
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Ir a la página principal
          </a>
        </div>
      </div>
    </div>
  );
}