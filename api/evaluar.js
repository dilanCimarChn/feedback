import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Carga de reglas.json con compatibilidad para desarrollo y Vercel Serverless
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let reglas = null;
const posiblesRutas = [
  join(__dirname, 'reglas.json'),
  join(__dirname, '../src/reglas/reglas.json'),
  join(process.cwd(), 'src/reglas/reglas.json'),
  join(process.cwd(), 'api/reglas.json')
];

for (const ruta of posiblesRutas) {
  try {
    reglas = JSON.parse(readFileSync(ruta, 'utf8'));
    if (reglas) break;
  } catch {
    // Continuar con la siguiente ruta
  }
}

if (!reglas) {
  console.warn('Advertencia: No se pudo cargar reglas.json desde disco, se usarán reglas por defecto.');
}

import dotenv from 'dotenv';
dotenv.config();

// Obtener API key con fallback de lectura directa del archivo .env en caliente
function getApiKey() {
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim()) {
    return process.env.GEMINI_API_KEY.trim();
  }
  try {
    const envPath = join(__dirname, '../.env');
    const envContent = readFileSync(envPath, 'utf8');
    const match = envContent.match(/GEMINI_API_KEY\s*=\s*(["']?)(.*?)\1(?:\r?\n|$)/);
    if (match && match[2]) {
      process.env.GEMINI_API_KEY = match[2].trim();
      return process.env.GEMINI_API_KEY;
    }
  } catch {
    // Si no existe el archivo .env, continuará y validará
  }
  return null;
}

export default async function handler(req, res) {
  // Manejo de CORS si es necesario
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Método no permitido. Utilice POST.'
    });
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    return res.status(500).json({
      error: 'La variable de entorno GEMINI_API_KEY no está configurada en el servidor.'
    });
  }

  try {
    const { copy, imagenBase64, tipo } = req.body || {};

    if (!copy && !imagenBase64) {
      return res.status(400).json({
        error: 'Debe proporcionar al menos el copy o una imagen para evaluar.'
      });
    }

    // Reglas de marca a evaluar
    const reglasMarca = reglas || {};
    const formatoActual = reglasMarca.formatos?.[tipo] || {
      nombre: tipo || 'Post General',
      zona_seguridad: 'Margen general de 24px sin tocar los bordes.',
      requisito_copy: 'Copy alineado al objetivo de la publicación con llamado a la acción claro.'
    };

    // Prompt estricto para Gemini con reglas generales y específicas por formato
    const prompt = `Eres un auditor experto de identidad de marca y control de calidad para publicaciones en redes sociales.
Evalúa la siguiente publicación contra las reglas estrictas de identidad de marca y las pautas técnicas del formato seleccionado.

TIPO DE PUBLICACIÓN:
${tipo ? tipo.toUpperCase() : 'POST'} (${formatoActual.nombre})

COPY DE LA PUBLICACIÓN:
"""
${copy || '(Sin texto de copy)'}
"""

REGLAS GENERALES DE IDENTIDAD DE MARCA:
- Margenes base: ${reglasMarca.margenes || 'Dejar zona de seguridad de 24px'}
- Colores corporativos permitidos: ${JSON.stringify(reglasMarca.colores || ['#1A2B3C', '#FFFFFF', '#E63946'])}
- Contexto y tono: ${reglasMarca.contexto || 'Tono cercano y directo, sin jerga corporativa'}
- Tipografia: ${reglasMarca.tipografia || 'Máximo 2 tipografías legibles'}
- Gramatica y estilo: ${reglasMarca.gramatica || 'Sin errores ortográficos, sin mayúsculas sostenidas salvo títulos cortos'}

PAUTAS TÉCNICAS ESPECÍFICAS PARA EL FORMATO [${tipo?.toUpperCase()}]:
- Zona de seguridad requerida: ${formatoActual.zona_seguridad}
- Requisito del copy para este formato: ${formatoActual.requisito_copy}

CRITERIOS CRÍTICOS POR FORMATO:
1. SI ES REEL:
   - En la imagen (portada o frame vertical 9:16): verifica estrictamente que los 220px inferiores (área nativa del título, audio y descripción en Instagram/TikTok) y los 120px del lateral derecho (botones nativos de like, comentar, compartir) estén libres de logotipos, textos clave o elementos de lectura esenciales. Si hay elementos invadiendo esas zonas, regístralo bajo la categoría "margenes".
   - En el copy: debe ser conciso, ágil y complementar el video sin bloques de texto masivos.
2. SI ES CARRUSEL:
   - En el copy: es OBLIGATORIO que contenga un llamado a la acción (CTA) explícito que invite a deslizar a la siguiente lámina o guardar el post (ej: "Desliza para ver más", "Guarda este post", "Desliza para el paso a paso"). Si no incluye este llamado explícito a deslizar o interactuar con el carrusel, regístralo como error bajo la categoría "contexto".
3. SI ES POST DE FEED:
   - Mantener proporción limpia 1:1 o 4:5, margen general libre de 24px y CTA directo.

INSTRUCCIONES DE EVALUACIÓN:
1. Evalúa minuciosamente tanto la imagen (si se adjuntó) como el texto del copy.
2. Si todo cumple satisfactoriamente tanto las reglas de marca como los requisitos técnicos del formato (${tipo}), "aprobado" debe ser true y "errores" debe ser [].
3. Si existe cualquier incumplimiento (en márgenes, zonas de seguridad de la app, colores fuera de paleta, falta de CTA de deslizar en carruseles, tipografía, jergas o faltas ortográficas), "aprobado" debe ser false y debes detallar cada falta en la lista "errores".
4. Las únicas categorías válidas para "categoria" son: "margenes", "colores", "contexto", "tipografia", "gramatica".
5. Para cada error, provee una "descripcion" clara y una "sugerencia" práctica para solucionarlo.

DEBES RESPONDER EXCLUSIVAMENTE EN FORMATO JSON CON ESTA ESTRUCTURA EXACTA:
{
  "aprobado": boolean,
  "errores": [
    {
      "categoria": "margenes" | "colores" | "contexto" | "tipografia" | "gramatica",
      "descripcion": "string explicando qué regla o zona de interfaz se infringió",
      "sugerencia": "string con la recomendación para solucionarlo"
    }
  ]
}`;

    // Construcción de partes multimodales
    const parts = [{ text: prompt }];

    if (imagenBase64) {
      let mimeType = 'image/jpeg';
      let cleanData = imagenBase64;

      if (imagenBase64.includes(',')) {
        const matches = imagenBase64.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.*)$/);
        if (matches && matches.length === 3) {
          mimeType = matches[1];
          cleanData = matches[2];
        } else {
          cleanData = imagenBase64.split(',')[1];
        }
      }

      parts.push({
        inlineData: {
          mimeType: mimeType,
          data: cleanData
        }
      });
    }

    // Lista de modelos compatibles con fallback en caso de sobrecarga temporal
    const modelosDisponibles = [
      process.env.GEMINI_MODEL,
      'gemini-3.6-flash',
      'gemini-3.7-flash',
      'gemini-3.8-flash',
      'gemini-flash-latest'
    ].filter(Boolean);

    const geminiPayload = {
      contents: [
        {
          parts: parts
        }
      ],
      generationConfig: {
        responseMimeType: 'application/json'
      }
    };

    let response = null;
    let ultimoError = null;

    for (const mod of modelosDisponibles) {
      try {
        const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${mod}:generateContent?key=${apiKey}`;
        response = await fetch(geminiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(geminiPayload)
        });

        if (response.ok) {
          break;
        } else {
          ultimoError = await response.text();
          console.warn(`Modelo ${mod} devolvió estado ${response.status}:`, ultimoError);
        }
      } catch (err) {
        ultimoError = err.message;
        console.warn(`Fallo de conexión al invocar ${mod}:`, err);
      }
    }

    if (!response || !response.ok) {
      return res.status(502).json({
        error: 'No se pudo obtener respuesta de los modelos de Gemini disponibles.',
        detalle: ultimoError
      });
    }

    const data = await response.json();

    // Extraer texto generado por el modelo
    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidateText) {
      return res.status(502).json({
        error: 'No se recibió texto de respuesta válido de Gemini.',
        raw: data
      });
    }

    // Parsea la respuesta JSON y la devuelve al front tal cual
    const parsedFeedback = JSON.parse(candidateText);
    return res.status(200).json(parsedFeedback);
  } catch (error) {
    console.error('Error procesando evaluación:', error);
    return res.status(500).json({
      error: 'Error interno del servidor al procesar la evaluación.',
      detalle: error.message
    });
  }
}
