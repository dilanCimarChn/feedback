import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { llamarApi } from '../lib/api';
import { rangoCampana, dividirCampana, DIAS, REDES, descargarArchivo, calendarioCsv } from '../lib/marketing';
import { PERIODOS_CAMPANA, MAXIMO_POR_UNIDAD, periodoSeleccionado, mesSiguiente, rangoMes, cantidadAutomatica, cuposPorBloque, celdasMes } from '../lib/planificacion';
import { useGuardadoDiferido } from '../lib/useGuardadoDiferido';
const Marketing = lazy(() => import('./Marketing'));
import { TSCP } from '../lib/tscp';

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
  const [form,setForm]=useState(()=>({inicio:hoy(),cantidad:3,unidad:'meses',pais:'US',zona:'America/New_York',estrategia:'general',idioma:'Español',descripcion:'',objetivo:'',region:'',publicaciones:'',mes:guardado.form?.inicio?.slice(0,7)||mesSiguiente(),modo:guardado.form?.inicio?'personalizado':'duracion',...guardado.form}));
  const [plan,setPlan]=useState(()=>Array.isArray(guardado.plan?.bloques)?guardado.plan:null);
  const [mes,setMes]=useState(guardado.plan?.inicio?.slice(0,7)||'');
  const [error,setError]=useState('');
  const [aviso,setAviso]=useState('');
  const [cargando,setCargando]=useState(false);
  const [progreso,setProgreso]=useState('');
  const [seleccion,setSeleccion]=useState(null);
  const [red,setRed]=useState('');
  const [editando,setEditando]=useState(false);
  const [manualVisitado,setManualVisitado]=useState(false);
  const detener=useRef(false);
  const ocupado=useRef(false);
  const editor=useRef(null);
  const botonPieza=useRef(null);
  useEffect(()=>{if(contexto?.texto&&!ocupado.current)setForm(f=>({...f,descripcion:contexto.texto}));},[contexto]);
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
  const totalPublicaciones=rango?(form.publicaciones===''?cantidadAutomatica(rango.dias):Number(form.publicaciones)):0;
  const perfilTexto={nombre:perfil.nombre,descripcion:perfil.descripcion,publico:perfil.publico,tono:perfil.tono,emojis:perfil.emojis,colores:perfil.colores,tipografias:perfil.tipografias,estilo_visual:perfil.estilo_visual,palabras_clave:perfil.palabras_clave,palabras_prohibidas:perfil.palabras_prohibidas,hashtags:perfil.hashtags,instrucciones:comportamiento?.instrucciones};
  const firma=JSON.stringify([4,form,perfilTexto]);
  const generar=async(reanudar=false)=>{
    if(ocupado.current)return;
    setError('');
    if(!rango)return setError('Elige una fecha y duración entre un día y un año.');
    if(form.estrategia!=='tscp'&&!(form.descripcion||perfil.descripcion)?.trim())return setError('Cuéntanos qué hace tu marca en una frase.');
    if(form.estrategia!=='tscp'&&(!Number.isInteger(totalPublicaciones)||totalPublicaciones<1||(form.publicaciones!==''&&totalPublicaciones>120)||totalPublicaciones>rango.dias*6))return setError(`Elige entre 1 y ${Math.min(120,rango.dias*6)} publicaciones, o deja la cantidad en automático.`);
    const maxDias=form.estrategia==='tscp'?7:Math.max(1,Math.min(7,Math.floor(9*rango.dias/totalPublicaciones)));
    const periodos=dividirCampana(rango.inicio,rango.fin,maxDias);
    const cupos=form.estrategia==='tscp'?[]:cuposPorBloque(periodos,totalPublicaciones);
    let siguiente=reanudar&&plan?.firma===firma?plan:{inicio:rango.inicio,fin:rango.fin,zona:form.zona,pais:form.pais,region:form.region,totalPublicaciones:form.estrategia==='tscp'?null:totalPublicaciones,firma,bloques:[],totalBloques:periodos.length,publicaciones:[]};
    ocupado.current=true;setCargando(true);detener.current=false;
    let metricas=[];
    try{metricas=JSON.parse(localStorage.getItem('agente-feedback:marketing:v1'))?.metricas||[];}catch{/* Sin histórico opcional. */}
    try{
      for(let i=siguiente.bloques.length;i<periodos.length;i++){
        if(detener.current)break;
        setProgreso(`Consultando fuentes y preparando bloque ${i+1} de ${periodos.length} (${periodos[i].inicio} a ${periodos[i].fin})…`);
        const bloque=await llamarApi('/api/plan-automatico',{...periodos[i],estrategia:form.estrategia,idioma:form.idioma,origen:rango.inicio,finCampana:rango.fin,...(form.estrategia==='tscp'?{}:{cantidadPublicaciones:cupos[i],totalPublicaciones}),pais:form.pais,region:form.region,zona:form.zona,descripcion:form.descripcion||(form.estrategia==='tscp'?TSCP.descripcion:perfil.descripcion||''),objetivo:form.objetivo||(form.estrategia==='tscp'?TSCP.objetivo:''),perfil:perfilTexto,metricas,temasAnteriores:siguiente.publicaciones.slice(-60).map(p=>p.titulo)});
        siguiente={...siguiente,bloques:[...siguiente.bloques,bloque],publicaciones:[...siguiente.publicaciones,...bloque.publicaciones],creado:bloque.creado};
        setPlan(siguiente);setMes(m=>m||bloque.inicio.slice(0,7));setSeleccion(null);setEditando(false);
        if(i===0)setMes(bloque.inicio.slice(0,7));
      }
    }catch(e){setError(e.message);}
    finally{setCargando(false);ocupado.current=false;setProgreso(detener.current?'Generación detenida. Los bloques terminados se conservaron.':'');}
  };
  const meses=useMemo(()=>plan?[...new Set(dividirCampana(plan.inicio,plan.fin).map(b=>b.inicio.slice(0,7)))]:[],[plan?.inicio,plan?.fin]);
  const publicaciones=plan?.publicaciones||[];
  const porFecha=useMemo(()=>{
    const dias=new Map();
    publicaciones.forEach((p,indice)=>{
      if(!p.fecha.startsWith(mes)&&mes)return;
      if(red&&p.red!==red)return;
      if(!dias.has(p.fecha))dias.set(p.fecha,[]);
      dias.get(p.fecha).push({...p,indice});
    });
    return dias;
  },[publicaciones,mes,red]);
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
  const editar=(c,v)=>setPlan(p=>({...p,publicaciones:p.publicaciones.map((fila,i)=>i===seleccion?{...fila,[c]:v}:fila)}));
  return <section className="marketing">
    <div className="marketing-hero"><div><span className="marketing-etiqueta">TU AGENTE DE MARKETING</span><h2>Tu estrategia, con el tiempo que necesites.</h2><p>Desde un día hasta un año de contenido. Cuéntanos a quién quieres llegar y el agente prepara el calendario con días, horas, formatos, textos y hashtags.</p></div><div className="marketing-sello">Investiga → Propone → Planifica</div></div>
    <form className="panel-card" onSubmit={e=>{e.preventDefault();generar();}}>
      <h3>¿Qué quieres impulsar y a quién quieres llegar?</h3>
      <label className="marketing-brief"><span>Tu idea en una frase{(perfil.descripcion||form.estrategia==='tscp')&&' · opcional'}</span><textarea disabled={cargando} required={!perfil.descripcion&&form.estrategia!=='tscp'} maxLength={600} value={form.descripcion} onChange={e=>cambiar('descripcion',e.target.value)} placeholder={perfil.descripcion||'Ej. Una ONG de educación en Estados Unidos que busca donantes y voluntarios en Nueva York.'} /></label>
      {(perfil.descripcion||form.estrategia==='tscp')&&<p className="marketing-nota">Usamos {form.estrategia==='tscp'?'el brief TSCP':`el perfil guardado de ${perfil.nombre||'tu marca'}`}. Puedes añadir el enfoque de este mes.</p>}
      <div className="marketing-inicio-grid">
        <label>¿Para cuánto tiempo?<select disabled={cargando} value={periodoSeleccionado(form)} onChange={e=>{const elegido=PERIODOS_CAMPANA.find(p=>p.id===e.target.value);setForm(f=>elegido?{...f,cantidad:elegido.cantidad,unidad:elegido.unidad,modo:'duracion'}:{...f,modo:e.target.value==='mes_completo'?'mes':'personalizado'});}}>{PERIODOS_CAMPANA.map(p=><option key={p.id} value={p.id}>{p.nombre}</option>)}<option value="personalizado">Otra duración</option><option value="mes_completo">Un mes del calendario</option></select></label>
        <label>¿Dónde está tu audiencia?<select disabled={cargando} value={form.pais} onChange={e=>setForm(f=>({...f,pais:e.target.value,region:'',zona:zonaPais(e.target.value)}))}>{PAISES.map(([v,t])=><option key={v} value={v}>{t}</option>)}</select></label>
        <label>Publicaciones{form.estrategia==='tscp'?<input disabled value="Cadencia del brief TSCP" />:<input disabled={cargando} type="number" min="1" max={rango?Math.min(120,rango.dias*6):120} step="1" value={form.publicaciones} onChange={e=>cambiar('publicaciones',e.target.value)} placeholder={rango?`Automático · ${cantidadAutomatica(rango.dias)}`:'Automático'} />}</label>
      </div>
      {form.modo==='mes'&&<label>Mes del calendario<input disabled={cargando} required type="month" min="2020-01" max="2100-12" value={form.mes} onChange={e=>cambiar('mes',e.target.value)} /></label>}
      {periodoSeleccionado(form)==='personalizado'&&<div className="marketing-filtros"><label>Cantidad<input disabled={cargando} type="number" min="1" max={MAXIMO_POR_UNIDAD[form.unidad]||366} step="1" required value={form.cantidad} onChange={e=>cambiar('cantidad',e.target.value)} /></label><label>Unidad<select disabled={cargando} value={form.unidad} onChange={e=>setForm(f=>({...f,unidad:e.target.value,cantidad:Math.min(Number(f.cantidad)||1,MAXIMO_POR_UNIDAD[e.target.value])}))}>{[['dias','Días'],['semanas','Semanas'],['meses','Meses'],['anos','Año']].map(([v,t])=><option key={v} value={v}>{t}</option>)}</select></label></div>}
      <p className="marketing-nota">Mínimo: 1 día. Máximo: 1 año (hasta 366 días). Recomendamos empezar con 3 meses para organizar la campaña y revisar resultados cada semana. {form.modo!=='mes'&&`Empieza el ${form.inicio}; puedes ajustar la fecha en las opciones.`}</p>
      {rango?.dias>30&&<p className="marketing-nota">El primer mes sirve como plan de ejecución; los siguientes son una propuesta provisional. Vuelve a consultar las tendencias antes de publicar y ajusta el calendario según los resultados.</p>}
      <p className="marketing-nota">Prioridad: Facebook → Instagram → TikTok → X → LinkedIn → YouTube. Deja la cantidad vacía para que el agente distribuya unas cinco publicaciones semanales entre las redes.</p>
      <details className="marketing-preferencias"><summary>Ajustar fecha, ciudad, objetivo o idioma</summary>
        <div className="marketing-form-grid">
          <label>Ciudad o región de la audiencia (opcional)<input disabled={cargando} maxLength={120} value={form.region} onChange={e=>setForm(f=>({...f,region:e.target.value,zona:zonaPais(f.pais,e.target.value)}))} placeholder="Ej. Nueva York, California o Miami" /></label>
          <label>Zona horaria de publicación<input disabled={cargando} required maxLength={80} value={form.zona} onChange={e=>cambiar('zona',e.target.value)} /><small>Revisa la zona si el país abarca varios husos horarios.</small></label>
          <label>¿Qué resultado buscas? (opcional)<input disabled={cargando} maxLength={600} value={form.objetivo} onChange={e=>cambiar('objetivo',e.target.value)} placeholder="Ej. Visibilidad, reservas, ventas o donaciones" /></label>
          <label>Idioma del contenido<input disabled={cargando} value={form.idioma||'Español'} maxLength={80} onChange={e=>cambiar('idioma',e.target.value)} /></label>
          <label>Estrategia<select disabled={cargando} value={form.estrategia||'general'} onChange={e=>cambiar('estrategia',e.target.value)}><option value="general">Adaptada a mi marca y objetivo</option><option value="tscp">TSCP · flujo del equipo de marketing</option></select></label>
          {form.modo!=='mes'&&<label>Empezar el<input disabled={cargando} required type="date" min="2020-01-01" max="2100-12-31" value={form.inicio} onChange={e=>cambiar('inicio',e.target.value)} /></label>}
        </div>
      </details>
      <div className="marketing-generar"><p>{rango?`${rango.inicio} → ${rango.fin} · ${form.estrategia==='tscp'?'Cadencia TSCP':`${totalPublicaciones} publicaciones`}`:'Elige el período de tu calendario'}<small>{PAISES.find(p=>p[0]===form.pais)?.[1]}{form.region&&` · ${form.region}`} · Horas en {form.zona}</small></p><div className="marketing-acciones"><button className="btn-guardar" disabled={cargando}>{cargando?'Investigando y generando…':'Generar mi calendario'}</button>{!cargando&&plan?.firma===firma&&plan.bloques.length<plan.totalBloques&&<button type="button" className="btn-secundario" onClick={()=>generar(true)}>Continuar bloques pendientes</button>}{cargando&&<button type="button" className="btn-secundario" onClick={()=>{detener.current=true;setProgreso('Se detendrá al finalizar el bloque en curso.');}}>Detener después de este bloque</button>}</div></div>
      <p className="marketing-nota">Consultamos fuentes al generar y mostramos el fundamento de cada sugerencia. Sin datos de actividad de tu audiencia, los horarios se identifican como pruebas. El contenido queda listo para revisar.</p>
      {plan&&<p className="marketing-nota">Al generar de nuevo se reemplaza el calendario actual. Expórtalo si quieres conservarlo.</p>}
    </form>
    {(error||aviso)&&<p className="tendencias-error" role="alert">{error||aviso}</p>}<p role="status" aria-live="polite">{progreso}</p>
    {plan&&<>
      <div className="panel-card"><div className="marketing-acciones"><h3>Tu calendario · {publicaciones.length}{plan.totalPublicaciones?` de ${plan.totalPublicaciones}`:''} publicaciones</h3><button type="button" className="btn-secundario" onClick={()=>descargarArchivo(`calendario-${plan.inicio}.csv`,calendarioCsv(plan),'text/csv;charset=utf-8')}>Exportar a Excel (CSV)</button><button type="button" className="btn-secundario" onClick={()=>descargarArchivo(`plan-${plan.inicio}.json`,JSON.stringify(plan,null,2),'application/json')}>Descargar plan completo</button></div><p className="marketing-nota">{plan.inicio} → {plan.fin} · Horas en {plan.zona} · {plan.bloques.length}/{plan.totalBloques} bloques completados · Selecciona una publicación para ver el contenido y su explicación.</p><div className="marketing-filtros"><label>Mes<select value={mesActivo} onChange={e=>{setMes(e.target.value);setSeleccion(null);}}>{meses.map(m=><option key={m} value={m}>{nombreMes(m)}</option>)}</select></label><label>Red<select value={red} onChange={e=>{setRed(e.target.value);setSeleccion(null);}}><option value="">Todas</option>{REDES.filter(r=>publicaciones.some(p=>p.red===r)).map(r=><option key={r}>{r}</option>)}</select></label></div>
        <div className="marketing-fuentes-estado" aria-label="Estado de las fuentes consultadas">{fuentesVisibles.map(s=><span className={s.estado==='Consultada'?'marketing-fuente-disponible':''} key={s.fuente}><strong>{s.fuente}</strong> · {s.estado}</span>)}</div>
        <div className="marketing-resumen-redes" aria-label="Publicaciones por plataforma este mes">{redesMes.map(r=><button type="button" key={r} aria-pressed={red===r} onClick={()=>{setRed(v=>v===r?'':r);setSeleccion(null);}}><strong>{publicacionesMes.filter(p=>p.red===r).length}</strong><span>{r}</span></button>)}</div>
        <p className="marketing-nota">Este mes: {publicacionesMes.length} publicaciones{formatosMes.length>0&&` · ${formatosMes.map(f=>`${publicacionesMes.filter(p=>p.formato===f).length} ${f}`).join(' · ')}`}</p>
        <details className="marketing-preferencias"><summary>Días y horas sugeridos por red</summary><p className="marketing-nota">Horarios de publicación en {plan.zona}. Las fuentes consultadas aportan contexto; la actividad de tu audiencia requiere estadísticas de tu cuenta. Selecciona una pieza para ver el fundamento de su horario.</p><div className="marketing-tabla"><table><thead><tr><th>Red</th><th>Publicaciones del mes</th><th>Días</th><th>Horas propuestas</th></tr></thead><tbody>{redesMes.map(r=>{const piezas=publicacionesMes.filter(p=>p.red===r);return <tr key={r}><td>{r}</td><td>{piezas.length}</td><td>{[...new Set(piezas.map(p=>new Date(`${p.fecha}T00:00:00Z`).getUTCDay()))].sort((a,b)=>a-b).map(d=>DIAS[d]).join(', ')}</td><td>{[...new Set(piezas.map(p=>p.hora))].sort().join(', ')}</td></tr>;})}</tbody></table></div></details>
        <div className="marketing-calendario-scroll" tabIndex="0" role="region" aria-label={`Calendario de ${nombreMes(mesActivo)}. Desplázate horizontalmente en pantallas pequeñas.`}><div className="marketing-calendario marketing-calendario-mensual">{DIAS.map(d=><div className="marketing-cabecera-dia" key={d}>{d}</div>)}{dias.map((d,i)=>d?<div className={`marketing-dia${d<plan.inicio||d>plan.fin?' marketing-dia-fuera':''}`} key={d}><span><time dateTime={d}>{Number(d.slice(-2))}</time></span>{(porFecha.get(d)||[]).map(p=><button type="button" key={p.indice} aria-pressed={seleccion===p.indice} aria-controls="marketing-pieza-editor" onClick={e=>{botonPieza.current=e.currentTarget;setSeleccion(p.indice);setEditando(false);}}><small>{p.hora} · {p.red}</small><strong>{p.formato}</strong><span>{p.titulo}</span></button>)}</div>:<div className="marketing-dia marketing-dia-vacio" key={`vacio-${i}`} aria-hidden="true" />)}</div></div>
        {!bloqueVisible?.inicio.startsWith(mesActivo)&&<p>Este mes aún no se generó. Continúa los bloques pendientes.</p>}
      </div>
      {pieza&&<div className="panel-card marketing-editor" id="marketing-pieza-editor" ref={editor} tabIndex={-1} aria-label={`Detalle de ${pieza.titulo}`}>
        <div className="marketing-acciones"><h3>{pieza.titulo}</h3><button type="button" className="btn-texto" onClick={()=>{setSeleccion(null);setEditando(false);botonPieza.current?.focus();}}>Cerrar</button></div>
        <p className="marketing-nota">{DIAS[new Date(`${pieza.fecha}T00:00:00Z`).getUTCDay()]} {pieza.fecha} · {pieza.hora} ({plan.zona}) · {pieza.red} · {pieza.formato}</p>
        {pieza.base_contenido&&<p className="marketing-nota">{pieza.base_contenido}</p>}
        <div className="marketing-pieza-resumen"><div><h4>Qué producir</h4><p>{pieza.guion}</p><h4>Texto propuesto</h4><p className="marketing-copy">{pieza.copy}</p><h4>Hashtags sugeridos</h4><p>{pieza.hashtags.join(' ')||'Prioriza las palabras clave del contenido.'}</p>{pieza.criterio_hashtags&&<p className="marketing-nota">{pieza.criterio_hashtags}</p>}<p><strong>{pieza.cta}</strong></p>{pieza.url_cta&&<p className="marketing-nota">Enlace CTA: {pieza.url_cta}</p>}</div><div><h4>Por qué esta publicación</h4><p>{pieza.motivo}</p><h4>Por qué este horario</h4><p className="marketing-nota">{pieza.base_horario}</p><h4>Idea visual</h4><p>{pieza.visual}</p>{pieza.herramienta&&<div className="marketing-herramienta"><h4>Herramienta sugerida</h4><p>{pieza.herramienta.url?<a href={pieza.herramienta.url} target="_blank" rel="noopener noreferrer">{pieza.herramienta.nombre}</a>:pieza.herramienta.nombre}</p><p>{pieza.herramienta.uso}</p></div>}<h4>Dónde compartir</h4><p>{pieza.distribucion}</p></div></div>
        <div className="marketing-acciones"><button type="button" className="btn-guardar" onClick={()=>onUsar([pieza.copy,pieza.hashtags.join(' '),pieza.cta].join('\n\n'))}>Revisar con mi marca</button><button type="button" className="btn-secundario" aria-expanded={editando} onClick={()=>setEditando(v=>!v)}>{editando?'Terminar edición':'Editar contenido'}</button></div>
        {editando&&<div className="marketing-form-grid">{[['guion','Qué producir'],['copy','Texto'],['cta','Llamada a la acción'],['visual','Idea visual'],['distribucion','Dónde compartir']].map(([c,t])=><label key={c}>{t}<textarea disabled={cargando} value={pieza[c]} onChange={e=>editar(c,e.target.value)} /></label>)}<label>Hashtags<textarea disabled={cargando} value={pieza.hashtags.join(' ')} onChange={e=>editar('hashtags',e.target.value.split(/\s+/).filter(Boolean))} /></label></div>}
        <details className="marketing-preferencias"><summary>Qué medir y fuentes de esta publicación</summary><p>{pieza.metrica}</p>{pieza.referencias?.map(r=><p key={r.id}>{r.url?<a href={r.url} target="_blank" rel="noopener noreferrer">{r.titulo}</a>:r.titulo}<small>{r.fuente} · {r.tipo}</small></p>)}{pieza.campana&&<p>{pieza.campana} · {pieza.proposito} · {pieza.publico_objetivo}<br />{pieza.pilar} · {pieza.mensaje}</p>}<p>Palabras clave: {pieza.palabras_clave.join(', ')}</p></details>
      </div>}
      {plan.bloques[0]?.emails?.length>0&&<details className="panel-card"><summary>Emails de apoyo · 5 borradores en 20 días por contacto</summary><p>Para voluntarios que presentan TSCP a sus organizaciones. Confirmar lista autorizada, responsable y mecanismo de baja antes de enviar. El ciclo termina al responder o convertirse; no hay envío automático.</p>{plan.bloques[0].emails.map(e=><article key={e.dia}><h4>Día {e.dia} · {e.asunto}</h4><p>{e.condicion}</p><p style={{whiteSpace:'pre-wrap'}}>{e.copy}</p><p>{e.cta} · {e.url_cta}</p></article>)}</details>}
      {bloqueVisible?.flujo&&<details className="panel-card"><summary>Entrega al equipo y validaciones pendientes</summary><p>{bloqueVisible.flujo.pendiente}</p><p>Confirmar mercados y zonas de audiencia, enlaces de CTA, responsables y capacidad de producción. Revisar resultados semanalmente; adaptar temas y horarios cada mes. Medir clics UTM, consultas, reuniones y registros. Los enlaces propuestos no han sido comprobados automáticamente.</p></details>}
      {bloqueVisible&&<details className="panel-card"><summary><strong>Estrategia y fuentes consultadas</strong></summary><p className="marketing-estrategia">{bloqueVisible.estrategia}</p><ul>{bloqueVisible.experimentos.map((t,i)=><li key={i}>{t}</li>)}</ul><h4>Fuentes consultadas</h4><p className="marketing-nota">{bloqueVisible.evidencia.consultado} · {bloqueVisible.evidencia.limites}</p>{bloqueVisible.evidencia.estados.map(s=><p key={s.fuente}><a href={s.url} target="_blank" rel="noopener noreferrer">{s.fuente}</a> · {s.estado}<small>{s.detalle}</small></p>)}<details><summary>Ver señales y referencias reales</summary>{bloqueVisible.evidencia.tendencias.map((t,i)=><p key={i}>{t.tema} · Búsquedas aproximadas: {t.volumenAproximado||'No indicado'} · {t.fecha}</p>)}{bloqueVisible.evidencia.noticias.map(n=><p key={n.url}><a href={n.url} target="_blank" rel="noopener noreferrer">{n.titulo}</a></p>)}{bloqueVisible.evidencia.videos.map(v=><p key={v.url}><a href={v.url} target="_blank" rel="noopener noreferrer">{v.titulo}</a> · {v.vistas||'Sin dato'} vistas acumuladas</p>)}</details><h4>Oportunidades de temporada · no son tendencias medidas</h4>{bloqueVisible.eventos.map(e=><p key={e.fecha+e.nombre}>{e.fecha} · {e.nombre}<small>{e.tipo} {e.url&&<a href={e.url} target="_blank" rel="noopener noreferrer">Fuente</a>}</small></p>)}</details>}
    </>}
    <details className="panel-card" onToggle={e=>{if(e.currentTarget.open)setManualVisitado(true);}}><summary>Ajustes manuales e importar estadísticas (opcional)</summary><p className="marketing-nota">Si prefieres controlar cada día y horario o importar tu histórico, utiliza el modo manual. Las estadísticas importadas se usan automáticamente la próxima vez que generes un calendario.</p>{manualVisitado&&<Suspense fallback={<p>Cargando ajustes...</p>}><Marketing perfil={perfil} onUsar={onUsar} /></Suspense>}</details>
  </section>;
}
