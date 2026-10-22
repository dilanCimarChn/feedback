import { useState } from 'react';
import { Icono } from './ui';

export default function CodigoAccesoModal({ mensaje, onConfirmar, onCancelar }) {
  const [codigo, setCodigo] = useState('');

  const handleSubmit = e => {
    e.preventDefault();
    if (codigo.trim()) onConfirmar(codigo.trim());
  };

  return (
    <div className="modal-fondo">
      <form className="modal modal-pequeno" role="dialog" aria-modal="true" onSubmit={handleSubmit}>
        <div className="modal-cuerpo">
          <div className="icono-acceso">
            <Icono nombre="escudo" tamano={22} />
          </div>
          <h2 className="titulo-acceso">Ingresa tu código de acceso</h2>
          <p className="field-hint texto-centrado">
            Lo necesitas solo una vez en este navegador. Si no lo tienes, pídeselo a quien te compartió la herramienta.
          </p>
          {mensaje && <div className="aviso aviso-error aviso-simple">{mensaje}</div>}
          <input
            className="input-texto"
            type="password"
            value={codigo}
            onChange={e => setCodigo(e.target.value)}
            placeholder="Código de acceso"
            autoFocus
          />
        </div>
        <footer className="modal-pie modal-pie-derecha">
          <button type="button" className="btn-secundario" onClick={onCancelar}>
            Cancelar
          </button>
          <button type="submit" className="btn-guardar" disabled={!codigo.trim()}>
            Continuar
          </button>
        </footer>
      </form>
    </div>
  );
}
