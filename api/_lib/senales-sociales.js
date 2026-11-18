import { crearCacheAsync, huella, limitarFuentes } from './carga.js';
const cache = crearCacheAsync({ max: 40 });
const ID_VIDEO = /^[\w-]{11}$/;
const idValido = valor => typeof valor === 'string' && ID_VIDEO.test(valor);
const TEXTO_ALCANCE = 'El país indica disponibilidad de reproducción o selección del catálogo; no acredita residencia del creador ni ubicación o actividad de su audiencia. Las vistas y likes son acumulados, no crecimiento ni eficacia en otras redes.';
const contador = valor => typeof valor === 'string' && /^\d{1,20}$/.test(valor) ? valor : typeof valor === 'number' && Number.isFinite(valor) && valor >= 0 ? valor : null;

function errorProveedor(status, data) {
  const razones = Array.isArray(data?.error?.errors) ? data.error.errors.map(e=>e?.reason) : [];
  if (status === 429 || razones.some(r=>['quotaExceeded','dailyLimitExceeded','rateLimitExceeded','userRateLimitExceeded'].includes(r))) return new Error('YouTube alcanzó su cuota o límite temporal. Revisa las cuotas del proyecto antes de reintentar.');
  if (status === 401 || status === 403) return new Error('YouTube rechazó el acceso. Revisa la clave, sus restricciones y la activación de YouTube Data API.');
  return new Error('YouTube no respondió correctamente. Revisa la disponibilidad del servicio y del país.');
}

async function consultar(recurso, params, key) {
  return limitarFuentes(async () => {
    let response;
    try {
      response = await fetch(`https://www.googleapis.com/youtube/v3/${recurso}?${params}`, { method:'GET', headers:{ 'X-Goog-Api-Key':key }, signal:AbortSignal.timeout(15000) });
    } catch (error) {
      throw new Error(error?.name === 'TimeoutError' || error?.name === 'AbortError' ? 'YouTube tardó demasiado en responder. Intenta nuevamente más tarde.' : 'No se pudo conectar con YouTube. Intenta nuevamente más tarde.');
    }
    let data;
    try { data = await response.json(); } catch { throw new Error('Respuesta no válida de YouTube.'); }
    if (!response.ok || data?.error) throw errorProveedor(response.status, data);
    if (!Array.isArray(data?.items)) throw new Error('Respuesta no válida de YouTube.');
    return data;
  });
}

