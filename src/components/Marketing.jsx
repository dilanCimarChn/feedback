import { useEffect, useState } from 'react';
import { llamarApi } from '../lib/api';
import { REDES, DIAS, crearFechas, validarMetricas, resumirMetricas, descargarArchivo, calendarioCsv, importarCsv } from '../lib/marketing';

const CLAVE = 'agente-feedback:marketing:v1';
const FUENTES = [
  ['Meta: estrategia de contenido y actividad de audiencia', 'https://www.facebookblueprint.com/student/path/196036-strategic-content-for-your-community'],
  ['YouTube: origen de las estadísticas públicas', 'https://developers.google.com/youtube/data/reference/rest/v3/videos/list']
];
function leer() { try { return JSON.parse(localStorage.getItem(CLAVE)) || {}; } catch { return {}; } }
function mesActual() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; }
const BASE = { mes: mesActual(), dias: [1,3,5], horarios: ['12:00','18:00'], zona: 'America/La_Paz', objetivo: 'Visibilidad y comunidad', sector: '', oferta: '', campana: '', objetivoDetalle: '', audiencia: '', region: 'Bolivia', recursos: 'Equipo pequeño: diseño de carruseles, fotografías y clips grabados con celular.', redes: ['Instagram'], usarSenales: false, paisSenales: 'BO' };

