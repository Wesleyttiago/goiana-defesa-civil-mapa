import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularIdade, lerFamiliares } from '../src/lib/integrantes';
import { dentroDeGoiana, LIMITE_GOIANA } from '../src/lib/territorio';
import { carregarDetalhe, exemploCadastro, prepararCadastro, validarCadastro } from '../src/lib/familias';

test('idade usa aniversário civil, aceita bebê com zero anos e rejeita datas impossíveis ou futuras', () => {
  assert.equal(calcularIdade('2000-10-30', '2026-10-30'), 26);
  assert.equal(calcularIdade('2000-10-31', '2026-10-30'), 25);
  assert.equal(calcularIdade('2026-10-30', '2026-10-30'), 0);
  assert.equal(calcularIdade('2024-02-29', '2026-02-28'), 1);
  for (const data of ['', '31/12/2000', '2025-02-29', '2026-11-31', '2026-10-31', '1800-01-01']) assert.equal(calcularIdade(data, '2026-10-30'), null, data);
});

test('limite reconhece sede e distritos de Goiana e rejeita cidades vizinhas e mar aberto', () => {
  assert.equal(dentroDeGoiana(-7.5606, -35.0025), true);
  assert.equal(dentroDeGoiana(-7.625, -34.813), true, 'Cocota, distrito de Ponta de Pedras');
  for (const [lat, lng] of [[-7.7764, -34.8927], [-7.747, -34.825], [-8.05, -34.9], [-7.56, -34.7], [NaN, -35], [-35, -7.56]]) assert.equal(dentroDeGoiana(lat, lng), false);
  const geometria = LIMITE_GOIANA.geometry;
  const primeira = geometria.type === 'Polygon' ? geometria.coordinates[0][0] : geometria.coordinates[0][0][0];
  assert.equal(dentroDeGoiana(primeira[1], primeira[0]), true, 'borda municipal inclusiva');
});

test('cadastro bloqueia GPS, coordenadas e marcações fora de Goiana', () => {
  for (const origem of ['gps', 'mapa', 'coordenadas'] as const) {
    const fora = { ...exemploCadastro(), localizacao: { latitude: -7.7764, longitude: -34.8927, origem } };
    assert.match(validarCadastro(fora).localizacao!, /fora do limite/);
    assert.throws(() => prepararCadastro(fora), /Revise/);
  }
});

test('cadastro valida composição, CPFs opcionais, duplicidades e quantidade de moradores', () => {
  const exemplo = exemploCadastro();
  assert.deepEqual(validarCadastro(exemplo), {});
  const pessoas = exemplo.familiares!;
  assert.equal(prepararCadastro(exemplo).familiares!.length, 3);
  assert.equal(prepararCadastro(exemplo).familiares![0].cpf, '');
  assert.ok(validarCadastro({ ...exemplo, moradores: '2' }).moradores);
  assert.ok(validarCadastro({ ...exemplo, nascimentoRepresentante: '2050-01-01' }).nascimentoRepresentante);
  for (const alterado of [{ dataNascimento: '2025-02-29' }, { nomeCompleto: 'A' }, { cpf: '123' }, { cpf: exemplo.cpf }, { parentesco: '__proto__' }]) {
    assert.ok(validarCadastro({ ...exemplo, familiares: [{ ...pessoas[0], ...alterado } as typeof pessoas[0]] }).familiares);
  }
  assert.equal(lerFamiliares([{ ...pessoas[0] }, { ...pessoas[0] }]), null);
  assert.equal(lerFamiliares({ nomeCompleto: 'objeto inválido' }), null);
});

test('detalhes da API preservam familiares permitidos e continuam aceitando contratos anteriores', async t => {
  const dados = prepararCadastro(exemploCadastro());
  const fake = t.mock.method(globalThis, 'fetch', async () => Response.json({ dados: { ...dados, familiares: dados.familiares!.map(p => ({ ...p, segredo: 'não copiar' })) } }));
  assert.deepEqual(await carregarDetalhe('/familias', '1'), dados);
  const { familiares, nascimentoRepresentante, apoioRepresentante, ...legado } = dados;
  fake.mock.mockImplementation(async () => Response.json({ dados: legado }));
  assert.deepEqual(await carregarDetalhe('/familias', 'antigo'), legado);
  fake.mock.mockImplementation(async () => Response.json({ dados: { ...dados, familiares: [{ id: 'incompleto' }] } }));
  await assert.rejects(carregarDetalhe('/familias', 'corrompido'), /familiares/);
});
