import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularCampoCalor, colorirCampoCalor, opcoesCalorNoZoom, prepararPontosCalor, projetarPontosCalor, RAIO_CALOR_METROS } from '../src/lib/calor';
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


function valorNoMundo(campo: ReturnType<typeof calcularCampoCalor>, x: number, y: number) {
  const ix = Math.round((x - campo.origemX) / campo.passo);
  const iy = Math.round((y - campo.origemY) / campo.passo);
  return campo.valores[iy * campo.colunas + ix];
}

test('o raio mantém a vizinhança geográfica de 250 m inclusive acima do zoom 17', () => {
  const referencia = opcoesCalorNoZoom(14);
  assert.equal(RAIO_CALOR_METROS, 250);
  for (const zoom of [3, 8, 12, 14, 15, 16, 17, 18, 19]) {
    const opcoes = opcoesCalorNoZoom(zoom);
    assert.ok(Math.abs(opcoes.radius / 2 ** (zoom - 14) - referencia.radius) < 1e-9);
    assert.ok(opcoes.radius / opcoes.passo <= 32.000001);
  }
  assert.ok(opcoesCalorNoZoom(19).radius > 200, 'raios grandes não podem depender de um deslocamento de sombra fixo');
  assert.deepEqual(opcoesCalorNoZoom(NaN), referencia);
  assert.deepEqual(opcoesCalorNoZoom(22), opcoesCalorNoZoom(19));
});

test('kernel tem pico unitário, simetria radial e termina suavemente sem disco sólido', () => {
  const campo = calcularCampoCalor([[0, 0, 1]], { x: -40, y: -40, largura: 80, altura: 80, zoom: 14 });
  assert.equal(valorNoMundo(campo, 0, 0), 1);
  assert.equal(valorNoMundo(campo, 10, 0), valorNoMundo(campo, 0, 10));
  assert.equal(valorNoMundo(campo, -10, 0), valorNoMundo(campo, 10, 0));
  assert.ok(valorNoMundo(campo, 10, 0) < 1 && valorNoMundo(campo, 10, 0) > 0);
  assert.ok(valorNoMundo(campo, 24, 0) < .02);
  assert.equal(valorNoMundo(campo, 30, 0), 0);
  assert.equal(valorNoMundo(campo, 30, 30), 0);
  assert.ok(new Set(campo.valores).size > 20);
});

test('cadastros coincidentes somam peso linear sem depender da classificação', () => {
  const janela = { x: -40, y: -40, largura: 80, altura: 80, zoom: 14 };
  const um = calcularCampoCalor([[0, 0, 1]], janela);
  const dois = calcularCampoCalor([[0, 0, 1], [0, 0, 1]], janela);
  for (let i = 0; i < um.valores.length; i++) assert.ok(Math.abs(dois.valores[i] - um.valores[i] * 2) < 1e-6);
  assert.equal(valorNoMundo(dois, 0, 0), 2);
});

test('mover a janela preserva os valores comuns e considera famílias fora da borda da tela', () => {
  const pontos: [number, number, number][] = [[0, 0, 1], [20, 10, 1], [-10, 10, 1]];
  const a = calcularCampoCalor(pontos, { x: -40, y: -40, largura: 100, altura: 100, zoom: 14 });
  const b = calcularCampoCalor(pontos, { x: 0, y: 0, largura: 80, altura: 80, zoom: 14 });
  for (const x of [0, 10, 20, 30, 40]) for (const y of [0, 10, 20, 30, 40]) assert.equal(valorNoMundo(a, x, y), valorNoMundo(b, x, y));
  const soExterno = calcularCampoCalor([[-10, 10, 1]], { x: 0, y: 0, largura: 80, altura: 80, zoom: 14 });
  assert.ok(valorNoMundo(soExterno, 0, 10) > 0);
});

test('pico e cor permanecem iguais em todos os zooms e não mudam ao filtrar para uma família', () => {
  for (const zoom of [8, 12, 14, 16, 17, 18, 19]) {
    const campo = calcularCampoCalor([[0, 0, 1]], { x: -40, y: -40, largura: 80, altura: 80, zoom });
    assert.ok(Math.abs(valorNoMundo(campo, 0, 0) - 1) < 1e-6);
  }
  const cores = colorirCampoCalor(new Float32Array([0, .001, 1, 10, 60, 600]));
  assert.equal(cores[3], 0);
  assert.ok(cores[2 * 4 + 2] > cores[2 * 4], 'um cadastro isolado é azul');
  assert.ok(cores[4 * 4] > cores[4 * 4 + 2], 'concentração alta chega ao vermelho');
  for (let i = 3; i < cores.length; i += 4) assert.ok(cores[i] <= 164, 'as ruas precisam continuar legíveis');
  assert.deepEqual(colorirCampoCalor(new Float32Array([1])), cores.slice(8, 12));
});

test('grade e projeção suportam 2.000 famílias e não alocam canvases enormes em zoom alto', () => {
  const pontos: PontoRisco[] = Array.from({ length: 2000 }, (_, i) => ({ id: String(i), latitude: -7.56 + (i % 50) / 10000, longitude: -35 + Math.floor(i / 50) / 10000, nivelRisco: 'medio' }));
  const projetados = projetarPontosCalor(prepararPontosCalor(pontos));
  assert.equal(projetados.length, 2000);
  const [x, y] = projetados[0];
  for (const zoom of [12, 14, 16, 19]) {
    const escala = 2 ** (zoom - 14);
    const campo = calcularCampoCalor(projetados, { x: x * escala - 650, y: y * escala - 350, largura: 1300, altura: 700, zoom });
    assert.ok(campo.valores.length < 300000);
    assert.ok(campo.valores.some(v => v > 1));
  }
  assert.deepEqual(projetarPontosCalor([[0, 0, 1]])[0], [2097152, 2097152, 1]);
  assert.throws(() => calcularCampoCalor([], { x: 0, y: 0, largura: 0, altura: 10, zoom: 14 }), /Dimensões/);
  assert.throws(() => calcularCampoCalor([], { x: 0, y: 0, largura: 100000, altura: 100000, zoom: 14 }), /limite/);
});
