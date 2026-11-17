import { obtenerSenales } from './senales-sociales.js';
import { consultarPlataformas } from './plataformas-sociales.js';
import { crearCacheAsync, huella, limitarFuentes } from './carga.js';

const cache = crearCacheAsync({ max: 100 });
const cacheRss = crearCacheAsync({ max: 40 });
const limpiar = s => String(s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]*>/g, '').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').trim().slice(0,500);
const etiqueta = (xml, tag) => limpiar(xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`))?.[1]);
const PRIORIDAD_REDES = ['Facebook', 'Instagram', 'TikTok', 'X', 'LinkedIn', 'YouTube'];
const PAISES_BUSQUEDA = { BO:'Bolivia', AR:'Argentina', CL:'Chile', CO:'Colombia', MX:'Mexico', PE:'Peru', ES:'Spain', US:'United States', CA:'Canada', GB:'United Kingdom', DE:'Germany', FR:'France', BR:'Brazil', IN:'India', AU:'Australia', ZA:'South Africa', KE:'Kenya' };
const normalizar = valor => String(valor || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const palabras = valor => (String(valor || '').match(/[\p{L}\p{N}]+/gu) || []).filter(p => !/^(OR|AND|NOT)$/i.test(p));
const frase = valor => palabras(valor).slice(0, 12).join(' ');
const CONCEPTOS = [
  {claves:['educacion','education','educativo','educativa','escuela','school','aprendizaje','learning','becas','scholarship'],buscar:['education','school','learning','scholarship'],reconocer:['education','educacion','educativo','educativa','escuela','school','aprendizaje','learning','beca','scholarship']},
  {claves:['salud','health','healthcare','hospital','medicina','medicine','bienestar','wellness'],buscar:['health','healthcare','hospital','wellness'],reconocer:['salud','health','healthcare','hospital','medicina','medical','bienestar','wellness']},
  {claves:['ambiente','ambiental','environment','environmental','clima','climate','reciclaje','recycling','sostenibilidad','sustainability'],buscar:['environment','climate','recycling','sustainability'],reconocer:['ambiente','ambiental','environment','clima','climate','recicl','recycl','sostenib','sustainab']},
  {claves:['animales','animals','animal','mascotas','pets','biodiversidad','wildlife'],buscar:['animal','pets','wildlife','biodiversity'],reconocer:['animal','mascota','pets','biodivers','wildlife']},
  {claves:['tecnologia','technology','software','digital','informatica','computer'],buscar:['technology','software','digital','computer'],reconocer:['tecnolog','technology','software','digital','informatica','computer']},
  {claves:['alimentacion','alimentaria','hambre','hunger','nutrition','nutricion','food'],buscar:['food','hunger','nutrition'],reconocer:['alimenta','hambre','hunger','nutri','food']},
  {claves:['refugiados','refugees','migrantes','migrants','refugee','migrant'],buscar:['refugee','migrant','immigration'],reconocer:['refug','migrant','immigration']},
  {claves:['restaurante','restaurant','cafeteria','coffee','cafe','gastronomia'],buscar:['restaurant','coffee','cafe'],reconocer:['restauran','cafeteria','coffee','cafe','gastronom']},
  {claves:['turismo','tourism','viajes','travel','hotel'],buscar:['tourism','travel','hotel'],reconocer:['turis','touris','viaje','travel','hotel']},
  {claves:['inmobiliaria','inmobiliario','real estate','vivienda','housing'],buscar:['"real estate"','housing','property'],reconocer:['inmobiliar','real estate','vivienda','housing','property']},
];
const SOCIAL = {claves:['ong','ngo','nonprofit','non profit','charity','organizacion social','fundacion','donaciones','donations','voluntariado','volunteer'],buscar:['nonprofit','charity','ngo','volunteer'],reconocer:['ong','ngo','nonprofit','non profit','charit','fundacion','donacion','donation','voluntar','volunteer']};
const IGNORAR = new Set(['para','como','sobre','with','that','this','from','your','tendencias','marketing','captar','captacion','quiero','marca','crear','contenido','publicar','llegar','aumentar','gente','redes','sociales','donde','nuestra','nuestro','negocio','objetivo','eeuu','usa','estados','unidos','pais','ciudad']);
function conceptosTema(tema) {
  const limpio = ` ${normalizar(tema).replace(/[^\p{L}\p{N}\s]/gu,' ')} `;
  const coincide = c => c.claves.some(k => limpio.includes(` ${k} `));
  const sectores = CONCEPTOS.filter(coincide);
  return sectores.length ? sectores : coincide(SOCIAL) ? [SOCIAL] : [];
}
function terminosTema(tema) {
  const conceptos = conceptosTema(tema);
  return conceptos.length ? [...new Set(conceptos.flatMap(c=>c.reconocer))] : palabras(normalizar(tema)).filter(p => p.length > 3 && !IGNORAR.has(p)).slice(0, 8);
}
function consultaTema(tema) {
  const conceptos = conceptosTema(tema);
  const terminos = conceptos.length ? [...new Set(conceptos.flatMap(c=>c.buscar))].slice(0,12) : palabras(tema).filter(p=>p.length>2&&!IGNORAR.has(normalizar(p))).slice(0,6).map(p=>`"${p}"`);
  return terminos.length > 1 ? `(${terminos.join(' OR ')})` : terminos[0] || 'marketing';
}

// GDELT busca cobertura traducida al inglés. El lugar se busca como mención en
// las noticias; no equivale al país del medio ni al lugar de una audiencia.
export function consultaGeografica(pais, tema, region = '') {
  const asunto = consultaTema(tema);
  const paisTexto = PAISES_BUSQUEDA[pais] || pais;
  const lugar = frase(region);
  return [asunto, `"${paisTexto}"`, lugar ? `"${lugar}"` : ''].filter(Boolean).join(' ');
}

function marcarPertinencia(items, tema, campo) {
  const terminos = terminosTema(tema);
  return items.map(item => ({ ...item, pertinente: terminos.length > 0 && terminos.some(t => normalizar(item[campo]).includes(t)) }));
}

export function hashtagsObservados(plataformas, videos, consultado) {
  const observados = [];
  const agregar = (red, item, alcance, consultaFuente) => {
    if (item.pertinente === false || !/^https?:\/\//i.test(item.url || '')) return;
    for (const hashtag of item.hashtags || []) {
      if (!/^#[\p{L}\p{N}_]+$/u.test(hashtag) || observados.some(h => h.red === red && normalizar(h.hashtag) === normalizar(hashtag))) continue;
      observados.push({ hashtag, red, url:item.url, publicado:item.fecha || item.publicado || null, consultado:item.consultado || consultaFuente || consultado, alcance, base:'Observado en una publicación; sin volumen ni eficacia medidos.' });
      if (observados.length >= 60) return;
    }
  };
  for (const red of PRIORIDAD_REDES) {
    if (red === 'YouTube') videos.forEach(v => agregar(red, v, 'Selección popular del país; pertinencia temática por coincidencia de términos.'));
    else plataformas.filter(p => p.fuente === red).forEach(p => p.items.forEach(i => agregar(red, i, p.alcance, p.consultado)));
  }
  return observados.slice(0, 60);
}

export function leerTendenciasRss(xml) {
  if (!/<rss[\s>]/i.test(xml)) throw new Error('Feed no válido.');
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0,20).map(m => ({ tema: etiqueta(m[1],'title'), volumenAproximado: etiqueta(m[1],'ht:approx_traffic'), fecha: etiqueta(m[1],'pubDate'), url: etiqueta(m[1],'link') })).filter(t => t.tema);
}
async function descargar(url, tipo = 'json') {
  return limitarFuentes(async () => {
  const r = await fetch(url, { signal: AbortSignal.timeout(12000) });
  if (!r.ok) throw new Error(`Proveedor no disponible (${r.status}).`);
  return tipo === 'text' ? r.text() : r.json();
  });
}
export async function investigarMarketing(pais, tema, region = '') {
  if (!/^[A-Z]{2}$/.test(pais || '')) throw new Error('País no válido.');
  tema = String(tema || '').trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 150);
  region = String(region || '').trim().replace(/\s+/g, ' ').slice(0, 120);
  const configuracion = Object.entries(process.env).filter(([k]) => /^(YOUTUBE_|META_|FACEBOOK_|INSTAGRAM_|TIKTOK_|X_BEARER_|LINKEDIN_)/.test(k)).sort(([a],[b]) => a.localeCompare(b));
  return cache(`${pais}:${tema}:${normalizar(region)}:${huella(configuracion)}`, () => investigar(pais, tema, region), data => data.estados.some(s => s.estado === 'No disponible') ? 15000 : 900000);
}

async function investigar(pais, tema, region) {
  const rss = `https://trends.google.com/trending/rss?geo=${pais}`;
  const query = consultaGeografica(pais, tema, region);
  const consulta = new URLSearchParams({query,mode:'artlist',format:'json',timespan:'7d',maxrecords:'10',sort:'datedesc'});
  const buscarNoticias = async () => {
    const leer = async parametros => {
      const d = await descargar(`https://api.gdeltproject.org/api/v2/doc/doc?${parametros}`);
      if (!Array.isArray(d.articles)) throw new Error('Respuesta no válida.');
      return d.articles.filter(a => /^https?:\/\//i.test(a.url || '')).map(a => ({titulo:a.title,url:a.url,fecha:a.seendate}));
    };
    const noticias = await leer(consulta);
    if (noticias.length || !region) return {noticias,consulta:query,nivel:region?'Localidad solicitada':'País solicitado'};
    const nacional = new URLSearchParams(consulta);
    nacional.set('query', consultaGeografica(pais, tema));
    return {noticias:await leer(nacional),consulta:nacional.get('query'),nivel:'País solicitado; sin resultados para la localidad'};
  };
  const tareas = await Promise.allSettled([
    cacheRss(pais, () => descargar(rss,'text').then(leerTendenciasRss)),
    obtenerSenales(pais),
    tema.length >= 2 ? buscarNoticias() : Promise.resolve({noticias:[],consulta:query,nivel:'Sin tema específico'}),
    consultarPlataformas(tema)
  ]);
  const plataformas=tareas[3].status==='fulfilled'?tareas[3].value.map(p=>({...p,items:marcarPertinencia(p.items,tema,'titulo')})):[];
  const estados = tareas.slice(0,3).map((r,i) => ({ fuente:['Google Trends','YouTube','GDELT'][i], estado:r.status === 'fulfilled' ? (i === 1 && !r.value.conectado ? 'Sin configurar' : (i === 1 ? r.value.videos.length : i === 2 ? r.value.noticias.length : r.value.length) ? 'Consultada' : 'Sin resultados') : 'No disponible', detalle:i === 1 && r.status === 'fulfilled' ? r.value.aviso : i === 2 && r.status === 'fulfilled' ? `${r.value.nivel}. Consulta: ${r.value.consulta}. Son menciones geográficas en noticias, no actividad de usuarios.` : i === 0 ? 'Búsquedas generales del país, sin filtro por ciudad ni sector. Solo se vinculan como referencia las coincidencias temáticas.' : '', url:[rss,'https://developers.google.com/youtube/data/reference/rest/v3/videos/list','https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/'][i] }));
  estados.push(...plataformas.map(({items,...estado})=>estado));
  const data = {consultado:new Date().toISOString(),pais,tema,region,prioridadRedes:PRIORIDAD_REDES,estados,tendencias:marcarPertinencia(tareas[0].status === 'fulfilled' ? tareas[0].value : [],tema,'tema'), videos:marcarPertinencia(tareas[1].status === 'fulfilled' ? tareas[1].value.videos.map(v=>({...v,consultado:tareas[1].value.consultado})) : [],tema,'titulo'), noticias:tareas[2].status === 'fulfilled' ? tareas[2].value.noticias : []};
  data.plataformas=plataformas;
  data.alcanceGeografico={pais,regionSolicitada:region || null,noticias:tareas[2].status === 'fulfilled' ? tareas[2].value.nivel : 'Sin datos disponibles',consultaNoticias:tareas[2].status === 'fulfilled' ? tareas[2].value.consulta : query,redes:'Las cuentas autorizadas y X no tienen geolocalización de audiencia verificada. Google Trends y YouTube usan país, no ciudad.'};
  data.hashtagsObservados=hashtagsObservados(plataformas,data.videos,data.consultado);
  data.limites='Facebook, Instagram, TikTok y LinkedIn consultan cuentas autorizadas. X busca publicaciones públicas por tema sin filtro geográfico; YouTube muestra videos populares del país. No equivalen a un ranking global de cada red ni permiten deducir horas óptimas universales. Google Trends y GDELT son fuentes complementarias. Las coincidencias de términos solo ayudan a filtrar pertinencia; pueden omitir sinónimos y necesitan revisión. Los hashtags observados acreditan su presencia en publicaciones, no volumen, tendencia ni eficacia. #parati y #fyp no garantizan distribución.';
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
