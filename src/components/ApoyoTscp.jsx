function enlaceSeguro(valor) {
  try { const url = new URL(valor); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null; }
  catch { return null; }
}

export default function ApoyoTscp({ apoyo }) {
  if (!apoyo || !Array.isArray(apoyo.fuentes)) return null;
  const fuentes = apoyo.fuentes;
  const estados = Array.isArray(apoyo.estados) ? apoyo.estados : [];
  return <details className="tscp-detalle" aria-label="Referencias automáticas de apoyo">
    <summary>Referencias encontradas para las sugerencias · {fuentes.length}</summary>
    <p className="tscp-ayuda">Estas fuentes aportan temas e ideas para adaptar a los canales elegidos. Los resultados de YouTube y Google Trends conservan su origen; no se cuentan como perfiles ni métricas de Instagram, Facebook, LinkedIn o TikTok.</p>
    {!!estados.length && <ul className="tscp-lista">{estados.map((estado, i) => <li key={`${estado.fuente}-${i}`}><strong>{estado.fuente}: {estado.estado}</strong>{estado.detalle && <span className="tscp-subtexto">{estado.detalle}</span>}{estado.avisos?.slice(0, 2).map((aviso, j) => <span className="tscp-subtexto" key={j}>{aviso}</span>)}</li>)}</ul>}
    {fuentes.length ? <ul className="tscp-fuentes">{fuentes.map((fuente, i) => {
      const url = enlaceSeguro(fuente.url);
      const titulo = fuente.titulo || fuente.nombre || fuente.texto?.slice(0, 160) || fuente.tipo || `Referencia ${i + 1}`;
      return <li key={fuente.id || i}>{url ? <a href={url} target="_blank" rel="noopener noreferrer">{titulo}</a> : titulo}
        <span className="tscp-subtexto">{fuente.canalOrigen || fuente.tipo || 'Fuente pública'}{fuente.fecha ? ` · ${fuente.fecha.slice(0, 10)}` : ''}</span>
        {fuente.alcance && <p className="tscp-ayuda">{fuente.alcance}</p>}
      </li>;
    })}</ul> : <p className="tscp-ayuda">La búsqueda no devolvió referencias utilizables en esta consulta. Revisa el estado de las fuentes; el brief sigue disponible para preparar propuestas.</p>}
    {apoyo.limite && <p className="tscp-ayuda">{apoyo.limite}</p>}
  </details>;
}
