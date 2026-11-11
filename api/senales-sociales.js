import { obtenerSenales } from './_lib/senales-sociales.js';
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Utiliza POST.' });
  const codigo = process.env.APP_ACCESS_CODE?.trim();
  if (codigo && req.headers['x-codigo-acceso'] !== codigo) return res.status(401).json({ error: 'Ingresa el código de acceso.', codigoRequerido: true });
  const region = req.body?.region || 'BO';
  if (typeof region !== 'string' || !/^[A-Z]{2}$/.test(region)) return res.status(400).json({ error: 'Selecciona un país válido.' });
  try { return res.status(200).json(await obtenerSenales(region)); }
  catch (e) { return res.status(502).json({ error: e.message }); }
}
