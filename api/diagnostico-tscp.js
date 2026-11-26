import { validarSolicitud } from './_lib/comun.js';
import { responderErrorServicio } from './_lib/carga.js';
import { crearDiagnosticoTscp, normalizarReferentes } from './_lib/diagnostico-tscp.js';
import { validarConfiguracionTscp } from '../src/lib/agente-tscp.js';

export default async function handler(req, res) {
  const apiKey = validarSolicitud(req, res);
  if (!apiKey) return;
  const entrada = req.body || {};
  let configuracion, referentes, perfil;
  try {
    if (JSON.stringify(entrada).length > 120000) throw new Error('El diagnóstico admite una configuración de hasta 120.000 caracteres.');
    if (entrada.perfil !== undefined && (!entrada.perfil || typeof entrada.perfil !== 'object' || Array.isArray(entrada.perfil))) throw new Error('El perfil de marca debe ser un objeto.');
    perfil = entrada.perfil || {};
    configuracion = validarConfiguracionTscp(entrada.configuracion || {}, perfil);
    referentes = normalizarReferentes(entrada.referentes || [], configuracion.redes);
  } catch (error) { return res.status(400).json({ error: error.message }); }
  try {
    const diagnostico = await crearDiagnosticoTscp({ configuracion, perfil, referentes }, { apiKey });
    res.setHeader?.('Cache-Control', 'private, no-store');
    return res.status(200).json(diagnostico);
  } catch (error) {
    if (responderErrorServicio(res, error)) return;
    return res.status(502).json({ error: 'No se pudo completar el diagnóstico. Conserva los referentes y vuelve a intentarlo.' });
  }
}
