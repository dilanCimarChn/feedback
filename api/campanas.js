import {validarAccesoEquipo,almacenamientoDisponible,almacenamientoLocal,repositorioCampanas} from './_lib/campanas-equipo.js';

export default async function handler(req,res) {
  const b=req.body||{};
  if(req.method==='POST'&&b.accion==='estado')return res.status(200).json({disponible:almacenamientoDisponible()&&Boolean(process.env.EQUIPO_CODIGO_ACCESO||process.env.APP_ACCESS_CODE),almacen:almacenamientoLocal()?'Archivo privado de desarrollo':'Vercel Blob privado'});
  if(!validarAccesoEquipo(req,res))return;
  if(b.accion==='hallazgo')return res.status(400).json({error:'Guarda el hallazgo desde el radar; el servidor debe verificar la observación consultada.'});
  if(!almacenamientoDisponible())return res.status(503).json({error:'El almacenamiento compartido no está configurado. Tu calendario local se conserva.'});
  try {return res.status(200).json(await repositorioCampanas.ejecutar(b));}
  catch(e){return res.status(e.status||503).json({error:e.status?e.message:'No se pudo guardar o leer el calendario compartido. Los cambios locales se conservan.'});}
}
