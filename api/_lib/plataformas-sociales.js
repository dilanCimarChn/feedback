// Lectura exclusivamente: las credenciales y las peticiones quedan en el servidor.
const DOCUMENTACION = {
  Facebook:'https://developers.facebook.com/docs/pages-api/posts/',
  Instagram:'https://developers.facebook.com/docs/instagram-platform/',
  TikTok:'https://developers.tiktok.com/doc/tiktok-api-v2-video-list/',
  X:'https://docs.x.com/x-api/posts/search-recent-posts',
  LinkedIn:'https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api'
};
const texto=v=>typeof v==='string'?v.slice(0,1200):'';
const hashtags=v=>[...new Set((v||'').match(/#[\p{L}\p{N}_]+/gu)||[])].slice(0,12);
const numero=v=>Number.isFinite(Number(v))&&v!==null&&v!==undefined?Number(v):null;
function metrica(obj){return Object.fromEntries(Object.entries(obj).map(([k,v])=>[k,numero(v)]));}
function item(titulo,url,fecha,formato,metricas={}) {
  return {titulo:texto(titulo)||'Publicación sin texto',url:/^https?:\/\//.test(url||'')?url:'',fecha:fecha||null,formato,hashtags:hashtags(titulo),metricas:metrica(metricas)};
}
async function json(url,token,options={}) {
  const r=await fetch(url,{...options,signal:AbortSignal.timeout(12000),headers:{Authorization:`Bearer ${token}`,...options.headers}});
  if(!r.ok)throw new Error(r.status===429?'Cuota temporal agotada.':r.status===401||r.status===403?'Revisa autorización, permisos y plan de API.':`Proveedor no disponible (${r.status}).`);
  const d=await r.json();
  if(d.error&&d.error.code!=='ok')throw new Error('El proveedor rechazó la consulta. Revisa permisos o renueva el acceso.');
  return d;
}
const requeridas={
  Facebook:['META_GRAPH_VERSION','FACEBOOK_PAGE_ID','FACEBOOK_PAGE_ACCESS_TOKEN'],
  Instagram:['META_GRAPH_VERSION','INSTAGRAM_USER_ID','INSTAGRAM_ACCESS_TOKEN'],
  TikTok:['TIKTOK_ACCESS_TOKEN'],
  X:['X_BEARER_TOKEN'],
  LinkedIn:['LINKEDIN_ACCESS_TOKEN','LINKEDIN_ORGANIZATION_ID','LINKEDIN_VERSION']
};
async function leer(red,tema) {
  const e=process.env;
  if(red==='Facebook'||red==='Instagram') {
    if(!/^v\d+\.\d+$/.test(e.META_GRAPH_VERSION))throw new Error('Configura una versión válida de Meta Graph API.');
    const id=red==='Facebook'?e.FACEBOOK_PAGE_ID:e.INSTAGRAM_USER_ID;
    if(!/^\d+$/.test(id))throw new Error('El identificador de la cuenta debe ser numérico.');
    const fields=red==='Facebook'?'id,message,created_time,permalink_url,shares':'id,caption,media_type,media_product_type,timestamp,permalink,like_count,comments_count';
    const params=new URLSearchParams({fields,limit:'15'});
    const d=await json(`https://graph.facebook.com/${e.META_GRAPH_VERSION}/${id}/${red==='Facebook'?'posts':'media'}?${params}`,red==='Facebook'?e.FACEBOOK_PAGE_ACCESS_TOKEN:e.INSTAGRAM_ACCESS_TOKEN);
    if(!Array.isArray(d.data))throw new Error('Respuesta no válida.');
    return d.data.map(p=>red==='Facebook'?item(p.message,p.permalink_url,p.created_time,'No determinado',{compartidos:p.shares?.count}):item(p.caption,p.permalink,p.timestamp,p.media_product_type==='REELS'?'Reel':p.media_type==='CAROUSEL_ALBUM'?'Carrusel':p.media_type==='IMAGE'?'Imagen':p.media_type==='VIDEO'?'Clip':'No determinado',{likes:p.like_count,comentarios:p.comments_count}));
  }
  if(red==='TikTok') {
    const fields='id,title,video_description,create_time,share_url,duration,like_count,comment_count,share_count,view_count';
    const d=await json(`https://open.tiktokapis.com/v2/video/list/?fields=${fields}`,e.TIKTOK_ACCESS_TOKEN,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({max_count:15})});
    if(!Array.isArray(d.data?.videos))throw new Error('Respuesta no válida.');
    return d.data.videos.map(p=>item(p.video_description||p.title,p.share_url,p.create_time?new Date(p.create_time*1000).toISOString():null,'Clip',{vistas:p.view_count,likes:p.like_count,comentarios:p.comment_count,compartidos:p.share_count}));
  }
  if(red==='X') {
    const palabras=tema.match(/[\p{L}\p{N}]+/gu)?.slice(0,12).join(' ')||'marketing';
    const params=new URLSearchParams({query:`${palabras} -is:retweet`,max_results:'15','tweet.fields':'created_at,public_metrics'});
    const d=await json(`https://api.x.com/2/tweets/search/recent?${params}`,e.X_BEARER_TOKEN);
    if(d.errors?.length&&!d.data)throw new Error('X no devolvió resultados válidos. Revisa permisos y cuota.');
    if(!Array.isArray(d.data)&&d.meta?.result_count!==0)throw new Error('Respuesta no válida.');
    return (d.data||[]).filter(p=>/^\d+$/.test(p.id)).map(p=>item(p.text,`https://x.com/i/web/status/${p.id}`,p.created_at,'Texto',{likes:p.public_metrics?.like_count,respuestas:p.public_metrics?.reply_count,reposts:p.public_metrics?.retweet_count,vistas:p.public_metrics?.impression_count}));
  }
  if(red==='LinkedIn') {
    if(!/^\d+$/.test(e.LINKEDIN_ORGANIZATION_ID)||!/^\d{6}$/.test(e.LINKEDIN_VERSION))throw new Error('Revisa el ID de organización y la versión de LinkedIn (AAAAMM).');
    const params=new URLSearchParams({q:'author',author:`urn:li:organization:${e.LINKEDIN_ORGANIZATION_ID}`,count:'15',sortBy:'LAST_MODIFIED'});
    const d=await json(`https://api.linkedin.com/rest/posts?${params}`,e.LINKEDIN_ACCESS_TOKEN,{headers:{'LinkedIn-Version':e.LINKEDIN_VERSION,'X-Restli-Protocol-Version':'2.0.0'}});
    if(!Array.isArray(d.elements))throw new Error('Respuesta no válida.');
    return d.elements.map(p=>item(p.commentary,/^urn:li:(share|ugcPost):\d+$/.test(p.id)?`https://www.linkedin.com/feed/update/${p.id}/`:'',p.publishedAt?new Date(p.publishedAt).toISOString():null,'No determinado'));
  }
}
export async function consultarPlataformas(tema) {
  return Promise.all(Object.keys(requeridas).map(async red=>{
    const alcance=red==='X'?'Publicaciones públicas recientes por tema; sin filtro geográfico ni ranking de tendencias.':'Publicaciones de la cuenta autorizada; no son tendencias globales de la plataforma.';
    const faltantes=requeridas[red].filter(k=>!process.env[k]?.trim());
    const base={fuente:red,url:DOCUMENTACION[red],alcance,items:[],consultado:new Date().toISOString()};
    if(faltantes.length)return {...base,estado:'Sin configurar',detalle:`Requiere autorización y configuración del servidor: ${faltantes.join(', ')}.`};
    try{const items=await leer(red,tema);return {...base,items,estado:items.length?'Consultada':'Sin resultados',detalle:alcance};}
    catch(err){return {...base,estado:'No disponible',detalle:err.message};}
  }));
}
