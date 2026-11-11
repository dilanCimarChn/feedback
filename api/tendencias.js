import { investigarMarketing } from './_lib/investigacion-marketing.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Utiliza POST.' });
  const codigo = process.env.APP_ACCESS_CODE?.trim();
  if (codigo && req.headers['x-codigo-acceso'] !== codigo) return res.status(401).json({ error: 'Ingresa el código de acceso.', codigoRequerido: true });
  const { tema = '', pais = 'BO' } = req.body || {};
  const region = ({ CI: 'CL', SP: 'ES', '': 'BO' })[pais] || pais;
  if (typeof tema !== 'string' || tema.length > 150 || !['BO','AR','CL','CO','MX','PE','ES','US'].includes(region)) return res.status(400).json({ error: 'Indica un tema de hasta 150 caracteres y un país válido.' });
  const consulta = (tema.match(/[\p{L}\p{N}]+/gu) || []).slice(0,15).join(' ') || 'marketing';
  try {
    const evidencia = await investigarMarketing(region, consulta);
    return res.status(200).json({ ...evidencia, articulos: evidencia.noticias.map(n => ({ titulo:n.titulo,url:n.url,fecha:n.fecha })), serie:[], actualizado:evidencia.consultado, filtros:{tema:tema.trim() || 'Exploración general',pais:region,periodo:7}, aviso:'Se consultaron fuentes independientes. El historial de cobertura no está disponible en este radar; las noticias corresponden a los últimos 7 días. Puedes continuar al calendario aunque una fuente falle.' });
  } catch { return res.status(502).json({ error:'No se pudo iniciar la consulta. Intenta de nuevo; el calendario sigue disponible en Estrategia y calendario.' }); }
}
