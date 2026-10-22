import { useState } from 'react';
import { Icono, OpcionesTarjeta, ZonaArchivos } from './ui';
import { comprimirImagen, esImagen } from '../lib/archivos';
import { llamarApi } from '../lib/api';

const FORMATOS = [
  { valor: 'post', titulo: 'Post', descripcion: 'Imagen única 1:1 o 4:5', max: 1 },
  { valor: 'carrusel', titulo: 'Carrusel', descripcion: 'Varias láminas', max: 8 },
  { valor: 'reel', titulo: 'Reel', descripcion: 'Portada o captura 9:16', max: 1 }
];

export default function FormularioPublicacion({ configuracion, onEvaluacionExitosa, onEvaluacionError, cargando, setCargando }) {
  const [copy, setCopy] = useState('');
  const [tipo, setTipo] = useState('post');
  const [imagenes, setImagenes] = useState([]);

  const formato = FORMATOS.find(f => f.valor === tipo);

  const cambiarTipo = nuevo => {
    setTipo(nuevo);
    const max = FORMATOS.find(f => f.valor === nuevo).max;
    setImagenes(prev => prev.slice(0, max));
  };

  const agregarImagenes = async archivos => {
    const validos = archivos.filter(esImagen).slice(0, formato.max - imagenes.length);
    try {
      const nuevas = await Promise.all(validos.map(a => comprimirImagen(a)));
      setImagenes(prev => [...prev, ...nuevas].slice(0, formato.max));
    } catch (error) {
      onEvaluacionError(error.message);
    }
  };

  const handleSubmit = async e => {
    e.preventDefault();
    if (!copy.trim() && !imagenes.length) {
      onEvaluacionError('Escribe el copy o sube una imagen para iniciar la revisión.');
      return;
    }

    setCargando(true);
    onEvaluacionError(null);
    try {
      const data = await llamarApi('/api/evaluar', {
        copy,
        imagenes,
        tipo,
        perfil: configuracion.perfil,
        comportamiento: configuracion.comportamiento
      });
      onEvaluacionExitosa(data);
    } catch (error) {
      onEvaluacionError(error.message);
    } finally {
      setCargando(false);
    }
  };

  return (
    <form className="panel-card" onSubmit={handleSubmit}>
      <div className="panel-header">
        <h2 className="panel-title">
          <span className="panel-icon-wrap">
            <Icono nombre="documento" />
          </span>
          <span>Publicación a revisar</span>
        </h2>
      </div>

      <div className="field-group">
        <label className="field-label">1. ¿Qué tipo de publicación es?</label>
        <OpcionesTarjeta opciones={FORMATOS} valor={tipo} onChange={cambiarTipo} />
      </div>

      <div className="field-group">
        <label className="field-label">
          2. {tipo === 'carrusel' ? 'Sube las láminas en orden' : tipo === 'reel' ? 'Sube la portada o una captura' : 'Sube la imagen'}
        </label>
        <ZonaArchivos
          miniaturas={imagenes}
          onAgregar={agregarImagenes}
          onQuitar={i => setImagenes(prev => prev.filter((_, j) => j !== i))}
          max={formato.max}
          multiple={formato.max > 1}
          titulo="Selecciona o arrastra aquí tu imagen"
          ayuda="PNG, JPG o WebP"
          deshabilitado={cargando}
        />
      </div>

      <div className="field-group">
        <label htmlFor="copy-texto" className="field-label">
          3. Texto que acompaña la publicación
        </label>
        <textarea
          id="copy-texto"
          className="input-textarea"
          placeholder="Pega aquí el texto (copy) que irá en la publicación..."
          value={copy}
          onChange={e => setCopy(e.target.value)}
          disabled={cargando}
        />
        <p className="field-hint contador">{copy.length} caracteres</p>
      </div>

      <button id="btn-evaluar" type="submit" className="btn-primary-action" disabled={cargando}>
        {cargando ? (
          <>
            <span className="loader-spinner" />
            <span>Revisando publicación...</span>
          </>
        ) : (
          <>
            <Icono nombre="buscar" tamano={16} />
            <span>Revisar publicación</span>
          </>
        )}
      </button>
    </form>
  );
}
