import { useRef, useState } from 'react';
import { llamarApi } from '../lib/api';

export default function ConexionesApis() {
  const [estado, setEstado] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const consultando = useRef(false);
  const consultar = async () => {
    if (consultando.current) return;
    consultando.current = true; setOcupado(true); setError('');
    try {
      const datos = await llamarApi('/api/estado-apis', { accion: 'estado' });
      if (!Array.isArray(datos?.fuentes)) throw new Error('No llegó el estado de conexiones.');
      setEstado(datos);
    } catch (fallo) { setError(fallo.message); }
    finally { consultando.current = false; setOcupado(false); }
  };
  return <details className="tscp-detalle tscp-conexiones" onToggle={e => { if (e.currentTarget.open && !estado) consultar(); }}>
    <summary>Conexiones y APIs · configuración y faltantes</summary>
    <p className="tscp-ayuda">Revisa las variables del servidor que está atendiendo esta web. Las claves se configuran en Vercel → proyecto → Settings → Environment Variables; después hay que volver a desplegar. Para las APIs locales se usa .env.</p>
    <button type="button" className="btn-secundario" disabled={ocupado} onClick={consultar}>{ocupado ? 'Consultando conexiones…' : 'Revisar conexiones'}</button>
    {error && <p className="tscp-error" role="alert">{error}</p>}
    {estado && <>
      <p role="status" className="tscp-ayuda">Entorno consultado: {estado.entorno === 'produccion' ? 'Producción' : estado.entorno} · {new Date(estado.consultado).toLocaleString('es')}. {estado.aviso}</p>
      <div className="tscp-conexiones-lista">{estado.fuentes.map(f => <details key={f.id}>
        <summary><strong>{f.nombre}</strong><span className="tscp-subtexto">{f.estado}</span></summary>
        <p>{f.alcance}</p>
        {!!f.faltantes.length && <p><strong>Falta configurar: </strong>{f.faltantes.map(nombre => <code key={nombre}>{nombre} </code>)}</p>}
        <p>{f.comoConfigurar}</p>
        {!!f.variables.length && <ul>{f.variables.map(v => <li key={v.nombre}><code>{v.nombre}</code> · {v.configurada ? 'Presente' : 'Ausente'}{v.opcional ? ' · opcional' : ''}</li>)}</ul>}
        <a href={f.documentacion} target="_blank" rel="noopener noreferrer">Ver documentación oficial</a>
      </details>)}</div>
      <p className="tscp-ayuda">Para comprobar acceso real, usa Fuentes y tendencias. La generación del diagnóstico comprueba Gemini y los referentes configurados; los errores se muestran junto al resultado.</p>
    </>}
  </details>;
}
