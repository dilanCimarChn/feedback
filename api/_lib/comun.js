import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { crearLimitador, ErrorServicio, huella } from './carga.js';

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

const limitarGemini = crearLimitador();
const pausas = new Map();
let bytesPendientes = 0;

// Una cuota agotada no debe provocar una cascada de peticiones a otros modelos.
export async function consultarGemini(apiKey, parts) {
  const clave = huella([apiKey]);
  const comprobarPausa = () => {
    const restante = (pausas.get(clave) || 0) - Date.now();
    if (restante > 0) throw new ErrorServicio('La cuota de IA está temporalmente ocupada. Intenta más tarde.', 429, Math.ceil(restante / 1000));
    pausas.delete(clave);
  };
  comprobarPausa();
  const bytes = parts.reduce((s,p)=>s+2*((p.text?.length||0)+(p.inlineData?.data?.length||0)),0);
  if (bytesPendientes + bytes > 32 * 1024 * 1024) throw new ErrorServicio('Hay demasiados archivos en proceso. Intenta de nuevo en unos segundos.');
  bytesPendientes += bytes;
  try {
    return await limitarGemini(async () => {
      comprobarPausa();
      return invocarGemini(apiKey, parts, clave);
    });
  } finally { bytesPendientes -= bytes; }
}

async function invocarGemini(apiKey, parts, clave) {
  const payload = {
    contents: [{ parts }],
    generationConfig: { responseMimeType: 'application/json' }
  };

  const cuerpo = JSON.stringify(payload);
  const limite = Date.now() + 32000;
  for (const modelo of [...new Set(MODELOS)]) {
    if (Date.now() >= limite) break;
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: cuerpo,
          signal: AbortSignal.timeout(Math.min(18000, Math.max(1, limite - Date.now())))
        }
      );

      if (!response.ok) {
        if (response.status === 429) {
          const indicado = Number(response.headers?.get('retry-after'));
          const segundos = Number.isFinite(indicado) && indicado > 0 ? Math.min(300, Math.ceil(indicado)) : 30;
          if (pausas.size >= 100) pausas.delete(pausas.keys().next().value);
          pausas.set(clave, Date.now() + segundos * 1000);
          throw new ErrorServicio('La cuota de IA está temporalmente ocupada. Intenta más tarde.', 429, segundos);
        }
        if (response.status === 404) continue;
        if (response.status >= 500) throw new ErrorServicio('El proveedor de IA está ocupado. Intenta de nuevo en unos segundos.', 503, 10);
        throw new ErrorServicio('El proveedor de IA rechazó la solicitud. Revisa la configuración del servicio.', 502, 30);
      }

      const data = await response.json();
      const texto = data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('');
      if (!texto) {
        continue;
      }
      return extraerJson(texto);
    } catch (err) {
      if (err instanceof ErrorServicio) throw err;
      if (err.name === 'TimeoutError' || err.name === 'AbortError') throw new ErrorServicio('La IA tardó demasiado. Reintenta; el calendario anterior se conserva.', 504, 5);
      // Un JSON incompleto permite probar el siguiente modelo dentro del presupuesto.
      if (!(err instanceof SyntaxError)) throw new ErrorServicio('No se pudo conectar con la IA. Intenta de nuevo.', 503, 5);
    }
  }

  const error = new Error('No se pudo obtener respuesta de los modelos de Gemini disponibles.');
  throw error;
}

export const texto = (valor, max = 600) => (typeof valor === 'string' ? valor.trim().slice(0, max) : '');

export const listaTextos = (valor, max = 30) =>
  Array.isArray(valor) ? valor.map(v => texto(v, 80)).filter(Boolean).slice(0, max) : [];
