import test from 'node:test';
import assert from 'node:assert/strict';
import { resolverReferentesTscp } from '../api/_lib/perfiles-referentes-tscp.js';
import { crearReferentesTscp, REDES_TSCP } from '../src/lib/agente-tscp.js';

test('localiza tres perfiles por canal desde fuentes oficiales, sin inventar métricas', () => {
  const refs = resolverReferentesTscp(crearReferentesTscp(), REDES_TSCP);
  assert.equal(refs.length, 12);
  for (const canal of REDES_TSCP) {
    assert.equal(refs.filter(r => r.canal === canal && r.url).length, 3);
    assert.ok(refs.filter(r => r.canal === canal).every(r => r.identificacion.url.startsWith('https://')));
  }
  assert.equal(refs.find(r => r.canal === 'Instagram' && r.nombre === 'Good360').cuenta, 'good360usa');
  assert.deepEqual(refs.filter(r => r.canal === 'TikTok').map(r => r.nombre), ['American Red Cross', 'Doctors Without Borders', 'UNICEF']);
  assert.equal(refs.find(r => r.id === 'tiktok-1').identificacion.sustituye, 'Good360');
  assert.ok(refs.every(r => r.seguidores === null && !r.publicaciones.length));
});

test('preserva perfiles y observaciones elegidos por el equipo; no sustituye candidatos con datos manuales', () => {
  const datos = [{ id: 'tiktok-1', nombre: 'Good360', canal: 'TikTok', url: '', seguidores: 0, publicaciones: [] }];
  const refs = resolverReferentesTscp(datos, ['TikTok']);
  assert.equal(refs[0].nombre, 'Good360');
  assert.equal(refs[0].seguidores, 0);
  assert.equal(refs[0].url, '');
  assert.equal(refs.length, 3);
  const manuales = Array.from({ length: 3 }, (_, i) => ({ id: `manual-${i}`, nombre: `Otra ONG ${i}`, canal: 'Instagram', url: `https://www.instagram.com/otra${i}/`, publicaciones: [] }));
  assert.deepEqual(resolverReferentesTscp(manuales, ['Instagram']), manuales);
  assert.ok(resolverReferentesTscp([], ['Facebook']).every(r => r.canal === 'Facebook'));
});
