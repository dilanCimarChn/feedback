import { validarSolicitud, parteArchivo, consultarGemini, texto, listaTextos } from './_lib/comun.js';
import { FORMATOS, CATEGORIAS } from './_lib/formatos.js';

const MAX_PIEZAS = 10;
const MAX_REFERENCIAS = 4;

// Puntaje mínimo y severidades que impiden aprobar según el nivel de exigencia
const EXIGENCIAS = {
  flexible: {
    puntaje: 55,
    bloquean: ['alta'],
    instruccion: 'Sé tolerante: reporta solo problemas evidentes que un cliente notaría. Ignora detalles menores.'
  },
  equilibrado: {
    puntaje: 70,
    bloquean: ['alta'],
    instruccion: 'Reporta problemas claros y detalles relevantes, sin ser quisquilloso.'
  },
  estricto: {
    puntaje: 85,
    bloquean: ['alta', 'media'],
    instruccion: 'Sé riguroso: reporta cualquier desviación de las reglas de marca, incluso las menores.'
  }
};

const EMOJIS = {
  no: 'No se permiten emojis.',
  moderado: 'Emojis permitidos con moderación (máximo 2-3 por publicación).',
  libre: 'Uso libre de emojis.'
};

function describirPerfil(perfil) {
  const lineas = [];
  const agregar = (etiqueta, valor) => valor && lineas.push(`- ${etiqueta}: ${valor}`);

  agregar('Marca', texto(perfil.nombre, 120));
  agregar('Descripción', texto(perfil.descripcion));
  const colores = Array.isArray(perfil.colores) ? perfil.colores.slice(0, 12) : [];
  if (colores.length) {
    agregar(
      'Paleta oficial',
      colores.map(c => `${texto(c.hex, 9)}${c.nombre ? ` (${texto(c.nombre, 40)})` : ''}`).join(', ')
    );
  }
  agregar('Tipografía de títulos', texto(perfil.tipografias?.titulos, 120));
  agregar('Tipografía de cuerpo', texto(perfil.tipografias?.cuerpo, 120));
  agregar('Notas de tipografía', texto(perfil.tipografias?.notas));
  agregar('Tono de voz', texto(perfil.tono));
  agregar('Público objetivo', texto(perfil.publico));
  agregar('Emojis', EMOJIS[perfil.emojis]);
  agregar('Palabras o frases a usar', listaTextos(perfil.palabras_clave).join(', '));
  agregar('Palabras o frases prohibidas', listaTextos(perfil.palabras_prohibidas).join(', '));
  agregar('Hashtags oficiales', listaTextos(perfil.hashtags).join(' '));
  agregar('Estilo visual', texto(perfil.estilo_visual));
  agregar('Uso del logo', texto(perfil.logo));
  agregar('Márgenes', texto(perfil.margenes));

  return lineas.length
    ? lineas.join('\n')
    : '- No hay reglas de marca configuradas: evalúa según buenas prácticas generales de diseño y redacción.';
}

function construirPrompt({ copy, tipo, formato, perfil, comportamiento, categorias, numPiezas, numReferencias }) {
  const exigencia = EXIGENCIAS[comportamiento.exigencia] || EXIGENCIAS.equilibrado;
  const redes = listaTextos(comportamiento.redes, 6);
  const instrucciones = texto(comportamiento.instrucciones, 1500);
  const detalle =
    comportamiento.detalle === 'detallado'
      ? 'Explica cada observación en 2-3 oraciones y da sugerencias concretas paso a paso.'
      : 'Descripciones y sugerencias de una sola oración, directas y fáciles de entender.';

  return `Eres un revisor experto de identidad de marca para publicaciones en redes sociales. Tus comentarios los leerá un equipo de marketing sin conocimientos técnicos: escribe en español claro, amable y concreto.

TIPO DE PUBLICACIÓN: ${formato.nombre}
${redes.length ? `REDES DONDE SE PUBLICARÁ: ${redes.join(', ')}\n` : ''}
COPY DE LA PUBLICACIÓN:
"""
${copy || '(Sin texto de copy)'}
"""

REGLAS DE LA MARCA:
${describirPerfil(perfil)}

PAUTAS TÉCNICAS DEL FORMATO:
- Zona de seguridad: ${formato.zona_seguridad}
- Copy: ${formato.requisito_copy}

MATERIAL ADJUNTO:
- ${numReferencias ? `${numReferencias} imagen(es) de REFERENCIA: publicaciones aprobadas de la marca. NO se evalúan; úsalas como el estándar visual (colores, tipografías, composición, estilo).` : 'Sin imágenes de referencia.'}
- ${numPiezas ? `${numPiezas} imagen(es) de la PIEZA A EVALUAR${tipo === 'carrusel' ? ' (láminas del carrusel en orden)' : ''}.` : 'Sin imagen: evalúa solo el copy y omite observaciones visuales.'}

CÓMO REVISAR:
- Nivel de exigencia: ${exigencia.instruccion}
- Revisa ÚNICAMENTE estos aspectos: ${categorias.map(c => `"${c}" (${CATEGORIAS[c]})`).join(', ')}. No reportes nada de otros aspectos.
- ${detalle}
- Los colores y medidas son estimaciones visuales: si no estás seguro de una desviación, usa severidad "baja".
- Severidad "alta": rompe la identidad de marca o la pieza no funciona (logo o texto en zona insegura, colores ajenos a la marca, falta un CTA obligatorio, error ortográfico visible). "media": afecta la calidad pero no la invalida. "baja": mejora opcional.
${instrucciones ? `- Instrucciones adicionales del equipo de marca (respétalas): ${instrucciones}\n` : ''}
RESPONDE EXCLUSIVAMENTE CON ESTE JSON:
{
  "puntaje": número de 0 a 100 que refleja qué tan alineada está la pieza con la marca,
  "resumen": "una oración con la conclusión general",
  "aciertos": ["hasta 4 cosas que la pieza hace bien"],
  "errores": [
    {
      "categoria": ${categorias.map(c => `"${c}"`).join(' | ')},
      "severidad": "alta" | "media" | "baja",
      "descripcion": "qué regla se incumple y dónde",
      "sugerencia": "cómo solucionarlo"
    }
  ]
}`;
}

