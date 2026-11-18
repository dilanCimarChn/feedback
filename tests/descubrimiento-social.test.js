import test from 'node:test';
import assert from 'node:assert/strict';
import {consultarTikTokDiscovery,consultarFacebookExterno} from '../api/_lib/descubrimiento-social.js';

test('Discovery exige sus propias credenciales y comprueba la respuesta del proveedor sin fingir volúmenes',async()=>{
  const nombres=['TIKTOK_DISCOVERY_ACCESS_TOKEN','TIKTOK_DISCOVERY_BUSINESS_ID','TIKTOK_ACCESS_TOKEN'],prev=Object.fromEntries(nombres.map(k=>[k,process.env[k]])),fetch=globalThis.fetch;
  try {
    for(const k of nombres)delete process.env[k];process.env.TIKTOK_ACCESS_TOKEN='display-no-descubrimiento';
    let llamadas=0;
    globalThis.fetch=async(url,opts)=>{llamadas++;assert.equal(new URL(url).pathname,'/open_api/v1.3/discovery/trending/search/');assert.equal(new URL(url).searchParams.get('business_id'),'open_id_autorizado');assert.equal(new URL(url).searchParams.get('is_personalized'),'false');assert.equal(opts.headers['Access-Token'],'discovery-prueba');assert.ok(!String(url).includes('discovery-prueba'));return {ok:true,json:async()=>({code:40001,message:'NO IMPRIMIR',data:{}})};};
    assert.equal((await consultarTikTokDiscovery()).estado,'Sin configurar');assert.equal(llamadas,0);
    process.env.TIKTOK_DISCOVERY_ACCESS_TOKEN='discovery-prueba';process.env.TIKTOK_DISCOVERY_BUSINESS_ID='open_id_autorizado';
    const error=await consultarTikTokDiscovery();assert.equal(error.estado,'No disponible');assert.match(error.detalle,/discovery.search.words/);assert.ok(!JSON.stringify(error).includes('NO IMPRIMIR'));assert.equal(llamadas,1);
    process.env.TIKTOK_DISCOVERY_ACCESS_TOKEN='otro-token';
    globalThis.fetch=async()=>{llamadas++;return {ok:true,json:async()=>({code:0,data:{search_keywords:['education','education','volunteering',null]}})};};
    const r=await consultarTikTokDiscovery({pais:'US'});assert.equal(r.estado,'Consultada');assert.equal(r.items.length,2);assert.deepEqual(r.items[0].metricas,{});assert.equal(r.items[0].fecha,null);assert.equal(r.items[0].observaciones.regionVerificada,false);assert.match(r.alcance,/no filtra país/);
    await consultarTikTokDiscovery({tema:'otro tema',pais:'US'});assert.equal(llamadas,2,'la ruta no filtra por tema: comparte la misma respuesta pública');
  }finally{globalThis.fetch=fetch;for(const [k,v] of Object.entries(prev))v===undefined?delete process.env[k]:process.env[k]=v;}
});

test('Facebook externo no reutiliza el token propio, conserva enlaces originales y declara rechazos parciales',async()=>{
  const nombres=['FACEBOOK_DISCOVERY_PAGE_IDS','FACEBOOK_PUBLIC_ACCESS_TOKEN','FACEBOOK_PAGE_ACCESS_TOKEN','FACEBOOK_PAGE_ID','META_GRAPH_VERSION'],prev=Object.fromEntries(nombres.map(k=>[k,process.env[k]])),fetch=globalThis.fetch;
  try {
    process.env.FACEBOOK_PAGE_ID='111';process.env.FACEBOOK_PAGE_ACCESS_TOKEN='token-propio';process.env.META_GRAPH_VERSION='v25.0';process.env.FACEBOOK_DISCOVERY_PAGE_IDS='111,222,333';delete process.env.FACEBOOK_PUBLIC_ACCESS_TOKEN;
    let llamadas=0;globalThis.fetch=async()=>{llamadas++;throw new Error('No debe consultar');};
    assert.equal((await consultarFacebookExterno()).estado,'Sin configurar');assert.equal(llamadas,0);
    process.env.FACEBOOK_PUBLIC_ACCESS_TOKEN='publico-autorizado';
    globalThis.fetch=async(url,opts)=>{llamadas++;const u=new URL(url);assert.ok(!u.pathname.includes('111'));assert.equal(opts.headers.Authorization,'Bearer publico-autorizado');if(u.pathname.includes('333'))return {ok:false,status:403,json:async()=>({error:{message:'NO IMPRIMIR'}})};return {ok:true,json:async()=>({data:[{message:'Educación #Comunidad',created_time:'2026-11-16T10:00:00Z',permalink_url:'https://www.facebook.com/story.php?story_fbid=444&id=222&tracking=remove',shares:{count:9}},{message:'Enlace no válido',permalink_url:'https://host-inventado.test/post/1'}]})};};
    const r=await consultarFacebookExterno();assert.equal(llamadas,2);assert.equal(r.estado,'Consultada');assert.equal(r.parcial,true);assert.equal(r.items.length,1);assert.equal(r.items[0].metricas.compartidos,9);assert.match(r.items[0].url,/story_fbid=444/);assert.ok(!r.items[0].url.includes('tracking'));assert.ok(!JSON.stringify(r).includes('NO IMPRIMIR'));
  }finally{globalThis.fetch=fetch;for(const [k,v] of Object.entries(prev))v===undefined?delete process.env[k]:process.env[k]=v;}
});
