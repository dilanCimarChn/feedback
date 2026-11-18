import {mkdir,readFile,open,rename,unlink} from 'node:fs/promises';
import {resolve,join,dirname} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';

const vacio=()=>({campanas:{},referencias:[],hallazgos:[]});
const version=contenido=>createHash('sha256').update(contenido).digest('hex');
const conflicto=()=>Object.assign(new Error('Otro proceso actualizó el archivo local. Intenta guardar nuevamente.'),{status:409});

/** Desarrollo únicamente: el mismo contrato de revisiones que el almacén remoto. */
export function crearAlmacenLocal(directorio=resolve('.data.local')) {
  const carpeta=resolve(directorio),archivo=join(carpeta,'equipo-v1.json'),bloqueo=join(carpeta,'equipo.lock');
  const leer=async()=>{
    try{const contenido=await readFile(archivo,'utf8');return {datos:JSON.parse(contenido),etag:version(contenido)};}
    catch(e){if(e.code==='ENOENT')return {datos:vacio(),etag:null};throw e;}
  };
  const escribir=async(datos,etag)=>{
    await mkdir(carpeta,{recursive:true});let lock;
    for(let intento=0;intento<40;intento++){
      try{lock=await open(bloqueo,'wx');break;}catch(e){if(e.code!=='EEXIST')throw e;await new Promise(r=>setTimeout(r,10));}
    }
    if(!lock)throw conflicto();
    const temporal=join(carpeta,`equipo-${randomUUID()}.tmp`);
    try{
      const actual=await leer();if(actual.etag!==etag)throw conflicto();
      const contenido=JSON.stringify(datos),f=await open(temporal,'wx');
      try{await f.writeFile(contenido,'utf8');await f.sync();}finally{await f.close();}
      await rename(temporal,archivo);return {etag:version(contenido)};
    }finally{
      await unlink(temporal).catch(e=>{if(e.code!=='ENOENT')throw e;});
      await lock.close();await unlink(bloqueo);
    }
  };
  return {leer,escribir,archivo,directorio:dirname(archivo)};
}
