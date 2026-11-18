import dotenv from 'dotenv';
import {resolve} from 'node:path';

/** Ninguna variable del servidor se exporta a Vite ni al navegador. */
export function cargarEntornoLocal(raiz=process.cwd()) {
  const alta=dotenv.config({path:resolve(raiz,'.env.local'),override:false}).parsed||{};
  const base=dotenv.config({path:resolve(raiz,'.env'),override:false}).parsed||{};
  for(const [nombre,valor] of Object.entries({...base,...alta}))if(valor&&/^(VITE_|NEXT_PUBLIC_).*(?:TOKEN|SECRET|PASSWORD|API_KEY|CODIGO_ACCESO|ACCESS_CODE)/i.test(nombre))throw new Error('Se detectó una credencial con prefijo público. Usa únicamente nombres de backend en los archivos de entorno.');
}
