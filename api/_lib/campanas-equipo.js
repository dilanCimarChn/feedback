import {get,head,put,BlobPreconditionFailedError} from '@vercel/blob';
import {prepararCampana,referenciaManual,idValido} from '../../src/lib/campanas.js';
import {timingSafeEqual} from 'node:crypto';
import {crearAlmacenLocal} from './almacen-local.js';
import {prepararHallazgo} from '../../src/lib/radar.js';

const RUTA='feedback/equipo-v1.json';
export class ErrorCampana extends Error {constructor(message,status=400){super(message);this.status=status;}}
export function validarAccesoEquipo(req,res) {
  if(req.method!=='POST'){res.status(405).json({error:'Utiliza POST.'});return false;}
  const codigo=(process.env.EQUIPO_CODIGO_ACCESO||process.env.APP_ACCESS_CODE||'').trim();
  if(!codigo){res.status(503).json({error:'El administrador debe configurar el código de acceso del equipo para compartir campañas.'});return false;}
  const recibido=String(req.headers?.['x-codigo-acceso']||'');
  const a=Buffer.from(codigo),b=Buffer.from(recibido);
  if(a.length!==b.length||!timingSafeEqual(a,b)){res.status(401).json({error:'Ingresa el código del equipo para abrir los calendarios compartidos.',codigoRequerido:true});return false;}
  res.setHeader?.('Cache-Control','private, no-store');
  return true;
}
const blobConfigurado=()=>Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim()||(process.env.BLOB_STORE_ID&&process.env.VERCEL_OIDC_TOKEN));
export const almacenamientoLocal=()=>process.env.NODE_ENV==='development'&&!process.env.VERCEL&&!blobConfigurado();
export const almacenamientoDisponible=()=>blobConfigurado()||almacenamientoLocal();
const opciones=()=>({access:'private',...(process.env.BLOB_READ_WRITE_TOKEN?{token:process.env.BLOB_READ_WRITE_TOKEN}:{})});
export function crearAlmacenBlob({leerBlob=get,leerMetadata=head,escribirBlob=put}={}){return {
  async leer(){
    const r=await leerBlob(RUTA,{...opciones(),useCache:false,abortSignal:AbortSignal.timeout(12000)});
    if(!r)return {datos:{campanas:{},referencias:[]},etag:null};
    const datos=await new Response(r.stream).json();let etag=r.blob.etag;
    // If-Match exige un ETag fuerte; contrasta metadata para no asociar
    // contenido antiguo con una escritura concurrente tras una respuesta comprimida.
    if(etag?.startsWith('W/')){
      const metadata=await leerMetadata(RUTA,{...opciones(),abortSignal:AbortSignal.timeout(12000)});
      if(etag.slice(2)!==metadata.etag)throw new ErrorCampana('El documento cambió durante la lectura. Intenta guardar nuevamente.',409);
      etag=metadata.etag;
    }
    if(!etag)throw new ErrorCampana('No se pudo comprobar la versión del documento. Los cambios locales se conservan.',503);
    return {datos,etag};
  },
  async escribir(datos,etag){
    try {return await escribirBlob(RUTA,JSON.stringify(datos),{...opciones(),contentType:'application/json',addRandomSuffix:false,allowOverwrite:Boolean(etag),...(etag?{ifMatch:etag}:{}),abortSignal:AbortSignal.timeout(12000)});}
    catch(e){if(e instanceof BlobPreconditionFailedError||/already exists|precondition/i.test(e.message||''))throw new ErrorCampana('Otra persona guardó cambios al mismo tiempo.',409);throw e;}
  }
};}
export const almacenBlob=crearAlmacenBlob();
const local=crearAlmacenLocal();
const almacenAutomatico={leer:()=> (almacenamientoLocal()?local:almacenBlob).leer(),escribir:(datos,etag)=>(almacenamientoLocal()?local:almacenBlob).escribir(datos,etag)};
export function crearRepositorioCampanas(almacen=almacenAutomatico) {
  async function ejecutar(b) {
    if(!['listar','abrir','guardar','referencia','hallazgo'].includes(b.accion))throw new ErrorCampana('Acción de campañas no válida.');
    let plan,manual,hallazgo;
    try {plan=b.accion==='guardar'?prepararCampana(b.plan):null;manual=b.accion==='referencia'?referenciaManual(b.referencia):null;hallazgo=b.accion==='hallazgo'?prepararHallazgo(b.hallazgo):null;}
    catch(e){throw new ErrorCampana(e.message);}
    if(plan&&(!Number.isInteger(b.revision)||b.revision<0))throw new ErrorCampana('Falta la versión de la campaña.');
    for(let intento=0;intento<3;intento++) {
      let lectura;
      try{lectura=await almacen.leer();}catch(e){if(e.status===409&&intento<2)continue;throw e;}
      const {datos,etag}=lectura;
      datos.campanas||={};datos.referencias||=[];datos.hallazgos||=[];
      if(b.accion==='listar')return {campanas:Object.values(datos.campanas).map(c=>({id:c.plan.id,nombre:c.plan.nombre,inicio:c.plan.inicio,fin:c.plan.fin,publicaciones:c.plan.publicaciones.length,revision:c.revision,actualizado:c.actualizado})).sort((a,b)=>b.actualizado.localeCompare(a.actualizado)),referencias:datos.referencias,hallazgos:datos.hallazgos};
      if(b.accion==='abrir') {
        if(!idValido(b.id))throw new ErrorCampana('La campaña no es válida.');
        const c=datos.campanas[b.id];if(!c)throw new ErrorCampana('La campaña no existe en el equipo.',404);return c;
      }
      let respuesta;
      if(plan) {
        const actual=datos.campanas[plan.id];
        if((actual?.revision||0)!==b.revision)throw new ErrorCampana('Otra persona actualizó esta campaña. Tus cambios se conservan aquí: guárdalos como copia o abre la versión del equipo.',409);
        if(!actual&&Object.keys(datos.campanas).length>=30)throw new ErrorCampana('El equipo alcanzó 30 campañas. Conserva una exportación y organiza las campañas antes de añadir otra.');
        respuesta={plan,revision:(actual?.revision||0)+1,actualizado:new Date().toISOString()};datos.campanas[plan.id]=respuesta;
      } else if(hallazgo) {
        const existente=datos.hallazgos.find(h=>h.id===hallazgo.id&&h.consultado===hallazgo.consultado);
        if(existente)return {hallazgo:existente};
        if(datos.hallazgos.length>=200)throw new ErrorCampana('El equipo alcanzó 200 observaciones guardadas. Exporta los hallazgos antes de reorganizarlos.');
        datos.hallazgos.push(hallazgo);respuesta={hallazgo};
      } else {
        const existente=datos.referencias.find(r=>r.url===manual.url);
        if(existente)return {referencia:existente};
        if(datos.referencias.length>=100)throw new ErrorCampana('El equipo alcanzó 100 referencias manuales.');
        datos.referencias.push(manual);respuesta={referencia:manual};
      }
      if(JSON.stringify(datos).length>10000000)throw new ErrorCampana('El espacio de campañas alcanzó el límite de tamaño configurado. Exporta los planes antes de reorganizarlos.');
      try {await almacen.escribir(datos,etag);return respuesta;}
      catch(e){if(e.status!==409||intento===2)throw e;}
    }
  }
  return {ejecutar};
}
export const repositorioCampanas=crearRepositorioCampanas();
