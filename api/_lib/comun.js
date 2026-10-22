import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Modelos compatibles con fallback en caso de sobrecarga temporal
const MODELOS = [
  process.env.GEMINI_MODEL,
  'gemini-3.6-flash',
  'gemini-3.7-flash',
  'gemini-3.8-flash',
  'gemini-flash-latest'
].filter(Boolean);

// Obtener API key con fallback de lectura directa del archivo .env en caliente
function getApiKey() {
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim()) {
    return process.env.GEMINI_API_KEY.trim();
  }
  try {
    const envContent = readFileSync(join(__dirname, '../../.env'), 'utf8');
    const match = envContent.match(/GEMINI_API_KEY\s*=\s*(["']?)(.*?)\1(?:\r?\n|$)/);
    if (match && match[2]) {
      process.env.GEMINI_API_KEY = match[2].trim();
      return process.env.GEMINI_API_KEY;
    }
  } catch {
    // Si no existe el archivo .env, se informa más abajo
  }
  return null;
}

// Valida método, código de acceso y API key. Devuelve la API key o null si ya respondió con error.
export function validarSolicitud(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido. Utilice POST.' });
    return null;
  }

  const codigo = process.env.APP_ACCESS_CODE?.trim();
  if (codigo && req.headers['x-codigo-acceso'] !== codigo) {
    res.status(401).json({ error: 'Ingresa el código de acceso para usar la herramienta.', codigoRequerido: true });
    return null;
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    res.status(500).json({ error: 'La variable de entorno GEMINI_API_KEY no está configurada en el servidor.' });
    return null;
  }
  return apiKey;
}

// Convierte un data URL (imagen o PDF) en una parte multimodal para Gemini
export function parteArchivo(dataUrl) {
  const match = /^data:([\w/+.-]+);base64,(.+)$/s.exec(dataUrl || '');
  if (!match) return null;
  return { inlineData: { mimeType: match[1], data: match[2] } };
}

function extraerJson(texto) {
  const limpio = texto.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return JSON.parse(limpio);
}

// Llama a Gemini probando cada modelo hasta obtener un JSON válido
export async function consultarGemini(apiKey, parts) {
  const payload = {
    contents: [{ parts }],
    generationConfig: { responseMimeType: 'application/json' }
  };

  let ultimoError = null;
  for (const modelo of MODELOS) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify(payload)
        }
      );

      if (!response.ok) {
        ultimoError = await response.text();
        console.warn(`Modelo ${modelo} devolvió estado ${response.status}:`, ultimoError);
        continue;
      }

      const data = await response.json();
      const texto = data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('');
      if (!texto) {
        ultimoError = 'Respuesta vacía del modelo.';
        continue;
      }
      return extraerJson(texto);
    } catch (err) {
      ultimoError = err.message;
      console.warn(`Fallo al invocar ${modelo}:`, err);
    }
  }

  const error = new Error('No se pudo obtener respuesta de los modelos de Gemini disponibles.');
  error.detalle = ultimoError;
  throw error;
}

export const texto = (valor, max = 600) => (typeof valor === 'string' ? valor.trim().slice(0, max) : '');

export const listaTextos = (valor, max = 30) =>
  Array.isArray(valor) ? valor.map(v => texto(v, 80)).filter(Boolean).slice(0, max) : [];
