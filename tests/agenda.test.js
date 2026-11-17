import test from 'node:test';
import assert from 'node:assert/strict';
import { crearAgenda, herramientaPara } from '../api/_lib/agenda-marketing.js';
import { REDES, dividirCampana } from '../src/lib/marketing.js';

const base = { inicio: '2026-12-01', fin: '2026-12-31', zona: 'America/New_York' };
const conteos = agenda => REDES.map(red => agenda.filter(p => p.red === red).length);

test('la cantidad exacta respeta prioridad, cobertura, formatos y capacidad diaria', () => {
  assert.deepEqual(REDES, ['Facebook', 'Instagram', 'TikTok', 'X', 'LinkedIn', 'YouTube']);
  for (let total = 1; total <= 120; total++) {
    const agenda = crearAgenda({ ...base, cantidadPublicaciones: total });
    assert.equal(agenda.length, total);
    const cantidades = conteos(agenda);
    assert.ok(cantidades.every((n, i) => !i || cantidades[i - 1] >= n), `${total}: ${cantidades}`);
    if (total >= 6) assert.ok(cantidades.every(n => n > 0));
    else assert.deepEqual(cantidades, REDES.map((_, i) => i < total ? 1 : 0));
    assert.equal(new Set(agenda.map(p => p.fecha + p.red)).size, total);
    assert.ok(agenda.every(p => p.fecha >= base.inicio && p.fecha <= base.fin));
    assert.ok(agenda.filter(p => ['TikTok', 'YouTube'].includes(p.red)).every(p => p.formato === 'Clip'));
    assert.ok(agenda.every(p => /Prueba inicial/.test(p.base_horario) && /America\/New_York/.test(p.base_horario)));
  }
});

test('mes completo y bloques conservan cantidad y distribución por red', () => {
  for (const total of [1, 6, 22, 120]) {
    const completa = crearAgenda({ ...base, totalPublicaciones: total });
    const bloques = dividirCampana(base.inicio, base.fin, 7);
    const porBloques = bloques.flatMap(b => {
      const desde = (Date.parse(b.inicio) - Date.parse(base.inicio)) / 86400000;
      const dias = (Date.parse(b.fin) - Date.parse(b.inicio)) / 86400000 + 1;
      return crearAgenda({ ...base, ...b, origen: base.inicio, finCampana: base.fin, totalPublicaciones: total,
        cantidadPublicaciones: Math.round(total * (desde + dias) / 31) - Math.round(total * desde / 31) });
    });
    assert.equal(porBloques.length, total);
    assert.deepEqual(porBloques, completa);
  }
});

test('una campaña anual reparte las seis redes durante todos los meses', () => {
  const inicio = '2026-11-16', fin = '2027-11-15', total = 261;
  const bloques = dividirCampana(inicio, fin, 7);
  const agenda = bloques.flatMap(b => {
    const desde = (Date.parse(b.inicio) - Date.parse(inicio)) / 86400000;
    const dias = (Date.parse(b.fin) - Date.parse(b.inicio)) / 86400000 + 1;
    return crearAgenda({ ...b, origen: inicio, finCampana: fin, totalPublicaciones: total,
      cantidadPublicaciones: Math.round(total * (desde + dias) / 365) - Math.round(total * desde / 365) });
  });
  assert.equal(agenda.length, total);
  assert.equal(new Set(agenda.map(p => p.fecha + p.red)).size, total);
  assert.deepEqual(conteos(agenda), [79, 66, 47, 31, 23, 15]);
  for (const mes of new Set(agenda.map(p => p.fecha.slice(0, 7)))) {
    const cantidades = conteos(agenda.filter(p => p.fecha.startsWith(mes)));
    assert.ok(cantidades.every(n => n > 0), `${mes}: faltan redes ${cantidades}`);
    assert.ok(cantidades.every((n, i) => !i || cantidades[i - 1] >= n), `${mes}: ${cantidades}`);
  }
  for (const red of REDES) {
    const fechas = agenda.filter(p => p.red === red).map(p => Date.parse(p.fecha));
    assert.ok(fechas[0] - Date.parse(inicio) < 14 * 86400000, red);
    assert.ok(fechas.every((fecha, i) => !i || fecha - fechas[i - 1] <= 40 * 86400000), red);
  }
});

test('histórico reciente selecciona alcance medio dentro de la misma red y día', () => {
  const ahora = new Date();
  const inicio = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth() + 1, 1));
  const fin = new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth() + 1, 0));
  const filas = [];
  // Se cubren todos los días semanales para comprobar la elección, cualquiera sea el slot.
  for (let i = 1; i <= 28; i++) {
    const fecha = new Date(Date.parse(ahora.toISOString().slice(0, 10)) - i * 86400000).toISOString().slice(0, 10);
    for (const [hora, alcance, pagado] of [['07:30', 150, false], ['11:15', 75, false], ['22:00', 9000, true]]) {
      filas.push({ red: REDES[0], formato: 'Reel', fecha, hora, alcance, interacciones: 5, conversiones: 0, pagado });
    }
  }
  const agenda = crearAgenda({ inicio: inicio.toISOString().slice(0, 10), fin: fin.toISOString().slice(0, 10),
    cantidadPublicaciones: 1, metricas: filas, zona: 'America/La_Paz' });
  assert.equal(agenda[0].hora, '07:00');
  assert.match(agenda[0].base_horario, /4 publicaciones orgánicas/);
  assert.match(agenda[0].base_horario, /alcance medio 150/);
  assert.match(agenda[0].base_horario, /No mide personas conectadas/);
});

test('cero publicaciones, límites diarios y cuotas incoherentes se manejan explícitamente', () => {
  assert.deepEqual(crearAgenda({ ...base, cantidadPublicaciones: 0 }), []);
  assert.throws(() => crearAgenda({ inicio: base.inicio, fin: base.inicio, cantidadPublicaciones: 7 }), /cantidad total/);
  assert.throws(() => crearAgenda({ ...base, totalPublicaciones: 20, cantidadPublicaciones: 21 }), /no coincide/);
  assert.throws(() => crearAgenda({ ...base, inicio: '2026-02-30' }), /rango/);
  const unDia = crearAgenda({ inicio: base.inicio, fin: base.inicio, cantidadPublicaciones: 6 });
  assert.equal(new Set(unDia.map(p => p.red)).size, 6);
});

test('la frecuencia automática y las herramientas usan propuestas y enlaces oficiales', () => {
  assert.equal(crearAgenda(base).length, 22);
  for (const red of REDES) {
    const herramienta = herramientaPara(red, 'Reel', 'US');
    assert.ok(herramienta.nombre && herramienta.uso);
    assert.match(herramienta.url, /^https:\/\//);
  }
});
