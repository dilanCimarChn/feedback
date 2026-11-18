import {crearCacheAsync,huella,limitarFuentes} from './carga.js';

const cache=crearCacheAsync({max:100});
const DOC_TIKTOK='https://business-api.tiktok.com/portal/docs?id=1832798345014338';
const DOC_FACEBOOK='https://developers.facebook.com/docs/features-reference/page-public-content-access/';
const lista=valor=>typeof valor==='string'?[...new Set(valor.split(',').map(s=>s.trim()).filter(Boolean))]:[];
async function jsonOficial(url,headers,red) {
  return limitarFuentes(async()=>{
    let r,d;
    try {r=await fetch(url,{headers,redirect:'error',signal:AbortSignal.timeout(10000)});d=await r.json();}
    catch {throw new Error(`${red} no respondió a tiempo o devolvió datos no válidos.`);}
    if(!r.ok || d.error || (red==='TikTok' && d.code!==0)) {
      if(r.status===429 || [4,17,32,613].includes(Number(d.error?.code)))throw new Error(`${red}: límite de consultas alcanzado. No se reintenta automáticamente.`);
      throw new Error(red==='TikTok'?'TikTok rechazó el acceso: comprueba discovery.search.words, la cuenta con Advanced Access o verificación y que business_id sea el open_id autorizado.':'Facebook rechazó el acceso público: comprueba el producto, permisos aprobados, token y páginas de referencia.');
    }
    return d;
  });
}

export async function consultarTikTokDiscovery({tema='',pais=''}={}) {
  const token=process.env.TIKTOK_DISCOVERY_ACCESS_TOKEN?.trim(), id=process.env.TIKTOK_DISCOVERY_BUSINESS_ID?.trim();
  const base={fuente:'TikTok',modo:'descubrimiento_externo',url:DOC_TIKTOK,consultado:new Date().toISOString(),items:[],alcance:'Términos actuales no personalizados de Discovery API. Esta ruta no filtra país ni intervalo histórico y no devuelve vistas, videos ni volumen de búsquedas.',regionSolicitada:pais};
  if(!token||!id)return {...base,estado:'Sin configurar',detalle:'Pendiente de una cuenta autorizada con discovery.search.words y su open_id; Creative Center y las referencias manuales siguen disponibles.'};
  if(!/^[A-Za-z0-9_.:-]{1,180}$/.test(id))return {...base,estado:'No disponible',detalle:'El identificador de Discovery debe ser el open_id del flujo de autorización, no una URL ni el ID del anunciante.'};
  return cache(huella(['tiktok-discovery',id,token,pais]),async()=>{
    try {
      const params=new URLSearchParams({business_id:id,is_personalized:'false'});
      const d=await jsonOficial(`https://business-api.tiktok.com/open_api/v1.3/discovery/trending/search/?${params}`,{'Access-Token':token},'TikTok');
      if(!Array.isArray(d.data?.search_keywords))throw new Error('TikTok no devolvió una lista válida de términos de búsqueda.');
      const keywords=[...new Set(d.data.search_keywords.filter(k=>typeof k==='string'&&k.trim()).map(k=>k.trim().slice(0,255)))].slice(0,20);
      const items=keywords.map(titulo=>({titulo,tema:titulo,url:DOC_TIKTOK,urlExplorar:`https://www.tiktok.com/search?q=${encodeURIComponent(titulo)}`,fecha:null,consultado:new Date().toISOString(),formato:'Término de búsqueda',tipoFuente:'TikTok Discovery · término no personalizado',hashtags:[],metricas:{},observaciones:{personalizado:false,regionVerificada:false,limite:'El proveedor lo devuelve como término en tendencia; no aporta volumen ni una medición de crecimiento.'}}));
      return {...base,consultado:new Date().toISOString(),estado:items.length?'Consultada':'Sin resultados',items,detalle:'Discovery devolvió términos públicos actuales no personalizados. El tema se filtra después de consultar; no son datos de una cuenta propia.'};
    } catch(e) {return {...base,estado:'No disponible',detalle:e.message};}
  },r=>r.estado==='No disponible'?15000:900000);
}

export async function consultarFacebookExterno() {
  const ids=lista(process.env.FACEBOOK_DISCOVERY_PAGE_IDS).filter(id=>/^\d{1,30}$/.test(id)&&id!==process.env.FACEBOOK_PAGE_ID).slice(0,3);
  const token=process.env.FACEBOOK_PUBLIC_ACCESS_TOKEN?.trim(),version=process.env.META_GRAPH_VERSION?.trim();
  const base={fuente:'Facebook',modo:'descubrimiento_externo',url:DOC_FACEBOOK,consultado:new Date().toISOString(),items:[],alcance:'Hasta tres páginas públicas de referencia con acceso autorizado. No es búsqueda global ni acredita la ubicación de su audiencia.'};
  if(!ids.length||!token)return {...base,estado:'Sin configurar',detalle:'Pendiente de páginas de referencia y un acceso público aprobado para este uso. El token de tu página no se utiliza como sustituto; puedes agregar enlaces manuales.'};
  if(!/^v\d+\.\d+$/.test(version||''))return {...base,estado:'No disponible',detalle:'Configura una versión soportada de Meta Graph API.'};
  return cache(huella(['facebook-publico',ids,token,version]),async()=>{
    const respuestas=await Promise.allSettled(ids.map(async id=>{
      const params=new URLSearchParams({fields:'id,message,created_time,permalink_url,shares',limit:'10'});
      const d=await jsonOficial(`https://graph.facebook.com/${version}/${id}/posts?${params}`,{Authorization:`Bearer ${token}`},'Facebook');
      if(!Array.isArray(d.data))throw new Error('Facebook no devolvió publicaciones públicas válidas.');
      return d.data.flatMap(p=>{
        let url;
        try {url=new URL(p.permalink_url);if(url.protocol!=='https:'||!['www.facebook.com','facebook.com','fb.watch'].includes(url.hostname)||url.username||url.password)return [];url.hash='';for(const k of [...url.searchParams.keys()])if(!['story_fbid','id','v'].includes(k))url.searchParams.delete(k);}catch{return [];}
        const titulo=typeof p.message==='string'?p.message.slice(0,1200):'Publicación pública sin texto';
        const fecha=typeof p.created_time==='string'&&Number.isFinite(Date.parse(p.created_time))?new Date(p.created_time).toISOString():null;
        return [{titulo,url:url.toString(),fecha,formato:'No determinado',tipoFuente:'Página pública de referencia',consultado:new Date().toISOString(),hashtags:[...new Set(titulo.match(/#[\p{L}\p{N}_]+/gu)||[])].slice(0,12),metricas:{compartidos:typeof p.shares?.count==='number'&&p.shares.count>=0?p.shares.count:null}}];
      });
    }));
    const items=[...new Map(respuestas.flatMap(r=>r.status==='fulfilled'?r.value:[]).map(p=>[p.url,p])).values()];
    const fallos=respuestas.filter(r=>r.status==='rejected');
    return {...base,consultado:new Date().toISOString(),items,estado:items.length?'Consultada':fallos.length===respuestas.length?'No disponible':'Sin resultados',parcial:fallos.length>0&&fallos.length<respuestas.length,avisos:fallos.map(r=>r.reason.message),detalle:fallos.length?fallos[0].reason.message:'Lectura pública de las páginas de referencia completada; no se verificó tendencia, crecimiento ni rendimiento.'};
  },r=>r.estado==='No disponible'||r.parcial?15000:900000);
}
