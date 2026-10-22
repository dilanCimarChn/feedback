import { validarSolicitud, parteArchivo, consultarGemini, texto, listaTextos } from './_lib/comun.js';

const MAX_IMAGENES = 8;

const PROMPT = `Eres un director de arte y estratega de marca. A partir del material adjunto (publicaciones de la marca, manual de marca y/o la descripción escrita por el cliente), extrae la identidad de marca para configurar un revisor automático de publicaciones en redes sociales.

Reglas:
- Si el manual de marca indica un dato explícito (códigos HEX, nombres de fuentes), úsalo tal cual.
- Si solo hay imágenes, deduce los datos observando patrones que se repiten entre publicaciones. Para tipografías, indica el nombre más probable o una descripción del estilo (ej: "Sans serif geométrica tipo Montserrat, en negrita").
- Lo que el cliente escriba en su descripción tiene prioridad sobre lo que deduzcas.
- Si no hay información suficiente para un campo, déjalo vacío ("" o []). No inventes.
- Escribe en español claro, pensado para un equipo de marketing no técnico.

RESPONDE EXCLUSIVAMENTE CON ESTE JSON:
{
  "nombre": "nombre de la marca",
  "descripcion": "a qué se dedica la marca, en 1-2 oraciones",
  "colores": [{ "hex": "#RRGGBB", "nombre": "nombre descriptivo y su uso (ej: Azul marino - principal)" }],
  "tipografias": { "titulos": "", "cuerpo": "", "notas": "reglas de uso: pesos, mayúsculas, tamaños" },
  "tono": "cómo habla la marca: formal/cercano, tuteo/usted, estilo",
  "publico": "a quién le habla",
  "emojis": "no" | "moderado" | "libre",
  "palabras_clave": ["frases, slogans o términos que la marca usa"],
  "palabras_prohibidas": ["palabras o expresiones a evitar"],
  "hashtags": ["#hashtags oficiales"],
  "estilo_visual": "fotografía, ilustración, íconos, composición, fondos",
  "logo": "dónde y cómo se ubica el logo",
  "margenes": "márgenes o espacios que se respetan",
  "instrucciones_revisor": "indicaciones del cliente sobre cómo debe comportarse el revisor, si las dio",
  "notas": "qué no se pudo determinar y conviene completar a mano"
}`;

const HEX = /^#[0-9A-F]{6}$/;

function normalizarPerfil(bruto) {
  const colores = (Array.isArray(bruto?.colores) ? bruto.colores : [])
    .map(c => ({ hex: texto(c?.hex, 9).toUpperCase(), nombre: texto(c?.nombre, 60) }))
    .filter(c => HEX.test(c.hex))
    .slice(0, 8);

  return {
    perfil: {
      nombre: texto(bruto?.nombre, 120),
      descripcion: texto(bruto?.descripcion),
      colores,
      tipografias: {
        titulos: texto(bruto?.tipografias?.titulos, 120),
        cuerpo: texto(bruto?.tipografias?.cuerpo, 120),
        notas: texto(bruto?.tipografias?.notas)
      },
      tono: texto(bruto?.tono),
      publico: texto(bruto?.publico),
      emojis: ['no', 'moderado', 'libre'].includes(bruto?.emojis) ? bruto.emojis : '',
      palabras_clave: listaTextos(bruto?.palabras_clave),
      palabras_prohibidas: listaTextos(bruto?.palabras_prohibidas),
      hashtags: listaTextos(bruto?.hashtags),
      estilo_visual: texto(bruto?.estilo_visual),
      logo: texto(bruto?.logo),
      margenes: texto(bruto?.margenes)
    },
    instrucciones: texto(bruto?.instrucciones_revisor, 1500),
    notas: texto(bruto?.notas)
  };
}

export default async function handler(req, res) {
  const apiKey = validarSolicitud(req, res);
  if (!apiKey) return;

  try {
    const { imagenes = [], documento = null, descripcion = '' } = req.body || {};
    const partesImagen = imagenes.map(parteArchivo).filter(Boolean).slice(0, MAX_IMAGENES);
    const parteDocumento = parteArchivo(documento);
    const descripcionLimpia = texto(descripcion, 3000);

    if (!partesImagen.length && !parteDocumento && !descripcionLimpia) {
      return res.status(400).json({
        error: 'Sube algunas publicaciones, tu manual de marca o cuéntanos cómo es tu marca.'
      });
    }

    const parts = [{ text: PROMPT }];
    if (descripcionLimpia) {
      parts.push({ text: `DESCRIPCIÓN ESCRITA POR EL CLIENTE:\n"""\n${descripcionLimpia}\n"""` });
    }
    if (parteDocumento) {
      parts.push({ text: 'MANUAL DE MARCA:' }, parteDocumento);
    }
    partesImagen.forEach((img, i) => {
      parts.push({ text: `PUBLICACIÓN DE LA MARCA ${i + 1}:` }, img);
    });

    const bruto = await consultarGemini(apiKey, parts);
    return res.status(200).json(normalizarPerfil(bruto));
  } catch (error) {
    console.error('Error analizando marca:', error);
    return res.status(502).json({
      error: 'No fue posible analizar tu marca. Inténtalo de nuevo en unos segundos.',
      detalle: error.detalle || error.message
    });
  }
}
