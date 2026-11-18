import { responderErrorServicio } from './_lib/carga.js';
import { investigarMarketing } from './_lib/investigacion-marketing.js';
import {validarAccesoEquipo,almacenamientoDisponible,repositorioCampanas} from './_lib/campanas-equipo.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Utiliza POST.' });
  const codigo = process.env.APP_ACCESS_CODE?.trim();
  if (codigo && req.headers['x-codigo-acceso'] !== codigo) return res.status(401).json({ error: 'Ingresa el código de acceso.', codigoRequerido: true });
  const { tema = '', pais = 'BO',dias=7,idioma='',hashtags,cuentas,localidad='',orden='viewCount',palabrasClave='',canalId='',accion='consultar',hallazgoId } = req.body || {};
  if(!['consultar','guardar'].includes(accion))return res.status(400).json({error:'Acción de radar no válida.'});
  if(accion==='guardar'){
    if(!validarAccesoEquipo(req,res))return;
    if(!almacenamientoDisponible())return res.status(503).json({error:'No hay almacenamiento disponible para guardar el hallazgo.'});
    if(typeof hallazgoId!=='string'||!hallazgoId||hallazgoId.length>6000)return res.status(400).json({error:'Selecciona un hallazgo de la consulta.'});
  }
  const region = ({ CI: 'CL', SP: 'ES', '': 'BO' })[pais] || pais;
  if (typeof tema !== 'string' || tema.length > 150 || !['BO','AR','CL','CO','MX','PE','ES','US'].includes(region)) return res.status(400).json({ error: 'Indica un tema de hasta 150 caracteres y un país válido.' });
  if(!Number.isInteger(dias)||dias<1||dias>30||typeof idioma!=='string'||(idioma&&!/^[a-z]{2}(?:-[A-Za-z]{2,4})?$/.test(idioma))||typeof localidad!=='string'||localidad.length>120||[hashtags,cuentas].some(v=>v!==undefined&&(!Array.isArray(v)||v.length>2||v.some(s=>typeof s!=='string'||s.length>100))))return res.status(400).json({error:'Revisa el período de 1 a 30 días, idioma y hasta dos hashtags o cuentas de referencia.'});
  if(!['viewCount','relevance','date'].includes(orden)||typeof palabrasClave!=='string'||palabrasClave.length>150||typeof canalId!=='string'||(canalId&&!/^UC[\w-]{22}$/.test(canalId)))return res.status(400).json({error:'Revisa el orden, las palabras clave y el ID de canal de YouTube (UC…).'});
  const consulta = (tema.match(/[\p{L}\p{N}]+/gu) || []).slice(0,15).join(' ');
  try {
    const evidencia = await investigarMarketing(region, consulta,localidad,{dias,idioma,hashtags,cuentas,orden,palabrasClave,canalId});
    if(accion==='guardar'){
      const hallazgo=evidencia.resultados.find(r=>r.id===hallazgoId&&!r.propia);
      if(!hallazgo)return res.status(409).json({error:'La observación ya no está disponible en esta consulta. Conserva tus resultados, vuelve a consultar o agrega el enlace como referencia manual.'});
      return res.status(200).json(await repositorioCampanas.ejecutar({accion:'hallazgo',hallazgo}));
    }
    return res.status(200).json({ ...evidencia, articulos: evidencia.noticias.map(n => ({ titulo:n.titulo,url:n.url,fecha:n.fecha })), serie:[], actualizado:evidencia.consultado, filtros:{tema:tema.trim() || 'Exploración general',pais:region,periodo:dias,idioma}, aviso:'Cada fuente declara su cobertura y sus permisos. Los filtros no convierten las señales actuales en un histórico si el proveedor no lo ofrece. Puedes continuar al calendario aunque una fuente falle.' });
  } catch (error) { if (responderErrorServicio(res, error)) return; return res.status(502).json({ error:'No se pudo iniciar la consulta. Intenta de nuevo; el calendario sigue disponible en Estrategia y calendario.' }); }
}
