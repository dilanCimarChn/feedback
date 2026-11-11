import test from 'node:test';
import assert from 'node:assert/strict';
import { crearFechas, validarMetricas, resumirMetricas, calendarioCsv, importarCsv } from '../src/lib/marketing.js';
import planHandler from '../api/plan-marketing.js';
import senalesHandler from '../api/senales-sociales.js';

const registro = { red: 'Instagram', formato: 'Carrusel', fecha: '2026-10-01', hora: '18:00', alcance: 100, interacciones: 10, conversiones: 2 };
const entrada = { mes: '2028-02', dias: [2], redes: ['Instagram'], horarios: ['12:00','18:00'], zona: 'America/La_Paz', causa: 'Educación', objetivo: 'Voluntariado', metricas: [] };
async function invocar(handler, body, headers = {}) {
  const res = { status(n) { this.code = n; return this; }, json(data) { this.data = data; return this; } };
  await handler({ method: 'POST', headers, body },res); return res;
}

test('calendario respeta días de semana, mes y año bisiesto', () => {
  assert.deepEqual(crearFechas('2028-02',[2]), ['2028-02-01','2028-02-08','2028-02-15','2028-02-22','2028-02-29']);
  assert.equal(crearFechas('2026-02',[0,1,2,3,4,5,6]).length,28);
  assert.throws(() => crearFechas('2026-13',[1]));
  assert.throws(() => crearFechas('2026-02',[]));
});
test('histórico rechaza fechas imposibles y métricas no numéricas', () => {
  assert.equal(validarMetricas([registro]).length,1);
  assert.throws(() => validarMetricas([{...registro,fecha:'2026-02-30'}]));
  assert.throws(() => validarMetricas([{...registro,alcance:'100'}]));
  assert.throws(() => validarMetricas([{...registro,hora:'25:30'}]));
});
test('comparación separa red, excluye pagados y usa tasa ponderada', () => {
  const datos = [registro,{...registro,alcance:300,interacciones:15},{...registro,red:'Facebook'},{...registro,pagado:true,alcance:99999}];
  const resumen = resumirMetricas(datos);
  assert.equal(resumen.length,2);
  assert.equal(resumen[0].publicaciones,2);
  assert.equal(resumen[0].alcanceMedio,200);
  assert.equal(resumen[0].tasaInteraccion,6.25);
  assert.equal(resumirMetricas(datos,'2026-11-01').length,0);
  assert.equal(resumirMetricas([{...registro,alcance:0}])[0].tasaInteraccion,null);
});
test('CSV conserva zona y escapa fórmulas y comillas', () => {
  const csv = calendarioCsv({zona:'America/La_Paz',publicaciones:[{titulo:'=HYPERLINK("x")',copy:'Línea 1\nLínea 2',hashtags:['#ONG']}]});
  assert.ok(csv.includes('America/La_Paz'));
  assert.ok(csv.includes("\"'=HYPERLINK(\"\"x\"\")\""));
});
test('importación CSV admite Excel, campos entre comillas y rechaza campos numéricos vacíos', () => {
  const cabecera='red;formato;fecha;hora;alcance;interacciones;conversiones;pagado;hashtags\r\n';
  const csv='\uFEFF'+cabecera+'Instagram;Carrusel;2026-10-01;18:00;100;10;2;no;"#ONG #Educación"\r\n';
  assert.equal(importarCsv(csv)[0].alcance,100);
  assert.equal(importarCsv(csv)[0].pagado,false);
  assert.equal(importarCsv(csv)[0].hashtags,'#ONG #Educación');
  assert.throws(() => importarCsv(cabecera+'Instagram;Carrusel;2026-10-01;18:00;;10;2;no;'));
  assert.throws(() => importarCsv('otra,columna\na,b'));
});
test('API protege acceso y devuelve calendario completo con fechas deterministas', async () => {
  const oldFetch = globalThis.fetch, oldKey = process.env.GEMINI_API_KEY, oldCode = process.env.APP_ACCESS_CODE;
  try {
    process.env.GEMINI_API_KEY='test'; process.env.APP_ACCESS_CODE='privado';
    assert.equal((await invocar(planHandler,entrada)).code,401);
    const headers = {'x-codigo-acceso':'privado'};
    assert.equal((await invocar(planHandler,{...entrada,zona:'invalida'},headers)).code,400);
    assert.equal((await invocar(planHandler,{...entrada,redes:[]},headers)).code,400);
    const publicaciones = crearFechas(entrada.mes,entrada.dias).map(() => ({red:'Instagram',formato:'Carrusel',copy:'Participa en el taller.',titulo:'Una acción por la educación',gancho:'Aprender juntos',guion:'Tres láminas con pasos para participar',cta:'Consulta por el taller',metrica:'Registros',motivo:'Explicar el proceso',hashtags:['#Educación','invalid']}));
    const prompts = [];
    globalThis.fetch = async (url, options) => {
      prompts.push(JSON.parse(options.body).contents[0].parts[0].text);
      return {ok:true,json:async () => ({candidates:[{content:{parts:[{text:JSON.stringify({estrategia:'Aprender, conocer y participar.',publicaciones})}]}}]})};
    };
    const result = await invocar(planHandler,entrada,headers);
    assert.equal(result.code,200);
    assert.equal(result.data.publicaciones.length,5);
    assert.equal(result.data.publicaciones.at(-1).fecha,'2028-02-29');
    assert.deepEqual(result.data.publicaciones.map(p => p.hora),['12:00','18:00','12:00','18:00','12:00']);
    assert.deepEqual(result.data.publicaciones[0].hashtags,['#Educación']);
    assert.match(result.data.base,/Sin tendencias externas/);
    for (const sector of ['Gastronomía','Servicios profesionales','ONG','Nicho especializado libre']) {
      const personalizado = { ...entrada, causa: undefined, sector, oferta: 'Propuesta particular de la marca', campana: 'Campaña mensual', objetivo: 'Conseguir consultas' };
      assert.equal((await invocar(planHandler,personalizado,headers)).code,200);
      const contexto = JSON.parse(prompts.at(-1).split('DATOS:\n')[1]);
      assert.equal(contexto.sector,sector);
      assert.equal(contexto.oferta,personalizado.oferta);
      assert.equal(contexto.campana,personalizado.campana);
      assert.equal(contexto.objetivo,personalizado.objetivo);
      assert.match(prompts.at(-1),/No presupongas una ONG/);
    }
    publicaciones.pop();
    assert.equal((await invocar(planHandler,entrada,headers)).code,502);
  } finally {
    globalThis.fetch=oldFetch;
    if (oldKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY=oldKey;
    if (oldCode === undefined) delete process.env.APP_ACCESS_CODE; else process.env.APP_ACCESS_CODE=oldCode;
  }
});
test('señales sin conexión no devuelven métricas inventadas', async () => {
  const oldCode=process.env.APP_ACCESS_CODE, oldKey=process.env.YOUTUBE_API_KEY;
  try {
    delete process.env.APP_ACCESS_CODE; delete process.env.YOUTUBE_API_KEY;
    const result=await invocar(senalesHandler,{region:'BO'});
    assert.equal(result.code,200); assert.equal(result.data.conectado,false); assert.deepEqual(result.data.videos,[]);
    assert.equal((await invocar(senalesHandler,{region:'invalid'})).code,400);
  } finally {
    if (oldKey === undefined) delete process.env.YOUTUBE_API_KEY; else process.env.YOUTUBE_API_KEY=oldKey;
    if (oldCode === undefined) delete process.env.APP_ACCESS_CODE; else process.env.APP_ACCESS_CODE=oldCode;
  }
});
