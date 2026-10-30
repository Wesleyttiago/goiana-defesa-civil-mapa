import test from 'node:test';
import assert from 'node:assert/strict';
import { carregarDetalhe, cpfValido, criarCadastroDemonstrativo, enviarCadastro, exemploCadastro, FORMULARIO_VAZIO, formatarCpf,
  gerarIdentificador, lerCoordenada, prepararCadastro, validarCadastro, type CamposCadastro } from '../src/lib/familias';

test('CPF verifica tamanho, dígitos, repetições e ambos os verificadores', () => {
  assert.equal(cpfValido('111.444.777-35'), true);
  assert.equal(cpfValido('11144477735'), true);
  for (const valor of ['', '11144477734', '11144477736', '1114447773', '111444777351', '00000000000', '11111111111', 'abc11144477735']) assert.equal(cpfValido(valor), false, valor);
  assert.equal(formatarCpf('11144477735'), '111.444.777-35');
});
test('cadastro vazio não passa e uma família sem coordenadas é bloqueada', () => {
  assert.ok(Object.keys(validarCadastro(FORMULARIO_VAZIO)).length >= 6);
  assert.ok(validarCadastro({ ...exemploCadastro(), localizacao: null }).localizacao);
  assert.throws(() => prepararCadastro({ ...exemploCadastro(), localizacao: null }), /Revise/);
});
test('coordenadas manuais aceitam vírgula decimal e rejeitam entradas incompletas', () => {
  assert.equal(lerCoordenada(' -7,5606 '), -7.5606);
  assert.equal(lerCoordenada('-35.0025'), -35.0025);
  for (const valor of ['', ' ', '7.5abc', 'NaN', 'Infinity', '1,2,3', '-']) assert.equal(lerCoordenada(valor), null);
  for (const latitude of [NaN, Infinity, 90.1, -90.1]) assert.ok(validarCadastro({ ...exemploCadastro(), localizacao: { latitude, longitude: -35, origem: 'mapa' } }).localizacao);
});
test('quantidade de moradores, telefone e tipo de ocorrência inválidos são bloqueados', () => {
  for (const moradores of ['0', '-1', '1.5', '100', '', 'abc']) assert.ok(validarCadastro({ ...exemploCadastro(), moradores }).moradores);
  assert.ok(validarCadastro({ ...exemploCadastro(), telefone: '123' }).telefone);
  assert.ok(validarCadastro({ ...exemploCadastro(), tipoOcorrencia: '__proto__' as CamposCadastro['tipoOcorrencia'] }).tipoOcorrencia);
});
test('preparação remove formatação e espaços, sem inventar avaliação', () => {
  const campos = { ...exemploCadastro(), nomeRepresentante: '  Família   Exemplo  ', nivelRisco: 'nao_informado' as const, telefone: '(81) 90000-0000' };
  const dados = prepararCadastro(campos);
  assert.equal(dados.nomeRepresentante, 'Família Exemplo'); assert.equal(dados.cpf, '11144477735');
  assert.equal(dados.telefone, '81900000000'); assert.equal(dados.moradores, 4);
  assert.equal(dados.nivelRisco, 'nao_informado'); assert.equal(dados.localizacao.origem, 'mapa');
});
test('cadastros demonstrativos possuem IDs distintos e mantêm a residência informada', () => {
  const dados = prepararCadastro(exemploCadastro()); const a = criarCadastroDemonstrativo(dados); const b = criarCadastroDemonstrativo(dados);
  assert.notEqual(a.id, b.id); assert.equal(a.latitude, dados.localizacao.latitude);
  assert.equal(a.longitude, dados.localizacao.longitude); assert.equal(a.dados, dados);
});
test('identificação funciona mesmo sem randomUUID em uma prévia HTTP', t => {
  const original = Object.getOwnPropertyDescriptor(crypto, 'randomUUID');
  Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true });
  t.after(() => { if (original) Object.defineProperty(crypto, 'randomUUID', original); else Reflect.deleteProperty(crypto, 'randomUUID'); });
  const id = gerarIdentificador(); assert.match(id, /^[0-9a-f]{32}$/); assert.notEqual(id, gerarIdentificador());
});
test('POST usa sessão da API, chave de idempotência e sinal de cancelamento', async t => {
  const dados = prepararCadastro(exemploCadastro()); const signal = new AbortController().signal;
  const chamada = t.mock.method(globalThis, 'fetch', async () => Response.json({ id: 'api-42', latitude: dados.localizacao.latitude, longitude: dados.localizacao.longitude, nivelRisco: dados.nivelRisco }, { status: 201 }));
  const salvo = await enviarCadastro('https://api.exemplo/familias', dados, 'chave-repetivel', signal);
  assert.equal(salvo.id, 'api-42'); assert.equal(salvo.nomeRepresentante, dados.nomeRepresentante);
  const opcoes = chamada.mock.calls[0].arguments[1] as RequestInit;
  assert.equal(opcoes.method, 'POST'); assert.equal(opcoes.credentials, 'include'); assert.equal(opcoes.signal, signal);
  assert.equal((opcoes.headers as Record<string,string>)['Idempotency-Key'], 'chave-repetivel');
  assert.deepEqual(JSON.parse(String(opcoes.body)), dados);
});
test('erros de duplicidade, sessão e validação da API geram mensagens recuperáveis', async t => {
  const fake = t.mock.method(globalThis, 'fetch', async () => new Response('', { status: 409 }));
  const dados = prepararCadastro(exemploCadastro());
  await assert.rejects(enviarCadastro('/familias', dados, 'x'), /Já existe/);
  fake.mock.mockImplementation(async () => new Response('', { status: 401 }));
  await assert.rejects(enviarCadastro('/familias', dados, 'x'), /sessão/);
  fake.mock.mockImplementation(async () => new Response('', { status: 422 }));
  await assert.rejects(enviarCadastro('/familias', dados, 'x'), /recusou/);
});
test('resposta sem ID ou residência válida não vira sucesso de cadastro', async t => {
  const fake = t.mock.method(globalThis, 'fetch', async () => Response.json({ latitude: -7.56, longitude: -35 }));
  const dados = prepararCadastro(exemploCadastro());
  await assert.rejects(enviarCadastro('/familias', dados, 'x'), /identificação/);
  fake.mock.mockImplementation(async () => Response.json({ id: 1, latitude: null, longitude: -35 }));
  await assert.rejects(enviarCadastro('/familias', dados, 'x'), /localização inválida/);
});
test('detalhes são consultados individualmente e conteúdo malformado não é renderizado como cadastro', async t => {
  const dados = prepararCadastro(exemploCadastro());
  const fake = t.mock.method(globalThis, 'fetch', async () => Response.json({ dados }));
  assert.deepEqual(await carregarDetalhe('/familias/', 'id/com barra'), dados);
  assert.equal(fake.mock.calls[0].arguments[0], '/familias/id%2Fcom%20barra');
  fake.mock.mockImplementation(async () => Response.json({ dados: { cpf: 'inválido' } }));
  assert.equal(await carregarDetalhe('/familias', '1'), null);
});
