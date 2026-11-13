import { useEffect, useRef, useState } from 'react';
import { llamarApi } from '../lib/api';
import { rangoCampana, dividirCampana, DIAS, descargarArchivo, calendarioCsv } from '../lib/marketing';
import Marketing from './Marketing';
import { TSCP } from '../lib/tscp';

const CLAVE='agente-feedback:automatico:v1';
function leer() {try{return JSON.parse(localStorage.getItem(CLAVE)) || {};}catch{return {};}}
function hoy() {const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
const PAISES=[['BO','Bolivia','America/La_Paz'],['AR','Argentina','America/Argentina/Buenos_Aires'],['CL','Chile','America/Santiago'],['CO','Colombia','America/Bogota'],['MX','México','America/Mexico_City'],['PE','Perú','America/Lima'],['ES','España','Europe/Madrid'],['US','Estados Unidos','America/New_York'],['CA','Canadá','America/Toronto'],['GB','Reino Unido','Europe/London'],['DE','Alemania','Europe/Berlin'],['FR','Francia','Europe/Paris'],['BR','Brasil','America/Sao_Paulo'],['IN','India','Asia/Kolkata'],['AU','Australia','Australia/Sydney'],['ZA','Sudáfrica','Africa/Johannesburg'],['KE','Kenia','Africa/Nairobi']];

export default function MarketingAutomatico({perfil,comportamiento,contexto,onUsar}) {
  const [guardado]=useState(leer);
  const [form,setForm]=useState(()=>({inicio:hoy(),cantidad:3,unidad:'meses',pais:'US',zona:'America/New_York',estrategia:'tscp',idioma:'English',descripcion:'',objetivo:'',...guardado.form}));
  const [plan,setPlan]=useState(()=>Array.isArray(guardado.plan?.bloques)?guardado.plan:null);
  const [mes,setMes]=useState(guardado.plan?.inicio?.slice(0,7)||'');
  const [error,setError]=useState('');
  const [aviso,setAviso]=useState('');
  const [cargando,setCargando]=useState(false);
  const [progreso,setProgreso]=useState('');
  const [seleccion,setSeleccion]=useState(null);
  const [red,setRed]=useState('');
  const detener=useRef(false);
  const ocupado=useRef(false);
  useEffect(()=>{if(contexto?.texto&&!ocupado.current)setForm(f=>({...f,descripcion:contexto.texto}));},[contexto]);
  useEffect(()=>{try{localStorage.setItem(CLAVE,JSON.stringify({form,plan}));setAviso('');}catch{setAviso('No se pudo guardar en este navegador. Exporta para conservar el calendario.');}},[form,plan]);
  useEffect(()=>()=>{detener.current=true;},[]);
  const cambiar=(k,v)=>setForm(f=>({...f,[k]:v}));
  let rango=null;
  try{rango=rangoCampana(form.inicio,Number(form.cantidad),form.unidad);}catch{/* Mostrar error al enviar. */}
  const perfilTexto={nombre:perfil.nombre,descripcion:perfil.descripcion,publico:perfil.publico,tono:perfil.tono,emojis:perfil.emojis,colores:perfil.colores,tipografias:perfil.tipografias,estilo_visual:perfil.estilo_visual,palabras_clave:perfil.palabras_clave,palabras_prohibidas:perfil.palabras_prohibidas,hashtags:perfil.hashtags,instrucciones:comportamiento?.instrucciones};
  const firma=JSON.stringify([form,perfilTexto]);
  const generar=async(reanudar=false)=>{
    if(ocupado.current)return;
    setError('');
    if(!rango)return setError('Elige una fecha y duración entre un día y un año.');
    if(form.estrategia!=='tscp'&&!(form.descripcion||perfil.descripcion)?.trim())return setError('Cuéntanos qué hace tu marca en una frase.');
    const periodos=dividirCampana(rango.inicio,rango.fin);
    let siguiente=reanudar&&plan?.firma===firma?plan:{inicio:rango.inicio,fin:rango.fin,zona:form.zona,firma,bloques:[],totalBloques:periodos.length,publicaciones:[]};
    ocupado.current=true;setCargando(true);detener.current=false;
    let metricas=[];
    try{metricas=JSON.parse(localStorage.getItem('agente-feedback:marketing:v1'))?.metricas||[];}catch{/* Sin histórico opcional. */}
    try{
      for(let i=siguiente.bloques.length;i<periodos.length;i++){
        if(detener.current)break;
        setProgreso(`Consultando fuentes y preparando bloque ${i+1} de ${periodos.length} (${periodos[i].inicio} a ${periodos[i].fin})…`);
        const bloque=await llamarApi('/api/plan-automatico',{...periodos[i],estrategia:form.estrategia,idioma:form.idioma,origen:rango.inicio,pais:form.pais,zona:form.zona,descripcion:form.descripcion||(form.estrategia==='tscp'?TSCP.descripcion:''),objetivo:form.objetivo||(form.estrategia==='tscp'?TSCP.objetivo:''),perfil:perfilTexto,metricas,temasAnteriores:siguiente.publicaciones.slice(-60).map(p=>p.titulo)});
        siguiente={...siguiente,bloques:[...siguiente.bloques,bloque],publicaciones:[...siguiente.publicaciones,...bloque.publicaciones],creado:bloque.creado};
        setPlan(siguiente);setMes(m=>m||bloque.inicio.slice(0,7));setSeleccion(null);
        if(i===0)setMes(bloque.inicio.slice(0,7));
      }
    }catch(e){setError(e.message);}
    finally{setCargando(false);ocupado.current=false;setProgreso(detener.current?'Generación detenida. Los bloques terminados se conservaron.':'');}
  };
  const meses=plan?dividirCampana(plan.inicio,plan.fin).map(b=>b.inicio.slice(0,7)):[];
  const publicaciones=plan?.publicaciones||[];
  const visibles=publicaciones.map((p,i)=>({...p,indice:i})).filter(p=>p.fecha.startsWith(mes)&&(!red||p.red===red));
  const bloqueVisible=plan?.bloques.find(b=>b.inicio.startsWith(mes))||plan?.bloques[0];
  const mesActivo=mes||meses[0];
  const dias=mesActivo?Array.from({length:new Date(Number(mesActivo.slice(0,4)),Number(mesActivo.slice(5)),0).getDate()},(_,i)=>`${mesActivo}-${String(i+1).padStart(2,'0')}`).filter(d=>d>=plan.inicio&&d<=plan.fin):[];
  const pieza=seleccion!==null?publicaciones[seleccion]:null;
  const editar=(c,v)=>setPlan(p=>({...p,publicaciones:p.publicaciones.map((fila,i)=>i===seleccion?{...fila,[c]:v}:fila)}));
  return <section className="marketing">
    <div className="marketing-hero"><div><span className="marketing-etiqueta">TU AGENTE DE MARKETING</span><h2>Tu próximo contenido, listo para revisar.</h2><p>El agente sigue el flujo de marketing: revisa tendencias disponibles, propone ideas y prepara los textos y el calendario.</p></div><div className="marketing-sello">Investiga → Propone → Planifica</div></div>
    <form className="panel-card" onSubmit={e=>{e.preventDefault();generar();}}>
      <h3>Elige el período y genera</h3>
      <div className="marketing-duracion">{[[1,'semanas','Una semana'],[1,'meses','Un mes'],[3,'meses','Tres meses'],[1,'anos','Un año']].map(([n,u,t])=><button type="button" key={t} aria-pressed={Number(form.cantidad)===n&&form.unidad===u} disabled={cargando} onClick={()=>setForm(f=>({...f,cantidad:n,unidad:u}))}>{t}</button>)}</div>
      {!perfil.descripcion&&form.estrategia!=='tscp'&&<label>¿Qué hace tu marca?<input disabled={cargando} required maxLength={600} value={form.descripcion} onChange={e=>cambiar('descripcion',e.target.value)} placeholder="Ej. ONG de educación en La Paz, o cafetería artesanal para familias" /></label>}
      <p className="marketing-nota">{form.estrategia==='tscp'?'TSCP · Captación de ONGs · Redes sociales y emails de apoyo':perfil.nombre||'Tu marca'} · Usamos el perfil y el contexto guardados.</p>
      {(perfil.descripcion||form.estrategia==='tscp')&&<label>¿Algo que debamos tener en cuenta? <span className="marketing-nota">Opcional</span><input disabled={cargando} maxLength={600} value={form.descripcion} onChange={e=>cambiar('descripcion',e.target.value)} placeholder="Ej. Priorizar el onboarding de ONGs esta semana" /></label>}
      <details className="marketing-preferencias"><summary>Ajustar fecha, idioma y otras opciones</summary>      <div className="marketing-filtros"><label>O personaliza<input disabled={cargando} type="number" min="1" max="366" required value={form.cantidad} onChange={e=>cambiar('cantidad',e.target.value)} /></label><label>Duración<select disabled={cargando} value={form.unidad} onChange={e=>cambiar('unidad',e.target.value)}>{[['dias','Días'],['semanas','Semanas'],['meses','Meses'],['anos','Año']].map(([v,t])=><option key={v} value={v}>{t}</option>)}</select></label></div>
<div className="marketing-form-grid"><label>Estrategia<select disabled={cargando} value={form.estrategia||'general'} onChange={e=>cambiar('estrategia',e.target.value)}><option value="tscp">TSCP · flujo del equipo de marketing</option><option value="general">Otra marca</option></select></label><label>Idioma del contenido<input disabled={cargando} value={form.idioma||'English'} maxLength={80} onChange={e=>cambiar('idioma',e.target.value)} /></label><label>Empezar el<input disabled={cargando} required type="date" min="2020-01-01" max="2100-12-31" value={form.inicio} onChange={e=>cambiar('inicio',e.target.value)} /></label><label>País de la audiencia<select disabled={cargando} value={form.pais} onChange={e=>setForm(f=>({...f,pais:e.target.value,zona:PAISES.find(p=>p[0]===e.target.value)[2]}))}>{PAISES.map(([v,t])=><option key={v} value={v}>{t}</option>)}</select></label><label>Zona horaria<input disabled={cargando} required maxLength={80} value={form.zona} onChange={e=>cambiar('zona',e.target.value)} /></label><label>¿Algo que quieras impulsar? (opcional)<input disabled={cargando} maxLength={600} value={form.objetivo} onChange={e=>cambiar('objetivo',e.target.value)} placeholder="El agente puede recomendar el objetivo" /></label></div></details>
      <div className="marketing-generar"><p>{rango?`${rango.inicio} → ${rango.fin} · ${rango.dias} días`:'Hasta un año de planificación'}<small>{PAISES.find(p=>p[0]===form.pais)?.[1]} · {form.zona} · El agente propone días, horas y redes.</small></p><div className="marketing-acciones"><button className="btn-guardar" disabled={cargando}>{cargando?'Investigando y generando…':'Generar mi calendario'}</button>{!cargando&&plan?.firma===firma&&plan.bloques.length<plan.totalBloques&&<button type="button" className="btn-secundario" onClick={()=>generar(true)}>Continuar bloques pendientes</button>}{cargando&&<button type="button" className="btn-secundario" onClick={()=>{detener.current=true;setProgreso('Se detendrá al finalizar el bloque en curso.');}}>Detener después de este bloque</button>}</div></div>
      <p className="marketing-nota">Las tendencias se consultan al generar. Sin datos disponibles, se proponen ideas editoriales y horarios de prueba. El contenido queda pendiente de revisión.</p>
      {plan&&<p className="marketing-nota">Al generar de nuevo se reemplaza el calendario actual. Expórtalo si quieres conservarlo.</p>}
    </form>
    {(error||aviso)&&<p className="tendencias-error" role="alert">{error||aviso}</p>}<p role="status" aria-live="polite">{progreso}</p>
    {plan&&<>
      <div className="panel-card"><div className="marketing-acciones"><h3>Tu calendario · {publicaciones.length} publicaciones</h3><button type="button" className="btn-secundario" onClick={()=>descargarArchivo(`calendario-${plan.inicio}.csv`,calendarioCsv(plan),'text/csv;charset=utf-8')}>Exportar a Excel (CSV)</button><button type="button" className="btn-secundario" onClick={()=>descargarArchivo(`plan-${plan.inicio}.json`,JSON.stringify(plan,null,2),'application/json')}>Descargar plan completo</button></div><p className="marketing-nota">{plan.inicio} → {plan.fin} · {plan.zona} · {plan.bloques.length}/{plan.totalBloques} bloques completados · Propuesta pendiente de aprobación, sin publicación automática.</p><div className="marketing-filtros"><label>Mes<select value={mesActivo} onChange={e=>{setMes(e.target.value);setSeleccion(null);}}>{meses.map(m=><option key={m}>{m}</option>)}</select></label><label>Red<select value={red} onChange={e=>setRed(e.target.value)}><option value="">Todas</option>{[...new Set(publicaciones.map(p=>p.red))].map(r=><option key={r}>{r}</option>)}</select></label></div>
        <div className="marketing-calendario">{dias.map(d=><div className="marketing-dia" key={d}><span>{DIAS[new Date(`${d}T12:00:00Z`).getUTCDay()]} {Number(d.slice(-2))}</span>{visibles.filter(p=>p.fecha===d).map(p=><button type="button" key={p.indice} onClick={()=>setSeleccion(p.indice)}><small>{p.hora} · {p.red}</small><strong>{p.formato}</strong><span>{p.titulo}</span></button>)}</div>)}</div>
        {!bloqueVisible?.inicio.startsWith(mesActivo)&&<p>Este mes aún no se generó. Continúa los bloques pendientes.</p>}
      </div>
      {pieza&&<div className="panel-card marketing-editor"><div className="marketing-acciones"><h3>{pieza.titulo}</h3><button type="button" className="btn-texto" onClick={()=>setSeleccion(null)}>Cerrar</button></div><p>{pieza.fecha} · {pieza.hora} · {pieza.red} · {pieza.formato}</p><p className="marketing-nota">Horario: {pieza.base_horario}</p>{pieza.campana&&<p>{pieza.campana} ? {pieza.proposito} ? {pieza.publico_objetivo}<br />{pieza.pilar} ? {pieza.mensaje}<br />Enlace CTA: {pieza.url_cta}</p>}<div className="marketing-form-grid">{[['guion','Qué producir'],['copy','Copy'],['cta','Llamada a la acción'],['visual','Colores, tipografía y composición'],['distribucion','Dónde compartir'],['motivo','Por qué esta pieza'],['metrica','Qué medir']].map(([c,t])=><label key={c}>{t}<textarea disabled={cargando} value={pieza[c]} onChange={e=>editar(c,e.target.value)} /></label>)}<label>Hashtags propuestos<textarea disabled={cargando} value={pieza.hashtags.join(' ')} onChange={e=>editar('hashtags',e.target.value.split(/\s+/).filter(Boolean))} /></label></div><p>Palabras clave: {pieza.palabras_clave.join(', ')}</p><button type="button" className="btn-guardar" onClick={()=>onUsar([pieza.copy,pieza.hashtags.join(' '),pieza.cta].join('\n\n'))}>Revisar con mi marca</button></div>}
      {plan.bloques[0]?.emails?.length>0&&<details className="panel-card"><summary>Emails de apoyo · 5 borradores en 20 días por contacto</summary><p>Para voluntarios que presentan TSCP a sus organizaciones. Confirmar lista autorizada, responsable y mecanismo de baja antes de enviar. El ciclo termina al responder o convertirse; no hay envío automático.</p>{plan.bloques[0].emails.map(e=><article key={e.dia}><h4>Día {e.dia} · {e.asunto}</h4><p>{e.condicion}</p><p style={{whiteSpace:'pre-wrap'}}>{e.copy}</p><p>{e.cta} · {e.url_cta}</p></article>)}</details>}
      {bloqueVisible?.flujo&&<details className="panel-card"><summary>Entrega al equipo y validaciones pendientes</summary><p>{bloqueVisible.flujo.pendiente}</p><p>Confirmar mercados y zonas de audiencia, enlaces de CTA, responsables y capacidad de producción. Revisar resultados semanalmente; adaptar temas y horarios cada mes. Medir clics UTM, consultas, reuniones y registros. Los enlaces propuestos no han sido comprobados automáticamente.</p></details>}
      {bloqueVisible&&<details className="panel-card"><summary><strong>Estrategia y fuentes consultadas</strong></summary><p className="marketing-estrategia">{bloqueVisible.estrategia}</p><ul>{bloqueVisible.experimentos.map((t,i)=><li key={i}>{t}</li>)}</ul><h4>Fuentes consultadas</h4><p className="marketing-nota">{bloqueVisible.evidencia.consultado} · {bloqueVisible.evidencia.limites}</p>{bloqueVisible.evidencia.estados.map(s=><p key={s.fuente}><a href={s.url} target="_blank" rel="noopener noreferrer">{s.fuente}</a> · {s.estado}<small>{s.detalle}</small></p>)}<details><summary>Ver señales y referencias reales</summary>{bloqueVisible.evidencia.tendencias.map((t,i)=><p key={i}>{t.tema} · Búsquedas aproximadas: {t.volumenAproximado||'No indicado'} · {t.fecha}</p>)}{bloqueVisible.evidencia.noticias.map(n=><p key={n.url}><a href={n.url} target="_blank" rel="noopener noreferrer">{n.titulo}</a></p>)}{bloqueVisible.evidencia.videos.map(v=><p key={v.url}><a href={v.url} target="_blank" rel="noopener noreferrer">{v.titulo}</a> · {v.vistas||'Sin dato'} vistas acumuladas</p>)}</details><h4>Oportunidades de temporada · no son tendencias medidas</h4>{bloqueVisible.eventos.map(e=><p key={e.fecha+e.nombre}>{e.fecha} · {e.nombre}<small>{e.tipo} {e.url&&<a href={e.url} target="_blank" rel="noopener noreferrer">Fuente</a>}</small></p>)}</details>}
    </>}
    <details className="panel-card"><summary>Ajustes manuales e importar estadísticas (opcional)</summary><p className="marketing-nota">Si prefieres controlar cada día y horario o importar tu histórico, utiliza el modo manual. Las estadísticas importadas se usan automáticamente la próxima vez que generes un calendario.</p><Marketing perfil={perfil} onUsar={onUsar} /></details>
  </section>;
}
