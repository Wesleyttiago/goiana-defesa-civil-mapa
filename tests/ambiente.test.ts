import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { formatarMedicao, leituraAntiga, normalizarEstacoes, urlEstacoes } from '../src/lib/ambiente';

const chuva = (valor: unknown, data = '30/10/2026', hora = '10:00:00') => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [-35.004, -7.563] }, properties: { objectid: 1, nome: 'Estação de teste', horas_24: valor, ultima_leitura: data, ultima_leitura_hora: hora } });
test('zero de chuva é medição válida, ausência e sentinela negativa não viram zero', () => {
  const registros = normalizarEstacoes({ features: [chuva(0), chuva(-1), chuva(null), chuva('10'), chuva(NaN)] }, 'chuva');
  assert.equal(registros.length, 5); assert.equal(registros[0].valor, 0);
  for (const registro of registros.slice(1)) { assert.equal(registro.valor, null); assert.equal(formatarMedicao(registro), 'Sem medição'); }
  assert.equal(formatarMedicao(registros[0]), '0 mm / 24h');
});
test('estações sem coordenadas ou nome são descartadas e erros do ArcGIS não viram dados', () => {
  const invalida = chuva(0); invalida.geometry.coordinates = [200, 200];
  assert.deepEqual(normalizarEstacoes({ features: [invalida, {}, null] }, 'chuva'), []);
  assert.throws(() => normalizarEstacoes({ error: { code: 500 } }, 'rio'), /esperados/);
});
test('rio preserva a cota em centímetros e a data da medição, sem calcular alerta', () => {
  const estacao = normalizarEstacoes({ features: [{ geometry: { type: 'Point', coordinates: [-34.9983, -7.5555] }, properties: { id: 1, namestation: 'CANAL DO GOIANA', river: 'CANAL DO GOIANA', levelnow: 74, datacoleta: '30/10/2026', horacoleta: '01:00:00', situacao: 'Normal' } }] }, 'rio')[0];
  assert.equal(formatarMedicao(estacao), '74 cm'); assert.equal(estacao.leitura, '30/10/2026 às 01:00');
  assert.equal('situacao' in estacao, false);
});
test('leitura antiga ou sem horário nunca é apresentada como recém-atualizada', () => {
  const atual = normalizarEstacoes({ features: [chuva(0)] }, 'chuva')[0];
  assert.equal(leituraAntiga(atual, Date.parse('2026-10-30T11:00:00-03:00')), false);
  assert.equal(leituraAntiga(atual, Date.parse('2026-10-30T14:00:00-03:00')), true);
  const semData = normalizarEstacoes({ features: [chuva(0, '', '')] }, 'chuva')[0];
  assert.equal(leituraAntiga(semData), true);
});
test('consultas usam os recortes oficiais de Goiana e WGS84', () => {
  const chuva = new URL(urlEstacoes('chuva')); const rio = new URL(urlEstacoes('rio'));
  assert.match(chuva.searchParams.get('where')!, /municipio.*GOIANA/);
  assert.match(rio.searchParams.get('where')!, /namebasin.*GOIANA/);
  assert.equal(chuva.searchParams.get('outSR'), '4326');
});
test('cartografia publicada mantém as classes e os totais das tabelas oficiais do SGB', () => {
  const dados = JSON.parse(readFileSync(new URL('../public/camadas/suscetibilidade-goiana.geojson', import.meta.url), 'utf8'));
  const totais: Record<string, number> = {};
  for (const feature of dados.features) {
    const chave = `${feature.properties.camada}:${feature.properties.descricao}`; totais[chave] = (totais[chave] || 0) + 1;
    assert.ok(['Polygon', 'MultiPolygon'].includes(feature.geometry.type));
    const poligonos = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
    for (const poligono of poligonos) for (const anel of poligono) {
      assert.ok(anel.length >= 4); assert.deepEqual(anel[0], anel.at(-1));
      for (const [lng, lat] of anel) { assert.ok(lng > -36 && lng < -34 && lat > -9 && lat < -6); }
    }
  }
  assert.deepEqual(totais, { 'inundacao:Alta': 60, 'inundacao:Baixa': 172, 'inundacao:Média': 241, 'movimento:Alta': 243, 'movimento:Baixa': 153, 'movimento:Média': 593 });
});