function normalizarResultado(bruto, categorias, comportamiento) {
  const errores = (Array.isArray(bruto?.errores) ? bruto.errores : [])
    .filter(e => categorias.includes(e?.categoria))
    .map(e => ({
      categoria: e.categoria,
      severidad: ['alta', 'media', 'baja'].includes(e.severidad) ? e.severidad : 'media',
      descripcion: texto(e.descripcion, 1200),
      sugerencia: texto(e.sugerencia, 1200)
    }))
    .filter(e => e.descripcion);

  const puntajeBruto = Number(bruto?.puntaje);
  const puntaje = Number.isFinite(puntajeBruto) ? Math.round(Math.min(100, Math.max(0, puntajeBruto))) : null;

  // La aprobación se decide aquí, no en el modelo, para que respete el nivel de exigencia
  const exigencia = EXIGENCIAS[comportamiento.exigencia] || EXIGENCIAS.equilibrado;
  const bloqueado = errores.some(e => exigencia.bloquean.includes(e.severidad));
  const aprobado =
    comportamiento.modo === 'sugerencias' ? null : !bloqueado && (puntaje === null || puntaje >= exigencia.puntaje);

  return {
    aprobado,
    puntaje,
    resumen: texto(bruto?.resumen, 400),
    aciertos: (Array.isArray(bruto?.aciertos) ? bruto.aciertos : []).map(a => texto(a, 300)).filter(Boolean).slice(0, 4),
    errores
  };
}

export default async function handler(req, res) {
  const apiKey = validarSolicitud(req, res);
  if (!apiKey) return;

  try {
    const { copy = '', tipo = 'post', perfil = {}, comportamiento = {} } = req.body || {};
    // Compatibilidad con clientes anteriores que enviaban una sola imagen
    const imagenes = (req.body?.imagenes || (req.body?.imagenBase64 ? [req.body.imagenBase64] : []))
      .map(parteArchivo)
      .filter(Boolean)
      .slice(0, MAX_PIEZAS);

    if (!texto(copy, 5000) && !imagenes.length) {
      return res.status(400).json({ error: 'Escribe el copy o sube al menos una imagen para revisar.' });
    }

    const revisar = comportamiento.revisar || {};
    const categorias = Object.keys(CATEGORIAS).filter(c => revisar[c] !== false);
    if (!categorias.length) {
      return res.status(400).json({ error: 'Activa al menos un aspecto a revisar en la configuración.' });
    }

    const referencias = (Array.isArray(perfil.referencias) ? perfil.referencias : [])
      .map(parteArchivo)
      .filter(Boolean)
      .slice(0, MAX_REFERENCIAS);

    const formato = FORMATOS[tipo] || FORMATOS.post;
    const parts = [
      {
        text: construirPrompt({
          copy: texto(copy, 5000),
          tipo,
          formato,
          perfil,
          comportamiento,
          categorias,
          numPiezas: imagenes.length,
          numReferencias: referencias.length
        })
      }
    ];

    referencias.forEach((ref, i) => {
      parts.push({ text: `REFERENCIA ${i + 1} (no evaluar):` }, ref);
    });
    imagenes.forEach((img, i) => {
      parts.push({ text: `PIEZA A EVALUAR - imagen ${i + 1} de ${imagenes.length}:` }, img);
    });

    const bruto = await consultarGemini(apiKey, parts);
    return res.status(200).json(normalizarResultado(bruto, categorias, comportamiento));
  } catch (error) {
    console.error('Error procesando evaluación:', error);
    return res.status(502).json({
      error: 'No fue posible completar la revisión. Inténtalo de nuevo en unos segundos.',
      detalle: error.detalle || error.message
    });
  }
}
