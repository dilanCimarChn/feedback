import { obtenerSenales } from './senales-sociales.js';
import { consultarPlataformas } from './plataformas-sociales.js';

const cache = new Map();
const limpiar = s => String(s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]*>/g, '').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').trim().slice(0,500);
const etiqueta = (xml, tag) => limpiar(xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`))?.[1]);

export function leerTendenciasRss(xml) {
  if (!/<rss[\s>]/i.test(xml)) throw new Error('Feed no válido.');
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0,20).map(m => ({ tema: etiqueta(m[1],'title'), volumenAproximado: etiqueta(m[1],'ht:approx_traffic'), fecha: etiqueta(m[1],'pubDate'), url: etiqueta(m[1],'link') })).filter(t => t.tema);
}
async function descargar(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(12000) });
  if (!r.ok) throw new Error(`Proveedor no disponible (${r.status}).`);
  return r;
}
export async function investigarMarketing(pais, tema) {
  const key = `${pais}:${tema}`;
  const previo = cache.get(key);
  if (previo && Date.now()-previo.time < 900000) return previo.data;
  const rss = `https://trends.google.com/trending/rss?geo=${pais}`;
  const consulta = new URLSearchParams({query:tema,mode:'artlist',format:'json',timespan:'7d',maxrecords:'10',sort:'datedesc'});
  const tareas = await Promise.allSettled([
    descargar(rss).then(r => r.text()).then(leerTendenciasRss),
    obtenerSenales(pais),
    tema.length >= 2 ? descargar(`https://api.gdeltproject.org/api/v2/doc/doc?${consulta}`).then(r => r.json()).then(d => {
      if (!Array.isArray(d.articles)) throw new Error('Respuesta no válida.');
      return d.articles.filter(a => /^https?:\/\//.test(a.url)).map(a => ({titulo:a.title,url:a.url,fecha:a.seendate}));
    }) : Promise.resolve([]),
    consultarPlataformas(tema)
  ]);
  const plataformas=tareas[3].status==='fulfilled'?tareas[3].value:[];
  const estados = tareas.slice(0,3).map((r,i) => ({ fuente:['Google Trends','YouTube','GDELT'][i], estado:r.status === 'fulfilled' ? (i === 1 && !r.value.conectado ? 'Sin configurar' : (i === 1 ? r.value.videos.length : r.value.length) ? 'Consultada' : 'Sin resultados') : 'No disponible', detalle:i === 1 && r.status === 'fulfilled' ? r.value.aviso : '', url:[rss,'https://developers.google.com/youtube/data/reference/rest/v3/videos/list','https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/'][i] }));
  estados.push(...plataformas.map(({items,...estado})=>estado));
  const data = {consultado:new Date().toISOString(),pais,tema,estados,tendencias:tareas[0].status === 'fulfilled' ? tareas[0].value : [], videos:tareas[1].status === 'fulfilled' ? tareas[1].value.videos : [], noticias:tareas[2].status === 'fulfilled' ? tareas[2].value : [], limites:'Google Trends mide búsquedas, YouTube muestra una selección popular y GDELT cobertura de noticias. No miden mejores horarios de Instagram ni garantizan rendimiento. No hay acceso automático a Insights de cuentas.'};
  data.plataformas=plataformas;
  data.limites='Facebook, Instagram, TikTok y LinkedIn consultan cuentas autorizadas. X busca publicaciones públicas por tema; YouTube muestra videos populares. No equivalen a un ranking global de cada red ni permiten deducir horas óptimas universales. Google Trends y GDELT son fuentes complementarias.';
  if (cache.size >= 50) cache.delete(cache.keys().next().value);
  cache.set(key,{time:Date.now(),data});
  return data;
}

export function temporadas(inicio, fin) {
  const catalogo = [
    ['01-01','Año nuevo','Calendario anual: oportunidad editorial, no tendencia medida.',''],
    ['01-24','Día Internacional de la Educación','Efeméride ONU','https://www.un.org/en/observances/list-days-weeks'],
    ['03-08','Día Internacional de la Mujer','Efeméride ONU','https://www.un.org/en/observances/list-days-weeks'],
    ['06-05','Día Mundial del Medio Ambiente','Efeméride ONU','https://www.un.org/en/observances/list-days-weeks'],
    ['12-05','Día Internacional de los Voluntarios','Efeméride ONU','https://www.un.org/observances/volunteer-day'],
    ['12-10','Día de los Derechos Humanos','Efeméride ONU','https://www.un.org/en/observances/list-days-weeks'],
    ['12-25','Navidad','Calendario anual: adaptar a la cultura y audiencia; no es una tendencia medida.','']
  ];
  const lista=[];
  for(let y=Number(inicio.slice(0,4)); y<=Number(fin.slice(0,4));y++) for(const [dia,nombre,tipo,url] of catalogo) {
    const fecha=`${y}-${dia}`;
    // Incluir la anticipación de campaña hasta tres semanas antes del evento.
    if(fecha>=inicio && fecha<=new Date(Date.parse(fin)+21*86400000).toISOString().slice(0,10)) lista.push({fecha,nombre,tipo,url});
  }
  return lista;
}
