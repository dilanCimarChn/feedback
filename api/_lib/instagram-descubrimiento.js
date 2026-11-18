import { crearCacheAsync, huella, limitarFuentes } from './carga.js';

const DOC_HASHTAGS = 'https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-facebook-login/hashtag-search';
const DOC_BUSINESS = 'https://developers.facebook.com/documentation/instagram-platform/instagram-graph-api/reference/ig-user/business_discovery';
const CAMPOS_MEDIA = 'id,caption,media_type,permalink,timestamp,like_count,comments_count';
const MINUTOS_15 = 15 * 60 * 1000, SEMANA = 7 * 86400000;
const cacheMedia = crearCacheAsync({ max: 100, ahora: () => Date.now() });
const cacheIds = crearCacheAsync({ max: 1000, ttlMs: SEMANA, ahora: () => Date.now() });
// Solo observa este proceso. Meta aplica su cuota por cuenta entre apps e instancias.
const cuotasLocales = new Map();
const texto = (valor, max = 150) => typeof valor === 'string' ? valor.trim().slice(0, max) : '';
const normalizar = valor => texto(valor, 600).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const CLAVES = ['META_GRAPH_VERSION', 'INSTAGRAM_USER_ID', 'INSTAGRAM_ACCESS_TOKEN'];

function hashtagInicial(tema, pais) {
  const palabras = normalizar(tema).match(/[\p{L}\p{N}_]+/gu) || [];
  const ingles = ['US', 'CA', 'GB', 'AU', 'IN', 'ZA', 'KE'].includes(pais);
  const sectores = [
    [['educacion', 'education', 'escuela', 'school', 'aprendizaje', 'learning'], 'educacion', 'education'],
    [['salud', 'health', 'healthcare', 'bienestar'], 'salud', 'health'],
    [['ambiente', 'environment', 'climate', 'reciclaje', 'sostenibilidad'], 'sostenibilidad', 'sustainability'],
    [['animales', 'animals', 'mascotas', 'pets'], 'animales', 'animals'],
    [['tecnologia', 'technology', 'software'], 'tecnologia', 'technology'],
    [['alimentacion', 'food', 'hambre', 'hunger'], 'alimentacion', 'food'],
    [['refugiados', 'refugees', 'migrantes', 'migrants'], 'refugiados', 'refugees'],
    [['cafeteria', 'coffee', 'cafe'], 'cafe', 'coffee'],
    [['ong', 'ngo', 'nonprofit', 'charity', 'fundacion', 'voluntariado'], 'ong', 'nonprofit']
  ];
  const sector = sectores.find(([claves]) => claves.some(clave => palabras.includes(clave)));
  if (sector) return sector[ingles ? 2 : 1];
  const ignorar = new Set(['para', 'with', 'from', 'quiero', 'marca', 'marketing', 'contenido', 'social', 'redes', 'sobre', 'nuestra', 'nuestro', 'estados', 'unidos', 'eeuu', 'publicar', 'captar']);
  return palabras.find(p => p.length > 2 && p.length <= 100 && !ignorar.has(p)) || '';
}

