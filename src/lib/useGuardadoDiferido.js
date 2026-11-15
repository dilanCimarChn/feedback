import { useEffect, useRef } from 'react';

export function useGuardadoDiferido(clave, valor, onError, demora = 400) {
  const actual = useRef();
  actual.current = { valor, onError };
  const pendiente = useRef(false);
  const guardar = useRef(() => {});
  guardar.current = () => {
    if (!pendiente.current) return;
    try {
      localStorage.setItem(clave, JSON.stringify(actual.current.valor));
      pendiente.current = false;
      actual.current.onError('');
    } catch { actual.current.onError('No se pudo guardar en este navegador. Exporta para conservar el calendario.'); }
  };
  useEffect(() => {
    pendiente.current = true;
    const timer = setTimeout(() => guardar.current(), demora);
    return () => clearTimeout(timer);
  }, [clave, valor, demora]);
  useEffect(() => {
    const flush = () => guardar.current();
    const ocultar = () => { if (document.visibilityState === 'hidden') flush(); };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', ocultar);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', ocultar);
      flush();
    };
  }, [clave]);
}
