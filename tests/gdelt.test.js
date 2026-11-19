import test from 'node:test';
import assert from 'node:assert/strict';
import {buscarNoticiasGdelt,ErrorGdelt} from '../api/_lib/noticias-gdelt.js';

const consultar=opciones=>buscarNoticiasGdelt({pausa:{hasta:0},...opciones});
const json=datos=>new Response(JSON.stringify(datos),{headers:{'content-type':'application/json'}});

test('GDELT consulta la API oficial por tema y período, conserva enlaces y amplía una localidad vacía',async()=>{
  const llamadas=[];
  const r=await consultar({consulta:'nonprofit "United States" "Boston"',consultaNacional:'nonprofit "United States"',region:'Boston',dias:7,fetchImpl:async(url,opciones)=>{
    const u=new URL(url);llamadas.push(u);
    assert.equal(u.origin,'https://api.gdeltproject.org');assert.equal(u.pathname,'/api/v2/doc/doc');
    assert.equal(u.searchParams.get('mode'),'artlist');assert.equal(u.searchParams.get('format'),'json');assert.equal(u.searchParams.get('timespan'),'7d');assert.equal(opciones.headers.Accept,'application/json');
    return json({articles:llamadas.length===1?[]:[{title:'Nonprofit news',url:'https://example.org/news',seendate:'20261118T120000Z',language:'English'},{title:'Duplicada',url:'https://example.org/news'},{title:'No permitido',url:'javascript:alert(1)'}]});
  }});
  assert.equal(llamadas.length,2);assert.equal(r.noticias.length,1);assert.equal(r.noticias[0].url,'https://example.org/news');assert.equal(r.consulta,'nonprofit "United States"');assert.match(r.nivel,/sin resultados para la localidad/);
});

test('GDELT distingue una lista vacía de HTML, errores de consulta y JSON mal formado sin reflejar respuestas crudas',async()=>{
  const base={consulta:'nonprofit'};
  assert.deepEqual((await consultar({...base,fetchImpl:async()=>json({articles:[]})})).noticias,[]);
  for(const [cuerpo,causa]of [['<html>NO MOSTRAR: mantenimiento</html>','respuesta_no_valida'],['Your query is invalid NO MOSTRAR','consulta_rechazada'],['{}','respuesta_no_valida']]){
    await assert.rejects(consultar({...base,fetchImpl:async()=>new Response(cuerpo)}),e=>e instanceof ErrorGdelt&&e.causa===causa&&!e.message.includes('NO MOSTRAR'));
  }
});

test('los fallos HTTP de GDELT se identifican sin reintentar ni inventar resultados',async()=>{
  for(const [status,causa]of [[429,'limite_consultas'],[503,'error_proveedor'],[400,'consulta_rechazada']]){
    let llamadas=0;
    await assert.rejects(consultar({consulta:'nonprofit',fetchImpl:async()=>{llamadas++;return new Response('NO MOSTRAR',{status});}}),e=>e.causa===causa&&e.codigoHttp===status&&!e.message.includes('NO MOSTRAR'));
    assert.equal(llamadas,1);
  }
});

test('la ampliación de localidad comparte el presupuesto de tiempo de la primera consulta',async()=>{
  let instante=0,llamadas=0;
  await assert.rejects(consultar({consulta:'nonprofit Boston',consultaNacional:'nonprofit',region:'Boston',tiempoMs:20,ahora:()=>instante,fetchImpl:async()=>{llamadas++;instante=21;return json({articles:[]});}}),e=>e.causa==='tiempo_agotado');
  assert.equal(llamadas,1,'no inicia otra espera completa cuando ya venció el presupuesto');
});

test('GDELT informa tiempo agotado o falta de conexión con causas seguras',async()=>{
  for(const [error,causa]of [[Object.assign(new Error('NO MOSTRAR'),{name:'TimeoutError'}),'tiempo_agotado'],[new Error('NO MOSTRAR'),'sin_conexion']]){
    await assert.rejects(consultar({consulta:'nonprofit',fetchImpl:async()=>{throw error;}}),e=>e.causa===causa&&!e.message.includes('NO MOSTRAR'));
  }
});

test('una cuota de GDELT pausa consultas de otros temas hasta vencer Retry-After',async()=>{
  let instante=100000,llamadas=0;const pausa={hasta:0};
  const opciones={pausa,ahora:()=>instante,fetchImpl:async()=>{llamadas++;return llamadas===1?new Response('NO MOSTRAR',{status:429,headers:{'retry-after':'8'}}):json({articles:[]});}};
  await assert.rejects(consultar({...opciones,consulta:'nonprofit'}),e=>e.causa==='limite_consultas'&&e.reintentarEn===8);
  instante+=3000;
  await assert.rejects(consultar({...opciones,consulta:'education'}),e=>e.causa==='limite_consultas'&&e.reintentarEn===5);
  assert.equal(llamadas,1,'no consulta otro tema mientras siga la cuota');
  instante+=5000;
  assert.deepEqual((await consultar({...opciones,consulta:'education'})).noticias,[]);assert.equal(llamadas,2);
});

test('la pausa de cuota tiene un valor predeterminado y limita Retry-After entre 1 y 300 segundos',async()=>{
  const ahora=Date.parse('2026-11-18T12:00:00Z');
  for(const [valor,esperado]of [[null,60],['no válido',60],['0',1],['5000',300],['Wed, 18 Nov 2026 12:00:30 GMT',30]]){
    const pausa={hasta:0};
    await assert.rejects(consultar({consulta:'nonprofit',pausa,ahora:()=>ahora,fetchImpl:async()=>new Response('',{status:429,headers:valor===null?{}:{'retry-after':valor}})}),e=>e.reintentarEn===esperado);
    assert.equal(pausa.hasta,ahora+esperado*1000);
  }
});