export default function Marketing({ perfil, onUsar }) {
  const [guardado] = useState(leer);
  const [form, setForm] = useState(() => ({ ...BASE, ...guardado.form, campana: guardado.form?.campana ?? guardado.form?.causa ?? '' }));
  const [metricas, setMetricas] = useState(() => { try { return guardado.metricas?.length ? validarMetricas(guardado.metricas) : []; } catch { return []; } });
  const [plan, setPlan] = useState(() => Array.isArray(guardado.plan?.publicaciones) ? guardado.plan : null);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [cargando, setCargando] = useState(false);
  const [senales, setSenales] = useState(null);
  const [buscando, setBuscando] = useState(false);
  const [filtroRed, setFiltroRed] = useState('');
  const [filtroFormato, setFiltroFormato] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [editando, setEditando] = useState(null);
  useEffect(() => {
    try { localStorage.setItem(CLAVE, JSON.stringify({ form, metricas, plan })); setAviso(''); }
    catch { setAviso('No se pudo guardar en este navegador. Exporta el calendario para conservarlo.'); }
  }, [form, metricas, plan]);
  const cambiar = (campo, valor) => setForm(f => ({ ...f, [campo]: valor }));
  const alternar = (campo, valor) => cambiar(campo, form[campo].includes(valor) ? form[campo].filter(v => v !== valor) : [...form[campo], valor]);
  let fechas = [];
  try { fechas = crearFechas(form.mes, form.dias); } catch { /* Se valida también al generar. */ }
  const periodoValido = !desde || !hasta || desde <= hasta;
  const historico = periodoValido ? metricas.filter(p => (!desde || p.fecha >= desde) && (!hasta || p.fecha <= hasta)) : [];
  const resumen = resumirMetricas(historico);
  const importar = async e => {
    const file = e.target.files?.[0]; if (!file) return;
    try { if (file.size > 500000) throw new Error('El archivo debe pesar menos de 500 KB.'); const contenido = await file.text(); setMetricas(file.name.toLowerCase().endsWith('.csv') ? importarCsv(contenido) : validarMetricas(JSON.parse(contenido))); setError(''); }
    catch (err) { setError(err.message); }
    e.target.value = '';
  };
  const generar = async e => {
    e.preventDefault(); setError('');
    if (!periodoValido) return setError('La fecha inicial del histórico debe ser anterior a la final.');
    if (!fechas.length || !form.redes.length) return setError('Selecciona al menos un día y una red.');
    setCargando(true);
    try {
      const data = await llamarApi('/api/plan-marketing', { ...form, campana: form.campana || perfil.descripcion, objetivo: form.objetivo === 'Otro objetivo' ? form.objetivoDetalle : form.objetivo, audiencia: form.audiencia || perfil.publico, perfil: { nombre: perfil.nombre, descripcion: perfil.descripcion, tono: perfil.tono, hashtags: perfil.hashtags, palabras_prohibidas: perfil.palabras_prohibidas }, metricas: historico });
      setPlan(data); setEditando(null); setFiltroFormato(''); setFiltroRed('');
    } catch (err) { setError(err.message); }
    finally { setCargando(false); }
  };
  const consultar = async () => {
    setBuscando(true); setError('');
    try { setSenales(await llamarApi('/api/senales-sociales', { region: form.paisSenales })); }
    catch (err) { setError(err.message); setSenales(null); }
    finally { setBuscando(false); }
  };
  const editar = (i, campo, valor) => setPlan(p => ({ ...p, publicaciones: p.publicaciones.map((fila,j) => j === i ? { ...fila, [campo]: valor } : fila) }));
  const columnas = plan ? Array.from({ length: new Date(Number(plan.mes.slice(0,4)), Number(plan.mes.slice(5)), 0).getDate() }, (_,i) => `${plan.mes}-${String(i+1).padStart(2,'0')}`) : [];
  const filas = plan?.publicaciones.map((p,i) => ({...p, indice: i})).filter(p => (!filtroRed || p.red === filtroRed) && (!filtroFormato || p.formato === filtroFormato)) || [];
  return <section className="marketing">
    <div className="marketing-hero"><div><span className="marketing-etiqueta">ESTRATEGIA PARA TU MARCA</span><h2>De tu nicho a un mes de contenido</h2><p>Define a quién quieres llegar, qué acción buscas y cuánto puedes producir. Convierte esa estrategia en publicaciones concretas.</p></div><div className="marketing-sello">Objetivo → Contenido → Medición</div></div>
    <div className="marketing-pasos"><span>01 · Analiza tus resultados</span><span>02 · Define la campaña</span><span>03 · Genera y ajusta el calendario</span></div>

    <details className="panel-card" open><summary><strong>1. ¿Qué está funcionando?</strong> · Formatos y señales</summary>
      <div className="marketing-estado"><span>Consulta las conexiones sociales en Fuentes y tendencias</span><span>Histórico: {metricas.length ? `${metricas.length} publicaciones importadas` : 'sin importar'}</span></div>
      <p>Compara resultados reales de tus publicaciones. Completa la plantilla en Excel o Sheets con tus estadísticas y guárdala como CSV. También puedes importar JSON. Los registros marcados como pagados se excluyen de la comparación orgánica.</p>
      <div className="marketing-acciones"><label className="btn-secundario">Importar histórico CSV / JSON<input className="marketing-file" type="file" accept=".csv,.json,text/csv,application/json" onChange={importar} /></label><button type="button" className="btn-secundario" onClick={() => descargarArchivo('plantilla-metricas.csv', '\uFEFFred,formato,fecha,hora,alcance,interacciones,conversiones,pagado,hashtags\r\n', 'text/csv;charset=utf-8')}>Descargar plantilla para completar</button>{metricas.length > 0 && <button className="btn-texto" type="button" onClick={() => setMetricas([])}>Quitar histórico</button>}</div>
      <details><summary>Cómo completar la plantilla</summary><p>Una fila por publicación. Red: Instagram, Facebook, TikTok, X, LinkedIn o YouTube. Fecha: AAAA-MM-DD. Hora: HH:mm en la zona horaria de la campaña. Alcance, interacciones y conversiones: números sin separadores de miles (escribe 0 si no hubo). Pagado: si o no. Hashtags: separados por espacios. Conserva los encabezados.</p></details>
      <p className="marketing-nota">Formatos admitidos: Reel, Clip, Carrusel, Imagen, Historia, Texto. Conversiones: una misma acción elegida por tu equipo (por ejemplo, registros). Usa un período comparable y separa resultados de campañas pagadas.</p>
      <div className="marketing-filtros"><label>Histórico desde<input type="date" value={desde} onChange={e => setDesde(e.target.value)} /></label><label>Hasta<input type="date" value={hasta} onChange={e => setHasta(e.target.value)} /></label></div>
      {!periodoValido && <p role="alert">Revisa el rango de fechas.</p>}
      {resumen.length > 0 ? <div className="marketing-tabla"><table><thead><tr><th>Red</th><th>Formato</th><th>Muestra</th><th>Alcance medio</th><th>Interacciones / alcance</th><th>Conversiones</th></tr></thead><tbody>{resumen.map(r => <tr key={r.red+r.formato}><td>{r.red}</td><td>{r.formato}</td><td>{r.publicaciones} posts</td><td>{Math.round(r.alcanceMedio).toLocaleString('es')}</td><td>{r.tasaInteraccion === null ? 'Sin alcance' : `${r.tasaInteraccion.toFixed(2)} %`}</td><td>{r.conversiones}</td></tr>)}</tbody></table><p className="marketing-nota">Ordenado por alcance medio observado. No determina causalidad ni un ganador universal; compara formatos dentro de la misma red. Muestras pequeñas requieren más pruebas.</p></div> : <div className="marketing-vacio">Aún no hay datos orgánicos en este período. Puedes generar una estrategia inicial y medirla después.</div>}
      <div className="marketing-fuentes"><h3>Señales públicas recientes · YouTube</h3><p>Consulta una selección de videos populares por país con vistas, duración y hashtags presentes en su descripción. Sirve para explorar recursos creativos; su popularidad no equivale a eficacia para tu marca.</p><div className="marketing-acciones"><label>País<select value={form.paisSenales} onChange={e => { cambiar('paisSenales',e.target.value); setSenales(null); }}>{[['BO','Bolivia'],['AR','Argentina'],['CL','Chile'],['CO','Colombia'],['MX','México'],['PE','Perú'],['ES','España'],['US','Estados Unidos']].map(([v,t]) => <option value={v} key={v}>{t}</option>)}</select></label><button type="button" className="btn-secundario" disabled={buscando} onClick={consultar}>{buscando ? 'Consultando…' : 'Consultar señales públicas'}</button></div>
        {senales && <><p className="marketing-nota">{senales.aviso} {senales.consultado && `Consultado: ${new Date(senales.consultado).toLocaleString('es')}`}</p><div className="marketing-videos">{senales.videos.map(v => <article key={v.url}><a href={v.url} target="_blank" rel="noopener noreferrer">{v.titulo}</a><small>{Number(v.vistas || 0).toLocaleString('es')} vistas acumuladas · Duración: {v.duracion} · Publicado: {new Date(v.publicado).toLocaleDateString('es')}</small><small>{v.hashtags.join(' ') || 'Sin hashtags detectados'}</small></article>)}</div></>}
      </div>
      <div className="marketing-guia"><h3>Qué probar según el propósito</h3><div className="marketing-formatos">{[['Reels y clips','Presentar una causa, mostrar una acción o explicar una idea en video.','Medir retención, alcance y visitas al perfil.'],['Carruseles','Explicar un problema, enseñar pasos o rendir cuentas.','Medir guardados, compartidos y registros.'],['Imagen','Comunicar una convocatoria o una idea clara.','Medir clics y acciones completadas.'],['Historias','Conversar con la comunidad y recordar acciones.','Medir respuestas y clics.']].map(([t,u,m]) => <article key={t}><strong>{t}</strong><p>{u}</p><small>{m}</small></article>)}</div><p className="marketing-nota">Hipótesis editoriales, sin ranking de consumo. Los hashtags se proponen por relevancia, nicho, comunidad y ubicación; aquí no se dispone de su volumen de búsqueda en Instagram o TikTok.</p>{FUENTES.map(([t,u]) => <a key={u} href={u} target="_blank" rel="noopener noreferrer">{t} ↗ </a>)}</div>
    </details>

    <form className="panel-card" onSubmit={generar}><h3>2. Configura tu campaña mensual</h3><div className="marketing-form-grid">
      <label>Mes del calendario<input required type="month" min="2020-01" max="2100-12" value={form.mes} onChange={e => cambiar('mes',e.target.value)} /></label>
      <label>Objetivo principal<select value={form.objetivo} onChange={e => cambiar('objetivo',e.target.value)}>{['Visibilidad y comunidad','Generar consultas y clientes potenciales','Aumentar ventas','Conseguir reservas o citas','Lanzar un producto o servicio','Fidelizar clientes','Inscripciones a actividades','Alianzas con empresas','Captar voluntariado','Aumentar donaciones','Otro objetivo'].map(t => <option key={t}>{t}</option>)}</select></label>
      <label>Sector o nicho<input required maxLength={150} list="sectores-marketing" value={form.sector} onChange={e => cambiar('sector',e.target.value)} placeholder="Ej. Gastronomía, moda, educación, ONG…" /><datalist id="sectores-marketing">{['Gastronomía','Comercio y tiendas','Moda y belleza','Servicios profesionales','Educación','Turismo','Salud y bienestar','Tecnología','Inmobiliaria','Marca personal','ONG y causas sociales'].map(s => <option key={s} value={s} />)}</datalist></label>
      <label>Producto, servicio o propuesta de valor<textarea required maxLength={600} value={form.oferta} placeholder={perfil.descripcion || 'Qué ofreces, a quién ayudas y qué te diferencia'} onChange={e => cambiar('oferta',e.target.value)} /></label>
      {form.objetivo === 'Otro objetivo' && <label>Describe tu objetivo<input required maxLength={600} value={form.objetivoDetalle} onChange={e => cambiar('objetivoDetalle',e.target.value)} placeholder="Qué resultado quieres conseguir" /></label>}
      <label>Campaña o enfoque del mes<textarea required maxLength={600} value={form.campana || ''} placeholder="Ej. Lanzamiento de colección, reservas para vacaciones o captación de voluntariado" onChange={e => cambiar('campana',e.target.value)} /></label>
      <label>Audiencia prioritaria<textarea required maxLength={600} value={form.audiencia || ''} placeholder={perfil.publico || 'Ej. Familias de la ciudad que buscan opciones saludables para comer'} onChange={e => cambiar('audiencia',e.target.value)} /></label>
      <label>País o ciudad de la audiencia<input required maxLength={150} value={form.region} onChange={e => cambiar('region',e.target.value)} /></label>
      <label>Zona horaria<select value={form.zona} onChange={e => cambiar('zona',e.target.value)}>{['America/La_Paz','America/Lima','America/Bogota','America/Mexico_City','America/Santiago','America/Argentina/Buenos_Aires','Europe/Madrid','UTC'].map(t => <option key={t}>{t}</option>)}</select></label>
      <label className="marketing-ancho">Recursos y restricciones de producción<textarea maxLength={600} value={form.recursos} onChange={e => cambiar('recursos',e.target.value)} /></label>
    </div><fieldset><legend>Redes a incluir</legend><div className="marketing-checks">{REDES.map(r => <label key={r}><input type="checkbox" checked={form.redes.includes(r)} onChange={() => alternar('redes',r)} />{r}</label>)}</div></fieldset>
    <fieldset><legend>Días de publicación · una pieza total por día seleccionado</legend><div className="marketing-checks">{[1,2,3,4,5,6,0].map(d => <label key={d}><input type="checkbox" checked={form.dias.includes(d)} onChange={() => alternar('dias',d)} />{DIAS[d]}</label>)}</div></fieldset>
    <fieldset><legend>Horarios para probar · se alternan en el calendario</legend><div className="marketing-acciones">{form.horarios.map((h,i) => <label key={i}>Horario {i+1}<input required aria-label={`Horario ${i+1}`} type="time" value={h} onChange={e => cambiar('horarios',form.horarios.map((v,j) => i===j ? e.target.value : v))} /></label>)}</div><p className="marketing-nota">Estos horarios son elegidos por ti. El histórico permite orientar futuras pruebas; no se han medido las horas óptimas de tu audiencia.</p></fieldset>
    <label className="marketing-checkbox"><input type="checkbox" checked={form.usarSenales} onChange={e => cambiar('usarSenales',e.target.checked)} /> Consultar señales de YouTube al generar (requiere conexión configurada)</label>
    <div className="marketing-generar"><p><strong>{fechas.length} publicaciones</strong> para {form.mes} · {form.redes.length} redes · {form.zona}<small>El plan usa tu marca y el histórico filtrado, si lo importaste. No publica automáticamente.</small></p><button className="btn-guardar" disabled={cargando}>{cargando ? 'Creando estrategia y calendario…' : plan ? 'Generar nuevo calendario' : 'Generar estrategia y calendario'}</button></div><p className="marketing-nota">Un nuevo calendario reemplaza el guardado cuando se genera correctamente. Puedes exportar el actual antes.</p></form>
    {(error || aviso) && <p role={error ? 'alert' : 'status'} className="tendencias-error">{error || aviso}</p>}
    <div aria-live="polite">{cargando && <p>La IA está preparando la campaña y cada publicación. Puede tardar un momento.</p>}</div>

    {plan && <><div className="panel-card"><div className="marketing-acciones"><h3>3. Tu estrategia · {plan.mes}</h3><button type="button" className="btn-secundario" onClick={() => descargarArchivo(`calendario-${plan.mes}.csv`,calendarioCsv(plan),'text/csv;charset=utf-8')}>Exportar CSV</button><button type="button" className="btn-secundario" onClick={() => descargarArchivo(`estrategia-${plan.mes}.json`,JSON.stringify(plan,null,2),'application/json')}>Exportar plan completo</button></div><p className="marketing-nota">{plan.base} · Generado: {new Date(plan.creado).toLocaleString('es')} · Zona: {plan.zona}</p>{plan.avisoSenales && <p className="marketing-nota">{plan.avisoSenales}</p>}<p className="marketing-estrategia">{plan.estrategia}</p><div className="marketing-formatos">{plan.formatos?.map((f,i) => <article key={i}><strong>{f.formato}</strong><p>{f.uso}</p><small>{f.medir}</small></article>)}</div><h4>Hashtags propuestos · sin volumen medido</h4><p>{plan.hashtags?.propuestos?.join(' ')}</p><p>{plan.hashtags?.criterio}</p><h4>Pruebas y revisión semanal</h4><ul>{plan.experimentos?.map((t,i) => <li key={i}>{t}</li>)}</ul>{plan.fuentes?.conectado && <details><summary>Fuentes públicas consultadas para este plan</summary><p>{plan.fuentes.aviso} · {new Date(plan.fuentes.consultado).toLocaleString('es')}</p>{plan.fuentes.videos.map(v => <p key={v.url}><a href={v.url} target="_blank" rel="noopener noreferrer">{v.titulo}</a></p>)}</details>}</div>
      <div className="panel-card"><div className="marketing-acciones"><h3>Calendario de publicaciones</h3><label>Filtrar red<select value={filtroRed} onChange={e => setFiltroRed(e.target.value)}><option value="">Todas</option>{REDES.map(r => <option key={r}>{r}</option>)}</select></label><label>Filtrar formato<select value={filtroFormato} onChange={e => setFiltroFormato(e.target.value)}><option value="">Todos</option>{['Reel','Clip','Carrusel','Imagen','Historia','Texto'].map(r => <option key={r}>{r}</option>)}</select></label></div><p className="marketing-nota">Horarios de prueba en {plan.zona}. Selecciona una publicación para editarla. La exportación incluye todo el mes.</p><div className="marketing-calendario">{Array.from({ length: (new Date(`${plan.mes}-01T12:00:00Z`).getUTCDay()+6)%7 },(_,i) => <div key={`vacio${i}`} className="marketing-dia-vacio" />)}{columnas.map(d => <div className="marketing-dia" key={d}><span>{DIAS[new Date(`${d}T12:00:00Z`).getUTCDay()]} {Number(d.slice(-2))}</span>{filas.filter(p => p.fecha === d).map(p => <button type="button" key={p.indice} onClick={() => setEditando(p.indice)}><small>{p.hora} · {p.red}</small><strong>{p.formato}</strong><span>{p.titulo}</span></button>)}</div>)}</div></div>
      {editando !== null && plan.publicaciones[editando] && <div className="panel-card marketing-editor"><div className="marketing-acciones"><h3>Editar publicación</h3><button type="button" className="btn-texto" onClick={() => setEditando(null)}>Cerrar edición</button></div><div className="marketing-form-grid"><label>Fecha<input type="date" min={`${plan.mes}-01`} max={columnas.at(-1)} required value={plan.publicaciones[editando].fecha} onChange={e => { if (columnas.includes(e.target.value)) editar(editando,'fecha',e.target.value); }} /></label><label>Hora<input type="time" required value={plan.publicaciones[editando].hora} onChange={e => { if (e.target.value) editar(editando,'hora',e.target.value); }} /></label>{['titulo','gancho','guion','copy','cta','motivo','metrica'].map(c => <label key={c}>{({titulo:'Tema',gancho:'Gancho',guion:'Qué grabar o diseñar',copy:'Copy',cta:'Llamada a la acción',motivo:'Por qué esta pieza',metrica:'Qué medir'})[c]}<textarea value={plan.publicaciones[editando][c]} onChange={e => editar(editando,c,e.target.value)} /></label>)}<label>Hashtags<textarea value={plan.publicaciones[editando].hashtags.join(' ')} onChange={e => editar(editando,'hashtags', e.target.value.split(/\s+/).filter(Boolean))} /></label></div><p>Guardado automáticamente en este navegador.</p><button type="button" className="btn-guardar" onClick={() => onUsar([plan.publicaciones[editando].copy,plan.publicaciones[editando].hashtags.join(' '),plan.publicaciones[editando].cta].filter(Boolean).join('\n\n'))}>Llevar copy al revisor de marca</button></div>}
      {!filas.length && <p className="marketing-vacio">No hay publicaciones para esos filtros.</p>}
    </>}
  </section>;
}
