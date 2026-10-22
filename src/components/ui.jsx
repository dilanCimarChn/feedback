import { useState } from 'react';

const RUTAS_ICONOS = {
  ajustes: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </>
  ),
  imagen: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </>
  ),
  documento: (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </>
  ),
  chispa: <path d="M12 3l1.9 5.8L20 10.7l-5.1 3.7 1.9 6-4.8-3.6-4.8 3.6 1.9-6L4 10.7l6.1-1.9z" />,
  cerrar: (
    <>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </>
  ),
  check: <polyline points="20 6 9 17 4 12" />,
  mas: (
    <>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </>
  ),
  buscar: (
    <>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </>
  ),
  alerta: (
    <>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </>
  ),
  escudo: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
  copiar: (
    <>
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </>
  ),
  descargar: (
    <>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </>
  ),
  subir: (
    <>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </>
  ),
  reiniciar: (
    <>
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
    </>
  )
};

export function Icono({ nombre, tamano = 18, grosor = 2 }) {
  return (
    <svg
      width={tamano}
      height={tamano}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={grosor}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {RUTAS_ICONOS[nombre]}
    </svg>
  );
}

// Lista editable de palabras: se agregan con Enter o coma y se quitan con la X
export function ChipsInput({ valores, onChange, placeholder, prefijo = '' }) {
  const [borrador, setBorrador] = useState('');

  const agregar = () => {
    let valor = borrador.trim().replace(/,$/, '');
    if (!valor) return;
    if (prefijo && !valor.startsWith(prefijo)) valor = prefijo + valor;
    if (!valores.includes(valor)) onChange([...valores, valor]);
    setBorrador('');
  };

  const handleKeyDown = e => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      agregar();
    } else if (e.key === 'Backspace' && !borrador && valores.length) {
      onChange(valores.slice(0, -1));
    }
  };

  return (
    <div className="chips-input">
      {valores.map(valor => (
        <span key={valor} className="chip">
          {valor}
          <button
            type="button"
            className="chip-quitar"
            onClick={() => onChange(valores.filter(v => v !== valor))}
            aria-label={`Quitar ${valor}`}
          >
            <Icono nombre="cerrar" tamano={11} grosor={2.5} />
          </button>
        </span>
      ))}
      <input
        value={borrador}
        onChange={e => setBorrador(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={agregar}
        placeholder={valores.length ? '' : placeholder}
      />
    </div>
  );
}

// Grupo de opciones tipo tarjeta (una sola seleccionada)
export function OpcionesTarjeta({ opciones, valor, onChange, columnas = 3 }) {
  return (
    <div className="opciones-tarjeta" style={{ '--columnas': columnas }} role="radiogroup">
      {opciones.map(op => (
        <button
          key={op.valor}
          type="button"
          role="radio"
          aria-checked={valor === op.valor}
          className={`opcion-tarjeta ${valor === op.valor ? 'activa' : ''}`}
          onClick={() => onChange(op.valor)}
        >
          <span className="opcion-titulo">{op.titulo}</span>
          {op.descripcion && <span className="opcion-descripcion">{op.descripcion}</span>}
        </button>
      ))}
    </div>
  );
}

export function Segmentado({ opciones, valor, onChange }) {
  return (
    <div className="segmentado" role="radiogroup">
      {opciones.map(op => (
        <button
          key={op.valor}
          type="button"
          role="radio"
          aria-checked={valor === op.valor}
          className={valor === op.valor ? 'activo' : ''}
          onClick={() => onChange(op.valor)}
        >
          {op.titulo}
        </button>
      ))}
    </div>
  );
}

export function Interruptor({ activo, onChange, titulo, descripcion }) {
  return (
    <label className="interruptor">
      <span className="interruptor-texto">
        <span className="interruptor-titulo">{titulo}</span>
        {descripcion && <span className="interruptor-descripcion">{descripcion}</span>}
      </span>
      <input type="checkbox" checked={activo} onChange={e => onChange(e.target.checked)} />
      <span className="interruptor-pista" aria-hidden="true" />
    </label>
  );
}

// Zona para soltar o seleccionar archivos, con miniaturas
export function ZonaArchivos({ miniaturas, onAgregar, onQuitar, max, multiple = true, titulo, ayuda, deshabilitado }) {
  const lleno = miniaturas.length >= max;

  const handleChange = e => {
    const archivos = Array.from(e.target.files || []);
    e.target.value = '';
    if (archivos.length) onAgregar(archivos);
  };

  return (
    <div>
      {!lleno && (
        <div className={`dropzone ${miniaturas.length ? 'dropzone-compacta' : ''}`}>
          <input
            type="file"
            accept="image/png, image/jpeg, image/webp"
            multiple={multiple}
            className="dropzone-input"
            onChange={handleChange}
            disabled={deshabilitado}
          />
          <div className="dropzone-icon">
            <Icono nombre={miniaturas.length ? 'mas' : 'imagen'} tamano={miniaturas.length ? 20 : 28} grosor={1.8} />
          </div>
          <p className="dropzone-title">{miniaturas.length ? 'Agregar más imágenes' : titulo}</p>
          <p className="field-hint">{ayuda}</p>
        </div>
      )}
      {miniaturas.length > 0 && (
        <div className="miniaturas">
          {miniaturas.map((src, i) => (
            <div key={i} className="miniatura">
              <img src={src} alt={`Imagen ${i + 1}`} />
              <span className="miniatura-numero">{i + 1}</span>
              {!deshabilitado && (
                <button type="button" className="miniatura-quitar" onClick={() => onQuitar(i)} aria-label="Quitar imagen">
                  <Icono nombre="cerrar" tamano={12} grosor={2.5} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      <p className="field-hint">
        {miniaturas.length} de {max} {max === 1 ? 'imagen' : 'imágenes'}
      </p>
    </div>
  );
}
