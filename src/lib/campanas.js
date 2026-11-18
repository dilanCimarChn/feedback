import {REDES,FORMATOS_POR_RED} from './marketing.js';
import {urlReferencia} from './radar.js';

export const ESTADOS_PUBLICACION={borrador:'Borrador',pendiente_revision:'Pendiente de revisión',aprobado:'Aprobado',descartado:'Descartado'};
export const idValido=id=>typeof id==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(id);
const fechaValida=f=>typeof f==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(f)&&Number.isFinite(Date.parse(f))&&new Date(f).toISOString().slice(0,10)===f;
function limpiar(valor,nivel=0) {
  if(nivel>14)return null;
  if(typeof valor==='string')return /^data:[^,]*;base64,/i.test(valor)?'[Archivo omitido]':valor.slice(0,15000);
  if(valor===null||['number','boolean'].includes(typeof valor))return valor;
  if(Array.isArray(valor))return valor.slice(0,800).map(v=>limpiar(v,nivel+1));
  if(valor&&typeof valor==='object')return Object.fromEntries(Object.entries(valor).filter(([k])=>!['__proto__','constructor','prototype','_equipo'].includes(k)&&!/access.?token|api.?key|password|client.?secret/i.test(k)).slice(0,100).map(([k,v])=>[k,limpiar(v,nivel+1)]));
  return null;
}
export function prepararCampana(entrada) {
  if(!entrada||typeof entrada!=='object'||!fechaValida(entrada.inicio)||!fechaValida(entrada.fin)||entrada.fin<entrada.inicio||Date.parse(entrada.fin)-Date.parse(entrada.inicio)>365*86400000)throw new Error('La campaña necesita un rango válido de hasta un año.');
  if(!Array.isArray(entrada.publicaciones)||entrada.publicaciones.length>800)throw new Error('La campaña debe contener hasta 800 publicaciones.');
  if(typeof entrada.zona!=='string')throw new Error('Indica la zona horaria de la campaña.');
  new Intl.DateTimeFormat('es',{timeZone:entrada.zona}).format();
  const plan=limpiar(entrada);
  plan.id=idValido(entrada.id)?entrada.id:crypto.randomUUID();
  plan.nombre=String(entrada.nombre||`Campaña ${entrada.inicio}`).trim().slice(0,150);
  const vistos=new Set();
  plan.publicaciones=plan.publicaciones.map(p=>{
    if(!p||!fechaValida(p.fecha)||p.fecha<plan.inicio||p.fecha>plan.fin||!/^([01]\d|2[0-3]):[0-5]\d$/.test(p.hora)||!REDES.includes(p.red)||!FORMATOS_POR_RED[p.red]?.includes(p.formato))throw new Error('Una publicación tiene fecha, hora, red o formato no válidos.');
    const id=idValido(p.id)?p.id:crypto.randomUUID();
    if(vistos.has(id))throw new Error('Las publicaciones deben tener identificadores únicos.');vistos.add(id);
    const estado=p.estado||'borrador';
    if(!Object.hasOwn(ESTADOS_PUBLICACION,estado))throw new Error('El estado de revisión no es válido.');
    if(estado==='aprobado'&&(!p.copy?.trim()||!p.titulo?.trim()))throw new Error('Completa el título y el texto antes de aprobar una publicación.');
    return {...p,id,estado,hashtags:Array.isArray(p.hashtags)?p.hashtags.filter(t=>typeof t==='string').slice(0,12):[],palabras_clave:Array.isArray(p.palabras_clave)?p.palabras_clave.slice(0,12):[],referencias:Array.isArray(p.referencias)?p.referencias.filter(r=>r&&urlReferencia(r.url)).map(r=>({...r,url:urlReferencia(r.url)})).slice(0,5):[]};
  });
  // Cada bloque conserva sus fuentes y estrategia, sin duplicar todas las piezas.
  if(Array.isArray(plan.bloques))plan.bloques=plan.bloques.map(({publicaciones,...bloque})=>{
    if(bloque.evidencia){const {resultados,...evidencia}=bloque.evidencia;return {...bloque,evidencia};}
    return bloque;
  });
  if(JSON.stringify(plan).length>2500000)throw new Error('La campaña supera el tamaño permitido. Exporta el plan completo y divide el período.');
  return plan;
}
export function firmaCampana(plan) {
  if(!plan)return '';
  const {_equipo,...datos}=plan;
  return JSON.stringify(datos);
}
export function editarPublicacion(plan,id,cambios) {
  const horario=Object.keys(cambios).some(c=>['fecha','hora','red'].includes(c))?{base_horario:'Horario ajustado por el equipo; no representa un pico de conexión medido.'}:{};
  const etiquetas=Object.hasOwn(cambios,'hashtags')||Object.hasOwn(cambios,'red')?{hashtags_observados:[],criterio_hashtags:'Etiquetas editadas por el equipo; validar pertinencia en esta plataforma. Sin volumen social medido.'}:{};
  const herramienta=Object.hasOwn(cambios,'red')||Object.hasOwn(cambios,'formato')?{herramienta:null}:{};
  return {...plan,...(plan._equipo?{_equipo:{...plan._equipo,pendiente:true}}:{}),publicaciones:plan.publicaciones.map(p=>p.id===id?{...p,...cambios,...horario,...etiquetas,...herramienta,...(cambios.red?{formato:FORMATOS_POR_RED[cambios.red].includes(cambios.formato||p.formato)?cambios.formato||p.formato:FORMATOS_POR_RED[cambios.red][0]}:{}),estado:estadoTrasCambio(cambios,p),editado:true}:p)};
}
function estadoTrasCambio(cambios,p) {return Object.keys(cambios).every(k=>k==='estado')?cambios.estado||p.estado:'borrador';}
export function aplicarPropuesta(plan,id,propuesta) {
  return {...plan,...(plan._equipo?{_equipo:{...plan._equipo,pendiente:true}}:{}),publicaciones:plan.publicaciones.map(p=>p.id!==id?p:{...propuesta,id:p.id,fecha:p.fecha,hora:p.hora,red:p.red,formato:p.formato,estado:'borrador',editado:true,versionAnterior:{...p,versionAnterior:undefined}})};
}
export function fechasDelEquipo(texto,inicio,fin) {
  return String(texto||'').split('\n').map(s=>s.trim()).filter(Boolean).slice(0,12).map(linea=>{
    const m=/^(\d{4}-\d{2}-\d{2})\s*\|\s*(.{1,150})$/.exec(linea);
    if(!m||!fechaValida(m[1])||m[1]<inicio||m[1]>fin)throw new Error('Usa una fecha dentro de la campaña por línea: AAAA-MM-DD | Motivo.');
    return {fecha:m[1],nombre:m[2],tipo:'Fecha aportada por el equipo; no es una tendencia medida.',url:''};
  });
}
export function referenciaManual(datos) {
  const url=urlReferencia(datos.url);
  if(!url||typeof datos.titulo!=='string'||!datos.titulo.trim()||!REDES.includes(datos.plataforma))throw new Error('Indica una plataforma, un título y un enlace público válido.');
  const host=new URL(url).hostname.replace(/^www\./,'');
  const hosts={Facebook:['facebook.com','fb.watch'],Instagram:['instagram.com'],TikTok:['tiktok.com','vm.tiktok.com','ads.tiktok.com'],YouTube:['youtube.com','youtu.be'],LinkedIn:['linkedin.com'],X:['x.com','twitter.com']};
  if(!hosts[datos.plataforma].includes(host))throw new Error('El enlace debe corresponder a la plataforma elegida.');
  return {id:crypto.randomUUID(),plataforma:datos.plataforma,titulo:datos.titulo.trim().slice(0,600),url,tema:String(datos.tema||'').slice(0,150),fecha:fechaValida(datos.fecha)?datos.fecha:null,consultado:new Date().toISOString(),tipoFuente:'Referencia manual',metricas:{},nota:String(datos.nota||'').slice(0,600)};
}
export function referenciaSeleccionada(datos) {
  const url=urlReferencia(datos?.url);
  if(!url||typeof datos?.titulo!=='string'||!datos.titulo.trim()||![...REDES,'Google Trends','GDELT'].includes(datos.plataforma))throw new Error('La referencia seleccionada necesita título, fuente y enlace válidos.');
  return {id:crypto.randomUUID(),plataforma:datos.plataforma,titulo:datos.titulo.slice(0,600),url,tema:String(datos.tema||'').slice(0,150),fecha:fechaValida(datos.fecha)?datos.fecha:null,consultado:new Date().toISOString(),tipoFuente:'Referencia seleccionada por el equipo',metricas:{},nota:'Enlace aportado a la campaña; verificar vigencia y pertinencia.'};
}
