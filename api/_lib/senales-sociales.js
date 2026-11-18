import { crearCacheAsync, huella, limitarFuentes } from './carga.js';
const cache = crearCacheAsync({ max: 40 });
const ID_VIDEO = /^[\w-]{11}$/;
const idValido = valor => typeof valor === 'string' && ID_VIDEO.test(valor);
const TEXTO_ALCANCE = 'El país indica disponibilidad de reproducción o selección del catálogo; no acredita residencia del creador ni ubicación o actividad de su audiencia. Las vistas y likes son acumulados, no crecimiento ni eficacia en otras redes.';
const contador = valor => typeof valor === 'string' && /^\d{1,20}$/.test(valor) ? valor : typeof valor === 'number' && Number.isSafeInteger(valor) && valor >= 0 ? valor : null;
const ordenarVideos=(videos,orden)=>orden==='viewCount'?[...videos].sort((a,b)=>{const va=BigInt(a.vistas??-1),vb=BigInt(b.vistas??-1);return va===vb?0:va>vb?-1:1;}):videos;

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
    comentarios:metricas ? contador(video.statistics?.commentCount) : null,
    autor:typeof video.snippet?.channelTitle==='string'?video.snippet.channelTitle.slice(0,200):null,
    canalId:typeof video.snippet?.channelId==='string'&&/^UC[\w-]{22}$/.test(video.snippet.channelId)?video.snippet.channelId:null,
    hashtags:[...new Set(descripcion.match(/#[\p{L}\p{N}_]+/gu) || [])].filter(h=>h.length<=80).slice(0, 8),
    origen,
  };
}

export async function obtenerSenales(region = 'BO', tema = '', {dias=7,idioma='',orden='relevance',palabrasClave='',canalId=''} = {}) {
  if (!/^[A-Z]{2}$/.test(region)) throw new Error('País no válido.');
  if (typeof tema !== 'string') throw new Error('Tema no válido.');
  if(!Number.isInteger(dias)||dias<1||dias>30||typeof idioma!=='string'||(idioma&&!/^[a-z]{2}(?:-[A-Za-z]{2,4})?$/.test(idioma)))throw new Error('Periodo o idioma de búsqueda no válido.');
  if(!['relevance','viewCount','date'].includes(orden)||typeof palabrasClave!=='string'||palabrasClave.length>150||typeof canalId!=='string'||(canalId&&!/^UC[\w-]{22}$/.test(canalId)))throw new Error('Revisa el orden, las palabras clave y el ID de canal público de YouTube.');
  const consulta = [tema,palabrasClave].filter(Boolean).join(' ').normalize('NFC').trim().replace(/\s+/g, ' ').slice(0, 300);
  const modo = consulta||canalId ? 'busqueda_tematica' : 'seleccion_popular';
  const nombreOrden={relevance:'relevancia',viewCount:'vistas acumuladas',date:'fecha'}[orden];
  const alcance = `${modo==='busqueda_tematica' ? `Hasta 10 videos publicados en los últimos ${dias} días y encontrados por tema o canal; primera página ordenada por ${nombreOrden}. La selección depende de los filtros, puede ser incompleta y no es un ranking completo de YouTube.` : 'Hasta 15 videos de la selección popular de YouTube por país, sin filtro temático ni histórico.'} ${TEXTO_ALCANCE}`;
  const etiqueta = modo === 'busqueda_tematica' && orden === 'viewCount' ? `Más vistos entre los resultados publicados en los últimos ${dias} días` : modo === 'busqueda_tematica' ? `Resultados publicados en los últimos ${dias} días por ${nombreOrden}` : 'Selección popular de YouTube';
  const base = {region,modo,consulta,alcance,etiqueta,dias,idioma,orden,canalId,palabrasClave};
  const key = process.env.YOUTUBE_API_KEY?.trim();
  if (!key) return { ...base, conectado:false, videos:[], consultado:null, aviso:'YouTube sin conectar. Configura YOUTUBE_API_KEY en el servidor para consultar videos y sus estadísticas públicas.' };
  return cache(`${region}:${huella([consulta.toLowerCase(),key,dias,idioma,orden,canalId])}`, async () => {
    const consultado = new Date().toISOString();
    if (modo==='seleccion_popular') {
      const params = new URLSearchParams({ part:'snippet,statistics,contentDetails', chart:'mostPopular', regionCode:region, maxResults:'15' });
      const data = await consultar('videos', params, key);
      const vistos = new Set();
      const videos = data.items.filter(v=>idValido(v?.id) && !vistos.has(v.id) && vistos.add(v.id)).slice(0, 15).map(v=>normalizarVideo(v,'Selección popular de YouTube'));
      return { ...base, conectado:true, consultado, videos, aviso:`Selección popular de YouTube por país. Puede incluir música, entretenimiento y otros sectores; no es un ranking del sector de tu marca. ${TEXTO_ALCANCE}` };
    }

    const desde = new Date(Date.parse(consultado) - dias * 86400000).toISOString();
    // Una sola página por consulta: search.list tiene su propia cuota diaria.
    // https://developers.google.com/youtube/data/reference/rest/v3/search/list
    const params = new URLSearchParams({ part:'snippet', type:'video', regionCode:region, publishedAfter:desde, publishedBefore:consultado, order:orden, maxResults:'10' });
    if(consulta)params.set('q',consulta);
    if(canalId)params.set('channelId',canalId);
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
    const videos = ordenarVideos([...seleccion.keys()].filter(id=>porId.has(id)).map(id=>normalizarVideo(porId.get(id),`Búsqueda temática de YouTube · últimos ${dias} días`)),orden);
    return { ...resultadoBase, videos, parcial:videos.length < seleccion.size, aviso:`Búsqueda temática reciente de YouTube, con métricas públicas consultadas; no es un ranking de tendencias.${videos.length < seleccion.size ? ' Algunos resultados no devolvieron detalles y se excluyeron.' : ''}${geo} ${TEXTO_ALCANCE}` };
  });
}
