import test from 'node:test';
import assert from 'node:assert/strict';
import { crearConfiguracionTscp, validarConfiguracionTscp, crearReferentesTscp, crearGuiaTscp, exportarGuiaTscp, REDES_TSCP } from '../src/lib/agente-tscp.js';

test('la campaña reutiliza la marca y valida objetivo, fechas, duración y los cuatro canales', () => {
  const perfil = { mision: 'Misión del equipo', vocabulario_aprobado: ['Colaboración'], manual_marca: { nombre: 'marca.pdf', analizado: true }, lenguajes: { LinkedIn: 'Institucional' } };
  const config = crearConfiguracionTscp(perfil, {}, '2026-11-25');
  assert.equal(config.mision, perfil.mision);
  assert.deepEqual(config.vocabulario, ['Colaboración']);
  assert.equal(config.manual.nombre, 'marca.pdf');
  assert.equal(config.lenguajes.LinkedIn, 'Institucional');
  const anterior = crearConfiguracionTscp({ vocabulario_aprobado: [], palabras_clave: ['Término del perfil'] });
  assert.deepEqual(anterior.vocabulario, ['Término del perfil']);
  assert.equal(anterior.marcaConfirmada, false);
  const normal = validarConfiguracionTscp({ ...config, cantidad: 1, unidad: 'dias' });
  assert.equal(normal.fin, '2026-11-25');
  assert.equal(normal.dias, 1);
  assert.deepEqual(normal.redes, REDES_TSCP);
  assert.throws(() => validarConfiguracionTscp({ ...config, inicio: '2026-02-30' }));
  assert.throws(() => validarConfiguracionTscp({ ...config, objetivo: '' }));
  assert.throws(() => validarConfiguracionTscp({ ...config, redes: ['X'] }));
  assert.throws(() => validarConfiguracionTscp({ ...config, redes: ['Instagram', 'Instagram'] }));
  assert.throws(() => validarConfiguracionTscp({ ...config, cantidad: 0 }));
  assert.throws(() => validarConfiguracionTscp({ ...config, cantidad: 367, unidad: 'dias' }));
  assert.throws(() => validarConfiguracionTscp({ ...config, cantidad: 13, unidad: 'meses' }));
  assert.throws(() => validarConfiguracionTscp({ ...config, zona: 'Inventada' }));
  assert.equal(validarConfiguracionTscp({ ...config, inicio: '2024-01-01', cantidad: 1, unidad: 'anos' }).dias, 366);
});

test('los referentes sugeridos no simulan perfiles ni métricas verificadas', () => {
  const refs = crearReferentesTscp();
  assert.equal(refs.length, 8);
  assert.ok(refs.every(r => r.seguidores === null && !r.url && !r.cuenta && !r.publicaciones.length));
  assert.ok(refs.every(r => ['Good360', 'TechSoup'].includes(r.nombre)));
});

test('el cronograma respeta fechas y canales elegidos sin producir textos finales', () => {
  const config = { ...crearConfiguracionTscp({}, {}, '2026-11-23'), cantidad: 1, unidad: 'semanas' };
  const guia = crearGuiaTscp(config);
  assert.equal(guia.publicaciones.length, 9);
  assert.equal(guia.estado, 'Propuesta por confirmar con marketing');
  assert.deepEqual(guia.emails.map(e => e.dia), [0, 3, 7, 13, 20]);
  assert.equal(new Set(guia.publicaciones.map(p => p.fecha)).size, 3);
  assert.deepEqual(guia.frecuencia, { LinkedIn: 2, Instagram: 3, Facebook: 2, TikTok: 2 });
  assert.deepEqual(guia.frecuencias.find(f => f.canal === 'LinkedIn'), { canal: 'LinkedIn', minima: 2, maxima: 3, propuesta: 2, diasPropuestos: ['lunes', 'viernes'] });
  assert.match(guia.criterioFrecuencia, /no exige publicar todos los días/);
  const exportado = exportarGuiaTscp(config, {}, guia);
  assert.match(exportado, /Frecuencia del flujo \/ semana/);
  assert.match(exportado, /LinkedIn \| 2–3 \| 2 \| lunes, viernes/);
  for (const p of guia.publicaciones) {
    assert.ok(p.fecha >= '2026-11-23' && p.fecha <= '2026-11-29');
    assert.equal('copy' in p, false);
    assert.equal('guion' in p, false);
    assert.ok(p.estructura.length);
  }
  const seleccion = crearGuiaTscp({ ...config, redes: ['LinkedIn', 'TikTok'] });
  assert.equal(seleccion.publicaciones.length, 4);
  assert.ok(seleccion.publicaciones.every(p => ['LinkedIn', 'TikTok'].includes(p.red)));
  assert.ok(guia.emails.every(e => !('copy' in e) && !('asunto' in e)));
});

