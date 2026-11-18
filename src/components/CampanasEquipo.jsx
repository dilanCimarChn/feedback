import {useEffect,useRef,useState} from 'react';

export default function CampanasEquipo({equipo,plan,onAbrir,onNombre,ocupado=false}) {
  const [error,setError]=useState('');
  const [abierto,setAbierto]=useState(false);
  const refrescar=useRef(equipo.refrescar);refrescar.current=equipo.refrescar;
  useEffect(()=>{if(abierto&&equipo.disponible&&!ocupado){setError('');refrescar.current().catch(e=>setError(e.message));}},[abierto,equipo.disponible,ocupado]);
  const accion=async fn=>{setError('');try{await fn();}catch(e){setError(e.message);}};
  const pendiente=plan&&(!plan._equipo||plan._equipo.pendiente);
  const bloqueado=equipo.guardando||ocupado;
  return <details className="panel-card campanas-equipo" onToggle={e=>setAbierto(e.currentTarget.open)}>
    <summary><strong>Campañas compartidas del equipo</strong>{pendiente?' · Hay cambios sin compartir':plan?._equipo?' · Guardada':''}</summary>
    <p>Abre el mismo calendario desde otras computadoras, guarda las revisiones y conserva las campañas anteriores.</p>
    {equipo.disponible===null?<p role="status">Comprobando la conexión del equipo…</p>:!equipo.disponible&&<p className="marketing-nota">La conexión compartida no está disponible. Revisa la configuración o vuelve a intentar. Los borradores de este navegador siguen disponibles.</p>}
    {plan&&<><label>Nombre de la campaña<input maxLength={150} disabled={bloqueado} value={plan.nombre||''} onChange={e=>onNombre(e.target.value)} placeholder={`Campaña ${plan.inicio}`} /></label><div className="marketing-acciones"><button type="button" className="btn-guardar" disabled={!equipo.disponible||bloqueado} onClick={()=>accion(()=>equipo.guardar())}>Guardar cambios en el equipo</button><button type="button" className="btn-secundario" disabled={!equipo.disponible||bloqueado} onClick={()=>accion(()=>equipo.guardar(undefined,true))}>Guardar como otra campaña</button></div></>}
    <div className="marketing-acciones"><button type="button" className="btn-secundario" disabled={!equipo.disponible||bloqueado} onClick={()=>accion(equipo.refrescar)}>Actualizar lista</button></div>
    <p role="status" aria-live="polite">{equipo.mensaje}</p>{error&&<p className="tendencias-error" role="alert">{error}</p>}
    {pendiente&&equipo.campanas.length>0&&<p className="marketing-nota">Guarda la campaña actual o una copia antes de abrir otra; así conservas tus cambios.</p>}
    {equipo.campanas.length>0?<div className="marketing-tabla"><table><thead><tr><th>Campaña</th><th>Período</th><th>Publicaciones</th><th>Acción</th></tr></thead><tbody>{equipo.campanas.map(c=><tr key={c.id}><td>{c.nombre}</td><td>{c.inicio} → {c.fin}</td><td>{c.publicaciones}</td><td><button type="button" className="btn-secundario" disabled={Boolean(pendiente)||bloqueado} onClick={()=>accion(async()=>{const p=await equipo.abrir(c.id);onAbrir(p);})}>Abrir</button></td></tr>)}</tbody></table></div>:<p className="marketing-nota">Consulta la lista para ver los calendarios del equipo.</p>}
  </details>;
}
