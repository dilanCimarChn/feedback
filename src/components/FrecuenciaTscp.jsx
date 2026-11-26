export default function FrecuenciaTscp({ guia }) {
  const frecuencias = guia.frecuencias || [];
  const total = frecuencias.reduce((suma, f) => suma + f.propuesta, 0);
  const dias = new Set(frecuencias.flatMap(f => f.diasPropuestos)).size;
  return <section className="tscp-frecuencia" aria-label="Frecuencia de publicación">
    <h4>Frecuencia del flujo de marketing</h4>
    <p className="tscp-ayuda">El flujo no exige publicar todos los días. Esta propuesta distribuye {total} salidas entre los canales elegidos en {dias} días por semana completa; permite reutilizar una idea adaptándola a cada red.</p>
    <ul className="tscp-frecuencias">{frecuencias.map(f => <li key={f.canal}>
      <strong>{f.canal}: {f.minima === f.maxima ? f.minima : `${f.minima}–${f.maxima}`} por semana</strong>
      <span className="tscp-subtexto">Propuesta: {f.propuesta} · {f.diasPropuestos.join(', ')}.</span>
    </li>)}</ul>
    <p className="tscp-ayuda">Las cantidades proceden de la sección 4.3. Los días los propone el sistema y debe aprobarlos Marketing. Las semanas parciales incluyen solo fechas dentro de la campaña.</p>
  </section>;
}
