import test from 'node:test';
import assert from 'node:assert/strict';
import { opcoesCalorNoZoom, prepararPontosCalor } from '../src/lib/calor';
import type { PontoRisco } from '../src/lib/pontos';

test('calor usa apenas coordenadas válidas e deixa os dados da origem intactos', () => {
  const pontos = Object.freeze([
    Object.freeze({ id: 'valido', latitude: -7.56, longitude: -35, nivelRisco: 'alto' as const }),
    { id: 'fora', latitude: 91, longitude: -35, nivelRisco: 'baixo' as const },
    { id: 'ausente', latitude: NaN, longitude: -35, nivelRisco: 'medio' as const },
    { id: 'infinito', latitude: -7.56, longitude: Infinity, nivelRisco: 'medio' as const },
  ]);
  assert.deepEqual(prepararPontosCalor(pontos), [[-7.56, -35, 1]]);
  assert.equal(pontos.length, 4);
  assert.equal(pontos[0].nivelRisco, 'alto');
});

test('densidade conta cada cadastro igualmente, inclusive nos mesmos locais', () => {
  const pontos: PontoRisco[] = ['baixo', 'medio', 'alto', 'nao_informado'].map((nivel, i) => ({
    id: `cadastro-${i}`, latitude: -7.56, longitude: -35, nivelRisco: nivel as PontoRisco['nivelRisco'],
  }));
  const calor = prepararPontosCalor(pontos);
  assert.equal(calor.length, 4);
  assert.equal(calor.reduce((total, ponto) => total + ponto[2], 0), 4);
  assert.deepEqual(calor[0], calor[3]);
});

test('preparação de 2.000 cadastros preserva quantidade e localização', () => {
  const pontos: PontoRisco[] = Array.from({ length: 2000 }, (_, i) => ({
    id: `carga-${i}`, latitude: -7.56 + i / 100000, longitude: -35 - i / 100000, nivelRisco: 'baixo',
  }));
  const calor = prepararPontosCalor(pontos);
  assert.equal(calor.length, 2000);
  assert.deepEqual(calor[1999], [pontos[1999].latitude, pontos[1999].longitude, 1]);
});

test('lista vazia gera uma camada sem pontos artificiais', () => {
  assert.deepEqual(prepararPontosCalor([]), []);
});

test('a área do calor acompanha o zoom da cidade sem trocar a escala de intensidade', () => {
  const referencia = opcoesCalorNoZoom(14);
  for (const zoom of [10, 12, 13, 14, 15, 16, 17]) {
    const atual = opcoesCalorNoZoom(zoom);
    // Ao normalizar a projeção do mapa, a área suavizada permanece a mesma.
    assert.equal((atual.radius + atual.blur) / (2 ** (zoom - 14)), referencia.radius + referencia.blur);
    assert.equal(atual.max, referencia.max);
    // A atenuação 2^(maxZoom-zoom) do Leaflet.heat deve permanecer desligada.
    assert.equal(1 / (2 ** Math.max(0, Math.min(atual.maxZoom - zoom, 12))), 1);
  }
});

test('zoom extremo ou inválido não cria um kernel sem limite de memória', () => {
  assert.deepEqual(opcoesCalorNoZoom(NaN), opcoesCalorNoZoom(14));
  assert.deepEqual(opcoesCalorNoZoom(22), opcoesCalorNoZoom(17));
  assert.ok(opcoesCalorNoZoom(0).radius > 0);
});
