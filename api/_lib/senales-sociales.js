const cache = new Map();
export async function obtenerSenales(region = 'BO') {
  if (!/^[A-Z]{2}$/.test(region)) throw new Error('País no válido.');
  const key = process.env.YOUTUBE_API_KEY?.trim();
  if (!key) return { conectado: false, videos: [], aviso: 'YouTube sin conectar. Configura YOUTUBE_API_KEY en el servidor para consultar videos populares y sus estadísticas públicas.' };
  const previo = cache.get(region);
  if (previo && Date.now() - previo.time < 900000) return previo.data;
  const params = new URLSearchParams({ part: 'snippet,statistics,contentDetails', chart: 'mostPopular', regionCode: region, maxResults: '15', key });
  const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params}`, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error('YouTube no respondió: revisa la clave, cuota y disponibilidad del país.');
  const data = await response.json();
  if (!Array.isArray(data.items)) throw new Error('Respuesta no válida de YouTube.');
  const result = { conectado: true, region, consultado: new Date().toISOString(), aviso: 'Selección popular de YouTube por país. Puede incluir música, entretenimiento y otros sectores; no es un ranking de ONG ni demuestra qué funciona en Instagram. Los conteos son acumulados, no crecimiento.', videos: data.items.filter(v => /^[\w-]{11}$/.test(v.id)).map(v => ({ titulo: v.snippet?.title, url: `https://www.youtube.com/watch?v=${v.id}`, publicado: v.snippet?.publishedAt, duracion: v.contentDetails?.duration, vistas: v.statistics?.viewCount ?? null, likes: v.statistics?.likeCount ?? null, hashtags: [...new Set((v.snippet?.description || '').match(/#[\p{L}\p{N}_]+/gu) || [])].slice(0,8) })) };
  if (cache.size >= 30) cache.delete(cache.keys().next().value);
  cache.set(region, { time: Date.now(), data: result });
  return result;
}
