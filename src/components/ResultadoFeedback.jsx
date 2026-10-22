import { useState } from 'react';
import { Icono } from './ui';

const TITULOS_CATEGORIA = {
  margenes: 'Márgenes y espacios',
  colores: 'Colores de marca',
  contexto: 'Mensaje y tono',
  tipografia: 'Tipografías',
  gramatica: 'Ortografía y redacción'
};

const SEVERIDADES = {
  alta: { etiqueta: 'Importante', orden: 0 },
  media: { etiqueta: 'Mejorable', orden: 1 },
  baja: { etiqueta: 'Detalle', orden: 2 }
};

function Encabezado({ icono }) {
  return (
    <div className="panel-header">
      <h2 className="panel-title">
        <span className="panel-icon-wrap">
          <Icono nombre={icono} />
        </span>
        <span>Resultado de la revisión</span>
      </h2>
    </div>
  );
}

function AnilloPuntaje({ puntaje, tono }) {
  const radio = 34;
  const circunferencia = 2 * Math.PI * radio;
  return (
    <div className={`anillo anillo-${tono}`}>
      <svg width="84" height="84" viewBox="0 0 84 84" aria-hidden="true">
        <circle cx="42" cy="42" r={radio} className="anillo-fondo" />
        <circle
          cx="42"
          cy="42"
          r={radio}
          className="anillo-valor"
          strokeDasharray={circunferencia}
          strokeDashoffset={circunferencia * (1 - puntaje / 100)}
        />
      </svg>
      <span className="anillo-numero">{puntaje}</span>
    </div>
  );
}

function generarInforme({ aprobado, puntaje, resumen, aciertos, errores }) {
  const lineas = [];
  const veredicto = aprobado === null ? 'Sugerencias' : aprobado ? 'Aprobada' : 'Requiere cambios';
  lineas.push(`Revisión de publicación: ${veredicto}${puntaje !== null ? ` (${puntaje}/100)` : ''}`);
  if (resumen) lineas.push(resumen);
  if (aciertos.length) {
    lineas.push('', 'Lo que está bien:');
    aciertos.forEach(a => lineas.push(`- ${a}`));
  }
  if (errores.length) {
    lineas.push('', 'Para corregir:');
    errores.forEach(e => {
      lineas.push(`- [${SEVERIDADES[e.severidad].etiqueta}] ${TITULOS_CATEGORIA[e.categoria]}: ${e.descripcion}`);
      if (e.sugerencia) lineas.push(`  Cómo resolverlo: ${e.sugerencia}`);
    });
  }
  return lineas.join('\n');
}

export default function ResultadoFeedback({ resultado, error, cargando }) {
  const [copiado, setCopiado] = useState(false);

  if (error) {
    return (
      <div className="panel-card">
        <Encabezado icono="alerta" />
        <div className="server-error-box">
          <h4>No fue posible completar la revisión</h4>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (cargando) {
    return (
      <div className="panel-card">
        <Encabezado icono="buscar" />
        <div className="state-empty">
          <span className="loader-spinner loader-oscuro" />
          <h3>Revisando tu publicación</h3>
          <p>Comparando colores, tipografías, espacios y tono con las reglas de tu marca...</p>
        </div>
      </div>
    );
  }

  if (!resultado) {
    return (
      <div className="panel-card">
        <Encabezado icono="escudo" />
        <div className="state-empty">
          <div className="state-empty-icon">
            <Icono nombre="documento" tamano={40} grosor={1.5} />
          </div>
          <h3>Aquí verás el resultado</h3>
          <p>
            Sube tu publicación y pulsa <strong>"Revisar publicación"</strong>. Te diremos qué está bien y qué conviene
            corregir.
          </p>
        </div>
      </div>
    );
  }

  const { aprobado, puntaje = null, resumen = '', aciertos = [], errores = [] } = resultado;
  const tono = aprobado === null ? 'neutro' : aprobado ? 'exito' : 'error';
  const titulo =
    aprobado === null ? 'Sugerencias de mejora' : aprobado ? 'Lista para publicar' : 'Necesita algunos cambios';
  const ordenados = [...errores].sort((a, b) => SEVERIDADES[a.severidad].orden - SEVERIDADES[b.severidad].orden);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(generarInforme({ aprobado, puntaje, resumen, aciertos, errores: ordenados }));
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Portapapeles no disponible
    }
  };

  return (
    <div className="panel-card">
      <Encabezado icono={aprobado === false ? 'alerta' : 'check'} />

      <div className={`veredicto veredicto-${tono}`}>
        {puntaje !== null && <AnilloPuntaje puntaje={puntaje} tono={tono} />}
        <div>
          <h3>{titulo}</h3>
          {resumen && <p>{resumen}</p>}
        </div>
      </div>

      {aciertos.length > 0 && (
        <div className="bloque-resultado">
          <h4 className="bloque-titulo">Lo que está bien</h4>
          <ul className="lista-aciertos">
            {aciertos.map((a, i) => (
              <li key={i}>
                <Icono nombre="check" tamano={15} grosor={2.5} />
                <span>{a}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {ordenados.length > 0 && (
        <div className="bloque-resultado">
          <h4 className="bloque-titulo">
            {aprobado === null ? 'Sugerencias' : 'Para corregir'} ({ordenados.length})
          </h4>
          {ordenados.map((item, i) => (
            <div key={i} className={`observacion observacion-${item.severidad}`}>
              <div className="observacion-etiquetas">
                <span className={`etiqueta-severidad severidad-${item.severidad}`}>
                  {SEVERIDADES[item.severidad].etiqueta}
                </span>
                <span className="category-badge">{TITULOS_CATEGORIA[item.categoria]}</span>
              </div>
              <p className="error-message">{item.descripcion}</p>
              {item.sugerencia && (
                <div className="error-suggestion">
                  <strong>Cómo resolverlo: </strong>
                  <span>{item.sugerencia}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <button type="button" className="btn-secundario btn-ancho" onClick={copiar}>
        <Icono nombre={copiado ? 'check' : 'copiar'} tamano={16} />
        {copiado ? 'Informe copiado' : 'Copiar informe para el diseñador'}
      </button>
    </div>
  );
}
