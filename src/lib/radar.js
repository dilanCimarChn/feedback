export const CATEGORIAS_RADAR=['Educación','Salud','Medio ambiente','Tecnología','Comunidad','Comercio','General'];
const grupos=[['Educación',/educa|school|learning|escuela|beca/i],['Salud',/salud|health|hospital|wellness/i],['Medio ambiente',/clima|climate|sustain|recicl|ambiente/i],['Tecnología',/software|tecnolog|technology|digital/i],['Comunidad',/nonprofit|volunt|charity|fundac|comunidad|community/i],['Comercio',/restaur|coffee|cafeter|venta|product|tienda|store/i]];
const lista=v=>Array.isArray(v)?v:[];
export function fechaRadar(valor) {
  if(!valor)return null;
  const s=String(valor).replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/,'$1-$2-$3T$4:$5:$6Z');
  return Number.isFinite(Date.parse(s))?new Date(s).toISOString():null;
}
export function urlReferencia(valor) {
  try {const u=new URL(valor);if(!['http:','https:'].includes(u.protocol)||u.username||u.password||[...u.searchParams.keys()].some(k=>/^(?:access_token|api_key|key|password|secret|token)$/i.test(k)))return '';return u.toString();}catch{return '';}
}
export function normalizarRadar(evidencia) {
  const resultados=[];
  const agregar=(plataforma,tipo,item,alcance,propia=false)=>{
    const titulo=String(item.titulo||item.tema||'').slice(0,1200), url=urlReferencia(item.url);
    if(!titulo||(item.url&&!url))return;
    const categoria=item.categoria||grupos.find(([,patron])=>patron.test(titulo+' '+(item.tema||'')))?.[0]||'General';
    resultados.push({id:`${plataforma}:${tipo}:${item.urlExplorar||url}:${titulo}`,plataforma,tipoFuente:tipo,tema:item.tema||evidencia.tema||titulo,palabrasClave:lista(item.hashtags).slice(0,12),categoria,categoriaEditorial:!item.categoria,titulo,url,urlFuente:urlReferencia(item.urlFuente),urlExplorar:urlReferencia(item.urlExplorar),publicado:fechaRadar(item.fecha||item.publicado),consultado:fechaRadar(item.consultado||evidencia.consultado),region:item.region||null,regionReferencia:evidencia.pais||null,idioma:item.idioma||null,autor:item.autor||null,canalId:item.canalId||null,metricas:item.metricas||{},senal:{tipo:propia?'cuenta_propia':tipo.includes('término')?'termino_proveedor':tipo==='Referencia manual'?'referencia_manual':'observacion',confianza:tipo==='Referencia manual'?'Por revisar':'Contextual',explicacion:item.explicacion||alcance||'Observación consultada, sin medición de crecimiento. No acredita viralidad.'},propia,pertinente:item.pertinente,formato:item.formato||null});
  };
  lista(evidencia.videos).forEach(v=>agregar('YouTube',evidencia.youtube?.etiqueta||(evidencia.youtube?.modo==='busqueda_tematica'?'Video por tema':'Selección popular'),{...v,metricas:{vistas:v.vistas??null,likes:v.likes??null,comentarios:v.comentarios??null}},evidencia.youtube?.alcance));
  const externas=Array.isArray(evidencia.descubrimientos)?evidencia.descubrimientos:evidencia.descubrimiento?[evidencia.descubrimiento]:[];
  externas.forEach(f=>lista(f.items).forEach(i=>agregar(f.fuente,i.etiqueta||i.tipoFuente||'Contenido externo',i,f.alcance)));
  lista(evidencia.tendencias).forEach(t=>agregar('Google Trends','Búsqueda general',{...t,metricas:{busquedasAproximadas:t.volumenAproximado||null}},'Búsqueda general del país, no consumo de redes ni tendencia del nicho.'));
  lista(evidencia.noticias).forEach(n=>agregar('GDELT','Noticia',n,'Cobertura de noticias; una mención geográfica no acredita audiencia local.'));
  lista(evidencia.referenciasManuales).forEach(r=>agregar(r.plataforma,'Referencia manual',r,'Referencia aportada por el equipo; contenido y métricas sin verificación automática.'));
  lista(evidencia.plataformas).forEach(f=>lista(f.items).forEach(i=>agregar(f.fuente,'Cuenta autorizada',i,f.alcance,true)));
  return resultados;
}
export function prepararHallazgo(entrada) {
  const plataformas=['Facebook','Instagram','TikTok','YouTube','X','LinkedIn','Google Trends','GDELT'];
  if(!entrada||entrada.propia||/cuenta autorizada/i.test(entrada.tipoFuente||'')||!plataformas.includes(entrada.plataforma)||typeof entrada.id!=='string'||!entrada.id||typeof entrada.titulo!=='string'||!entrada.titulo.trim()||!fechaRadar(entrada.consultado))throw new Error('Solo se pueden guardar hallazgos externos obtenidos del radar con fecha de consulta.');
  const t=(v,max=600)=>typeof v==='string'?v.slice(0,max):null;
  const metricas=Object.fromEntries(Object.entries(entrada.metricas||{}).filter(([k,v])=>k.length<60&&!/token|secret|key|password/i.test(k)&&(v===null||(typeof v==='number'&&Number.isFinite(v)&&v>=0)||(typeof v==='string'&&v.length<=80&&/^[\d.,+\sKMBkmba-záéíóú]+$/.test(v)))).slice(0,20));
  return {id:t(entrada.id,6000),plataforma:entrada.plataforma,tipoFuente:t(entrada.tipoFuente,150),tema:t(entrada.tema,300),titulo:t(entrada.titulo,1200),url:urlReferencia(entrada.url)||null,urlExplorar:urlReferencia(entrada.urlExplorar)||null,urlFuente:urlReferencia(entrada.urlFuente)||null,publicado:fechaRadar(entrada.publicado),consultado:fechaRadar(entrada.consultado),guardado:new Date().toISOString(),region:t(entrada.region,120),regionReferencia:t(entrada.regionReferencia,120),idioma:t(entrada.idioma,60),autor:t(entrada.autor,200),canalId:t(entrada.canalId,50),categoria:t(entrada.categoria,100),categoriaEditorial:Boolean(entrada.categoriaEditorial),palabrasClave:lista(entrada.palabrasClave).filter(s=>typeof s==='string').map(s=>s.slice(0,80)).slice(0,12),metricas,senal:{tipo:t(entrada.senal?.tipo,60),confianza:t(entrada.senal?.confianza,60),explicacion:t(entrada.senal?.explicacion,1600)},propia:false,formato:t(entrada.formato,80)};
}
export function filtrarRadar(resultados,{plataforma='',categoria='',texto='',desde='',hasta='',incluirPropias=false}={}) {
  const q=texto.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase();
  return lista(resultados).filter(r=>(incluirPropias||!r.propia)&&(!plataforma||r.plataforma===plataforma)&&(!categoria||r.categoria===categoria)&&(!q||(r.titulo+' '+r.tema+' '+r.palabrasClave.join(' ')).normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().includes(q))&&(!desde||!r.publicado||r.publicado.slice(0,10)>=desde)&&(!hasta||!r.publicado||r.publicado.slice(0,10)<=hasta));
}
