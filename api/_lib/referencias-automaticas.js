import { obtenerSenales } from './senales-sociales.js';
import { consultarInstagramExterno } from './instagram-descubrimiento.js';
import { consultarFacebookExterno, consultarTikTokDiscovery } from './descubrimiento-social.js';
import { leerTendenciasRss } from './investigacion-marketing.js';
import { crearCacheAsync, huella, limitarFuentes } from './carga.js';

const cache = crearCacheAsync({ max: 80 });
const identidades = new WeakMap();
let siguienteIdentidad = 0;
const identidad = funcion => { if (!identidades.has(funcion)) identidades.set(funcion, ++siguienteIdentidad); return identidades.get(funcion); };
const texto = (valor, max = 600) => typeof valor === 'string' ? valor.trim().replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').slice(0, max) : '';
const normalizar = valor => texto(valor, 6000).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const lista = valor => texto(valor, 600).split(',').map(v => v.trim()).filter(Boolean).slice(0, 2);
const LIMITE = 'Referencias temáticas públicas para inspirar contenido. No completan perfiles de competidores, no acreditan sus métricas y no prueban eficacia en otros canales. Google Trends solo aporta coincidencias temáticas del RSS nacional.';
const HOSTS = {
  YouTube: ['www.youtube.com', 'youtube.com', 'youtu.be'],
  Instagram: ['www.instagram.com', 'instagram.com'],
  Facebook: ['www.facebook.com', 'facebook.com', 'm.facebook.com', 'fb.watch'],
  TikTok: ['www.tiktok.com', 'tiktok.com'],
  'Google Trends': ['trends.google.com'],
};

function urlSegura(valor, fuente) {
  try {
    const url = new URL(valor);
    if (url.protocol !== 'https:' || url.username || url.password || url.port || !HOSTS[fuente]?.includes(url.hostname)) return '';
    url.hash = '';
    for (const clave of [...url.searchParams.keys()]) if (!['v', 'q', 'geo', 'id', 'story_fbid'].includes(clave)) url.searchParams.delete(clave);
    return url.toString();
  } catch { return ''; }
}

const fecha = valor => typeof valor === 'string' && Number.isFinite(Date.parse(valor)) ? new Date(valor).toISOString() : null;

function temaCampana(configuracion, perfil) {
  const contexto = normalizar([configuracion.objetivo, configuracion.mision, perfil.descripcion, ...(configuracion.vocabulario || [])].join(' '));
  const ingles = ['US', 'GB', 'CA', 'AU', 'IN', 'ZA', 'KE'].includes(configuracion.pais);
  const sectores = [
    [/\b(?:educacion|education|escuela|school|becas)\b/, 'education', 'educación'],
    [/\b(?:salud|health|healthcare|hospital)\b/, 'health', 'salud'],
    [/\b(?:alimentacion|food|hambre|hunger|nutrition)\b/, 'food aid', 'ayuda alimentaria'],
    [/\b(?:reciclaje|recycling|sostenibilidad|sustainability)\b/, 'resource reuse', 'reutilización de recursos'],
  ];
  const sector = sectores.find(([expresion]) => expresion.test(contexto));
  const asunto = sector ? sector[ingles ? 1 : 2] : '';
  const objetivo = configuracion.objetivoTipo === 'empresa' ? (ingles ? 'corporate partnership' : 'alianzas empresariales') : (ingles ? 'volunteer recruitment' : 'captación de voluntarios');
  return [ingles ? 'nonprofit' : 'ONG', asunto, objetivo].filter(Boolean).join(' ');
}

function pertinente(valor) {
  const palabras = normalizar(valor).match(/[\p{L}\p{N}]+/gu) || [];
  const terminos = ['volunt', 'donac', 'donat', 'logist', 'humanit', 'fundrais', 'partnership', 'alianz', 'colabor', 'collabor', 'resource', 'recurso'];
  return palabras.some(p => terminos.some(t => p.startsWith(t)));
}

async function conTiempo(tarea) {
  let temporizador;
  try {
    return await Promise.race([Promise.resolve().then(tarea), new Promise((_, rechazar) => { temporizador = setTimeout(() => rechazar(new Error('Fuente fuera del tiempo de consulta.')), 11000); })]);
  } finally { clearTimeout(temporizador); }
}

