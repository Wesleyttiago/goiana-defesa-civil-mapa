import test from 'node:test';
import assert from 'node:assert/strict';
import { filtrarFamilias, documentosDaFamilia, possuiDocumentoCadastrado } from '../src/lib/gestao-familias';
import { exemploCadastro, prepararCadastro, criarCadastroDemonstrativo } from '../src/lib/familias';
import { validarFamiliar } from '../src/lib/integrantes';
import { normalizarPontos } from '../src/lib/pontos';
import { normalizarEstacoes, leituraAntiga } from '../src/lib/ambiente';

const familias = [
  { id: '1', nomeRepresentante: 'Maria Lúcia Ferreira', latitude: -7.56, longitude: -35, nivelRisco: 'alto' as const },
  { id: '2', nomeRepresentante: 'João Pedro Santos', latitude: -7.56, longitude: -35, nivelRisco: 'baixo' as const },
];
test('busca tolera acentos, espaços extras e termos em outra ordem sem perder o filtro de risco', () => {
  assert.deepEqual(filtrarFamilias(familias, '   ferreira   MARIA ', '').map(p => p.id), ['1']);
  assert.deepEqual(filtrarFamilias(familias, 'joao', 'baixo').map(p => p.id), ['2']);
  assert.equal(filtrarFamilias(familias, 'maria', 'baixo').length, 0);
  assert.equal(filtrarFamilias(familias, '  ', '').length, 2);
  assert.equal(familias.length, 2);
});
test('duplicidade na sessão considera CPF de representante e de familiar, sem ler a base fictícia como documentos reais', () => {
  const dados = prepararCadastro(exemploCadastro());
  const salvo = criarCadastroDemonstrativo(dados);
  assert.equal(possuiDocumentoCadastrado([salvo], dados), true);
  const outro = { ...dados, cpf: '52998224725', familiares: [{ ...dados.familiares![0], cpf: dados.cpf }] };
  assert.equal(possuiDocumentoCadastrado([salvo], outro), true);
  assert.equal(possuiDocumentoCadastrado(familias, outro), false);
  assert.deepEqual(documentosDaFamilia(dados), ['11144477735']);
});
test('identifica exatamente os campos inválidos de cada familiar e CPF repetido com o representante', () => {
  const exemplo = exemploCadastro();
  const pessoa = exemplo.familiares![0];
  assert.deepEqual(validarFamiliar(pessoa, exemplo.familiares!, exemplo.cpf), {});
  const invalido = { ...pessoa, nomeCompleto: 'A', dataNascimento: '2025-02-29', cpf: '123' };
  const erros = validarFamiliar(invalido, [invalido], exemplo.cpf);
  assert.ok(erros.nomeCompleto); assert.ok(erros.dataNascimento); assert.ok(erros.cpf);
  const repetido = { ...pessoa, cpf: exemplo.cpf };
  assert.match(validarFamiliar(repetido, [repetido], exemplo.cpf).cpf!, /outra pessoa/);
  assert.equal(validarFamiliar({ ...pessoa, cpf: '' }, [pessoa], exemplo.cpf).cpf, undefined);
});
test('IDs repetidos não criam duas famílias para o mesmo marcador e são contabilizados como descartados', () => {
  const resultado = normalizarPontos([familias[0], { ...familias[1], id: ' 1 ' }, familias[1]]);
  assert.equal(resultado.pontos.length, 2); assert.equal(resultado.descartados, 1);
  assert.equal(resultado.pontos[0].nomeRepresentante, familias[0].nomeRepresentante);
  const semId = normalizarPontos([{ ...familias[0], id: ' ' }, { ...familias[1], id: NaN }]);
  assert.deepEqual(semId.pontos.map(p => p.id), ['ponto-1', 'ponto-2']);
});
test('leituras com dias impossíveis ou horas inválidas não são apresentadas como atualizadas', () => {
  for (const [data, hora] of [['31/02/2026', '10:00'], ['30/10/2026', '25:00'], ['30/10/2026', '09:70'], ['29/02/2025', '10:00']]) {
    const [estacao] = normalizarEstacoes({ features: [{ geometry: { type: 'Point', coordinates: [-35, -7.56] }, properties: { objectid: 1, nome: 'Estação teste', horas_24: 0, ultima_leitura: data, ultima_leitura_hora: hora } }] }, 'chuva');
    assert.equal(estacao.instante, null); assert.equal(leituraAntiga(estacao), true);
    assert.equal(estacao.leitura, 'Horário não informado'); assert.equal(estacao.valor, 0);
  }
});