function normalizarVideo(video, origen, metricas = true) {
  const descripcion = typeof video.snippet?.description === 'string' ? video.snippet.description.slice(0, 10000) : '';
  const publicado = video.snippet?.publishedAt;
  return {
    titulo:typeof video.snippet?.title === 'string' ? video.snippet.title.slice(0, 350) : 'Video sin título',
    url:`https://www.youtube.com/watch?v=${video.id}`,
    publicado:typeof publicado === 'string' && Number.isFinite(Date.parse(publicado)) ? publicado : null,
    idioma:typeof video.snippet?.defaultAudioLanguage==='string'?video.snippet.defaultAudioLanguage:typeof video.snippet?.defaultLanguage==='string'?video.snippet.defaultLanguage:null,
    duracion:metricas && typeof video.contentDetails?.duration === 'string' && /^P[\dA-Z.]+$/.test(video.contentDetails.duration) ? video.contentDetails.duration.slice(0, 80) : null,
    vistas:metricas ? contador(video.statistics?.viewCount) : null,
    likes:metricas ? contador(video.statistics?.likeCount) : null,
    hashtags:[...new Set(descripcion.match(/#[\p{L}\p{N}_]+/gu) || [])].filter(h=>h.length<=80).slice(0, 8),
    origen,
  };
}

export async function obtenerSenales(region = 'BO', tema = '', {dias=7,idioma=''} = {}) {
  if (!/^[A-Z]{2}$/.test(region)) throw new Error('País no válido.');
  if (typeof tema !== 'string') throw new Error('Tema no válido.');
  if(!Number.isInteger(dias)||dias<1||dias>30||typeof idioma!=='string'||(idioma&&!/^[a-z]{2}(?:-[A-Za-z]{2,4})?$/.test(idioma)))throw new Error('Periodo o idioma de búsqueda no válido.');
  const consulta = tema.normalize('NFC').trim().replace(/\s+/g, ' ').slice(0, 150);
  const modo = consulta ? 'busqueda_tematica' : 'seleccion_popular';
  const alcance = `${consulta ? `Hasta 10 videos publicados en los últimos ${dias} días y encontrados por tema; primera página por relevancia, sin ranking de tendencias.` : 'Hasta 15 videos de la selección popular de YouTube por país, sin filtro temático ni histórico.'} ${TEXTO_ALCANCE}`;
  const base = {region,modo,consulta,alcance,dias,idioma};
  const key = process.env.YOUTUBE_API_KEY?.trim();
  if (!key) return { ...base, conectado:false, videos:[], consultado:null, aviso:'YouTube sin conectar. Configura YOUTUBE_API_KEY en el servidor para consultar videos y sus estadísticas públicas.' };
  return cache(`${region}:${huella([consulta.toLowerCase(),key,dias,idioma])}`, async () => {
    const consultado = new Date().toISOString();
    if (!consulta) {
      const params = new URLSearchParams({ part:'snippet,statistics,contentDetails', chart:'mostPopular', regionCode:region, maxResults:'15' });
      const data = await consultar('videos', params, key);
      const vistos = new Set();
      const videos = data.items.filter(v=>idValido(v?.id) && !vistos.has(v.id) && vistos.add(v.id)).slice(0, 15).map(v=>normalizarVideo(v,'Selección popular de YouTube'));
      return { ...base, conectado:true, consultado, videos, aviso:`Selección popular de YouTube por país. Puede incluir música, entretenimiento y otros sectores; no es un ranking del sector de tu marca. ${TEXTO_ALCANCE}` };
    }

    const desde = new Date(Date.parse(consultado) - dias * 86400000).toISOString();
    // Una sola página por consulta: search.list tiene su propia cuota diaria.
    // https://developers.google.com/youtube/data/reference/rest/v3/search/list
    const params = new URLSearchParams({ part:'snippet', type:'video', q:consulta, regionCode:region, publishedAfter:desde, publishedBefore:consultado, order:'relevance', maxResults:'10' });
    if(idioma)params.set('relevanceLanguage',idioma);
    const busqueda = await consultar('search', params, key);
    const seleccion = new Map();
    const enPeriodo = video => {
      const fecha = typeof video?.snippet?.publishedAt === 'string' ? Date.parse(video.snippet.publishedAt) : NaN;
      return Number.isFinite(fecha) && fecha >= Date.parse(desde) && fecha <= Date.parse(consultado);
    };
    for (const resultado of busqueda.items) {
      const id = resultado?.id?.videoId;
      if (!idValido(id) || !enPeriodo(resultado) || seleccion.has(id) || seleccion.size >= 10) continue;
      seleccion.set(id, {id,snippet:resultado.snippet});
    }
    const regionAplicada = /^[A-Z]{2}$/.test(busqueda.regionCode || '') ? busqueda.regionCode : region;
    const geo = regionAplicada !== region ? ` YouTube aplicó ${regionAplicada} en lugar de ${region}.` : '';
    const resultadoBase = { ...base, conectado:true, consultado, desde, regionAplicada };
    if (!seleccion.size) return { ...resultadoBase, videos:[], aviso:`La búsqueda temática no devolvió videos válidos en los últimos ${dias} días.${geo} ${TEXTO_ALCANCE}` };

    let detalles;
    try {
      detalles = await consultar('videos', new URLSearchParams({ part:'snippet,statistics,contentDetails', id:[...seleccion.keys()].join(',') }), key);
    } catch (error) {
      return { ...resultadoBase, parcial:true, videos:[...seleccion.values()].map(v=>normalizarVideo(v,'Búsqueda temática de YouTube · sin métricas verificadas',false)), aviso:`Se encontraron videos por tema, pero no se pudieron consultar sus detalles y métricas. ${error.message}${geo} ${TEXTO_ALCANCE}` };
    }
    const porId = new Map(detalles.items.filter(v=>idValido(v?.id) && seleccion.has(v.id) && enPeriodo(v)).map(v=>[v.id,v]));
    const videos = [...seleccion.keys()].filter(id=>porId.has(id)).map(id=>normalizarVideo(porId.get(id),`Búsqueda temática de YouTube · últimos ${dias} días`));
    return { ...resultadoBase, videos, parcial:videos.length < seleccion.size, aviso:`Búsqueda temática reciente de YouTube, con métricas públicas consultadas; no es un ranking de tendencias.${videos.length < seleccion.size ? ' Algunos resultados no devolvieron detalles y se excluyeron.' : ''}${geo} ${TEXTO_ALCANCE}` };
  });
}