async function tendencias(pais, fetchImpl) {
  return limitarFuentes(async () => {
    const r = await fetchImpl(`https://trends.google.com/trending/rss?geo=${pais}`, { redirect: 'error', signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error('Google Trends no disponible.');
    const xml = await r.text();
    if (xml.length > 300000) throw new Error('El RSS excedió el tamaño esperado.');
    return leerTendenciasRss(xml);
  });
}

function estado(fuente, resultado, campos = {}) {
  if (resultado.status === 'rejected') return { fuente, estado: 'No disponible', detalle: `No se pudo completar la consulta de ${fuente}. Las otras referencias se conservan.`, ...campos };
  const dato = resultado.value;
  const seguro = typeof dato === 'object' && !Array.isArray(dato) ? dato : {};
  return { fuente, estado: texto(seguro.estado, 120) || 'Consultada', detalle: texto(seguro.detalle || seguro.aviso, 1400), ...campos };
}

function fuenteCatalogo(fuente, indice, item, consultado, alcance) {
  const esTermino = fuente === 'TikTok';
  const url = urlSegura(esTermino ? item.urlExplorar : item.url, fuente);
  const contenido = texto(item.titulo || item.tema, 1000);
  if (!url || !contenido || !pertinente(contenido) || item.textoDisponible === false) return null;
  return {
    id: `apoyo:${({ YouTube: 'youtube', Instagram: 'instagram', Facebook: 'facebook', TikTok: 'tiktok', 'Google Trends': 'trends' })[fuente]}:${indice + 1}`,
    tipo: fuente === 'Google Trends' ? 'RSS Google Trends · coincidencia temática' : esTermino ? 'API TikTok Discovery · término de búsqueda' : `API ${fuente} · referencia temática`,
    canal: ['Instagram', 'Facebook', 'TikTok'].includes(fuente) ? fuente : null, canalOrigen: fuente, referenteId: null, url, fecha: fecha(item.fecha || item.publicado), consultado,
    titulo: contenido, texto: esTermino ? `Término de búsqueda devuelto por Discovery: ${contenido}. Esta referencia no contiene publicaciones, CTA ni métricas.` : contenido, alcance,
    ...(esTermino ? { formato: 'Término de búsqueda', esTermino: true } : {}),
    hashtagsObservados: [...new Set((item.hashtags || []).filter(h => typeof h === 'string' && /^#[\p{L}\p{N}_]{1,80}$/u.test(h)))].slice(0, 6),
  };
}

// Los adaptadores por defecto reutilizan las credenciales y cachés del servidor.
// Los proveedores inyectados permiten comprobar el flujo sin red ni mutar process.env.
export async function recopilarApoyoTscp({ configuracion, perfil = {}, referentes = [] }, {
  env = process.env, fetchImpl = globalThis.fetch, ahora = new Date(), youtube = obtenerSenales,
  instagram = consultarInstagramExterno, facebook = consultarFacebookExterno, tiktok = consultarTikTokDiscovery,
} = {}) {
  const pais = /^[A-Z]{2}$/.test(configuracion?.pais || '') ? configuracion.pais : 'US';
  const tema = temaCampana(configuracion || {}, perfil);
  const cuentas = [...new Set([...referentes.filter(r => r.canal === 'Instagram' && r.cuenta).map(r => r.cuenta), ...lista(env.INSTAGRAM_DISCOVERY_ACCOUNTS || env.INSTAGRAM_CUENTAS_REFERENCIA)])].slice(0, 2);
  const hashtags = lista(env.INSTAGRAM_DISCOVERY_HASHTAGS);
  const claves = ['YOUTUBE_API_KEY', 'META_GRAPH_VERSION', 'INSTAGRAM_USER_ID', 'INSTAGRAM_ACCESS_TOKEN', 'FACEBOOK_PUBLIC_ACCESS_TOKEN', 'FACEBOOK_DISCOVERY_PAGE_IDS', 'TIKTOK_DISCOVERY_ACCESS_TOKEN', 'TIKTOK_DISCOVERY_BUSINESS_ID'].map(k => env[k] || '');
  const clave = huella([pais, tema, cuentas, hashtags, claves, identidad(fetchImpl), identidad(youtube), identidad(instagram), identidad(facebook), identidad(tiktok)]);
  return cache(clave, async () => {
    const consultado = ahora.toISOString();
    const igConfigurado = ['META_GRAPH_VERSION', 'INSTAGRAM_USER_ID', 'INSTAGRAM_ACCESS_TOKEN'].every(k => typeof env[k] === 'string' && env[k].trim());
    const fbConfigurado = ['META_GRAPH_VERSION', 'FACEBOOK_PUBLIC_ACCESS_TOKEN', 'FACEBOOK_DISCOVERY_PAGE_IDS'].every(k => typeof env[k] === 'string' && env[k].trim());
    const ttConfigurado = ['TIKTOK_DISCOVERY_ACCESS_TOKEN', 'TIKTOK_DISCOVERY_BUSINESS_ID'].every(k => typeof env[k] === 'string' && env[k].trim());
    const faltante = fuente => ({ fuente, estado: 'Sin configurar', items: [], detalle: `La lectura externa de ${fuente} se activará al configurar sus accesos autorizados; se utilizan las otras fuentes disponibles.` });
    const resultados = await Promise.allSettled([
      conTiempo(() => env.YOUTUBE_API_KEY?.trim() ? youtube(pais, tema, { dias: 30, orden: 'relevance', sinFiltroFecha: true }) : { conectado: false, videos: [], estado: 'Sin configurar', aviso: 'Configura YOUTUBE_API_KEY para consultar referencias temáticas.' }),
      conTiempo(() => igConfigurado ? instagram({ tema, pais, cuentas, hashtags }) : faltante('Instagram')),
      conTiempo(() => fbConfigurado ? facebook() : faltante('Facebook')),
      conTiempo(() => ttConfigurado ? tiktok({ tema, pais }) : faltante('TikTok')),
      conTiempo(() => tendencias(pais, fetchImpl)),
    ]);
    const fuentes = [], estados = [];
    const redes = ['YouTube', 'Instagram', 'Facebook', 'TikTok', 'Google Trends'];
    resultados.forEach((resultado, indice) => {
      const nombre = redes[indice];
      if (resultado.status === 'rejected') { estados.push(estado(nombre, resultado, { consultado, referencias: 0 })); return; }
      const d = resultado.value || {};
      const muestra = indice === 0 ? d.videos : indice === 4 ? d : d.items;
      if (!Array.isArray(muestra)) { estados.push({ fuente: nombre, estado: 'No disponible', detalle: 'La fuente no devolvió una lista válida de resultados.', referencias: 0, consultado }); return; }
      const items = muestra;
      const alcance = indice === 0 ? `${texto(d.alcance, 1400) || 'Videos públicos encontrados por tema; sin evidencia de rendimiento en otros canales.'} Solo se recibió el título, la fecha y los hashtags; no se obtuvo una transcripción ni se revisó el video.` : indice === 4 ? 'Búsquedas generales actuales del país. La coincidencia temática no acredita eficacia, ubicación de audiencia ni tendencias de Instagram.' : texto(d.alcance, 1600) || 'Contenido público externo autorizado; no es una muestra completa ni un ranking.';
      const filas = items.map((item, i) => fuenteCatalogo(nombre, i, indice === 4 ? { ...item, url: urlSegura(item.url, nombre) || `https://trends.google.com/trending/rss?geo=${pais}` } : item, consultado, alcance)).filter(Boolean).slice(0, indice === 0 ? 4 : 2);
      fuentes.push(...filas);
      const registro = estado(nombre, resultado, { consultado: texto(d.consultado, 60) || consultado, referencias: filas.length });
      if (indice === 0 && !d.conectado) registro.estado = 'Sin configurar';
      else if ((indice === 0 || indice === 4 || ['Consultada', 'Sin resultados'].includes(d.estado)) && !filas.length) registro.estado = items.length ? 'Consultada · sin coincidencias' : 'Sin resultados';
      if (indice === 4) registro.detalle = items.length ? `RSS consultado: ${filas.length} coincidencia(s) temática(s) entre ${items.length} búsquedas generales. Solo las coincidencias apoyan las sugerencias.` : 'El RSS no devolvió búsquedas actuales.';
      if (indice === 0) registro.consulta = tema;
      if (Array.isArray(d.avisos)) registro.avisos = d.avisos.map(v => texto(v, 500)).slice(0, 6);
      estados.push(registro);
    });
    const unicas = [...new Map(fuentes.map(f => [f.url, f])).values()].slice(0, 8);
    for (const registro of estados) {
      registro.coincidencias = registro.referencias;
      registro.referencias = unicas.filter(f => f.canalOrigen === registro.fuente).length;
    }
    return { consultado, tema, fuentes: unicas, estados, limite: LIMITE };
  }, resultado => resultado.estados.some(s => s.estado === 'No disponible') ? 15000 : 900000);
}