test('la guía conserva segmentos del diagnóstico y exporta pendientes y fuentes', () => {
  const config = { ...crearConfiguracionTscp({}, {}, '2026-11-23'), cantidad: 1, unidad: 'semanas', objetivoTipo: 'empresa' };
  const diagnostico = { consultado: '2026-11-23T00:00:00Z', fuentes: [{ id: 'F1', url: 'https://example.org/caso', tipo: 'Aportado por el equipo' }],
    segmentos: [{ segmento: 'Alianzas | regionales', canal: 'LinkedIn', necesidad: 'Información', objetivo: 'Conocer colaboración' }],
    benchmark: [{ canal: 'LinkedIn', fuentes: ['F1', 'inventada'], recomendacion: 'Comparar CTA' }],
    pendientes: ['Confirmar manual y enlaces'], mensaje: { central: 'Posicionamiento por aprobar', apoyos: [], variantes: [] } };
  const guia = crearGuiaTscp(config, diagnostico);
  assert.deepEqual(guia.publicaciones.find(p => p.red === 'LinkedIn').referencias, ['F1']);
  assert.equal(guia.publicaciones.find(p => p.red === 'LinkedIn').segmento, 'Alianzas | regionales');
  const markdown = exportarGuiaTscp(config, diagnostico, guia);
  assert.match(markdown, /Alianzas \\\| regionales/);
  assert.match(markdown, /Confirmar manual y enlaces/);
  assert.match(markdown, /Paso 2 · Pendiente de marketing/);
  assert.match(markdown, /https:\/\/example.org\/caso/);
  assert.ok(markdown.includes(guia.publicaciones[0].estructura[0]));
  assert.ok(markdown.includes(guia.publicaciones[0].cta));
  assert.ok(markdown.includes(guia.emails[0].estructura[0]));
  const lejano = crearGuiaTscp({ ...config, inicio: '2027-02-01' }, diagnostico);
  assert.ok(lejano.publicaciones.every(p => p.referencias.length === 0));
});

test('ejemplos de copy y hashtags se incluyen en exportaciones y se vinculan una vez por canal', () => {
  const config = { ...crearConfiguracionTscp({}, {}, '2026-11-23'), cantidad: 1, unidad: 'semanas' };
  const diagnostico = { sugerencias: [{ canal: 'Instagram', tema: 'Aporta tu experiencia', formato: 'Reel', idea: 'Presentar una necesidad por validar', gancho: 'Tu experiencia cuenta', copy: 'Consulta cómo colaborar: [enlace por confirmar].', hashtags: ['#TSCP', '#Colaboracion', '#Voluntariado'], cta: 'Conocer cómo participar', estructura: ['Presentar la misión', 'Invitar a consultar'], fuentes: [], estado: 'Borrador orientativo' }] };
  const guia = crearGuiaTscp(config, diagnostico);
  assert.equal(guia.sugerencias.length, 1);
  assert.equal(guia.publicaciones.filter(p => p.sugerenciaId).length, 1);
  assert.equal(guia.publicaciones.find(p => p.sugerenciaId).red, 'Instagram');
  assert.match(exportarGuiaTscp(config, diagnostico, guia), /Consulta cómo colaborar/);
  assert.match(exportarGuiaTscp(config, diagnostico, guia), /#Voluntariado/);
  assert.equal(crearGuiaTscp({ ...config, redes: ['LinkedIn'] }, diagnostico).sugerencias.length, 0);
  assert.deepEqual(crearGuiaTscp(config, {}).sugerencias, []);
});
