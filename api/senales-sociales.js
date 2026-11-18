import { responderErrorServicio } from './_lib/carga.js';
import { obtenerSenales } from './_lib/senales-sociales.js';
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Utiliza POST.' });
  const codigo = process.env.APP_ACCESS_CODE?.trim();
  if (codigo && req.headers['x-codigo-acceso'] !== codigo) return res.status(401).json({ error: 'Ingresa el código de acceso.', codigoRequerido: true });
  const region = req.body?.region || 'BO';
  if (typeof region !== 'string' || !/^[A-Z]{2}$/.test(region)) return res.status(400).json({ error: 'Selecciona un país válido.' });
  const tema=req.body?.tema||'';
  if(typeof tema!=='string'||tema.length>150)return res.status(400).json({error:'Indica un tema de hasta 150 caracteres.'});
  try { return res.status(200).json(await obtenerSenales(region,tema)); }
  catch (e) { if (responderErrorServicio(res, e)) return; return res.status(502).json({ error: e.message }); }
}
