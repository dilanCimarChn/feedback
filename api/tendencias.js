import { responderErrorServicio } from './_lib/carga.js';
import { investigarMarketing } from './_lib/investigacion-marketing.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Utiliza POST.' });
  const codigo = process.env.APP_ACCESS_CODE?.trim();
  if (codigo && req.headers['x-codigo-acceso'] !== codigo) return res.status(401).json({ error: 'Ingresa el código de acceso.', codigoRequerido: true });
  const { tema = '', pais = 'BO',dias=7,idioma='',hashtags,cuentas,localidad='' } = req.body || {};
  const region = ({ CI: 'CL', SP: 'ES', '': 'BO' })[pais] || pais;
  if (typeof tema !== 'string' || tema.length > 150 || !['BO','AR','CL','CO','MX','PE','ES','US'].includes(region)) return res.status(400).json({ error: 'Indica un tema de hasta 150 caracteres y un país válido.' });
  if(!Number.isInteger(dias)||dias<1||dias>30||typeof idioma!=='string'||(idioma&&!/^[a-z]{2}(?:-[A-Za-z]{2,4})?$/.test(idioma))||typeof localidad!=='string'||localidad.length>120||[hashtags,cuentas].some(v=>v!==undefined&&(!Array.isArray(v)||v.length>2||v.some(s=>typeof s!=='string'||s.length>100))))return res.status(400).json({error:'Revisa el período de 1 a 30 días, idioma y hasta dos hashtags o cuentas de referencia.'});
  const consulta = (tema.match(/[\p{L}\p{N}]+/gu) || []).slice(0,15).join(' ');
  try {
    const evidencia = await investigarMarketing(region, consulta,localidad,{dias,idioma,hashtags,cuentas});
    return res.status(200).json({ ...evidencia, articulos: evidencia.noticias.map(n => ({ titulo:n.titulo,url:n.url,fecha:n.fecha })), serie:[], actualizado:evidencia.consultado, filtros:{tema:tema.trim() || 'Exploración general',pais:region,periodo:dias,idioma}, aviso:'Cada fuente declara su cobertura y sus permisos. Los filtros no convierten las señales actuales en un histórico si el proveedor no lo ofrece. Puedes continuar al calendario aunque una fuente falle.' });
  } catch (error) { if (responderErrorServicio(res, error)) return; return res.status(502).json({ error:'No se pudo iniciar la consulta. Intenta de nuevo; el calendario sigue disponible en Estrategia y calendario.' }); }
}
