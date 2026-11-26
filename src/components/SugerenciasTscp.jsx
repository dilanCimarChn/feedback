import { useState } from 'react';

export default function SugerenciasTscp({ sugerencias = [], catalogo = [] }) {
  const [aviso, setAviso] = useState('');
  const copiar = async s => {
    try { await navigator.clipboard.writeText(`${s.copy}\n\n${s.hashtags.join(' ')}`); setAviso(`Borrador de ${s.canal} copiado. Revisa datos y enlaces antes de usarlo.`); }
    catch { setAviso('No se pudo copiar automáticamente. Puedes seleccionar el texto del borrador.'); }
  };
  return <section className="tscp-sugerencias" aria-label="Sugerencias de contenido por canal">
    <h3>Sugerencias de copy, hashtags y contenido</h3>
    <p className="tscp-ayuda">Ejemplos adaptados al objetivo y lenguaje de cada red. Marketing revisa las afirmaciones, los enlaces y la pieza final. Los hashtags son propuestas temáticas.</p>
    {!sugerencias.length && <p className="tscp-aviso">Este diagnóstico no contiene ejemplos. Pulsa «Preparar diagnóstico y guía» para generar las sugerencias.</p>}
    {sugerencias.map(s => <details className="tscp-detalle" key={s.id} id={s.id}>
      <summary>{s.canal} · {s.tema}</summary>
      <span className="tscp-subtexto">{s.estado}</span>
      <p><strong>{s.formato}:</strong> {s.idea}</p>
      <p><strong>Gancho sugerido:</strong> {s.gancho}</p>
      <h4>Copy sugerido</h4><blockquote className="tscp-copy">{s.copy}</blockquote>
      <p className="tscp-hashtags"><strong>Hashtags sugeridos:</strong> {s.hashtags.join(' ')}</p>
      <button type="button" className="btn-secundario" onClick={() => copiar(s)}>Copiar borrador de {s.canal}</button>
      <p><strong>CTA:</strong> {s.cta}</p>
      <ol className="tscp-lista">{s.estructura.map((paso, i) => <li key={i}>{paso}</li>)}</ol>
      <p className="tscp-ayuda">{s.fundamento}</p>
      <ul className="tscp-fuentes">{s.fuentes.map(id => {
        const fuente = catalogo.find(f => f.id === id);
        return <li key={id}>{fuente?.url ? <a href={fuente.url} target="_blank" rel="noopener noreferrer">{fuente.tipo}</a> : `${fuente?.tipo || 'Brief'} · ${id.replace('brief:', '')}`}</li>;
      })}</ul>
    </details>)}
    {aviso && <p className="tscp-ayuda" role="status">{aviso}</p>}
  </section>;
}
