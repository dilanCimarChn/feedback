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
    resultados.push({id:`${plataforma}:${tipo}:${item.urlExplorar||url}:${titulo}`,plataforma,tipoFuente:tipo,tema:item.tema||evidencia.tema||titulo,palabrasClave:lista(item.hashtags).slice(0,12),categoria,categoriaEditorial:!item.categoria,titulo,url,urlExplorar:urlReferencia(item.urlExplorar),publicado:fechaRadar(item.fecha||item.publicado),consultado:fechaRadar(item.consultado||evidencia.consultado),region:item.region||null,regionReferencia:evidencia.pais||null,idioma:item.idioma||null,metricas:item.metricas||{},senal:{tipo:propia?'cuenta_propia':tipo.includes('término')?'termino_proveedor':tipo==='Referencia manual'?'referencia_manual':'observacion',confianza:tipo==='Referencia manual'?'Por revisar':'Contextual',explicacion:alcance||'Observación consultada, sin medición de crecimiento. No acredita viralidad.'},propia,pertinente:item.pertinente,formato:item.formato||null});
  };
  lista(evidencia.videos).forEach(v=>agregar('YouTube',evidencia.youtube?.modo==='busqueda_tematica'?'Video por tema':'Selección popular',{...v,metricas:{vistas:v.vistas??null,likes:v.likes??null}},evidencia.youtube?.alcance));
  const externas=Array.isArray(evidencia.descubrimientos)?evidencia.descubrimientos:evidencia.descubrimiento?[evidencia.descubrimiento]:[];
  externas.forEach(f=>lista(f.items).forEach(i=>agregar(f.fuente,i.tipoFuente||'Contenido externo',i,f.alcance)));
  lista(evidencia.tendencias).forEach(t=>agregar('Google Trends','Búsqueda general',{...t,metricas:{busquedasAproximadas:t.volumenAproximado||null}},'Búsqueda general del país, no consumo de redes ni tendencia del nicho.'));
  lista(evidencia.noticias).forEach(n=>agregar('GDELT','Noticia',n,'Cobertura de noticias; una mención geográfica no acredita audiencia local.'));
  lista(evidencia.referenciasManuales).forEach(r=>agregar(r.plataforma,'Referencia manual',r,'Referencia aportada por el equipo; contenido y métricas sin verificación automática.'));
  lista(evidencia.plataformas).forEach(f=>lista(f.items).forEach(i=>agregar(f.fuente,'Cuenta autorizada',i,f.alcance,true)));
  return resultados;
}
export function filtrarRadar(resultados,{plataforma='',categoria='',texto='',desde='',hasta='',incluirPropias=false}={}) {
  const q=texto.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase();
  return lista(resultados).filter(r=>(incluirPropias||!r.propia)&&(!plataforma||r.plataforma===plataforma)&&(!categoria||r.categoria===categoria)&&(!q||(r.titulo+' '+r.tema+' '+r.palabrasClave.join(' ')).normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().includes(q))&&(!desde||!r.publicado||r.publicado.slice(0,10)>=desde)&&(!hasta||!r.publicado||r.publicado.slice(0,10)<=hasta));
}
