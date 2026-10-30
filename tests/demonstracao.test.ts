import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { carregarDemonstracao, normalizarDemonstracao } from '../src/lib/demonstracao';
import { normalizarPontos } from '../src/lib/pontos';
import { calcularIdade } from '../src/lib/integrantes';
import { cpfValido } from '../src/lib/familias';

const ler = (nome: string) => JSON.parse(readFileSync(new URL(`../public/${nome}`, import.meta.url), 'utf8'));
const familias = ler('dados-exemplo.json');
type Posicao = [number, number];
type Geometria = { type: 'Polygon' | 'MultiPolygon'; coordinates: Posicao[][] | Posicao[][][] };
function emAnel([x, y]: Posicao, anel: Posicao[]): boolean {
  let dentro = false;
  for (let i = 0, j = anel.length - 1; i < anel.length; j = i++) {
    const [xi, yi] = anel[i]; const [xj, yj] = anel[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}
function emGeometria(posicao: Posicao, geometria: Geometria): boolean {
  const poligonos = geometria.type === 'Polygon' ? [geometria.coordinates as Posicao[][]] : geometria.coordinates as Posicao[][][];
  return poligonos.some(poligono => emAnel(posicao, poligono[0]) && !poligono.slice(1).some(anel => emAnel(posicao, anel)));
}

test('base contém 500 famílias fictícias distintas e dados úteis para consulta', () => {
  assert.equal(familias.length, 500);
  assert.equal(new Set(familias.map((p: { id: string }) => p.id)).size, 500);
  assert.equal(new Set(familias.map((p: { nomeRepresentante: string }) => p.nomeRepresentante)).size, 500);
  for (const p of familias) {
    assert.match(p.id, /^exemplo-\d{4}$/);
    assert.ok(p.nomeRepresentante.length >= 3 && p.nomeRepresentante.length <= 120);
    assert.ok(p.resumoDemonstrativo.moradores >= 1 && p.resumoDemonstrativo.moradores <= 7);
    assert.ok(p.resumoDemonstrativo.referenciaLocal.length > 10);
    assert.match(p.resumoDemonstrativo.nucleo, /^Sede de Goiana/);
    assert.equal(p.resumoDemonstrativo.integrantes.length, p.resumoDemonstrativo.moradores);
    assert.equal(p.resumoDemonstrativo.integrantes[0].nomeCompleto, p.nomeRepresentante);
    assert.equal(p.resumoDemonstrativo.integrantes[0].parentesco, 'representante');
    for (const pessoa of p.resumoDemonstrativo.integrantes) { assert.notEqual(calcularIdade(pessoa.dataNascimento), null); assert.equal(pessoa.cpf, '00000000000'); assert.equal(cpfValido(pessoa.cpf), false); }
    assert.ok(!('cpf' in p) && !('telefone' in p) && !('dados' in p));
    assert.deepEqual(Object.keys(p.resumoDemonstrativo).sort(), ['areaSgb', 'integrantes', 'moradores', 'nucleo', 'referenciaLocal']);
  }
  assert.deepEqual([...new Set(familias.map((p: { nivelRisco: string }) => p.nivelRisco))].sort(), ['alto', 'baixo', 'medio']);
});

test('cada ponto está dentro da área média ou alta do SGB informada nos seus detalhes', () => {
  const sgb = ler('camadas/suscetibilidade-goiana.geojson');
  const areas = new Map(sgb.features.map((f: { properties: { id: string }; geometry: Geometria }) => [f.properties.id, f]));
  for (const familia of familias) {
    const referencia = familia.resumoDemonstrativo.areaSgb;
    const area = areas.get(referencia.id) as { properties: { descricao: string; camada: string }; geometry: Geometria };
    assert.ok(area, familia.id);
    assert.ok(['Alta', 'Média'].includes(area.properties.descricao));
    assert.equal(referencia.classe, area.properties.descricao);
    assert.equal(referencia.camada, area.properties.camada);
    assert.ok(emGeometria([familia.longitude, familia.latitude], area.geometry), `${familia.id} fora da área ${referencia.id}`);
  }
});

test('os 500 pontos permanecem em áreas edificadas e não se sobrepõem artificialmente', () => {
  const urbanas = ler('demonstracao/areas-edificadas.geojson');
  for (let i = 0; i < familias.length; i++) {
    const p = familias[i];
    assert.ok(urbanas.features.some((f: { geometry: Geometria }) => emGeometria([p.longitude, p.latitude], f.geometry)), `${p.id} fora da ocupação urbana`);
    for (let j = i + 1; j < familias.length; j++) {
      const outro = familias[j];
      const dy = (outro.latitude - p.latitude) * 110574;
      const dx = (outro.longitude - p.longitude) * 111320 * Math.cos(p.latitude * Math.PI / 180);
      assert.ok(Math.hypot(dx, dy) > 8.5, `${p.id} e ${outro.id} sobrepostos`);
    }
  }
});

test('a normalização demonstrativa mantém somente o resumo permitido e a API real ignora esse resumo', () => {
  const item = { ...familias[0], cpf: 'não copiar', telefone: 'não copiar', resumoDemonstrativo: { ...familias[0].resumoDemonstrativo, cpf: 'não copiar' } };
  const resultado = normalizarDemonstracao([item]);
  assert.equal(resultado.pontos.length, 1); assert.equal(resultado.descartados, 0);
  assert.equal('cpf' in resultado.pontos[0], false);
  assert.equal('cpf' in resultado.pontos[0].resumoDemonstrativo!, false);
  assert.equal('resumoDemonstrativo' in normalizarPontos([item]).pontos[0], false);
});

test('contexto demonstrativo inválido não transforma um ponto em um cadastro completo', () => {
  const p = familias[0];
  const resultado = normalizarDemonstracao([{ ...p, resumoDemonstrativo: { ...p.resumoDemonstrativo, moradores: 0 } }, { ...p, id: 'invalido', latitude: null }]);
  assert.equal(resultado.pontos.length, 1); assert.equal(resultado.descartados, 1);
  assert.equal(resultado.pontos[0].resumoDemonstrativo, undefined);
});

test('carregamento demonstrativo respeita cancelamento e informa falha HTTP', async t => {
  const signal = new AbortController().signal;
  const chamada = t.mock.method(globalThis, 'fetch', async () => Response.json(familias));
  const resultado = await carregarDemonstracao('/dados-exemplo.json', signal);
  assert.equal(resultado.pontos.length, 500);
  const opcoes = chamada.mock.calls[0].arguments[1] as RequestInit;
  assert.equal(opcoes.signal, signal); assert.equal(opcoes.cache, 'no-store');
  chamada.mock.mockImplementation(async () => new Response('', { status: 503 }));
  await assert.rejects(carregarDemonstracao('/dados-exemplo.json'), /Não foi possível carregar/);
});


test('todos os pontos respeitam o limite municipal do IBGE e ficam na sede, longe de Itapissuma e Itamaracá', () => {
  const limite = JSON.parse(readFileSync(new URL('../src/data/limite-goiana.json', import.meta.url), 'utf8'));
  assert.equal(limite.properties.codigoIbge, '2606200');
  assert.equal(limite.properties.ano, 2025);
  for (const p of familias) {
    assert.ok(emGeometria([p.longitude, p.latitude], limite.geometry), `${p.id} fora de Goiana`);
    const dy = (p.latitude + 7.5606) * 110574;
    const dx = (p.longitude + 35.0025) * 110350;
    assert.ok(Math.hypot(dx, dy) < 3600, `${p.id} longe da sede`);
  }
});

test('origem demonstrativa bloqueia pontos de municípios vizinhos e CPF real injetado no resumo', () => {
  const p = familias[0];
  const fora = { ...p, id: 'itapissuma', latitude: -7.7764, longitude: -34.8927 };
  assert.equal(normalizarDemonstracao([fora]).pontos.length, 0);
  assert.equal(normalizarDemonstracao([fora]).descartados, 1);
  const resumo = { ...p.resumoDemonstrativo, integrantes: p.resumoDemonstrativo.integrantes.map((pessoa: object) => ({ ...pessoa, cpf: '11144477735' })) };
  assert.equal(normalizarDemonstracao([{ ...p, resumoDemonstrativo: resumo }]).pontos[0].resumoDemonstrativo, undefined);
});
