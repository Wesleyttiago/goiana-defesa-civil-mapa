import test from 'node:test';
import assert from 'node:assert/strict';
import {
  carregarPontos, contarNiveis, coordenadasValidas, ESTILOS_RISCO,
  maiorNivel, nomeDaFamilia, normalizarNivel, normalizarPontos,
} from '../src/lib/pontos';

test('coordenadas devem ser números finitos dentro dos limites geográficos', () => {
  assert.equal(coordenadasValidas(-7.5606, -35.0025), true);
  assert.equal(coordenadasValidas(-90, 180), true);
  for (const [lat, lng] of [[null, 0], ['', 0], ['-7.56', -35], [NaN, -35], [0, Infinity], [90.1, 0], [0, -180.1]]) {
    assert.equal(coordenadasValidas(lat, lng), false);
  }
});

test('representante é normalizado sem copiar dados pessoais além do nome solicitado', () => {
  const { pontos } = normalizarPontos([{ id: 1, latitude: -7.56, longitude: -35,
    nomeRepresentante: '  Ana  Clara\nSantos  ', nivelRisco: 'alto', cpf: 'não copiar', telefone: 'não copiar' }]);
  assert.deepEqual(pontos, [{ id: '1', nomeRepresentante: 'Ana Clara Santos', latitude: -7.56, longitude: -35, nivelRisco: 'alto' }]);
  assert.equal(nomeDaFamilia(pontos[0]), 'Ana Clara Santos');
});

test('fonte sem representante continua compatível e não recebe nome inventado', () => {
  for (const nomeRepresentante of [null, undefined, '', '   ', 42]) {
    const { pontos } = normalizarPontos([{ id: 'legado-1', latitude: -7.56, longitude: -35, nomeRepresentante }]);
    assert.equal('nomeRepresentante' in pontos[0], false);
    assert.equal(nomeDaFamilia(pontos[0]), 'Família legado-1');
  }
});

test('normalização descarta coordenadas inválidas e preserva somente dados do mapa', () => {
  const resultado = normalizarPontos([
    { id: 42, latitude: -7.56, longitude: -35, nivelRisco: ' ALTO ', nome: 'Não deve ser copiado' },
    { latitude: null, longitude: -35 }, null, { latitude: -7.56, longitude: 400 },
    { latitude: -7.55, longitude: -35.01, nivelRisco: 'desconhecido' },
  ]);
  assert.equal(resultado.descartados, 3);
  assert.deepEqual(resultado.pontos, [
    { id: '42', latitude: -7.56, longitude: -35, nivelRisco: 'alto' },
    { id: 'ponto-5', latitude: -7.55, longitude: -35.01, nivelRisco: 'nao_informado' },
  ]);
  assert.throws(() => normalizarPontos({ pontos: [] }), /formato esperado/);
});

test('classificação aceita acentos e caixa, sem converter ausência em risco baixo', () => {
  assert.equal(normalizarNivel('MÉDIO'), 'medio');
  assert.equal(normalizarNivel(' Baixo '), 'baixo');
  for (const valor of [null, undefined, 1, '', 'crítico']) assert.equal(normalizarNivel(valor), 'nao_informado');
});

test('grupos sinalizam o maior nível informado entre seus pontos', () => {
  assert.equal(maiorNivel(['baixo', 'medio', 'alto', 'baixo']), 'alto');
  assert.equal(maiorNivel(['nao_informado', 'medio']), 'medio');
  assert.equal(maiorNivel([]), 'nao_informado');
});

test('lote de 2.000 pontos mantém coordenadas, identidades e totais corretos', () => {
  const niveis = ['baixo', 'medio', 'alto', 'nao_informado'];
  const entrada = Array.from({ length: 2000 }, (_, i) => ({
    id: `teste-${i}`, latitude: -7.56 + i / 100000, longitude: -35 - i / 100000,
    nivelRisco: niveis[i % 4],
  }));
  const { pontos, descartados } = normalizarPontos(entrada);
  assert.equal(descartados, 0);
  assert.equal(pontos.length, 2000);
  assert.equal(new Set(pontos.map(p => p.id)).size, 2000);
  assert.equal(pontos[1999].latitude, entrada[1999].latitude);
  assert.deepEqual(contarNiveis(pontos), { baixo: 500, medio: 500, alto: 500, nao_informado: 500 });
});

test('letras brancas têm contraste mínimo de 4,5:1 sobre todas as cores de risco', () => {
  for (const estilo of Object.values(ESTILOS_RISCO)) {
    const rgb = estilo.cor.slice(1).match(/../g)!.map(c => parseInt(c, 16) / 255);
    const linear = rgb.map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
    const luminancia = .2126 * linear[0] + .7152 * linear[1] + .0722 * linear[2];
    assert.ok(1.05 / (luminancia + .05) >= 4.5, `Contraste insuficiente: ${estilo.rotulo}`);
  }
});

test('resposta HTTP com falha gera mensagem recuperável', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response('', { status: 503 }));
  await assert.rejects(carregarPontos('/api-da-equipe'), /Não foi possível carregar/);
});

test('JSON quebrado e estrutura inesperada são rejeitados', async t => {
  const falsoFetch = t.mock.method(globalThis, 'fetch', async () => new Response('{'));
  await assert.rejects(carregarPontos('/api-da-equipe'), /Não foi possível ler/);
  falsoFetch.mock.mockImplementation(async () => Response.json({ mensagem: 'erro' }));
  await assert.rejects(carregarPontos('/api-da-equipe'), /formato esperado/);
});

test('API pode retornar uma lista vazia sem representar falha', async t => {
  const signal = new AbortController().signal;
  const chamada = t.mock.method(globalThis, 'fetch', async () => Response.json([]));
  assert.deepEqual(await carregarPontos('/api-da-equipe', signal), { pontos: [], descartados: 0 });
  const opcoes = chamada.mock.calls[0].arguments[1] as RequestInit;
  assert.equal(opcoes.signal, signal);
  assert.equal(opcoes.cache, 'no-store');
});
