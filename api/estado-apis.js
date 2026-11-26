import { timingSafeEqual } from 'node:crypto';
import { estadoApis } from './_lib/estado-apis.js';

export default function handler(req, res) {
  res.setHeader?.('Cache-Control', 'private, no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Utiliza POST.' });
  const codigo = process.env.APP_ACCESS_CODE?.trim();
  if (codigo) {
    const esperado = Buffer.from(codigo), recibido = Buffer.from(String(req.headers?.['x-codigo-acceso'] || ''));
    if (esperado.length !== recibido.length || !timingSafeEqual(esperado, recibido)) return res.status(401).json({ error: 'Ingresa el código de acceso.', codigoRequerido: true });
  }
  if (req.body?.accion !== undefined && req.body.accion !== 'estado') return res.status(400).json({ error: 'Esta ruta solo consulta la configuración de las APIs.' });
  return res.status(200).json(estadoApis());
}
