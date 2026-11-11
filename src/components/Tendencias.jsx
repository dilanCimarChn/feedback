import { useRef, useState } from 'react';
import { llamarApi } from '../lib/api';
import { REDES } from '../lib/marketing';

export default function Tendencias({ perfil, onUsar, onPlanificar }) {
  const [tema,setTema]=useState(perfil.palabras_clave?.[0] || '');
  const [pais,setPais]=useState('BO');
  const [datos,setDatos]=useState(null);
  const [error,setError]=useState('');
  const [cargando,setCargando]=useState(false);
  const pendiente=useRef(false);
  const buscar=async e=>{
    e.preventDefault(); if(pendiente.current)return;
    pendiente.current=true;setCargando(true);setError('');
    try{setDatos(await llamarApi('/api/tendencias',{tema,pais}));}
    catch(err){setError(err.message);}
    finally{pendiente.current=false;setCargando(false);}
  };
  const tieneDatos=datos&&(datos.tendencias.length||datos.videos.length||datos.noticias.length||datos.plataformas?.some(p=>p.items.length));
  return <section className="marketing tendencias">
    <div className="panel-card"><h2>Fuentes de tus redes sociales</h2><p>Facebook, Instagram, TikTok, X, LinkedIn y YouTube. Consulta las conexiones disponibles y utiliza sus señales para tu calendario.</p>
      <div className="marketing-formatos">{REDES.map(red=>{const estado=datos?.estados.find(s=>s.fuente===red);return <article key={red}><strong>{red==='X'?'X (Twitter)':red}</strong><p>{estado?.estado||'Sin consultar'}</p><small>{estado?.detalle||'Consulta para comprobar la conexión. Requiere acceso autorizado del proveedor.'}</small></article>;})}</div>
      <form className="marketing-filtros" onSubmit={buscar}><label>Tema o sector (opcional)<input maxLength={150} value={tema} onChange={e=>setTema(e.target.value)} placeholder="Ej. educación, gastronomía, turismo" /></label><label>País de las señales<select value={pais} onChange={e=>setPais(e.target.value)}>{[['BO','Bolivia'],['AR','Argentina'],['CL','Chile'],['CO','Colombia'],['MX','México'],['PE','Perú'],['ES','España'],['US','Estados Unidos']].map(([v,t])=><option key={v} value={v}>{t}</option>)}</select></label><button className="btn-guardar" disabled={cargando}>{cargando?'Consultando fuentes…':'Consultar fuentes'}</button></form>
      <p className="marketing-nota">Facebook, Instagram, TikTok y LinkedIn leen cuentas autorizadas. X busca publicaciones por tema sin filtro geográfico; YouTube muestra populares por país. Google Trends y noticias son fuentes complementarias. Ninguna de estas consultas demuestra por sí sola la mejor hora para publicar.</p>
      <button type="button" className="btn-secundario" onClick={()=>onPlanificar?.(tema)}>Crear mi calendario con el agente</button>
    </div>
    {error&&<p role="alert" className="tendencias-error">{error}{datos?' Se muestran los últimos resultados conservados.':''}</p>}
    <div role="status" aria-live="polite">{cargando?'Consultando las fuentes disponibles…':''}</div>
    {!datos&&!cargando&&!error&&<div className="panel-card"><h3>Consulta las fuentes o ve directo al calendario</h3><p>El generador también consulta las fuentes automáticamente. Puedes empezar con una descripción breve de tu marca.</p></div>}
    {datos&&<><div className="panel-card"><h3>Fuentes complementarias</h3><p className="marketing-nota">Consultado: {new Date(datos.consultado).toLocaleString('es')} · País: {datos.pais}</p><div className="marketing-formatos">{datos.estados.filter(s=>!REDES.includes(s.fuente)).map(s=><article key={s.fuente}><strong>{s.fuente}</strong><p>{s.estado}</p><small>{s.detalle || (s.estado==='No disponible'?'Esta fuente no respondió. Las otras fuentes y el calendario siguen disponibles.':'')}</small><a href={s.url} target="_blank" rel="noopener noreferrer">Ver fuente</a></article>)}</div><p className="marketing-nota">{datos.limites}</p></div>
      {datos.plataformas?.filter(p=>p.items.length).map(p=><div className="panel-card" key={p.fuente}><h3>{p.fuente} · Contenido consultado</h3><p className="marketing-nota">{p.alcance}</p><div className="marketing-videos">{p.items.map((item,i)=><article key={i}>{item.url?<a href={item.url} target="_blank" rel="noopener noreferrer">{item.titulo}</a>:<strong>{item.titulo}</strong>}<small>{item.formato} · {item.fecha?new Date(item.fecha).toLocaleString('es'):'Fecha no disponible'}</small><p>{Object.entries(item.metricas).filter(([,v])=>v!==null).map(([k,v])=>`${k}: ${v.toLocaleString('es')}`).join(' · ')||'Sin métricas disponibles en esta consulta'}</p><small>{item.hashtags.join(' ')}</small><button type="button" className="btn-secundario" onClick={()=>onPlanificar?.([tema,item.titulo].filter(Boolean).join(' · ').slice(0,600))}>Evaluar para mi campaña</button></article>)}</div></div>)}
      {!tieneDatos&&<div className="panel-card"><h3>No llegaron señales en esta consulta</h3><p>Puedes reintentar o generar una propuesta editorial inicial. Se identificará como una propuesta sin tendencias externas, sin inventar datos.</p><button type="button" className="btn-guardar" onClick={()=>onPlanificar?.(tema)}>Continuar al calendario</button></div>}
      {datos.tendencias.length>0&&<div className="panel-card"><h3>Búsquedas en tendencia · Google Trends</h3><p className="marketing-nota">Señales generales del país. El volumen es una aproximación de búsquedas, no alcance en redes.</p><div className="marketing-formatos">{datos.tendencias.map((t,i)=><article key={i}><strong>{t.tema}</strong><p>{t.volumenAproximado || 'Volumen no indicado'}</p><small>{t.fecha}</small><button type="button" className="btn-secundario" onClick={()=>onPlanificar?.([tema,t.tema].filter(Boolean).join(' · '))}>Evaluar para mi campaña</button></article>)}</div></div>}
      {datos.videos.length>0&&<div className="panel-card"><h3>Videos populares · YouTube</h3><div className="marketing-videos">{datos.videos.map(v=><article key={v.url}><a href={v.url} target="_blank" rel="noopener noreferrer">{v.titulo}</a><small>{v.vistas===null?'Sin conteo público':`${Number(v.vistas).toLocaleString('es')} vistas acumuladas`}</small><small>{v.hashtags.join(' ')}</small></article>)}</div></div>}
      {datos.noticias.length>0&&<div className="panel-card"><h3>Noticias del tema · GDELT</h3>{datos.noticias.map(n=><article key={n.url} className="tendencias-idea"><h3><a href={n.url} target="_blank" rel="noopener noreferrer">{n.titulo}</a></h3><button type="button" className="btn-secundario" onClick={()=>onUsar(`Referencia editorial: ${n.titulo}\nFuente: ${n.url}\n\n[Verificar y redactar el copy antes de revisar]`)}>Preparar borrador</button></article>)}</div>}
    </>}
  </section>;
}
