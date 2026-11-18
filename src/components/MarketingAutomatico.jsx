import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { llamarApi } from '../lib/api';
import { rangoCampana, dividirCampana, DIAS, REDES, descargarArchivo, calendarioCsv } from '../lib/marketing';
import { PERIODOS_CAMPANA, MAXIMO_POR_UNIDAD, periodoSeleccionado, mesSiguiente, rangoMes, cantidadAutomatica, cuposPorBloque, celdasMes } from '../lib/planificacion';
import { useGuardadoDiferido } from '../lib/useGuardadoDiferido';
const Marketing = lazy(() => import('./Marketing'));
import { TSCP } from '../lib/tscp';
import {editarPublicacion,aplicarPropuesta,fechasDelEquipo,ESTADOS_PUBLICACION} from '../lib/campanas';
import {useCampanasEquipo} from '../lib/useCampanasEquipo';
import CampanasEquipo from './CampanasEquipo';
import PublicacionCampana from './PublicacionCampana';

const CLAVE='agente-feedback:automatico:v1';
function leer() {try{return JSON.parse(localStorage.getItem(CLAVE)) || {};}catch{return {};}}
function hoy() {const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function nombreMes(mes) {return new Intl.DateTimeFormat('es',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(`${mes}-01T00:00:00Z`));}
function zonaPais(pais, region='') {
  if(pais==='US') {
    if(/los angeles|california|san francisco|seattle|washington state|nevada|oregon/i.test(region))return 'America/Los_Angeles';
    if(/chicago|texas|houston|dallas|illinois|austin/i.test(region))return 'America/Chicago';
    if(/denver|colorado|utah|salt lake/i.test(region))return 'America/Denver';
    if(/arizona|phoenix/i.test(region))return 'America/Phoenix';
    if(/hawai|honolulu/i.test(region))return 'Pacific/Honolulu';
    if(/alaska|anchorage/i.test(region))return 'America/Anchorage';
  }
  return PAISES.find(p=>p[0]===pais)?.[2]||'America/La_Paz';
}
const PAISES=[['BO','Bolivia','America/La_Paz'],['AR','Argentina','America/Argentina/Buenos_Aires'],['CL','Chile','America/Santiago'],['CO','Colombia','America/Bogota'],['MX','México','America/Mexico_City'],['PE','Perú','America/Lima'],['ES','España','Europe/Madrid'],['US','Estados Unidos','America/New_York'],['CA','Canadá','America/Toronto'],['GB','Reino Unido','Europe/London'],['DE','Alemania','Europe/Berlin'],['FR','Francia','Europe/Paris'],['BR','Brasil','America/Sao_Paulo'],['IN','India','Asia/Kolkata'],['AU','Australia','Australia/Sydney'],['ZA','Sudáfrica','Africa/Johannesburg'],['KE','Kenia','Africa/Nairobi']];

export default function MarketingAutomatico({perfil,comportamiento,contexto,onUsar}) {
  const [guardado]=useState(leer);
  const [form,setForm]=useState(()=>({inicio:hoy(),cantidad:3,unidad:'meses',pais:'US',zona:'America/New_York',estrategia:'general',idioma:'Español',descripcion:'',objetivo:'',region:'',publicaciones:'',frecuencia:'',publico:'',productos:'',presupuesto:'',tono:'',fechasImportantes:'',redes:REDES,referencias:[],mes:guardado.form?.inicio?.slice(0,7)||mesSiguiente(),modo:guardado.form?.inicio?'personalizado':'duracion',...guardado.form}));
  const [plan,setPlan]=useState(()=>Array.isArray(guardado.plan?.bloques)?{...guardado.plan,id:guardado.plan.id||crypto.randomUUID(),publicaciones:guardado.plan.publicaciones.map(p=>({...p,id:p.id||crypto.randomUUID(),estado:p.estado||'borrador'}))}:null);
  const [mes,setMes]=useState(guardado.plan?.inicio?.slice(0,7)||'');
  const [error,setError]=useState('');
  const [aviso,setAviso]=useState('');
  const [cargando,setCargando]=useState(false);
  const [progreso,setProgreso]=useState('');
  const [seleccion,setSeleccion]=useState(null);
  const [red,setRed]=useState('');
  const [estado,setEstado]=useState('');
  const [regenerando,setRegenerando]=useState(false);
  const equipo=useCampanasEquipo(plan,setPlan);
  const [editando,setEditando]=useState(false);
  const [manualVisitado,setManualVisitado]=useState(false);
  const detener=useRef(false);
  const ocupado=useRef(false);
  const editor=useRef(null);
  const botonPieza=useRef(null);
  useEffect(()=>{if(contexto?.texto&&!ocupado.current)setForm(f=>({...f,descripcion:contexto.texto,referencias:[...(f.referencias||[]),...(contexto.referencias||[])].filter((r,i,a)=>a.findIndex(x=>x.url===r.url)===i).slice(-5)}));},[contexto]);
  const paraGuardar=useMemo(()=>({form,plan}),[form,plan]);
  useGuardadoDiferido(CLAVE,paraGuardar,setAviso);
  useEffect(()=>()=>{detener.current=true;},[]);
  useEffect(()=>{
    if(seleccion!==null&&editor.current){
      editor.current.focus({preventScroll:true});
      editor.current.scrollIntoView({block:'start',behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
    }
  },[seleccion]);
  const cambiar=(k,v)=>setForm(f=>({...f,[k]:v}));
  let rango=null;
  try{rango=form.modo==='mes'?rangoMes(form.mes):rangoCampana(form.inicio,Number(form.cantidad),form.unidad);}catch{/* Mostrar error al enviar. */}
  const totalPublicaciones=rango?(form.publicaciones===''?Math.min(366,rango.dias*(form.redes?.length||6),form.frecuencia?Math.max(1,Math.round(rango.dias*Number(form.frecuencia)/7)):cantidadAutomatica(rango.dias)):Number(form.publicaciones)):0;
  const perfilTexto={nombre:perfil.nombre,descripcion:perfil.descripcion,publico:perfil.publico,tono:perfil.tono,emojis:perfil.emojis,colores:perfil.colores,tipografias:perfil.tipografias,estilo_visual:perfil.estilo_visual,palabras_clave:perfil.palabras_clave,palabras_prohibidas:perfil.palabras_prohibidas,hashtags:perfil.hashtags,instrucciones:comportamiento?.instrucciones};
  const firma=JSON.stringify([5,form,perfilTexto]);
  const generar=async(reanudar=false)=>{
    if(ocupado.current||equipo.guardando||regenerando)return;
    setError('');
    const ajustes=reanudar&&plan?.contexto?plan.contexto:form;
    const marcaGeneracion=reanudar&&plan?.contexto?.perfil?plan.contexto.perfil:perfilTexto;
    let rango;
    try{rango=ajustes.modo==='mes'?rangoMes(ajustes.mes):rangoCampana(ajustes.inicio,Number(ajustes.cantidad),ajustes.unidad);}catch{return setError('Revisa las fechas de la campaña.');}
    const totalPublicaciones=reanudar?plan.totalPublicaciones:(ajustes.publicaciones===''?Math.min(366,rango.dias*(ajustes.redes?.length||6),ajustes.frecuencia?Math.max(1,Math.round(rango.dias*Number(ajustes.frecuencia)/7)):cantidadAutomatica(rango.dias)):Number(ajustes.publicaciones));
    const firma=reanudar?plan.firma:JSON.stringify([5,ajustes,marcaGeneracion]);
    if(ajustes.estrategia!=='tscp'&&!ajustes.redes?.length)return setError('Selecciona al menos una plataforma.');
    if(!rango)return setError('Elige una fecha y duración entre un día y un año.');
    if(ajustes.estrategia!=='tscp'&&!(ajustes.descripcion||marcaGeneracion.descripcion)?.trim())return setError('Cuéntanos qué hace tu marca en una frase.');
    if(ajustes.estrategia!=='tscp'&&(!Number.isInteger(totalPublicaciones)||totalPublicaciones<1||totalPublicaciones>366||totalPublicaciones>rango.dias*(ajustes.redes?.length||0)))return setError(`Elige entre 1 y ${Math.min(366,rango.dias*(ajustes.redes?.length||0))} publicaciones, o deja la cantidad en automático.`);
    try{fechasDelEquipo(ajustes.fechasImportantes,rango.inicio,rango.fin);}catch(e){return setError(e.message);}
    const maxDias=ajustes.estrategia==='tscp'?7:Math.max(1,Math.min(7,Math.floor(9*rango.dias/totalPublicaciones)));
    const periodos=dividirCampana(rango.inicio,rango.fin,maxDias);
    const cupos=ajustes.estrategia==='tscp'?[]:cuposPorBloque(periodos,totalPublicaciones);
    let siguiente=reanudar&&plan?.firma===firma?plan:{id:crypto.randomUUID(),nombre:`Campaña ${rango.inicio}`,contexto:{...ajustes,perfil:marcaGeneracion},inicio:rango.inicio,fin:rango.fin,zona:ajustes.zona,pais:ajustes.pais,region:ajustes.region,totalPublicaciones:ajustes.estrategia==='tscp'?null:totalPublicaciones,firma,bloques:[],totalBloques:periodos.length,publicaciones:[]};
    ocupado.current=true;setCargando(true);detener.current=false;
    let metricas=[];
    try{metricas=JSON.parse(localStorage.getItem('agente-feedback:marketing:v1'))?.metricas||[];}catch{/* Sin histórico opcional. */}
    try{
      if(!reanudar&&plan&&equipo.estaDisponible()&&(!plan._equipo||plan._equipo.pendiente))await equipo.guardar(plan);
      for(let i=siguiente.bloques.length;i<periodos.length;i++){
        if(detener.current)break;
        setProgreso(`Consultando fuentes y preparando bloque ${i+1} de ${periodos.length} (${periodos[i].inicio} a ${periodos[i].fin})…`);
        const bloque=await llamarApi('/api/plan-automatico',{...periodos[i],estrategia:ajustes.estrategia,idioma:ajustes.idioma,redes:ajustes.redes,publico:ajustes.publico,productos:ajustes.productos,presupuesto:ajustes.presupuesto,tono:ajustes.tono,fechasImportantes:ajustes.fechasImportantes,referencias:ajustes.referencias,origen:rango.inicio,finCampana:rango.fin,...(ajustes.estrategia==='tscp'?{}:{cantidadPublicaciones:cupos[i],totalPublicaciones}),pais:ajustes.pais,region:ajustes.region,zona:ajustes.zona,descripcion:ajustes.descripcion||(ajustes.estrategia==='tscp'?TSCP.descripcion:marcaGeneracion.descripcion||''),objetivo:ajustes.objetivo||(ajustes.estrategia==='tscp'?TSCP.objetivo:''),perfil:marcaGeneracion,metricas,temasAnteriores:siguiente.publicaciones.slice(-60).map(p=>p.titulo)});
        siguiente={...siguiente,...(siguiente._equipo?{_equipo:{...siguiente._equipo,pendiente:true}}:{}),bloques:[...siguiente.bloques,bloque],publicaciones:[...siguiente.publicaciones,...bloque.publicaciones],creado:bloque.creado};
        setPlan(siguiente);setMes(m=>m||bloque.inicio.slice(0,7));setSeleccion(null);setEditando(false);
        if(i===0)setMes(bloque.inicio.slice(0,7));
      }
    }catch(e){setError(e.message);}
    finally{if(siguiente.publicaciones.length&&equipo.estaDisponible()){try{await equipo.guardar(siguiente);}catch(e){setError(`El borrador se conserva en este navegador. No se pudo compartir: ${e.message}`);}}setCargando(false);ocupado.current=false;setProgreso(detener.current?'Generación detenida. Los bloques terminados se conservaron.':'');}
  };
  const meses=useMemo(()=>plan?[...new Set(dividirCampana(plan.inicio,plan.fin).map(b=>b.inicio.slice(0,7)))]:[],[plan?.inicio,plan?.fin]);
  const publicaciones=plan?.publicaciones||[];
  const porFecha=useMemo(()=>{
    const dias=new Map();
    publicaciones.forEach((p,indice)=>{
      if(!p.fecha.startsWith(mes)&&mes)return;
      if(red&&p.red!==red)return;
      if(estado&&(p.estado||'borrador')!==estado)return;
      if(!dias.has(p.fecha))dias.set(p.fecha,[]);
      dias.get(p.fecha).push({...p,indice});
    });
    return dias;
  },[publicaciones,mes,red,estado]);
  const bloqueVisible=plan?.bloques.find(b=>b.inicio.startsWith(mes))||plan?.bloques[0];
  const mesActivo=mes||meses[0];
  const dias=mesActivo?celdasMes(mesActivo):[];
  const publicacionesMes=publicaciones.filter(p=>p.fecha.startsWith(mesActivo||''));
  const redesMes=REDES.filter(r=>publicacionesMes.some(p=>p.red===r));
  const formatosMes=[...new Set(publicacionesMes.map(p=>p.formato))];
  const fuentesVisibles=[...(bloqueVisible?.evidencia?.estados||[])].sort((a,b)=>{
    const prioridad=s=>REDES.includes(s.fuente)?REDES.indexOf(s.fuente):REDES.length;
    return prioridad(a)-prioridad(b);
  });
  const pieza=seleccion!==null?publicaciones[seleccion]:null;
  const editar=cambios=>setPlan(p=>editarPublicacion(p,pieza.id,cambios));
  const regenerar=async(publicacionId,indicacion)=>{setRegenerando(true);try{const r=await equipo.guardar();return await llamarApi('/api/regenerar-publicacion',{id:r.plan.id,revision:r.revision,publicacionId,indicacion});}finally{setRegenerando(false);}};
  return <section className="marketing">
    <div className="marketing-hero"><div><span className="marketing-etiqueta">TU AGENTE DE MARKETING</span><h2>Tu estrategia, con el tiempo que necesites.</h2><p>Desde un día hasta un año de contenido. Cuéntanos a quién quieres llegar y el agente prepara el calendario con días, horas, formatos, textos y hashtags.</p></div><div className="marketing-sello">Investiga → Propone → Planifica</div></div>
    <form className="panel-card" onSubmit={e=>{e.preventDefault();generar();}}>
      <h3>¿Qué quieres impulsar y a quién quieres llegar?</h3>
      <label className="marketing-brief"><span>Tu idea en una frase{(perfil.descripcion||form.estrategia==='tscp')&&' · opcional'}</span><textarea disabled={cargando||equipo.guardando||regenerando} required={!perfil.descripcion&&form.estrategia!=='tscp'} maxLength={600} value={form.descripcion} onChange={e=>cambiar('descripcion',e.target.value)} placeholder={perfil.descripcion||'Ej. Una ONG de educación en Estados Unidos que busca donantes y voluntarios en Nueva York.'} /></label>
      {(perfil.descripcion||form.estrategia==='tscp')&&<p className="marketing-nota">Usamos {form.estrategia==='tscp'?'el brief TSCP':`el perfil guardado de ${perfil.nombre||'tu marca'}`}. Puedes añadir el enfoque de este mes.</p>}
      <div className="marketing-inicio-grid">
        <label>¿Para cuánto tiempo?<select disabled={cargando||equipo.guardando||regenerando} value={periodoSeleccionado(form)} onChange={e=>{const elegido=PERIODOS_CAMPANA.find(p=>p.id===e.target.value);setForm(f=>elegido?{...f,cantidad:elegido.cantidad,unidad:elegido.unidad,modo:'duracion'}:{...f,modo:e.target.value==='mes_completo'?'mes':'personalizado'});}}>{PERIODOS_CAMPANA.map(p=><option key={p.id} value={p.id}>{p.nombre}</option>)}<option value="personalizado">Otra duración</option><option value="mes_completo">Un mes del calendario</option></select></label>
        <label>¿Dónde está tu audiencia?<select disabled={cargando||equipo.guardando||regenerando} value={form.pais} onChange={e=>setForm(f=>({...f,pais:e.target.value,region:'',zona:zonaPais(e.target.value)}))}>{PAISES.map(([v,t])=><option key={v} value={v}>{t}</option>)}</select></label>
        <label>Publicaciones{form.estrategia==='tscp'?<input disabled value="Cadencia del brief TSCP" />:<input disabled={cargando||equipo.guardando||regenerando} type="number" min="1" max={rango?Math.min(366,rango.dias*(form.redes?.length||6)):366} step="1" value={form.publicaciones} onChange={e=>cambiar('publicaciones',e.target.value)} placeholder={rango?`Automático · ${totalPublicaciones}`:'Automático'} />}</label>
      </div>
      {form.modo==='mes'&&<label>Mes del calendario<input disabled={cargando||equipo.guardando||regenerando} required type="month" min="2020-01" max="2100-12" value={form.mes} onChange={e=>cambiar('mes',e.target.value)} /></label>}
      {periodoSeleccionado(form)==='personalizado'&&<div className="marketing-filtros"><label>Cantidad<input disabled={cargando||equipo.guardando||regenerando} type="number" min="1" max={MAXIMO_POR_UNIDAD[form.unidad]||366} step="1" required value={form.cantidad} onChange={e=>cambiar('cantidad',e.target.value)} /></label><label>Unidad<select disabled={cargando||equipo.guardando||regenerando} value={form.unidad} onChange={e=>setForm(f=>({...f,unidad:e.target.value,cantidad:Math.min(Number(f.cantidad)||1,MAXIMO_POR_UNIDAD[e.target.value])}))}>{[['dias','Días'],['semanas','Semanas'],['meses','Meses'],['anos','Año']].map(([v,t])=><option key={v} value={v}>{t}</option>)}</select></label></div>}
      <p className="marketing-nota">Mínimo: 1 día. Máximo: 1 año (hasta 366 días). Recomendamos empezar con 3 meses para organizar la campaña y revisar resultados cada semana. {form.modo!=='mes'&&`Empieza el ${form.inicio}; puedes ajustar la fecha en las opciones.`}</p>
      {rango?.dias>30&&<p className="marketing-nota">El primer mes sirve como plan de ejecución; los siguientes son una propuesta provisional. Vuelve a consultar las tendencias antes de publicar y ajusta el calendario según los resultados.</p>}
      <p className="marketing-nota">Prioridad: Facebook → Instagram → TikTok → X → LinkedIn → YouTube. Deja la cantidad vacía para que el agente distribuya unas cinco publicaciones semanales entre las redes.</p>
      <details className="marketing-preferencias"><summary>Ajustar objetivo, público, plataformas y otras preferencias</summary>
        <div className="marketing-form-grid">
          <label>Ciudad o región de la audiencia (opcional)<input disabled={cargando||equipo.guardando||regenerando} maxLength={120} value={form.region} onChange={e=>setForm(f=>({...f,region:e.target.value,zona:zonaPais(f.pais,e.target.value)}))} placeholder="Ej. Nueva York, California o Miami" /></label>
          <label>Zona horaria de publicación<input disabled={cargando||equipo.guardando||regenerando} required maxLength={80} value={form.zona} onChange={e=>cambiar('zona',e.target.value)} /><small>Revisa la zona si el país abarca varios husos horarios.</small></label>
          <label>¿Qué resultado buscas? (opcional)<input disabled={cargando||equipo.guardando||regenerando} maxLength={600} value={form.objetivo} onChange={e=>cambiar('objetivo',e.target.value)} placeholder="Ej. Visibilidad, reservas, ventas o donaciones" /></label>
          <label>Idioma del contenido<input disabled={cargando||equipo.guardando||regenerando} value={form.idioma||'Español'} maxLength={80} onChange={e=>cambiar('idioma',e.target.value)} /></label>
          <label>Estrategia<select disabled={cargando||equipo.guardando||regenerando} value={form.estrategia||'general'} onChange={e=>cambiar('estrategia',e.target.value)}><option value="general">Adaptada a mi marca y objetivo</option><option value="tscp">TSCP · flujo del equipo de marketing</option></select></label>
          {form.modo!=='mes'&&<label>Empezar el<input disabled={cargando||equipo.guardando||regenerando} required type="date" min="2020-01-01" max="2100-12-31" value={form.inicio} onChange={e=>cambiar('inicio',e.target.value)} /></label>}
        </div>
        <div className="marketing-form-grid">{[['publico','Público de esta campaña',perfil.publico||'Ej. Donantes y voluntarios'],['productos','Productos o servicios','Ej. Becas, talleres o acompañamiento'],['presupuesto','Presupuesto disponible','Ej. Sin pauta; producción interna'],['tono','Tono de la campaña',perfil.tono||'Usar el tono de la marca']].map(([c,t,placeholder])=><label key={c}>{t} (opcional)<input disabled={cargando||equipo.guardando||regenerando} maxLength={600} value={form[c]||''} placeholder={placeholder} onChange={e=>cambiar(c,e.target.value)}/></label>)}<label>Frecuencia orientativa<select disabled={cargando||equipo.guardando||regenerando||form.estrategia==='tscp'} value={form.frecuencia||''} onChange={e=>setForm(f=>({...f,frecuencia:e.target.value,publicaciones:''}))}><option value="">Automática · unas 5 por semana</option>{[1,2,3,7,10,14].map(n=><option key={n} value={n}>{n} publicaciones por semana</option>)}</select><small>Distribuidas entre las plataformas elegidas, hasta 366 por campaña.</small></label><label>Fechas importantes (opcional)<textarea disabled={cargando||equipo.guardando||regenerando} maxLength={2000} value={form.fechasImportantes||''} onChange={e=>cambiar('fechasImportantes',e.target.value)} placeholder="AAAA-MM-DD | Motivo (una fecha por línea)"/></label></div>
        <fieldset className="campana-plataformas" disabled={cargando||equipo.guardando||regenerando||form.estrategia==='tscp'}><legend>Plataformas de la campaña</legend>{REDES.map(r=><label key={r}><input type="checkbox" checked={form.redes?.includes(r)} onChange={e=>setForm(f=>({...f,redes:e.target.checked?REDES.filter(x=>x===r||f.redes.includes(x)):f.redes.filter(x=>x!==r)}))}/>{r}</label>)}</fieldset>
      </details>
      {(form.referencias||[]).length>0&&<details className="marketing-preferencias"><summary>{form.referencias.length} referencias seleccionadas del radar</summary>{form.referencias.map(r=><p key={r.url}><a href={r.url} target="_blank" rel="noopener noreferrer">{r.titulo}</a> <button className="btn-texto" type="button" disabled={cargando||equipo.guardando||regenerando} onClick={()=>cambiar('referencias',form.referencias.filter(x=>x.url!==r.url))}>Quitar</button></p>)}</details>}
      <div className="marketing-generar"><p>{rango?`${rango.inicio} → ${rango.fin} · ${form.estrategia==='tscp'?'Cadencia TSCP':`${totalPublicaciones} publicaciones`}`:'Elige el período de tu calendario'}<small>{PAISES.find(p=>p[0]===form.pais)?.[1]}{form.region&&` · ${form.region}`} · Horas en {form.zona}</small></p><div className="marketing-acciones"><button className="btn-guardar" disabled={cargando||equipo.guardando||regenerando||equipo.disponible===null}>{equipo.disponible===null?'Conectando con el equipo…':cargando?'Investigando y generando…':'Generar mi calendario'}</button>{!cargando&&(plan?.contexto||plan?.firma===firma)&&plan?.bloques.length<plan.totalBloques&&<button type="button" className="btn-secundario" onClick={()=>generar(true)}>Continuar bloques pendientes</button>}{cargando&&<button type="button" className="btn-secundario" onClick={()=>{detener.current=true;setProgreso('Se detendrá al finalizar el bloque en curso.');}}>Detener después de este bloque</button>}</div></div>
      <p className="marketing-nota">Consultamos fuentes al generar y mostramos el fundamento de cada sugerencia. Sin datos de actividad de tu audiencia, los horarios se identifican como pruebas. El contenido queda listo para revisar.</p>
      {plan&&<p className="marketing-nota">{equipo.disponible?'Antes de generar otra campaña guardamos la actual para el equipo.':'Exporta el calendario actual antes de generar otro mientras se configura la conexión compartida.'}</p>}
    </form>
    {(error||aviso)&&<p className="tendencias-error" role="alert">{error||aviso}</p>}<p role="status" aria-live="polite">{progreso}</p>
    <CampanasEquipo equipo={equipo} plan={plan} ocupado={cargando||regenerando} onAbrir={p=>{if(p.contexto)setForm(f=>({...f,...p.contexto}));setMes(p.inicio.slice(0,7));setSeleccion(null);setRed('');setEstado('');}} onNombre={nombre=>setPlan(p=>({...p,nombre,...(p._equipo?{_equipo:{...p._equipo,pendiente:true}}:{})}))}/>
    {plan&&<>
      <div className="campana-guardado" role="status">{equipo.guardando?'Guardando en el equipo…':plan._equipo&&!plan._equipo.pendiente?'Guardada para el equipo.':'Hay cambios sin compartir.'}{equipo.disponible&&<button type="button" className="btn-secundario" disabled={cargando||equipo.guardando||regenerando} onClick={async()=>{try{await equipo.guardar();setError('');}catch(e){setError(e.message);}}}>Guardar cambios</button>}</div>
      <div className="panel-card"><div className="marketing-acciones"><h3>Tu calendario · {publicaciones.length}{plan.totalPublicaciones?` de ${plan.totalPublicaciones}`:''} publicaciones</h3><button type="button" className="btn-secundario" onClick={()=>descargarArchivo(`calendario-${plan.inicio}.csv`,calendarioCsv(plan),'text/csv;charset=utf-8')}>Exportar a Excel (CSV)</button><button type="button" className="btn-secundario" onClick={()=>descargarArchivo(`plan-${plan.inicio}.json`,JSON.stringify(plan,null,2),'application/json')}>Descargar plan completo</button></div><p className="marketing-nota">{plan.inicio} → {plan.fin} · Horas en {plan.zona} · {plan.bloques.length}/{plan.totalBloques} bloques completados · Selecciona una publicación para ver el contenido y su explicación.</p><div className="marketing-filtros"><label>Mes<select value={mesActivo} onChange={e=>{setMes(e.target.value);setSeleccion(null);}}>{meses.map(m=><option key={m} value={m}>{nombreMes(m)}</option>)}</select></label><label>Red<select value={red} onChange={e=>{setRed(e.target.value);setSeleccion(null);}}><option value="">Todas</option>{REDES.filter(r=>publicaciones.some(p=>p.red===r)).map(r=><option key={r}>{r}</option>)}</select></label><label>Estado<select value={estado} onChange={e=>{setEstado(e.target.value);setSeleccion(null);}}><option value="">Todos</option>{Object.entries(ESTADOS_PUBLICACION).map(([v,t])=><option key={v} value={v}>{t}</option>)}</select></label></div>
        <div className="marketing-fuentes-estado" aria-label="Estado de las fuentes consultadas">{fuentesVisibles.map(s=><span className={s.estado==='Consultada'?'marketing-fuente-disponible':''} key={s.fuente}><strong>{s.fuente}</strong> · {s.estado}</span>)}</div>
        <div className="marketing-resumen-redes" aria-label="Publicaciones por plataforma este mes">{redesMes.map(r=><button type="button" key={r} aria-pressed={red===r} onClick={()=>{setRed(v=>v===r?'':r);setSeleccion(null);}}><strong>{publicacionesMes.filter(p=>p.red===r).length}</strong><span>{r}</span></button>)}</div>
        <p className="marketing-nota">Este mes: {publicacionesMes.length} publicaciones{formatosMes.length>0&&` · ${formatosMes.map(f=>`${publicacionesMes.filter(p=>p.formato===f).length} ${f}`).join(' · ')}`}</p>
        <details className="marketing-preferencias"><summary>Días y horas sugeridos por red</summary><p className="marketing-nota">Horarios de publicación en {plan.zona}. Las fuentes consultadas aportan contexto; la actividad de tu audiencia requiere estadísticas de tu cuenta. Selecciona una pieza para ver el fundamento de su horario.</p><div className="marketing-tabla"><table><thead><tr><th>Red</th><th>Publicaciones del mes</th><th>Días</th><th>Horas propuestas</th></tr></thead><tbody>{redesMes.map(r=>{const piezas=publicacionesMes.filter(p=>p.red===r);return <tr key={r}><td>{r}</td><td>{piezas.length}</td><td>{[...new Set(piezas.map(p=>new Date(`${p.fecha}T00:00:00Z`).getUTCDay()))].sort((a,b)=>a-b).map(d=>DIAS[d]).join(', ')}</td><td>{[...new Set(piezas.map(p=>p.hora))].sort().join(', ')}</td></tr>;})}</tbody></table></div></details>
        <div className="marketing-calendario-scroll" tabIndex="0" role="region" aria-label={`Calendario de ${nombreMes(mesActivo)}. Desplázate horizontalmente en pantallas pequeñas.`}><div className="marketing-calendario marketing-calendario-mensual">{DIAS.map(d=><div className="marketing-cabecera-dia" key={d}>{d}</div>)}{dias.map((d,i)=>d?<div className={`marketing-dia${d<plan.inicio||d>plan.fin?' marketing-dia-fuera':''}`} key={d}><span><time dateTime={d}>{Number(d.slice(-2))}</time></span>{(porFecha.get(d)||[]).map(p=><button type="button" key={p.indice} aria-pressed={seleccion===p.indice} aria-controls="marketing-pieza-editor" onClick={e=>{botonPieza.current=e.currentTarget;setSeleccion(p.indice);setEditando(false);}}><small>{p.hora} · {p.red}</small><strong>{p.formato}</strong><span>{p.titulo}</span><small>{ESTADOS_PUBLICACION[p.estado||'borrador']}</small></button>)}</div>:<div className="marketing-dia marketing-dia-vacio" key={`vacio-${i}`} aria-hidden="true" />)}</div></div>
        {!bloqueVisible?.inicio.startsWith(mesActivo)&&<p>Este mes aún no se generó. Continúa los bloques pendientes.</p>}
      </div>
      {pieza&&<PublicacionCampana pieza={pieza} plan={plan} ocupado={cargando||regenerando} equipo={equipo} editor={editor} onCambiar={editar} onAplicar={propuesta=>setPlan(p=>aplicarPropuesta(p,pieza.id,propuesta))} onRegenerar={regenerar} onUsar={onUsar} onCerrar={()=>{setSeleccion(null);botonPieza.current?.focus();}}/>}
      {plan.bloques[0]?.emails?.length>0&&<details className="panel-card"><summary>Emails de apoyo · 5 borradores en 20 días por contacto</summary><p>Para voluntarios que presentan TSCP a sus organizaciones. Confirmar lista autorizada, responsable y mecanismo de baja antes de enviar. El ciclo termina al responder o convertirse; no hay envío automático.</p>{plan.bloques[0].emails.map(e=><article key={e.dia}><h4>Día {e.dia} · {e.asunto}</h4><p>{e.condicion}</p><p style={{whiteSpace:'pre-wrap'}}>{e.copy}</p><p>{e.cta} · {e.url_cta}</p></article>)}</details>}
      {bloqueVisible?.flujo&&<details className="panel-card"><summary>Entrega al equipo y validaciones pendientes</summary><p>{bloqueVisible.flujo.pendiente}</p><p>Confirmar mercados y zonas de audiencia, enlaces de CTA, responsables y capacidad de producción. Revisar resultados semanalmente; adaptar temas y horarios cada mes. Medir clics UTM, consultas, reuniones y registros. Los enlaces propuestos no han sido comprobados automáticamente.</p></details>}
      {bloqueVisible&&<details className="panel-card"><summary><strong>Estrategia y fuentes consultadas</strong></summary><p className="marketing-estrategia">{bloqueVisible.estrategia}</p><ul>{bloqueVisible.experimentos.map((t,i)=><li key={i}>{t}</li>)}</ul><h4>Fuentes consultadas</h4><p className="marketing-nota">{bloqueVisible.evidencia.consultado} · {bloqueVisible.evidencia.limites}</p>{bloqueVisible.evidencia.estados.map(s=><p key={s.fuente}><a href={s.url} target="_blank" rel="noopener noreferrer">{s.fuente}</a> · {s.estado}<small>{s.detalle}</small></p>)}<details><summary>Ver señales y referencias reales</summary>{bloqueVisible.evidencia.tendencias.map((t,i)=><p key={i}>{t.tema} · Búsquedas aproximadas: {t.volumenAproximado||'No indicado'} · {t.fecha}</p>)}{bloqueVisible.evidencia.noticias.map(n=><p key={n.url}><a href={n.url} target="_blank" rel="noopener noreferrer">{n.titulo}</a></p>)}{bloqueVisible.evidencia.videos.map(v=><p key={v.url}><a href={v.url} target="_blank" rel="noopener noreferrer">{v.titulo}</a> · {v.vistas||'Sin dato'} vistas acumuladas</p>)}</details><h4>Oportunidades de temporada · no son tendencias medidas</h4>{bloqueVisible.eventos.map(e=><p key={e.fecha+e.nombre}>{e.fecha} · {e.nombre}<small>{e.tipo} {e.url&&<a href={e.url} target="_blank" rel="noopener noreferrer">Fuente</a>}</small></p>)}</details>}
    </>}
    <details className="panel-card" onToggle={e=>{if(e.currentTarget.open)setManualVisitado(true);}}><summary>Ajustes manuales e importar estadísticas (opcional)</summary><p className="marketing-nota">Si prefieres controlar cada día y horario o importar tu histórico, utiliza el modo manual. Las estadísticas importadas se usan automáticamente la próxima vez que generes un calendario.</p>{manualVisitado&&<Suspense fallback={<p>Cargando ajustes...</p>}><Marketing perfil={perfil} onUsar={onUsar} /></Suspense>}</details>
  </section>;
}
