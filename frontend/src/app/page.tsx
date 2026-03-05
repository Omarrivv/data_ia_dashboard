import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xl">📊</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Dashboard Platform</h1>
            </div>
            <div className="space-x-4">
              <Link 
                href="/auth/login" 
                className="text-gray-600 hover:text-gray-900 font-medium"
              >
                Iniciar Sesión
              </Link>
              <Link 
                href="/auth/register" 
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Registrarse
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-4 py-20">
        <div className="text-center">
          <h2 className="text-5xl font-bold text-gray-900 mb-6">
            Dashboards Dinámicos
            <span className="block text-blue-600 mt-2">Potenciados por IA</span>
          </h2>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Transforma tus datos en insights accionables con nuestra plataforma inteligente. 
            Sube tus archivos y deja que la IA de Gemini genere dashboards profesionales automáticamente.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Link 
              href="/auth/register"
              className="bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold text-lg hover:bg-blue-700 transition-colors"
            >
              Comenzar Gratis →
            </Link>
            <Link 
              href="#features"
              className="bg-white text-gray-900 px-8 py-3 rounded-lg font-semibold text-lg border border-gray-300 hover:bg-gray-50 transition-colors"
            >
              Ver Características
            </Link>
          </div>

          {/* Status */}
          <div className="bg-white rounded-lg shadow-lg p-8 max-w-2xl mx-auto">
            <h3 className="text-2xl font-bold text-gray-900 mb-6">🎉 ¡Plataforma Lista!</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
              <div className="space-y-2">
                <p className="text-green-600 font-medium">✅ Backend API funcionando</p>
                <p className="text-green-600 font-medium">✅ MongoDB conectado</p>
                <p className="text-green-600 font-medium">✅ Gemini AI configurado</p>
              </div>
              <div className="space-y-2">
                <p className="text-green-600 font-medium">✅ Frontend ejecutándose</p>
                <p className="text-green-600 font-medium">✅ Autenticación lista</p>
                <p className="text-green-600 font-medium">✅ Subida de archivos</p>
              </div>
            </div>
          </div>
        </div>

        {/* Features */}
        <section id="features" className="mt-20">
          <h3 className="text-3xl font-bold text-center text-gray-900 mb-12">
            Características Principales
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="text-4xl mb-4">🤖</div>
              <h4 className="text-xl font-semibold mb-2">IA Gemini Integrada</h4>
              <p className="text-gray-600">Análisis automático de datos con inteligencia artificial avanzada.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="text-4xl mb-4">📊</div>
              <h4 className="text-xl font-semibold mb-2">Dashboards Dinámicos</h4>
              <p className="text-gray-600">Visualizaciones que se generan automáticamente según tus datos.</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="text-4xl mb-4">📁</div>
              <h4 className="text-xl font-semibold mb-2">Subida Fácil</h4>
              <p className="text-gray-600">Soporta CSV, JSON, Excel. Arrastra y suelta tus archivos.</p>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="mt-20">
          <h3 className="text-3xl font-bold text-center text-gray-900 mb-12">
            ¿Cómo Funciona?
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              { step: '1', title: 'Regístrate', desc: 'Crea tu cuenta gratuita' },
              { step: '2', title: 'Crea Proyecto', desc: 'Define tu proyecto' },
              { step: '3', title: 'Sube Datos', desc: 'Arrastra tus archivos' },
              { step: '4', title: 'Obtén Insights', desc: 'IA genera dashboards' }
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                  {item.step}
                </div>
                <h4 className="font-semibold mb-2">{item.title}</h4>
                <p className="text-gray-600 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12 mt-20">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <span className="text-2xl">📊</span>
            <span className="text-xl font-bold">Dashboard Platform</span>
          </div>
          <p className="text-gray-400 mb-4">
            Plataforma inteligente para crear dashboards dinámicos con IA Gemini.
          </p>
          <p className="text-gray-500 text-sm">
            &copy; 2024 Dashboard Platform. Todos los derechos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}