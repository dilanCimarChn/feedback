import test from 'node:test';
import assert from 'node:assert/strict';
import { agendaTscp, TSCP, SECUENCIA_EMAIL, enlacesTscp } from '../src/lib/tscp.js';
import handler from '../api/plan-automatico.js';

test('TSCP mantiene cadencia por red y embudo entre bloques',()=>{
  const agenda=agendaTscp('2026-11-16','2026-11-22');
  for(const [red,n] of Object.entries({Instagram:3,LinkedIn:2,Facebook:2,TikTok:2}))assert.equal(agenda.filter(p=>p.red===red).length,n);
  assert.equal(agendaTscp('2026-12-01','2026-12-03','2026-11-01')[0].proposito,'Consideration');
  assert.equal(agendaTscp('2027-01-01','2027-01-03','2026-11-01')[0].proposito,'Conversion');
  assert.match(enlacesTscp('Register now','LinkedIn','pieza-1'),/utm_content=pieza-1/);
  assert.match(enlacesTscp('Book intro meeting','LinkedIn','pieza-1'),/Pendiente/);
});

test('API TSCP valida agenda, segmentación, CTA y secuencia condicional de email',async()=>{
  const anterior=globalThis.fetch, key=process.env.GEMINI_API_KEY, codigo=process.env.APP_ACCESS_CODE;
  process.env.GEMINI_API_KEY='test';delete process.env.APP_ACCESS_CODE;
  let invalido=false;
  globalThis.fetch=async(url,opts)=>{
    if(!String(url).includes('generativelanguage'))throw new Error('Sin fuentes');
    const agenda=agendaTscp('2026-11-16','2026-11-22');
    const publicaciones=agenda.map(p=>({...p,hora:'12:00',formato:p.red==='TikTok'?'Clip':'Imagen',publico_objetivo:TSCP.segmentos[0],pilar:TSCP.pilares[0],cta:invalido?'Inventado':'Learn more',mensaje:'Conectar recursos con necesidades',...Object.fromEntries(['titulo','gancho','guion','copy','metrica','motivo','base_horario','visual','distribucion'].map(k=>[k,'Propuesta pendiente de validar'])),hashtags:[],palabras_clave:[]}));
    const emails=SECUENCIA_EMAIL.map(([dia,asunto])=>({dia,asunto,copy:'Conoce TSCP. Puedes solicitar la baja.',cta:'Learn more'}));
    return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:JSON.stringify({estrategia:'Adquisición de ONGs',publicaciones,emails,experimentos:[]})}]}}]})};
  };
  const invocar=async()=>{const res={status(c){this.code=c;return this;},json(d){this.data=d;return this;}};await handler({method:'POST',headers:{},body:{inicio:'2026-11-16',fin:'2026-11-22',pais:'US',zona:'America/New_York',descripcion:TSCP.descripcion,estrategia:'tscp'}},res);return res;};
  try{
    const r=await invocar();assert.equal(r.code,200);assert.equal(r.data.publicaciones.length,9);assert.equal(r.data.emails.length,5);assert.match(r.data.emails[1].condicion,/clic ni respuesta/);assert.match(r.data.publicaciones[0].url_cta,/utm_source/);
    invalido=true;assert.equal((await invocar()).code,502);
  }finally{globalThis.fetch=anterior;if(key===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=key;if(codigo===undefined)delete process.env.APP_ACCESS_CODE;else process.env.APP_ACCESS_CODE=codigo;}
});