function selectores(entrada, tipo, maximo, avisos) {
  if (!Array.isArray(entrada)) {
    avisos.push(`${tipo}: usa una lista de nombres, sin URLs.`);
    return [];
  }
  const validos = [];
  for (const valor of entrada) {
    const nombre = texto(valor, 300).replace(tipo === 'Hashtags' ? /^#/ : /^@/, '').toLowerCase();
    const valido = tipo === 'Hashtags'
      ? /^[\p{L}\p{N}_]{1,100}$/u.test(nombre)
      : /^[a-z0-9_](?:[a-z0-9._]{0,28}[a-z0-9_])?$/.test(nombre) && !nombre.includes('..');
    if (!valido) { avisos.push(`${tipo}: se omitió un nombre inválido; no se aceptan URLs ni expresiones de consulta.`); continue; }
    if (!validos.includes(nombre)) validos.push(nombre);
  }
  if (validos.length > maximo) avisos.push(`${tipo}: se consultan como máximo ${maximo} nombres por solicitud.`);
  return validos.slice(0, maximo);
}

function registroCuota(id) {
  const ahora = Date.now();
  for (const [cuenta, tags] of cuotasLocales) {
    for (const [tag, primero] of tags) if (primero + SEMANA <= ahora) tags.delete(tag);
    if (!tags.size) cuotasLocales.delete(cuenta);
  }
  const clave = huella([id]);
  if (!cuotasLocales.has(clave)) {
    if (cuotasLocales.size >= 100) throw new Error('El registro local de hashtags está ocupado. No se consultaron etiquetas nuevas.');
    cuotasLocales.set(clave, new Map());
  }
  return cuotasLocales.get(clave);
}

function reservarHashtag(id, hashtag) {
  const registro = registroCuota(id);
  if (registro.has(hashtag)) return;
  if (registro.size >= 30) throw new Error('Límite local de 30 hashtags únicos en 7 días alcanzado; se omitió la etiqueta nueva. Este control en memoria no sustituye la cuota global de Meta.');
  // Se registra el intento de forma conservadora, incluso si Meta luego lo rechaza.
  registro.set(hashtag, Date.now());
}

function cuotaActual(id) {
  let registradosLocalmente = 0;
  try { registradosLocalmente = registroCuota(id).size; } catch { /* Se informa en la subfuente. */ }
  return { limiteUnicos: 30, ventanaDias: 7, registradosLocalmente,
    alcance: 'Local a este proceso y cuenta; registra intentos, no verifica el uso global entre apps, reinicios o instancias. Meta controla su propia cuota.' };
}

function mensajeError(status, codigo, tipo) {
  if (status === 401 || codigo === 190) return 'El token de Instagram fue rechazado o venció. Renueva el acceso autorizado; no se consultaron publicaciones propias como sustituto.';
  if (status === 429 || [4, 17, 32, 613].includes(codigo)) return 'Meta indicó un límite de consultas. Revisa la cuota de la cuenta antes de reintentar.';
  if ([403, 404].includes(status) || [10, 200].includes(codigo)) return tipo === 'InstagramHashtag'
    ? 'Acceso público pendiente o rechazado: revisar App Review, Instagram Public Content Access y el permiso instagram_basic para Hashtag Search. No se sustituyó por contenido de la cuenta propia.'
    : 'Business Discovery no está disponible para esa cuenta: revisar instagram_basic, instagram_manage_insights, pages_read_engagement, App Review cuando corresponda y que la referencia sea una cuenta profesional accesible.';
  return 'Meta rechazó la consulta externa. Revisa versión, identificadores, permisos y disponibilidad del recurso; no se usó contenido propio como sustituto.';
}

async function graph(config, ruta, parametros, tipo) {
  const url = new URL(`https://graph.facebook.com/${config.version}/${ruta}`);
  url.search = new URLSearchParams(parametros).toString();
  return limitarFuentes(async () => {
    let respuesta;
    try {
      respuesta = await fetch(url.toString(), { headers: { Authorization: `Bearer ${config.token}` },
        redirect: 'error', signal: AbortSignal.timeout(12000) });
    } catch {
      throw new Error('No se pudo consultar Instagram externo a tiempo. Intenta de nuevo; no se usó contenido propio como sustituto.');
    }
    let datos;
    try { datos = await respuesta.json(); } catch { throw new Error('Instagram devolvió una respuesta externa no válida.'); }
    if (!respuesta.ok || datos?.error) throw new Error(mensajeError(respuesta.status, Number(datos?.error?.code), tipo));
    return datos;
  });
}

function urlInstagram(valor) {
  try {
    const url = new URL(valor);
    if (url.protocol !== 'https:' || url.username || url.password ||
      !['instagram.com', 'www.instagram.com'].includes(url.hostname) ||
      !/^\/(?:p|reel|tv)\/[a-z0-9_-]+\/?$/i.test(url.pathname)) return '';
    url.search = ''; url.hash = '';
    return url.toString();
  } catch { return ''; }
}

function fechaMedia(valor) {
  if (valor === null || valor === undefined || valor === '') return null;
  const numero = typeof valor === 'number' || /^\d+$/.test(String(valor));
  const fecha = numero ? new Date(Number(valor) * 1000) : new Date(valor);
  return Number.isFinite(fecha.getTime()) ? fecha.toISOString() : null;
}
function numero(valor) {
  if (!['number', 'string'].includes(typeof valor) || valor === '') return null;
  const n = Number(valor);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function normalizarMedia(media, fuente) {
  const url = urlInstagram(media?.permalink);
  if (!url) return null;
  const titulo = texto(media.caption, 1200) || 'Publicación externa sin texto';
  return { titulo, url, fecha: fechaMedia(media.timestamp),
    formato: ({ IMAGE: 'Imagen', CAROUSEL_ALBUM: 'Carrusel', VIDEO: 'Clip' })[media.media_type] || 'No determinado',
    hashtags: [...new Set((titulo.match(/#[\p{L}\p{N}_]+/gu) || []))].slice(0, 12),
    metricas: { likes: numero(media.like_count), comentarios: numero(media.comments_count) },
    tipoFuente: fuente.tipoFuente, consulta: fuente.consulta, consultado: fuente.consultado,
    observaciones: { tipoFuente: fuente.tipoFuente, seleccion: fuente.seleccion,
      consulta: fuente.consulta, geografiaVerificada: false,
      limite: fuente.tipoFuente === 'InstagramHashtag'
        ? 'Selección pública por hashtag; no mide el volumen del hashtag ni la audiencia de un país. VIDEO no acredita que sea Reel.'
        : 'Publicaciones de una cuenta profesional de referencia; no son tendencias globales ni estadísticas de su audiencia.' },
    procedencias: [{ tipoFuente: fuente.tipoFuente, seleccion: fuente.seleccion, consulta: fuente.consulta }] };
}

function subfuente(tipoFuente, consulta, seleccion, datos, detalle = '') {
  const fuente = { tipoFuente, consulta, seleccion, consultado: new Date().toISOString(),
    url: tipoFuente === 'InstagramHashtag' ? DOC_HASHTAGS : DOC_BUSINESS,
    estado: datos ? (datos.length ? 'Consultada' : 'Sin resultados') : 'No disponible', detalle };
  const items = (datos || []).map(media => normalizarMedia(media, fuente)).filter(Boolean);
  if (datos && !items.length) fuente.estado = 'Sin resultados';
  return { items, subfuentes: [fuente] };
}

async function leerHashtag(config, hashtag) {
  const clave = huella(['hashtag', config.version, config.id, config.token, hashtag]);
  return cacheMedia(clave, async () => {
    try {
      reservarHashtag(config.id, hashtag);
      const id = await cacheIds(clave, async () => {
        const datos = await graph(config, 'ig_hashtag_search', { user_id: config.id, q: hashtag }, 'InstagramHashtag');
        if (!Array.isArray(datos?.data)) throw new Error('Instagram devolvió una búsqueda de hashtag no válida.');
        if (!datos.data.length) return '';
        const encontrado = datos.data[0]?.id;
        if (!/^\d+$/.test(String(encontrado || ''))) throw new Error('Instagram devolvió un identificador de hashtag no válido.');
        return String(encontrado);
      }, encontrado => encontrado ? SEMANA : MINUTOS_15);
      if (!id) return subfuente('InstagramHashtag', `#${hashtag}`, 'ig_hashtag_search', []);
      const resultados = await Promise.all(['top_media', 'recent_media'].map(async seleccion => {
        try {
          const datos = await graph(config, `${id}/${seleccion}`, { user_id: config.id, fields: CAMPOS_MEDIA, limit: '10' }, 'InstagramHashtag');
          if (!Array.isArray(datos?.data)) throw new Error('Instagram devolvió una colección de medios no válida.');
          return subfuente('InstagramHashtag', `#${hashtag}`, seleccion, datos.data,
            seleccion === 'recent_media' ? 'Medios de las últimas 24 horas según Meta; no necesariamente ordenados cronológicamente.' : 'Selección popular del hashtag según Meta; no es un ranking global ni por país.');
        } catch (error) { return subfuente('InstagramHashtag', `#${hashtag}`, seleccion, null, error.message); }
      }));
      return { items: resultados.flatMap(r => r.items), subfuentes: resultados.flatMap(r => r.subfuentes) };
    } catch (error) { return subfuente('InstagramHashtag', `#${hashtag}`, 'ig_hashtag_search', null, error.message); }
  }, resultado => resultado.subfuentes.some(s => s.estado === 'No disponible') ? 15000 : MINUTOS_15);
}

async function leerCuenta(config, cuenta) {
  const clave = huella(['business', config.version, config.id, config.token, cuenta]);
  return cacheMedia(clave, async () => {
    try {
      const fields = `business_discovery.username(${cuenta}){id,username,media.limit(10){${CAMPOS_MEDIA}}}`;
      const datos = await graph(config, config.id, { fields }, 'InstagramBusinessDiscovery');
      const descubierta = datos?.business_discovery;
      if (String(descubierta?.id || '') === config.id) throw new Error('La referencia coincide con la cuenta autorizada y se omitió para mantener el descubrimiento externo.');
      if (!Array.isArray(descubierta?.media?.data)) throw new Error('La cuenta de referencia no devolvió medios accesibles. Verifica que sea profesional y tenga acceso mediante Business Discovery.');
      return subfuente('InstagramBusinessDiscovery', `@${cuenta}`, 'business_discovery', descubierta.media.data);
    } catch (error) { return subfuente('InstagramBusinessDiscovery', `@${cuenta}`, 'business_discovery', null, error.message); }
  }, resultado => resultado.subfuentes.some(s => s.estado === 'No disponible') ? 15000 : MINUTOS_15);
}

/** Solo API oficial con Facebook Login. No consulta /{cuenta}/media como fallback. */
export async function consultarInstagramExterno({ tema = '', pais = '', region = '', hashtags = [], cuentas = [] } = {}) {
  const avisos = [];
  const paisSeguro = /^[A-Z]{2}$/.test(pais) ? pais : '';
  const configuracion = CLAVES.map(clave => texto(process.env[clave], clave === 'INSTAGRAM_ACCESS_TOKEN' ? 4096 : 100));
  const base = { fuente: 'Instagram', modo: 'descubrimiento_externo', url: DOC_HASHTAGS,
    alcance: 'Contenido público externo mediante Hashtag Search y cuentas profesionales indicadas para Business Discovery. Sin filtro geográfico de audiencia, sin Insights privados y sin ranking global de tendencias.',
    pais: paisSeguro, region: texto(region, 120), consultado: new Date().toISOString(),
    items: [], subfuentes: [], avisos, parcial: false,
    contextoGeografico: { paisSolicitado: paisSeguro || null, regionSolicitada: texto(region, 120) || null,
      aplicado: false, detalle: 'País y región son contexto editorial; estos endpoints no filtran la audiencia por ubicación.' } };
  const faltantes = CLAVES.filter((_, i) => !configuracion[i]);
  if (faltantes.length) return { ...base, estado: 'Sin configurar', detalle: `Descubrimiento externo pendiente: ${faltantes.join(', ')}. Hashtag Search requiere App Review e Instagram Public Content Access; las credenciales por sí solas no acreditan ese acceso.` };
  const [version, id, token] = configuracion;
  if (!/^v\d+\.\d+$/.test(version) || !/^\d+$/.test(id)) return { ...base, estado: 'No disponible', detalle: 'Revisa META_GRAPH_VERSION (vNN.N) e INSTAGRAM_USER_ID numérico; no se consultaron fuentes externas.' };
  const etiquetas = selectores(hashtags, 'Hashtags', 2, avisos);
  if (Array.isArray(hashtags) && !hashtags.length) {
    const inicial = hashtagInicial(tema, paisSeguro);
    if (inicial) etiquetas.push(inicial);
  }
  const referencias = selectores(cuentas, 'Cuentas', 2, avisos);
  if (!etiquetas.length && !referencias.length) return { ...base, estado: avisos.length ? 'No disponible' : 'Sin resultados',
    detalle: 'Indica un tema, un hashtag válido o una cuenta profesional de referencia para buscar contenido externo.', cuota: cuotaActual(id) };
  const config = { version, id, token };
  const resultados = await Promise.allSettled([
    ...etiquetas.map(hashtag => leerHashtag(config, hashtag)),
    ...referencias.map(cuenta => leerCuenta(config, cuenta))
  ]);
  const subfuentes = resultados.flatMap(r => r.status === 'fulfilled' ? r.value.subfuentes : [{
    tipoFuente: 'InstagramExterno', estado: 'No disponible', consultado: new Date().toISOString(),
    detalle: 'Las consultas externas están ocupadas o no disponibles; intenta de nuevo.'
  }]);
  const unicos = new Map();
  for (const resultado of resultados) if (resultado.status === 'fulfilled') for (const item of resultado.value.items) {
    const previo = unicos.get(item.url);
    if (!previo) unicos.set(item.url, item);
    else unicos.set(item.url, { ...previo, procedencias: [...previo.procedencias, ...item.procedencias] });
  }
  const items = [...unicos.values()].slice(0, 60);
  const fallos = subfuentes.filter(s => s.estado === 'No disponible');
  avisos.push(...fallos.map(s => `${s.consulta || 'Consulta externa'}: ${s.detalle}`));
  const parcial = fallos.length > 0 && subfuentes.some(s => s.estado !== 'No disponible');
  const estado = items.length ? 'Consultada' : fallos.length === subfuentes.length ? 'No disponible' : 'Sin resultados';
  const tiempos = subfuentes.map(s => Date.parse(s.consultado)).filter(Number.isFinite);
  return { ...base, estado, items, subfuentes, avisos, parcial, cuota: cuotaActual(id),
    hashtagsConsultados: etiquetas.map(h => `#${h}`), cuentasReferencia: referencias.map(c => `@${c}`),
    consultado: tiempos.length ? new Date(Math.max(...tiempos)).toISOString() : base.consultado,
    detalle: `${parcial ? 'Resultados parciales: algunas rutas externas no estuvieron disponibles. ' : ''}${items.length ? `${items.length} publicaciones externas con enlaces válidos. ` : 'Sin publicaciones externas disponibles. '}${fallos.length ? 'Revisa los avisos de permisos, acceso o cuota. ' : ''}No se ha verificado la ubicación de su audiencia ni el acceso global a Instagram.` };
}
