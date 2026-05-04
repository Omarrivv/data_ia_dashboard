import { GoogleGenerativeAI } from '@google/generative-ai';
import { GeminiAnalysisResult, VisualizationRecommendation, Dataset } from '../types';
import crypto from 'crypto';
import { GeminiRequestCache } from '../models/GeminiRequestCache';

class GeminiService {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor() {
    console.log('🔍 Inicializando GeminiService...');
    console.log('📝 Variables de entorno disponibles:', {
      NODE_ENV: process.env.NODE_ENV,
      GEMINI_API_KEY: process.env.GEMINI_API_KEY ? '✅ Configurada' : '❌ No encontrada',
      PORT: process.env.PORT
    });
    
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('❌ GEMINI_API_KEY no encontrada en las variables de entorno');
      console.error('📁 Archivo .env ubicación esperada:', process.cwd() + '/.env');
      throw new Error('GEMINI_API_KEY no configurada');
    }
    
    console.log('✅ API Key de Gemini encontrada, inicializando cliente...');
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
    console.log('🚀 GeminiService inicializado correctamente con modelo gemini-2.5-flash-lite (gratuito)');
  }

  /**
   * Analiza un dataset y genera insights automáticamente
   */
  async analyzeDataset(dataset: Dataset): Promise<GeminiAnalysisResult> {
    try {
      console.log('🔍 Iniciando análisis de dataset:', dataset.originalName);
      
      // Validar dataset antes de proceder
      this.validateDataset(dataset);
      
      console.log('📊 Metadatos del dataset:', {
        filas: dataset.metadata.rowCount,
        columnas: dataset.metadata.columns.length,
        tipos: dataset.metadata.columns.map(col => `${col.name}:${col.type}`).join(', ')
      });

      const prompt = this.createAnalysisPrompt(dataset);
      console.log('📝 Enviando prompt a Gemini 2.5 Flash-Lite (modelo gratuito)...');

      const text = await this.requestWithRetries(prompt);
      
      console.log('✅ Respuesta recibida de Gemini, procesando...');
      const parsedResult = this.parseAnalysisResponse(text);
      console.log('🎯 Análisis completado exitosamente');
      
      return parsedResult;
    } catch (error) {
      console.error('❌ Error analizando dataset con Gemini:', error);
      console.error('📋 Stack trace completo:', error instanceof Error ? error.stack : 'No stack trace');
      console.error('📊 Dataset que causó el error:', {
        nombre: dataset.originalName,
        filas: dataset.metadata?.rowCount || 'sin información',
        columnas: dataset.metadata?.columns?.length || 'sin información'
      });
      
      // Verificar si es un error de cuota
      if (error instanceof Error && error.message.includes('quota')) {
        console.log('🚨 Error de cuota detectado, generando análisis de respaldo...');
        return this.generateFallbackAnalysis(dataset);
      }
      
      // Proporcionar un error más específico
      if (error instanceof Error) {
        throw new Error(`Error al analizar dataset '${dataset.originalName}': ${error.message}`);
      } else {
        throw new Error(`Error desconocido al analizar dataset '${dataset.originalName}'`);
      }
    }
  }

  /**
   * Genera documentación automática para un proyecto
   */
  async generateDocumentation(datasets: Dataset[], projectName: string, projectDescription?: string): Promise<string> {
    try {
      console.log('📚 Iniciando generación de documentación para:', projectName);
      console.log('📁 Cantidad de datasets:', datasets.length);

      if (!datasets || datasets.length === 0) {
        throw new Error('No hay datasets disponibles para generar documentación');
      }

      const prompt = this.createDocumentationPrompt(datasets, projectName, projectDescription);
      console.log('📝 Enviando prompt de documentación a Gemini...');

      let documentation = await this.requestWithRetries(prompt);

      // Limpiar bloques de código Markdown que Gemini a veces añade (```html ... ```)
      documentation = documentation
        .replace(/^```html\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```\s*$/i, '')
        .trim();

      // Si Gemini no generó HTML real, usar el fallback estilizado
      if (!documentation.startsWith('<!DOCTYPE') && !documentation.startsWith('<html')) {
        console.log('⚠️ Gemini no generó HTML válido, usando fallback estilizado');
        return this.generateFallbackDocumentation(datasets, projectName, projectDescription);
      }

      console.log('✅ Documentación HTML generada exitosamente');
      return documentation;
    } catch (error) {
      console.error('❌ Error generando documentación con Gemini:', error);
      console.error('📋 Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
      
      // Generar documentación HTML estilizada como fallback
      console.log('📄 Usando documentación estilizada como respaldo');
      return this.generateFallbackDocumentation(datasets, projectName, projectDescription);
    }
  }

  /**
   * Recomienda visualizaciones basadas en los datos
   */
  async recommendVisualizations(dataset: Dataset): Promise<VisualizationRecommendation[]> {
    try {
      const prompt = this.createVisualizationPrompt(dataset);
      const text = await this.requestWithRetries(prompt);
      return this.parseVisualizationRecommendations(text);
    } catch (error) {
      console.error('Error recomendando visualizaciones con Gemini:', error);
      throw new Error('Error al recomendar visualizaciones con IA');
    }
  }

  /**
   * Perform request to Gemini with idempotency caching and retries.
   * If an idempotencyKey is provided, the cached response will be used.
   */
  private async requestWithRetries(prompt: string, idempotencyKey?: string): Promise<string> {
    const key = idempotencyKey || crypto.createHash('sha256').update(prompt).digest('hex');

    // Check cache first
    try {
      const cached = await GeminiRequestCache.findOne({ key }).lean();
      if (cached) {
        console.log('🔁 Reusing cached Gemini response for key', key.slice(0, 8));
        return cached.responseText;
      }
    } catch (e) {
      console.warn('⚠️ Error consultando cache de Gemini:', e instanceof Error ? e.message : String(e));
    }

    const maxRetries = parseInt(process.env.GEMINI_MAX_RETRIES || '3', 10);
    const baseDelay = parseInt(process.env.GEMINI_RETRY_BASE_MS || '500', 10);

    let lastErr: any = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Save to cache (best-effort)
        try {
          await GeminiRequestCache.create({ key, responseText: text });
        } catch (e) {
          // ignore cache write errors
        }

        return text;
      } catch (err: any) {
        lastErr = err;
        const isQuota = err instanceof Error && err.message && err.message.toLowerCase().includes('quota');
        const isTransient = !isQuota; // treat non-quota as transient for retry purposes

        if (attempt >= maxRetries || isQuota) {
          // Do not retry further on quota errors or after max attempts
          console.error(`❌ Gemini request failed (attempt ${attempt}) - ${err?.message || String(err)}`);
          break;
        }

        const backoff = baseDelay * Math.pow(2, attempt);
        console.log(`⏱ Retry Gemini request in ${backoff}ms (attempt ${attempt + 1} of ${maxRetries})`);
        await new Promise(r => setTimeout(r, backoff));
      }
    }

    throw lastErr || new Error('Error desconocido en requestWithRetries');
  }

  /**
   * Crea el prompt para análisis de datos
   */
  private createAnalysisPrompt(dataset: Dataset): string {
    const columns = dataset.metadata.columns;
    const numericCols = columns.filter(c => c.type === 'number');
    const categoricalCols = columns.filter(c => c.type === 'string');
    const dateCols = columns.filter(c => c.type === 'date');

    // Calcular cardinalidad aproximada de columnas categóricas usando la muestra
    const sampleData = dataset.data.slice(0, 50);
    const categoricalWithCardinality = categoricalCols.map(col => {
      const uniqueVals = new Set(sampleData.map((row: any) => row[col.name])).size;
      return { name: col.name, approxUnique: uniqueVals };
    });

    // Columnas que NO deben usarse como eje X (IDs, alta cardinalidad, hashes)
    const idLikePattern = /^(id|_id|uuid|key|hash|code|ref|transaction|order|record|row|index|seq)/i;
    const badXAxisCols = categoricalWithCardinality
      .filter(c => idLikePattern.test(c.name) || c.approxUnique > 20)
      .map(c => c.name);

    // Columnas categóricas buenas para eje X (pocas categorías, no IDs)
    const goodCategoricalForX = categoricalWithCardinality
      .filter(c => !idLikePattern.test(c.name) && c.approxUnique <= 20)
      .map(c => c.name);

    const columnDetail = [
      ...numericCols.map(c => `  - ${c.name} [NUMÉRICA] → apta para eje Y, cálculos y métricas`),
      ...goodCategoricalForX.map(name => `  - ${name} [CATEGÓRICA - BUENA PARA EJE X, ~${categoricalWithCardinality.find(x => x.name === name)?.approxUnique} valores únicos]`),
      ...badXAxisCols.map(name => `  - ${name} [IDENTIFICADOR/ALTA CARDINALIDAD - NO USAR COMO EJE X]`),
      ...dateCols.map(c => `  - ${c.name} [FECHA] → apta para eje X en series temporales`),
    ].join('\n');

    const sampleStr = JSON.stringify(sampleData.slice(0, 5), null, 2);

    return `Eres un experto en análisis de datos y visualización. Analiza el siguiente dataset y genera visualizaciones con SENTIDO REAL para el negocio.

DATASET: "${dataset.originalName}"
Registros totales: ${dataset.metadata.rowCount.toLocaleString()}

COLUMNAS DISPONIBLES (lee con atención los tipos y restricciones):
${columnDetail}

MUESTRA DE DATOS (5 registros):
${sampleStr}

REGLAS CRÍTICAS PARA LAS VISUALIZACIONES:
1. NUNCA uses columnas marcadas como [IDENTIFICADOR/ALTA CARDINALIDAD] en el eje X. Son IDs únicos y producen gráficos sin sentido.
2. Para gráficos de barras y pie: el eje X DEBE ser una columna [CATEGÓRICA - BUENA PARA EJE X] con pocos valores únicos.
3. Para gráficos de línea y área: el eje X debe ser una columna [FECHA] o una columna numérica que represente tiempo/secuencia.
4. Para scatter: ambos ejes deben ser columnas [NUMÉRICA].
5. El eje Y SIEMPRE debe ser una columna [NUMÉRICA].
6. Cada gráfico debe responder una pregunta de negocio concreta y útil.
7. Genera exactamente 4 visualizaciones, cada una con un tipo diferente si es posible.

Responde ÚNICAMENTE con JSON válido, sin texto adicional ni bloques markdown:
{
  "insights": [
    "insight concreto con números reales del dataset",
    "patrón o tendencia identificada",
    "anomalía o punto de atención",
    "oportunidad de negocio detectada"
  ],
  "recommendations": [
    "acción concreta basada en los datos",
    "métrica a monitorear",
    "segmento a investigar más"
  ],
  "visualizations": [
    {
      "type": "chart",
      "chartType": "bar",
      "title": "Título descriptivo máx 40 chars",
      "description": "Qué pregunta de negocio responde este gráfico",
      "dataColumns": ["columna_eje_x", "columna_eje_y"],
      "reasoning": "Por qué estas columnas específicas y este tipo de gráfico"
    }
  ],
  "summary": "Resumen ejecutivo de 2-3 oraciones orientado a decisiones de negocio",
  "documentation": "Documentación técnica del dataset en markdown"
}`;
  }

  /**
   * Crea el prompt para documentación (estilo simple y humano)
   */
  private createDocumentationPrompt(datasets: Dataset[], projectName: string, projectDescription?: string): string {
    const datasetSummaries = datasets.map(ds => ({
      name: ds.originalName,
      rows: ds.metadata.rowCount,
      columns: ds.metadata.columns.length,
      columnNames: ds.metadata.columns.map(c => c.name).join(', '),
      types: [...new Set(ds.metadata.columns.map(col => col.type))].join(', ')
    }));

    return `
Genera un informe ejecutivo empresarial en HTML para el siguiente proyecto de análisis de datos.

Proyecto: ${projectName}
Descripción: ${projectDescription || 'Proyecto de análisis de datos'}

Datasets disponibles:
${datasetSummaries.map(ds => `- ${ds.name}: ${ds.rows.toLocaleString()} registros, ${ds.columns} variables`).join('\n')}

Variables por dataset (usar SOLO en la tabla de fuentes de información, NO en el encabezado ni en el título):
${datasetSummaries.map(ds => `- ${ds.name}: ${ds.columnNames}`).join('\n')}

El documento HTML debe tener el aspecto de un informe ejecutivo corporativo de alto nivel:
- Fondo blanco puro (#ffffff), tipografía 'Segoe UI' o Georgia
- Tamaño base del cuerpo: 15px, interlineado 1.8
- Encabezado con línea divisoria y metadatos (fecha, versión, clasificación)
- Barra lateral izquierda con índice de secciones (texto gris discreto)
- h1 negro 2rem font-weight:700, h2 1.1rem uppercase letra-espaciado con borde inferior fino
- Párrafos en 0.98rem color #334155, texto justificado
- Tablas profesionales con encabezados #f1f5f9, bordes #e2e8f0, filas alternas
- Sin emojis en absoluto
- Sin gradientes ni colores de fondo en secciones
- Paleta: #0f172a, #1e293b, #334155, #64748b, #e2e8f0, #f8fafc
- Lenguaje ejecutivo orientado al negocio: claro, estratégico, orientado a decisiones y oportunidades empresariales. Evitar jerga técnica innecesaria. Hablar de impacto, valor, crecimiento, eficiencia y ventaja competitiva.
- IMPORTANTE: El encabezado del documento solo debe contener el título del proyecto y la descripción ejecutiva. NUNCA mostrar la lista de columnas/variables en el encabezado ni debajo del título.

Estructura del documento:
1. Portada: t\u00edtulo del proyecto, descripci\u00f3n ejecutiva, fecha, versi\u00f3n
2. Resumen Ejecutivo (3-4 p\u00e1rrafos orientados al negocio: qu\u00e9 se encontr\u00f3, qu\u00e9 oportunidades existen, qu\u00e9 acciones se recomiendan)
3. Descripci\u00f3n de las Fuentes de Informaci\u00f3n (tabla: Archivo, Registros, Variables, Tipos de datos)
4. Principales Hallazgos y Oportunidades de Negocio (listado con sub-puntos orientados a resultados)
5. An\u00e1lisis Estrat\u00e9gicos Recomendados (enfocados en valor de negocio)
6. Conclusiones y Recomendaciones Estrat\u00e9gicas (lenguaje directivo)
7. Plan de Acci\u00f3n Prioritario (tabla: Iniciativa, \u00c1rea Responsable, Impacto Esperado, Prioridad)

REQUISITOS OBLIGATORIOS:
- HTML completo desde <!DOCTYPE html> hasta </html>
- CSS integrado en <style> con font-size base 15px
- Sin emojis en ninguna parte
- Lenguaje ejecutivo empresarial en espa\u00f1ol, orientado a la toma de decisiones
- M\u00e1ximo 9000 caracteres
`;
  }

  /**
   * Crea el prompt para recomendaciones de visualización
   */
  private createVisualizationPrompt(dataset: Dataset): string {
    const columns = dataset.metadata.columns;
    const sampleData = dataset.data.slice(0, 30);

    const numericColumns = columns.filter(col => col.type === 'number').map(col => col.name);
    const dateColumns = columns.filter(col => col.type === 'date').map(col => col.name);

    // Detectar columnas categóricas con baja cardinalidad (buenas para agrupar)
    const idLikePattern = /^(id|_id|uuid|key|hash|code|ref|transaction|order|record|row|index|seq)/i;
    const categoricalGood = columns
      .filter(col => col.type === 'string')
      .map(col => {
        const unique = new Set(sampleData.map((r: any) => r[col.name])).size;
        return { name: col.name, unique };
      })
      .filter(c => !idLikePattern.test(c.name) && c.unique <= 20)
      .map(c => `${c.name} (${c.unique} valores únicos)`);

    const categoricalBad = columns
      .filter(col => col.type === 'string')
      .map(col => {
        const unique = new Set(sampleData.map((r: any) => r[col.name])).size;
        return { name: col.name, unique };
      })
      .filter(c => idLikePattern.test(c.name) || c.unique > 20)
      .map(c => c.name);

    return `Eres un experto en visualización de datos. Recomienda las mejores visualizaciones para este dataset.

Dataset: "${dataset.originalName}" — ${dataset.metadata.rowCount.toLocaleString()} registros

Columnas numéricas (aptas para eje Y): ${numericColumns.join(', ') || 'ninguna'}
Columnas categóricas BUENAS para eje X (pocos valores únicos): ${categoricalGood.join(', ') || 'ninguna'}
Columnas de fecha (aptas para eje X en series temporales): ${dateColumns.join(', ') || 'ninguna'}
Columnas PROHIBIDAS para eje X (IDs o alta cardinalidad): ${categoricalBad.join(', ') || 'ninguna'}

REGLAS:
- Nunca uses columnas PROHIBIDAS como eje X
- El eje Y siempre debe ser numérico
- Cada visualización debe responder una pregunta de negocio real
- Varía los tipos de gráfico (no repitas el mismo tipo)

Responde ÚNICAMENTE con un array JSON válido:
[
  {
    "type": "chart",
    "chartType": "bar|line|pie|scatter|area",
    "title": "Título descriptivo máx 40 chars",
    "description": "Pregunta de negocio que responde",
    "dataColumns": ["columna_x", "columna_y"],
    "reasoning": "Por qué estas columnas y este tipo"
  }
]`;
  }

  /**
   * Parsea la respuesta de análisis de Gemini
   */
  private parseAnalysisResponse(text: string): GeminiAnalysisResult {
    try {
      console.log('🔄 Parseando respuesta de Gemini...');
      
      // Limpiar la respuesta de caracteres especiales y markdown
      let cleanText = text.trim();
      cleanText = cleanText.replace(/```json/gi, '').replace(/```/gi, '');
      cleanText = cleanText.replace(/^\s*```.*$/gm, ''); // Quitar líneas de código
      
      // Intentar extraer JSON de la respuesta
      const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          console.log('✅ JSON válido parseado exitosamente');
          
          // Validar estructura del JSON
          if (parsed.insights && parsed.recommendations && parsed.summary) {
            return {
              insights: Array.isArray(parsed.insights) ? parsed.insights : [parsed.insights],
              recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [parsed.recommendations],
              visualizations: Array.isArray(parsed.visualizations) ? parsed.visualizations : [],
              summary: typeof parsed.summary === 'string' ? parsed.summary : 'Resumen generado por IA',
              documentation: typeof parsed.documentation === 'string' ? parsed.documentation : cleanText
            };
          }
        } catch (jsonError) {
          console.log('⚠️ Error parseando JSON, usando extracción de texto');
        }
      }
      
      // Si no es JSON válido, extraer información manualmente
      console.log('📝 Extrayendo información de texto plano...');
      return {
        insights: this.extractInsights(cleanText),
        recommendations: this.extractRecommendations(cleanText),
        visualizations: this.extractSmartVisualizations(cleanText),
        summary: this.extractSummary(cleanText),
        documentation: cleanText
      };
    } catch (error) {
      console.error('❌ Error parseando respuesta de Gemini:', error);
      console.log('📄 Generando respuesta de respaldo...');
      
      return {
        insights: [
          'Análisis completado con IA',
          'Se detectaron patrones interesantes en los datos',
          'Los datos muestran características relevantes para el análisis'
        ],
        recommendations: [
          'Revisar los datos para obtener más insights específicos',
          'Considerar análisis adicionales según el contexto del negocio',
          'Generar visualizaciones exploratorias'
        ],
        visualizations: this.generateDefaultVisualizations(),
        summary: 'Análisis de datos realizado con inteligencia artificial. Se recomienda revisar los resultados detallados.',
        documentation: text || 'Documentación generada automáticamente'
      };
    }
  }

  /**
   * Parsea recomendaciones de visualización
   */
  private parseVisualizationRecommendations(text: string): VisualizationRecommendation[] {
    try {
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      return [];
    } catch (error) {
      console.error('Error parseando recomendaciones de visualización:', error);
      return [];
    }
  }

  // Métodos auxiliares para extraer información del texto
  private extractInsights(text: string): string[] {
    const insights: string[] = [];
    const lines = text.split('\n');
    
    for (const line of lines) {
      if (line.includes('insight') || line.includes('patrón') || line.includes('tendencia')) {
        insights.push(line.trim());
      }
    }
    
    return insights.length > 0 ? insights : ['Insights generados por IA'];
  }

  private extractRecommendations(text: string): string[] {
    const recommendations: string[] = [];
    const lines = text.split('\n');
    
    for (const line of lines) {
      if (line.includes('recomend') || line.includes('suger') || line.includes('debería')) {
        recommendations.push(line.trim());
      }
    }
    
    return recommendations.length > 0 ? recommendations : ['Recomendaciones generadas por IA'];
  }

  private extractVisualizations(text: string): VisualizationRecommendation[] {
    // Implementación básica - en producción sería más sofisticada
    return [
      {
        type: 'chart',
        chartType: 'bar',
        title: 'Gráfico de Barras',
        description: 'Visualización recomendada por IA',
        dataColumns: [],
        reasoning: 'Recomendación basada en análisis de IA'
      }
    ];
  }

  /**
   * Extrae visualizaciones inteligentes del texto
   */
  private extractSmartVisualizations(text: string): VisualizationRecommendation[] {
    const visualizations: VisualizationRecommendation[] = [];
    
    // Buscar patrones de visualización en el texto
    const vizPatterns = [
      { pattern: /gráfico de barras|bar chart|histograma/i, type: 'bar' },
      { pattern: /gráfico de líneas|line chart|series/i, type: 'line' },
      { pattern: /gráfico circular|pie chart|torta/i, type: 'pie' },
      { pattern: /dispersión|scatter plot|correlación/i, type: 'scatter' },
      { pattern: /área|area chart|relleno/i, type: 'area' }
    ];

    vizPatterns.forEach((pattern, index) => {
      if (pattern.pattern.test(text)) {
        visualizations.push({
          type: 'chart',
          chartType: pattern.type as any,
          title: `Análisis ${pattern.type}`,
          description: `Visualización recomendada basada en el análisis de los datos`,
          dataColumns: [],
          reasoning: `Análisis detectó patrones que se benefician de visualización tipo ${pattern.type}`
        });
      }
    });

    return visualizations.length > 0 ? visualizations : this.generateDefaultVisualizations();
  }

  /**
   * Genera visualizaciones por defecto (simples y claras)
   */
  private generateDefaultVisualizations(): VisualizationRecommendation[] {
    return [
      {
        type: 'chart',
        chartType: 'bar',
        title: 'Comparación por Categorías',
        description: 'Gráfico de barras que muestra las diferencias entre grupos',
        dataColumns: [],
        reasoning: 'Los gráficos de barras son fáciles de entender y perfectos para comparar'
      },
      {
        type: 'chart',
        chartType: 'line',
        title: 'Tendencias y Cambios',
        description: 'Líneas que muestran cómo cambian los valores',
        dataColumns: [],
        reasoning: 'Perfecto para ver patrones y tendencias de forma clara'
      },
      {
        type: 'chart',
        chartType: 'pie',
        title: 'Distribución Total',
        description: 'Círculo que muestra las partes del total',
        dataColumns: [],
        reasoning: 'Ideal para mostrar proporciones y porcentajes de forma visual'
      }
    ];
  }

  private extractSummary(text: string): string {
    const lines = text.split('\n');
    const summaryLines = lines.slice(0, 3); // Primeras 3 líneas como resumen
    return summaryLines.join(' ').trim() || 'Resumen generado por IA';
  }

  /**
   * Genera documentación de respaldo para un proyecto (estilo simple)
   */
  private generateFallbackDocumentation(datasets: Dataset[], projectName: string, projectDescription?: string): string {
    const datasetSummaries = datasets.map(ds => ({
      name: ds.originalName,
      rows: ds.metadata.rowCount,
      columns: ds.metadata.columns.length,
      types: ds.metadata.columns.map(c => c.type),
      columnNames: ds.metadata.columns.map(c => c.name)
    }));
    const totalRows = datasetSummaries.reduce((s, d) => s + d.rows, 0);
    const totalCols = datasetSummaries.reduce((s, d) => s + d.columns, 0);
    const date = new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });

    return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; font-size: 15px; color: #0f172a; background: #ffffff; display: flex; min-height: 100vh; line-height: 1.8; }
  nav { width: 220px; min-width: 220px; background: #f8fafc; border-right: 1px solid #e2e8f0; padding: 36px 20px; position: sticky; top: 0; height: 100vh; overflow-y: auto; }
  nav .nav-title { font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .14em; color: #94a3b8; margin-bottom: 16px; padding-bottom: 10px; border-bottom: 1px solid #e2e8f0; }
  nav a { display: block; padding: 5px 0; font-size: 13px; color: #475569; text-decoration: none; margin-bottom: 4px; border-left: 2px solid transparent; padding-left: 10px; transition: all .15s; }
  nav a:hover { color: #0f172a; border-left-color: #334155; background: #f1f5f9; }
  main { flex: 1; padding: 52px 64px; max-width: 920px; }
  .doc-header { border-bottom: 2px solid #0f172a; padding-bottom: 32px; margin-bottom: 48px; }
  .doc-header h1 { font-size: 2rem; font-weight: 700; color: #0f172a; letter-spacing: -0.025em; margin-bottom: 10px; line-height: 1.25; }
  .doc-header .description { color: #475569; font-size: 1rem; margin-bottom: 20px; line-height: 1.7; }
  .doc-meta { display: grid; grid-template-columns: repeat(3, auto); gap: 0; border: 1px solid #e2e8f0; border-radius: 3px; width: fit-content; font-size: 12.5px; }
  .doc-meta-item { padding: 8px 20px; border-right: 1px solid #e2e8f0; }
  .doc-meta-item:last-child { border-right: none; }
  .doc-meta-item .label { color: #94a3b8; text-transform: uppercase; font-size: 10px; letter-spacing: .1em; display: block; margin-bottom: 3px; }
  .doc-meta-item .value { color: #0f172a; font-weight: 600; font-size: 13px; }
  section { margin-bottom: 52px; }
  h2 { font-size: 1.05rem; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: .07em; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 1px solid #e2e8f0; }
  h3 { font-size: 0.98rem; font-weight: 600; color: #1e293b; margin: 26px 0 10px; }
  p { color: #334155; line-height: 1.85; margin-bottom: 14px; font-size: 0.97rem; text-align: justify; }
  ul, ol { padding-left: 24px; margin-bottom: 14px; }
  li { color: #334155; line-height: 1.85; font-size: 0.97rem; margin-bottom: 7px; }
  table { width: 100%; border-collapse: collapse; font-size: 0.92rem; margin: 18px 0; }
  th { background: #f1f5f9; text-align: left; padding: 11px 16px; font-weight: 600; color: #1e293b; border: 1px solid #e2e8f0; font-size: 0.84rem; text-transform: uppercase; letter-spacing: .05em; }
  td { padding: 11px 16px; border: 1px solid #e2e8f0; color: #334155; vertical-align: top; font-size: 0.93rem; }
  tr:nth-child(even) td { background: #f8fafc; }
  .note { border-left: 3px solid #334155; background: #f8fafc; padding: 14px 20px; margin: 22px 0; border-radius: 0 4px 4px 0; }
  .note p { margin: 0; font-size: 0.92rem; color: #475569; font-style: italic; line-height: 1.7; }
  .kpi-row { display: flex; gap: 0; margin: 22px 0; border: 1px solid #e2e8f0; border-radius: 3px; width: fit-content; }
  .kpi { padding: 18px 36px; border-right: 1px solid #e2e8f0; text-align: center; min-width: 130px; }
  .kpi:last-child { border-right: none; }
  .kpi .kpi-num { font-size: 1.65rem; font-weight: 700; color: #0f172a; display: block; letter-spacing: -0.02em; }
  .kpi .kpi-lbl { font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: .07em; margin-top: 4px; }
  .tag { display: inline-block; padding: 2px 10px; border: 1px solid #cbd5e1; border-radius: 3px; font-size: 12px; color: #475569; margin: 2px 3px; background: #f8fafc; }
  .priority-high { font-weight: 700; color: #0f172a; }
  .priority-med { color: #475569; font-weight: 500; }
  .priority-low { color: #94a3b8; }
  footer { margin-top: 64px; padding-top: 18px; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 12px; display: flex; justify-content: space-between; }
</style>
</head>
<body>
<nav>
  <div class="nav-title">Contenido</div>
  <a href="#resumen">I. Resumen Ejecutivo</a>
  <a href="#datos">II. Fuentes de Informaci\u00f3n</a>
  <a href="#hallazgos">III. Hallazgos y Oportunidades</a>
  <a href="#analisis">IV. An\u00e1lisis Estrat\u00e9gicos</a>
  <a href="#conclusiones">V. Conclusiones</a>
  <a href="#plan">VI. Plan de Acci\u00f3n</a>
</nav>
<main>
  <div class="doc-header">
    <h1>Informe Ejecutivo: ${projectName}</h1>
    <p class="description">${
      projectDescription && projectDescription.length <= 300
        ? projectDescription
        : 'El presente informe ejecutivo consolida los principales hallazgos, oportunidades de negocio y recomendaciones estratégicas derivadas del análisis de las fuentes de información disponibles. Su propósito es apoyar la toma de decisiones basada en datos.'
    }</p>
    <div class="doc-meta">
      <div class="doc-meta-item"><span class="label">Fecha</span><span class="value">${date}</span></div>
      <div class="doc-meta-item"><span class="label">Versi\u00f3n</span><span class="value">1.0</span></div>
      <div class="doc-meta-item"><span class="label">Clasificaci\u00f3n</span><span class="value">Interno</span></div>
    </div>
  </div>

  <section id="resumen">
    <h2>I. Resumen Ejecutivo</h2>
    <p>El proyecto <strong>${projectName}</strong> representa una oportunidad estrat\u00e9gica para transformar datos en ventaja competitiva. A trav\u00e9s del an\u00e1lisis sistem\u00e1tico de la informaci\u00f3n disponible, este informe identifica patrones clave, tendencias de negocio y \u00e1reas de mejora con potencial de impacto directo en los resultados organizacionales.</p>
    <p>El an\u00e1lisis abarca <strong>${totalRows.toLocaleString()} registros</strong> provenientes de <strong>${datasetSummaries.length} fuente${datasetSummaries.length > 1 ? 's' : ''} de datos</strong>, con <strong>${totalCols} variables</strong> que permiten una visi\u00f3n multidimensional del negocio. La calidad y estructura de la informaci\u00f3n es adecuada para la generaci\u00f3n de indicadores de desempe\u00f1o, reportes ejecutivos y modelos predictivos.</p>
    <p>Los hallazgos presentados en este documento constituyen la base para la definici\u00f3n de iniciativas de mejora, la optimizaci\u00f3n de procesos y la alineaci\u00f3n de recursos con las prioridades estrat\u00e9gicas de la organizaci\u00f3n.</p>
    <div class="note"><p>Este informe ha sido generado autom\u00e1ticamente por la plataforma de inteligencia de negocios. Se recomienda complementarlo con el conocimiento del dominio del \u00e1rea responsable antes de utilizarlo como base para decisiones cr\u00edticas.</p></div>
  </section>

  <section id="datos">
    <h2>II. Fuentes de Informaci\u00f3n y Datos</h2>
    <div class="kpi-row">
      <div class="kpi"><span class="kpi-num">${totalRows.toLocaleString()}</span><span class="kpi-lbl">Registros Totales</span></div>
      <div class="kpi"><span class="kpi-num">${totalCols}</span><span class="kpi-lbl">Variables Totales</span></div>
      <div class="kpi"><span class="kpi-num">${datasetSummaries.length}</span><span class="kpi-lbl">Fuentes</span></div>
    </div>
    <table>
      <thead><tr><th>Archivo</th><th>Registros</th><th>Variables</th><th>Tipos de Datos</th></tr></thead>
      <tbody>
        ${datasetSummaries.map(ds => `<tr>
          <td><strong>${ds.name}</strong></td>
          <td>${ds.rows.toLocaleString()}</td>
          <td>${ds.columns}</td>
          <td>${[...new Set(ds.types)].map(t => `<span class="tag">${t}</span>`).join('')}</td>
        </tr>`).join('')}
      </tbody>
    </table>
    ${datasetSummaries.map(ds => `
    <h3>Variables de ${ds.name}</h3>
    <p>${ds.columnNames.slice(0, 25).map(n => `<span class="tag">${n}</span>`).join('')}${ds.columnNames.length > 25 ? `<span style="font-size:11px;color:#94a3b8"> y ${ds.columnNames.length - 25} m\u00e1s...</span>` : ''}</p>
    `).join('')}
  </section>

  <section id="hallazgos">
    <h2>III. Principales Hallazgos y Oportunidades</h2>
    <ul>
      <li>El volumen de datos disponible (<strong>${totalRows.toLocaleString()} registros</strong>) es suficiente para extraer conclusiones con respaldo estad\u00edstico y fundamentar decisiones de negocio con alta confianza.</li>
      <li>La disponibilidad de <strong>${totalCols} variables</strong> permite un an\u00e1lisis multidimensional: desde m\u00e9tricas operativas hasta indicadores estrat\u00e9gicos de desempe\u00f1o.</li>
      <li>Las fuentes de informaci\u00f3n incluyen datos de tipo <strong>${[...new Set(datasetSummaries.flatMap(d => d.types))].join(', ')}</strong>, lo que habilita tanto el an\u00e1lisis cuantitativo como la segmentaci\u00f3n por categor\u00edas de negocio.</li>
      <li>La informaci\u00f3n presenta una estructura consistente y de calidad adecuada, lo que reduce los tiempos de preparaci\u00f3n y permite avanzar directamente al an\u00e1lisis de valor.</li>
      <li>Se identifican oportunidades para construir indicadores clave de desempe\u00f1o (KPIs) y modelos de seguimiento continuo que apoyen la gesti\u00f3n ejecutiva.</li>
      <li>El conjunto de datos habilita la generaci\u00f3n de dashboards din\u00e1micos y reportes ejecutivos que pueden integrarse en los procesos de toma de decisiones del \u00e1rea.</li>
    </ul>
  </section>

  <section id="analisis">
    <h2>IV. An\u00e1lisis Estrat\u00e9gicos Recomendados</h2>
    <ul>
      <li><strong>An\u00e1lisis de tendencias y proyecci\u00f3n.</strong> Evaluaci\u00f3n de la evoluci\u00f3n hist\u00f3rica de m\u00e9tricas clave para anticipar comportamientos futuros, identificar ciclos estacionales y detectar puntos de inflexi\u00f3n cr\u00edticos para el negocio.</li>
      <li><strong>Segmentaci\u00f3n estrat\u00e9gica.</strong> Clasificaci\u00f3n de clientes, productos o procesos por grupos de valor similar, permitiendo personalizar estrategias, optimizar recursos y maximizar el retorno por segmento.</li>
      <li><strong>An\u00e1lisis de correlaci\u00f3n y factores de impacto.</strong> Identificaci\u00f3n de las variables que m\u00e1s influyen en los resultados del negocio, habilitando acciones focalizadas con mayor probabilidad de \u00e9xito.</li>
      <li><strong>Medici\u00f3n de distribuci\u00f3n y concentraci\u00f3n.</strong> Evaluaci\u00f3n de c\u00f3mo se distribuyen los valores entre categor\u00edas para detectar desbalances, oportunidades de crecimiento o riesgos de dependencia.</li>
      <li><strong>Sistema de indicadores de negocio (KPIs).</strong> Dise\u00f1o de un cuadro de mando con m\u00e9tricas accionables alineadas a los objetivos estrat\u00e9gicos, actualizable en tiempo real para apoyo a la direcci\u00f3n.</li>
    </ul>
  </section>

  <section id="conclusiones">
    <h2>V. Conclusiones y Recomendaciones Estrat\u00e9gicas</h2>
    <ol>
      <li>Los datos disponibles constituyen un activo de alto valor para la organizaci\u00f3n. Se recomienda comenzar la exploraci\u00f3n a trav\u00e9s de los dashboards generados para identificar r\u00e1pidamente las \u00e1reas de mayor impacto potencial.</li>
      <li>La direcci\u00f3n y el equipo responsable deben acordar formalmente un conjunto de indicadores clave de negocio que ser\u00e1n monitoreados de forma continua, con umbrales de alerta y frecuencia de revisi\u00f3n definidos.</li>
      <li>Se recomienda validar la representatividad de los datos con el \u00e1rea propietaria para asegurar que las conclusiones obtenidas reflejen fielmente la realidad operativa antes de escalar decisiones estrat\u00e9gicas.</li>
      <li>Establecer un ciclo de actualizaci\u00f3n peri\u00f3dica de los datos garantizar\u00e1 la vigencia del an\u00e1lisis y permitir\u00e1 detectar cambios en tendencias con oportunidad suficiente para actuar.</li>
      <li>La combinaci\u00f3n del an\u00e1lisis cuantitativo con el juicio experto de los l\u00edderes del \u00e1rea maximizar\u00e1 la calidad y confiabilidad de las decisiones basadas en este informe.</li>
    </ol>
  </section>

  <section id="plan">
    <h2>VI. Plan de Acci\u00f3n Prioritario</h2>
    <table>
      <thead><tr><th>#</th><th>Iniciativa</th><th>\u00c1rea Responsable</th><th>Impacto Esperado</th><th>Prioridad</th></tr></thead>
      <tbody>
        <tr><td>1</td><td>Revisi\u00f3n ejecutiva de dashboards e identificaci\u00f3n de hallazgos clave</td><td>Direcci\u00f3n / Equipo de Datos</td><td>Visibilidad inmediata del estado del negocio</td><td class="priority-high">Alta</td></tr>
        <tr><td>2</td><td>Validaci\u00f3n de insights con el \u00e1rea de negocio propietaria</td><td>Analista de Datos</td><td>Alineaci\u00f3n entre datos y realidad operativa</td><td class="priority-high">Alta</td></tr>
        <tr><td>3</td><td>Dise\u00f1o del cuadro de mando con KPIs estrat\u00e9gicos</td><td>Gerencia / Direcci\u00f3n</td><td>Monitoreo continuo de variables cr\u00edticas</td><td class="priority-med">Media</td></tr>
        <tr><td>4</td><td>Distribuci\u00f3n del informe ejecutivo a stakeholders</td><td>Analista de Datos</td><td>Alineaci\u00f3n organizacional y toma de decisiones</td><td class="priority-med">Media</td></tr>
        <tr><td>5</td><td>Establecimiento de ciclo de actualizaci\u00f3n y revisi\u00f3n peri\u00f3dica</td><td>Equipo de Datos</td><td>Vigencia y confiabilidad sostenida del an\u00e1lisis</td><td class="priority-low">Baja</td></tr>
      </tbody>
    </table>
  </section>

  <footer>
    <span>Generado el ${date} &mdash; Plataforma de An\u00e1lisis de Datos</span>
    <span>Versi\u00f3n 1.0 &mdash; Uso Interno</span>
  </footer>
</main>
</body>
</html>`;
  }

  /**
   * Genera análisis de respaldo cuando Gemini no está disponible (estilo humano)
   */
  private generateFallbackAnalysis(dataset: Dataset): GeminiAnalysisResult {
    console.log('🔄 Generando análisis básico y amigable para:', dataset.originalName);
    
    const columns = dataset.metadata.columns;
    const numericColumns = columns.filter(col => col.type === 'number');
    const categoricalColumns = columns.filter(col => col.type === 'string');
    const dateColumns = columns.filter(col => col.type === 'date');

    // Generar insights simples y humanos
    const insights = [
      `📁 Tienes ${dataset.metadata.rowCount.toLocaleString()} registros de información - ¡suficiente para sacar buenas conclusiones!`,
      `📊 Hay ${columns.length} tipos diferentes de información para analizar`,
      ...(numericColumns.length > 0 ? [`🔢 ${numericColumns.length} columnas con números perfectas para hacer cálculos y comparaciones`] : []),
      ...(categoricalColumns.length > 0 ? [`🏷️ ${categoricalColumns.length} columnas con categorías ideales para agrupar y comparar`] : []),
      ...(dateColumns.length > 0 ? [`📅 ${dateColumns.length} columnas con fechas para ver cómo cambian las cosas en el tiempo`] : []),
      '✨ Los datos están bien organizados y listos para crear visualizaciones increíbles'
    ];

    // Generar recomendaciones prácticas
    const recommendations = [
      '🎯 Empieza explorando los gráficos más simples - las barras y líneas cuentan historias claras',
      '🔍 Busca patrones obvios primero - a veces lo más simple es lo más valioso',
      '📈 Crea dashboards que el equipo pueda entender de un vistazo',
      ...(numericColumns.length > 1 ? ['🧮 Compara diferentes números entre sí para encontrar relaciones interesantes'] : []),
      ...(dateColumns.length > 0 ? ['⏰ Revisa cómo cambian las métricas mes a mes - las tendencias son oro puro'] : []),
      '💡 Usa esta información para tomar decisiones más inteligentes en el día a día'
    ];

    // Generar visualizaciones inteligentes y simples
    const visualizations = this.generateSmartVisualizationsForDataset(dataset);

    const summary = `Análisis de ${dataset.originalName}: ${dataset.metadata.rowCount.toLocaleString()} registros con información valiosa. 
    ${numericColumns.length > 0 ? `Tenemos números para calcular (${numericColumns.map(c => c.name).join(', ')}).` : ''}
    ${categoricalColumns.length > 0 ? `Podemos agrupar por categorías (${categoricalColumns.map(c => c.name).join(', ')}).` : ''}
    ${dateColumns.length > 0 ? `Podemos ver tendencias en el tiempo.` : ''}
    ¡Perfecto para generar insights útiles para el negocio!`;

    const documentation = this.generateFallbackDocumentationForDataset(dataset);

    return {
      insights,
      recommendations,
      visualizations,
      summary,
      documentation
    };
  }

  /**
   * Genera visualizaciones inteligentes basadas en el tipo de datos del dataset (estilo humano)
   */
  private generateSmartVisualizationsForDataset(dataset: Dataset): VisualizationRecommendation[] {
    const columns = dataset.metadata.columns;
    const numericColumns = columns.filter(col => col.type === 'number');
    const categoricalColumns = columns.filter(col => col.type === 'string');
    const dateColumns = columns.filter(col => col.type === 'date');
    
    const visualizations: VisualizationRecommendation[] = [];

    // Para datos categóricos - usar lenguaje simple
    if (categoricalColumns.length > 0) {
      visualizations.push({
        type: 'chart',
        chartType: 'bar',
        title: `¿Cómo se distribuye ${categoricalColumns[0].name}?`,
        description: `Barras que muestran cuánto hay de cada tipo de ${categoricalColumns[0].name}`,
        dataColumns: [categoricalColumns[0].name],
        reasoning: 'Perfecto para ver rápidamente qué categoría es más común'
      });

      if (categoricalColumns.length > 1) {
        visualizations.push({
          type: 'chart',
          chartType: 'pie',
          title: `Proporción de ${categoricalColumns[1].name}`,
          description: `Círculo que muestra qué parte del total representa cada ${categoricalColumns[1].name}`,
          dataColumns: [categoricalColumns[1].name],
          reasoning: 'Ideal para entender porcentajes de un vistazo'
        });
      }
    }

    // Para datos numéricos - usar lenguaje simple
    if (numericColumns.length > 0) {
      const firstNumCol = numericColumns[0].name;
      visualizations.push({
        type: 'chart',
        chartType: 'line',
        title: `¿Cómo cambia ${firstNumCol}?`,
        description: `Línea que muestra si ${firstNumCol} sube, baja o se mantiene`,
        dataColumns: [firstNumCol],
        reasoning: 'Las líneas son geniales para ver tendencias y patrones'
      });

      if (numericColumns.length > 1) {
        const secondNumCol = numericColumns[1].name;
        visualizations.push({
          type: 'chart',
          chartType: 'scatter',
          title: `¿Se relacionan ${firstNumCol} y ${secondNumCol}?`,
          description: `Puntos que muestran si cuando ${firstNumCol} sube, ${secondNumCol} también lo hace`,
          dataColumns: [firstNumCol, secondNumCol],
          reasoning: 'Perfecto para descubrir si dos cosas están conectadas'
        });
      }
    }

    // Para datos temporales - usar lenguaje simple
    if (dateColumns.length > 0 && numericColumns.length > 0) {
      const timeCol = dateColumns[0].name;
      const valueCol = numericColumns[0].name;
      visualizations.push({
        type: 'chart',
        chartType: 'area',
        title: `${valueCol} a lo largo del tiempo`,
        description: `Área que muestra cómo ha evolucionado ${valueCol} desde ${timeCol}`,
        dataColumns: [timeCol, valueCol],
        reasoning: 'Excelente para ver la historia completa y predecir el futuro'
      });
    }

    // Si no cargamos ninguna visualización específica, usar las por defecto
    return visualizations.length > 0 ? visualizations.slice(0, 4) : this.generateDefaultVisualizations();
  }

  /**
   * Genera documentación de respaldo para un dataset específico (estilo simple)
   */
  private generateFallbackDocumentationForDataset(dataset: Dataset): string {
    const columns = dataset.metadata.columns;
    const numericColumns = columns.filter(col => col.type === 'number');
    const categoricalColumns = columns.filter(col => col.type === 'string');
    const dateColumns = columns.filter(col => col.type === 'date');

    return `# Reporte de Análisis: ${dataset.originalName}

## ¿De qué se trata este archivo?
Este archivo contiene información sobre **${dataset.originalName}** con **${dataset.metadata.rowCount.toLocaleString()} registros** de datos.

## ¿Qué información tenemos?
Los datos incluyen:
${categoricalColumns.length > 0 ? `
• **Categorías**: ${categoricalColumns.map(col => col.name).join(', ')} - para agrupar y comparar` : ''}
${numericColumns.length > 0 ? `
• **Números**: ${numericColumns.map(col => col.name).join(', ')} - para hacer cálculos y análisis` : ''}
${dateColumns.length > 0 ? `
• **Fechas**: ${dateColumns.map(col => col.name).join(', ')} - para ver tendencias en el tiempo` : ''}

## Principales descubrimientos
• Los datos están bien organizados y listos para analizar
• ${dataset.metadata.rowCount >= 100 ? 'Tenemos suficiente información para sacar conclusiones sólidas' : 'Es una muestra útil para empezar a entender patrones'}
• ${numericColumns.length > 0 ? 'Podemos hacer cálculos y comparaciones con los números' : 'Los datos son principalmente descriptivos'}
• ${categoricalColumns.length > 0 ? 'Podemos agrupar la información de diferentes maneras' : 'Los datos son principalmente numéricos'}

## ¿Qué podemos hacer con esta información?
• Crear gráficos para visualizar los datos de forma clara
• ${numericColumns.length > 0 ? 'Calcular promedios, totales y comparar valores' : 'Analizar la distribución de categorías'}
• ${dateColumns.length > 0 ? 'Ver cómo cambian las cosas a lo largo del tiempo' : 'Buscar patrones y tendencias en los datos'}
• Tomar decisiones basadas en datos reales

## Recomendaciones para el equipo
1. **Empezar con gráficos simples** - barras y líneas son fáciles de entender
2. **Buscar patrones obvios** - ¿hay algo que destaque inmediatamente?
3. **Hacer preguntas específicas** - ¿qué queremos saber exactamente?
4. **Revisar los datos regularmente** - mantener la información actualizada

---
*Reporte generado automáticamente el ${new Date().toLocaleDateString('es-ES')}*
*Si necesitas más detalles, contacta al equipo de datos*
`;
  }

  /**
   * Valida que un dataset tenga la estructura correcta
   */
  private validateDataset(dataset: Dataset): void {
    if (!dataset) {
      throw new Error('Dataset es null o undefined');
    }

    if (!dataset.originalName || dataset.originalName.trim() === '') {
      throw new Error('Dataset no tiene nombre válido');
    }

    if (!dataset.metadata) {
      throw new Error('Dataset no tiene metadatos');
    }

    if (!dataset.metadata.columns || !Array.isArray(dataset.metadata.columns) || dataset.metadata.columns.length === 0) {
      throw new Error('Dataset no tiene columnas válidas');
    }

    if (!dataset.data || !Array.isArray(dataset.data)) {
      throw new Error('Dataset no tiene datos válidos');
    }

    if (dataset.metadata.rowCount <= 0) {
      throw new Error('Dataset no tiene filas de datos');
    }
  }

  /**
   * Chat sobre un gráfico específico usando los datos reales
   */
  async chatAboutWidget(
    message: string,
    context: {
      projectName: string;
      widgetTitle: string;
      widgetDescription: string;
      chartType: string;
      xKey: string;
      yKey: string;
      dataSample: Array<{ name: string; value: number }>;
      conversationHistory: Array<{ role: string; text: string }>;
    }
  ): Promise<string> {
    const { projectName, widgetTitle, widgetDescription, chartType, xKey, yKey, dataSample, conversationHistory } = context;

    const dataTable = dataSample
      .map((d, i) => `  ${i + 1}. ${xKey}="${d.name}" → ${yKey}=${d.value}`)
      .join('\n');

    const historyBlock = conversationHistory.length > 0
      ? '\n\nConversación anterior:\n' +
        conversationHistory.map(m => `${m.role === 'user' ? 'Usuario' : 'Tú'}: ${m.text}`).join('\n')
      : '';

    const prompt = `Eres un analista de datos amigable y directo. Hablas en español de forma natural y conversacional, como un colega experto que explica cosas de forma sencilla y clara, sin ser robótico ni repetitivo.

DATOS DEL GRÁFICO "${widgetTitle}":
- Mide: ${yKey} por ${xKey}
- Tipo: ${chartType}
- Datos:
${dataTable}
${historyBlock}

El usuario dice: "${message}"

Responde de forma natural y directa a LO QUE PIDE. Si pregunta por MRR, habla de MRR. Si pregunta por tendencias, analiza la tendencia. Si pide recomendaciones, dáselas. Usa los números reales. Máximo 3 párrafos cortos. Sin asteriscos, sin títulos, solo texto natural.`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      return response.text().trim();
    } catch (error) {
      console.error('Error en chat widget:', error);
      return this.smartFallbackChat(message, { widgetTitle, xKey, yKey, dataSample, conversationHistory });
    }
  }

  /**
   * Fallback inteligente cuando Gemini no está disponible:
   * analiza la pregunta y responde con los datos reales de forma dinámica
   */
  private smartFallbackChat(
    message: string,
    ctx: {
      widgetTitle: string;
      xKey: string;
      yKey: string;
      dataSample: Array<{ name: string; value: number }>;
      conversationHistory: Array<{ role: string; text: string }>;
    }
  ): string {
    const { xKey, yKey, dataSample } = ctx;
    const msg = message.toLowerCase();

    if (dataSample.length === 0) return 'No hay datos disponibles en este gráfico para analizar.';

    const sorted = [...dataSample].sort((a, b) => b.value - a.value);
    const max = sorted[0];
    const min = sorted[sorted.length - 1];
    const values = dataSample.map(d => d.value);
    const avg = values.reduce((s, v) => s + v, 0) / values.length;
    const total = values.reduce((s, v) => s + v, 0);
    const first = dataSample[0];
    const last = dataSample[dataSample.length - 1];
    const pctChange = first.value !== 0 ? (((last.value - first.value) / first.value) * 100).toFixed(1) : '0';
    const trend = last.value > first.value ? 'creciente' : last.value < first.value ? 'decreciente' : 'estable';

    const asks = {
      max:       /m[aá]x|mayor|m[aá]s alto|pico|top|mejor/i.test(msg),
      min:       /m[ií]n|menor|m[aá]s bajo|peor|bajo/i.test(msg),
      avg:       /promedio|media|average|medio/i.test(msg),
      trend:     /tendencia|trend|sube|baja|crece|decrece|evoluci[oó]n|comportamiento/i.test(msg),
      total:     /total|suma|acumulado|todo/i.test(msg),
      recommend: /recomend|qu[eé] hago|qu[eé] debo|mejora|consejo|sugiere/i.test(msg),
      compare:   /compar|vs|diferencia|entre|cu[aá]l es mejor/i.test(msg),
    };

    if (asks.max) {
      return `El valor más alto de ${yKey} es ${max.value.toLocaleString()} en ${max.name}. Le siguen ${sorted.slice(1, 3).map(d => `${d.name} con ${d.value.toLocaleString()}`).join(' y ')}. ${trend === 'creciente' ? `La tendencia general es positiva (${pctChange}% de variación total).` : ''}`;
    }

    if (asks.min) {
      const diff = max.value - min.value;
      return `El valor más bajo de ${yKey} es ${min.value.toLocaleString()} en ${min.name}. La diferencia respecto al máximo (${max.value.toLocaleString()} en ${max.name}) es de ${diff.toLocaleString()}, una variación del ${max.value !== 0 ? (((diff) / max.value) * 100).toFixed(1) : 0}%.`;
    }

    if (asks.avg) {
      const above = dataSample.filter(d => d.value > avg).length;
      return `El promedio de ${yKey} es ${Math.round(avg).toLocaleString()}. De los ${dataSample.length} registros de ${xKey}, ${above} están por encima del promedio y ${dataSample.length - above} por debajo. El pico supera el promedio en un ${avg !== 0 ? (((max.value - avg) / avg) * 100).toFixed(1) : 0}%.`;
    }

    if (asks.trend) {
      const midIdx = Math.floor(dataSample.length / 2);
      const firstHalfAvg = dataSample.slice(0, midIdx).reduce((s, d) => s + d.value, 0) / midIdx;
      const secondHalfAvg = dataSample.slice(midIdx).reduce((s, d) => s + d.value, 0) / (dataSample.length - midIdx);
      const accel = secondHalfAvg > firstHalfAvg ? 'acelerándose' : secondHalfAvg < firstHalfAvg ? 'desacelerándose' : 'manteniéndose constante';
      return `La tendencia de ${yKey} es ${trend}: pasó de ${first.value.toLocaleString()} (${first.name}) a ${last.value.toLocaleString()} (${last.name}), un cambio de ${pctChange}%. Comparando primera y segunda mitad del período, el ritmo se está ${accel}.`;
    }

    if (asks.total) {
      return `El total acumulado de ${yKey} en los ${dataSample.length} períodos es ${total.toLocaleString()}, con un promedio de ${Math.round(avg).toLocaleString()} por ${xKey}. El período con mayor peso fue ${max.name} con ${max.value.toLocaleString()} (${total !== 0 ? ((max.value / total) * 100).toFixed(1) : 0}% del total).`;
    }

    if (asks.recommend) {
      if (trend === 'creciente') {
        return `${yKey} creció ${pctChange}% en el período analizado. Recomiendo reforzar las condiciones que generaron el pico en ${max.name} (${max.value.toLocaleString()}) e identificar si hay factores replicables en los demás períodos.`;
      } else if (trend === 'decreciente') {
        return `${yKey} cayó ${Math.abs(Number(pctChange))}% desde ${first.name}. El punto más alto fue ${max.name} con ${max.value.toLocaleString()}. Recomiendo investigar qué cambió a partir de ese punto y actuar sobre las variables que lo están afectando.`;
      }
      return `${yKey} se mantiene relativamente estable con un promedio de ${Math.round(avg).toLocaleString()}. Para mejorar, analiza los períodos pico (${max.name}: ${max.value.toLocaleString()}) y replica las condiciones que los generaron.`;
    }

    if (asks.compare) {
      const top = sorted.slice(0, 3);
      return `Los tres valores más altos de ${yKey} son: ${top.map((d, i) => `${i + 1}. ${d.name} → ${d.value.toLocaleString()}`).join(', ')}. La diferencia entre el primero y el tercero es de ${(top[0].value - (top[2]?.value ?? top[0].value)).toLocaleString()}.`;
    }

    // Resumen general
    return `El gráfico muestra ${yKey} por ${xKey}: parte de ${first.value.toLocaleString()} (${first.name}) y llega a ${last.value.toLocaleString()} (${last.name}), con tendencia ${trend} de ${pctChange}%. El máximo es ${max.value.toLocaleString()} en ${max.name} y el promedio es ${Math.round(avg).toLocaleString()}. ¿Qué aspecto quieres profundizar?`;
  }

  /**
   * Genera un widget personalizado a partir de un prompt del usuario
   */
  async generateCustomWidget(
    userPrompt: string,
    datasetColumns: Array<{ name: string; type: string }>,
    datasetName: string,
    existingWidgetTitles: string[] = []
  ): Promise<{ chartType: string; title: string; description: string; xAxis: string; yAxis: string; colors: string[] }> {
    const columnList = datasetColumns.map(c => `${c.name} (${c.type})`).join(', ');
    const existingTitles = existingWidgetTitles.length > 0
      ? `\nTítulos de gráficos ya existentes (evita repetirlos): ${existingWidgetTitles.join(', ')}`
      : '';

    const idLikePattern = /^(id|_id|uuid|key|hash|code|ref|transaction|order|record|row|index|seq)/i;
    const goodXCols = datasetColumns.filter(c =>
      c.type === 'string' && !idLikePattern.test(c.name)
    ).map(c => c.name);
    const numericCols2 = datasetColumns.filter(c => c.type === 'number').map(c => c.name);
    const dateCols2 = datasetColumns.filter(c => c.type === 'date').map(c => c.name);
    const forbiddenCols = datasetColumns.filter(c =>
      c.type === 'string' && idLikePattern.test(c.name)
    ).map(c => c.name);

    const prompt = `Eres un experto en visualización de datos. El usuario quiere crear un gráfico personalizado para el dataset "${datasetName}".

Columnas numéricas (aptas para eje Y): ${numericCols2.join(', ') || 'ninguna'}
Columnas categóricas buenas para eje X: ${goodXCols.join(', ') || 'ninguna'}
Columnas de fecha (aptas para eje X): ${dateCols2.join(', ') || 'ninguna'}
Columnas PROHIBIDAS para eje X (IDs/alta cardinalidad): ${forbiddenCols.join(', ') || 'ninguna'}
${existingTitles}

Petición del usuario: "${userPrompt}"

Tu tarea: genera la configuración de UN ÚNICO gráfico que cumpla exactamente con lo que el usuario pide.

REGLAS CRÍTICAS:
- NUNCA uses columnas PROHIBIDAS como xAxis
- xAxis debe ser una columna categórica buena o de fecha
- yAxis SIEMPRE debe ser numérica
- El gráfico debe tener sentido de negocio real

Responde ÚNICAMENTE con un objeto JSON válido sin texto adicional, sin bloques de código markdown, sin comentarios. Solo el JSON puro:
{
  "chartType": "bar|line|pie|area|scatter",
  "title": "título conciso del gráfico (máx 40 chars)",
  "description": "descripción de una oración explicando qué muestra el gráfico",
  "xAxis": "nombre exacto de la columna para el eje X (debe existir en el dataset)",
  "yAxis": "nombre exacto de la columna para el eje Y (debe ser numérica)",
  "colors": ["#hexcolor1", "#hexcolor2", "#hexcolor3"]
}

Reglas adicionales:
- El chartType debe ser el más adecuado para los datos y la petición del usuario
- Si el usuario pide un gráfico de pastel/pie, el xAxis es la categoría y yAxis el valor numérico
- Los colores deben ser visualmente atractivos y apropiados para el tipo de gráfico
- El título debe ser descriptivo y único`;

    try {
      console.log('🎨 Generando widget personalizado con prompt:', userPrompt.slice(0, 80));
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      let text = response.text().trim();

      // Limpiar posibles bloques markdown
      text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

      const parsed = JSON.parse(text);

      // Validar campos requeridos
      const chartType = ['bar', 'line', 'pie', 'area', 'scatter'].includes(parsed.chartType) ? parsed.chartType : 'bar';
      const title = typeof parsed.title === 'string' && parsed.title.trim() ? parsed.title.trim() : 'Gráfico Personalizado';
      const description = typeof parsed.description === 'string' ? parsed.description.trim() : '';

      // Validar que las columnas existen
      const colNames = datasetColumns.map(c => c.name);
      const xAxis = colNames.includes(parsed.xAxis) ? parsed.xAxis : (colNames[0] || 'categoria');
      const numericCols = datasetColumns.filter(c => c.type === 'number').map(c => c.name);
      const yAxis = colNames.includes(parsed.yAxis)
        ? parsed.yAxis
        : (numericCols[0] || colNames[1] || 'valor');

      const colors = Array.isArray(parsed.colors) && parsed.colors.length > 0
        ? parsed.colors
        : ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

      console.log('✅ Widget personalizado generado:', { chartType, title, xAxis, yAxis });
      return { chartType, title, description, xAxis, yAxis, colors };
    } catch (error) {
      console.error('❌ Error generando widget personalizado:', error);
      // Fallback: intentar inferir del prompt
      const lowerPrompt = userPrompt.toLowerCase();
      const chartType = lowerPrompt.includes('línea') || lowerPrompt.includes('linea') || lowerPrompt.includes('tendencia') ? 'line'
        : lowerPrompt.includes('pastel') || lowerPrompt.includes('pie') || lowerPrompt.includes('torta') ? 'pie'
        : lowerPrompt.includes('área') || lowerPrompt.includes('area') ? 'area'
        : lowerPrompt.includes('dispersión') || lowerPrompt.includes('scatter') ? 'scatter'
        : 'bar';
      const colNames = datasetColumns.map(c => c.name);
      const numericCols = datasetColumns.filter(c => c.type === 'number').map(c => c.name);
      return {
        chartType,
        title: 'Gráfico Personalizado',
        description: userPrompt.slice(0, 100),
        xAxis: colNames[0] || 'categoria',
        yAxis: numericCols[0] || colNames[1] || 'valor',
        colors: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'],
      };
    }
  }
}

export const geminiService = new GeminiService();