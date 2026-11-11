import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/tendencias.js';

async function consultar(body) {
  const res={status(c){this.code=c;return this;},json(d){this.data=d;return this;}};
  await handler({method:'POST',headers:{},body},res);return res;
}
test('el radar devuelve tendencias aunque GDELT falle, y declara fallos totales sin inventar datos',async()=>{
  const previo={fetch:globalThis.fetch,codigo:process.env.APP_ACCESS_CODE,youtube:process.env.YOUTUBE_API_KEY};
  try{
    delete process.env.APP_ACCESS_CODE;delete process.env.YOUTUBE_API_KEY;
    globalThis.fetch=async url=>{
      if(String(url).includes('trends.google.com'))return {ok:true,text:async()=>'<rss><channel><item><title>Tema real de prueba</title><ht:approx_traffic>500+</ht:approx_traffic></item></channel></rss>'};
      throw new Error('GDELT no responde');
    };
    const parcial=await consultar({tema:'educacion radar parcial',pais:'BO'});
    assert.equal(parcial.code,200);
    assert.equal(parcial.data.tendencias.length,1);
    assert.equal(parcial.data.estados.find(s=>s.fuente==='GDELT').estado,'No disponible');
    assert.deepEqual(parcial.data.articulos,[]);
    globalThis.fetch=async()=>{throw new Error('offline');};
    const vacio=await consultar({tema:'consulta sin fuentes',pais:'MX'});
    assert.equal(vacio.code,200);assert.deepEqual(vacio.data.tendencias,[]);
    assert.equal(vacio.data.estados[0].estado,'No disponible');
    assert.deepEqual(vacio.data.serie,[]);
    assert.equal((await consultar({tema:'x',pais:'invalid'})).code,400);
    process.env.APP_ACCESS_CODE='privado';
    assert.equal((await consultar({tema:'educacion',pais:'BO'})).code,401);
  }finally{
    globalThis.fetch=previo.fetch;
    for(const [k,v] of [['APP_ACCESS_CODE',previo.codigo],['YOUTUBE_API_KEY',previo.youtube]])if(v===undefined)delete process.env[k];else process.env[k]=v;
  }
});
