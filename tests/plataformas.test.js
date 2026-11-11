import test from 'node:test';
import assert from 'node:assert/strict';
import { consultarPlataformas } from '../api/_lib/plataformas-sociales.js';

const variables=['META_GRAPH_VERSION','FACEBOOK_PAGE_ID','FACEBOOK_PAGE_ACCESS_TOKEN','INSTAGRAM_USER_ID','INSTAGRAM_ACCESS_TOKEN','TIKTOK_ACCESS_TOKEN','X_BEARER_TOKEN','LINKEDIN_ACCESS_TOKEN','LINKEDIN_ORGANIZATION_ID','LINKEDIN_VERSION'];
test('conexiones sociales declaran accesos faltantes, normalizan datos y aíslan fallos',async()=>{
  const anteriores=Object.fromEntries(variables.map(k=>[k,process.env[k]]));const original=globalThis.fetch;
  try{
    variables.forEach(k=>delete process.env[k]);
    let llamadas=0;
    globalThis.fetch=async()=>{llamadas++;throw new Error('No debe consultar sin credenciales');};
    const sinConfig=await consultarPlataformas('educación');
    assert.equal(sinConfig.length,5);assert.ok(sinConfig.every(r=>r.estado==='Sin configurar'));assert.equal(llamadas,0);
    Object.assign(process.env,{META_GRAPH_VERSION:'v99.0',FACEBOOK_PAGE_ID:'123',FACEBOOK_PAGE_ACCESS_TOKEN:'secreto-fb',INSTAGRAM_USER_ID:'456',INSTAGRAM_ACCESS_TOKEN:'secreto-ig',TIKTOK_ACCESS_TOKEN:'secreto-tiktok',X_BEARER_TOKEN:'secreto-x',LINKEDIN_ACCESS_TOKEN:'secreto-li',LINKEDIN_ORGANIZATION_ID:'789',LINKEDIN_VERSION:'202611'});
    const peticiones=[];
    globalThis.fetch=async(url,opciones)=>{
      peticiones.push({url:String(url),opciones});let cuerpo;
      if(String(url).includes('/123/posts'))cuerpo={data:[{message:'Actividad #Comunidad',permalink_url:'https://www.facebook.com/123/posts/1',created_time:'2026-11-01T12:00:00Z',shares:{count:4}}]};
      else if(String(url).includes('/456/media'))cuerpo={data:[{caption:'Aprende #Educación',media_type:'VIDEO',media_product_type:'REELS',permalink:'https://www.instagram.com/reel/test/',timestamp:'2026-11-01T12:00:00Z',like_count:20,comments_count:3}]};
      else if(String(url).includes('tiktokapis'))cuerpo={error:{code:'ok'},data:{videos:[{title:'Taller',video_description:'Un #Taller',share_url:'https://www.tiktok.com/@prueba/video/1',create_time:1793534400,view_count:100,like_count:9,share_count:2}]}};
      else if(String(url).includes('api.x.com'))cuerpo={data:[{id:'123456',text:'Una idea #Educación',created_at:'2026-11-01T12:00:00Z',public_metrics:{like_count:7,reply_count:1}}]};
      else cuerpo={elements:[{id:'urn:li:share:123',commentary:'Una publicación profesional',publishedAt:1793534400000}]};
      return {ok:true,json:async()=>cuerpo};
    };
    const datos=await consultarPlataformas('educación');
    assert.ok(datos.every(p=>p.estado==='Consultada'));
    assert.equal(datos.find(p=>p.fuente==='Instagram').items[0].formato,'Reel');
    assert.equal(datos.find(p=>p.fuente==='Facebook').items[0].metricas.compartidos,4);
    assert.equal(datos.find(p=>p.fuente==='TikTok').items[0].metricas.vistas,100);
    assert.equal(datos.find(p=>p.fuente==='X').items[0].metricas.vistas,null);
    assert.deepEqual(datos.find(p=>p.fuente==='LinkedIn').items[0].metricas,{});
    assert.ok(peticiones.every(p=>p.opciones.headers.Authorization.startsWith('Bearer ')));
    assert.ok(!JSON.stringify(datos).includes('secreto-'));
    assert.ok(peticiones.every(p=>!p.url.includes('secreto-')));
    globalThis.fetch=async()=>({ok:false,status:403});
    const fallos=await consultarPlataformas('otra consulta');
    assert.ok(fallos.every(p=>p.estado==='No disponible'&&p.items.length===0));
    assert.ok(fallos.every(p=>/permisos/.test(p.detalle)));
  }finally{
    globalThis.fetch=original;
    for(const k of variables)if(anteriores[k]===undefined)delete process.env[k];else process.env[k]=anteriores[k];
  }
});
