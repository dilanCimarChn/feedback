import test from 'node:test';
import assert from 'node:assert/strict';
import { llamarApi, registrarSolicitudCodigo } from '../src/lib/api.js';

test('solicitudes concurrentes comparten el modal de acceso y reintentan una sola vez', async () => {
  const original=globalThis.fetch, almacenamiento=globalThis.localStorage;
  let codigo='', modales=0, peticiones=0;
  try {
    globalThis.localStorage={getItem:()=>codigo,setItem:(k,v)=>{codigo=v;}};
    registrarSolicitudCodigo(async()=>{modales++;await new Promise(r=>setTimeout(r,5));return 'autorizado';});
    globalThis.fetch=async (url,options)=>{
      peticiones++;
      assert.ok(options.signal instanceof AbortSignal);
      if(options.headers['x-codigo-acceso']==='autorizado')return {ok:true,status:200,json:async()=>({ok:true})};
      return {ok:false,status:401,json:async()=>({codigoRequerido:true})};
    };
    const resultados=await Promise.all(Array.from({length:10},()=>llamarApi('/api/prueba',{})));
    assert.equal(modales,1);assert.equal(peticiones,20);assert.ok(resultados.every(r=>r.ok));
  } finally {globalThis.fetch=original;globalThis.localStorage=almacenamiento;registrarSolicitudCodigo(null);}
});

test('saturación conserva el estado HTTP y comunica espera sin reintentos automáticos', async () => {
  const original=globalThis.fetch;
  let peticiones=0;
  try {
    globalThis.fetch=async()=>{peticiones++;return {ok:false,status:503,headers:new Headers({'Retry-After':'7'}),json:async()=>({error:'Servicio ocupado'})};};
    await assert.rejects(llamarApi('/api/prueba',{}),e=>e.status===503&&e.reintentarEn===7&&e.message.includes('7 segundos'));
    assert.equal(peticiones,1);
  } finally {globalThis.fetch=original;}
});

test('un timeout del cliente termina la espera con un mensaje recuperable', async () => {
  const original=globalThis.fetch;
  try {
    globalThis.fetch=async()=>{throw new DOMException('Timeout','TimeoutError');};
    await assert.rejects(llamarApi('/api/prueba',{}),/tardó demasiado/);
  } finally {globalThis.fetch=original;}
});
