import {validarAccesoEquipo} from './_lib/campanas-equipo.js';
import {consultarPlataformas} from './_lib/plataformas-sociales.js';
import {normalizarRadar} from '../src/lib/radar.js';
import {responderErrorServicio} from './_lib/carga.js';

export default async function handler(req,res){
  if(!validarAccesoEquipo(req,res))return;
  try{
    const plataformas=await consultarPlataformas('');
    const consultado=new Date().toISOString();
    return res.status(200).json({consultado,plataformas,resultados:normalizarRadar({plataformas,consultado}),aviso:'Publicaciones y métricas de las cuentas autorizadas; no son tendencias públicas ni datos de competidores.'});
  }catch(e){if(responderErrorServicio(res,e))return;return res.status(502).json({error:'No se pudieron consultar las cuentas propias. El radar público sigue disponible.'});}
}
