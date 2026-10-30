import { coordenadasValidas } from './pontos';

export type TipoEstacao = 'chuva' | 'rio';
export interface EstacaoAmbiental {
  id: string; tipo: TipoEstacao; nome: string; latitude: number; longitude: number;
  valor: number | null; leitura: string; instante: string | null; rio?: string;
}
const servicos = 'https://geoportal.apac.pe.gov.br/server/rest/services';
export const FONTES_AMBIENTAIS = {
  chuva: `${servicos}/met_monitoramento_chuvas_pe/MapServer/4`,
  rio: `${servicos}/SIRH/mon_nivel_rios_pe/MapServer/0`,
  solo: 'https://rigeo.sgb.gov.br/handle/doc/25401',
};
export function urlEstacoes(tipo: TipoEstacao): string {
  const parametros = new URLSearchParams({
    where: tipo === 'chuva' ? "UPPER(municipio) = 'GOIANA'" : "UPPER(namebasin) LIKE '%GOIANA%'",
    outFields: tipo === 'chuva' ? 'objectid,nome,horas_24,ultima_leitura,ultima_leitura_hora' : 'id,namestation,river,levelnow,datacoleta,horacoleta',
    outSR: '4326', f: 'geojson',
  });
  return `${FONTES_AMBIENTAIS[tipo]}/query?${parametros}`;
}
function dataCivilValida(data: string): boolean {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(data)) return false;
  const [dia, mes, ano] = data.split('/').map(Number);
  const valor = new Date(Date.UTC(ano, mes - 1, dia));
  return ano >= 1900 && valor.getUTCFullYear() === ano && valor.getUTCMonth() === mes - 1 && valor.getUTCDate() === dia;
}
export function normalizarEstacoes(entrada: unknown, tipo: TipoEstacao): EstacaoAmbiental[] {
  if (!entrada || typeof entrada !== 'object' || !('features' in entrada) || !Array.isArray(entrada.features)) throw new Error('A fonte ambiental não retornou os dados esperados.');
  const resultado: EstacaoAmbiental[] = [];
  for (const feature of entrada.features.slice(0, 1000)) {
    if (!feature || typeof feature !== 'object') continue;
    const { geometry, properties: p } = feature;
    if (!p || geometry?.type !== 'Point' || !Array.isArray(geometry.coordinates)) continue;
    const [longitude, latitude] = geometry.coordinates;
    if (!coordenadasValidas(latitude, longitude)) continue;
    const nome = p[tipo === 'chuva' ? 'nome' : 'namestation'];
    if (typeof nome !== 'string' || !nome.trim()) continue;
    const bruto = p[tipo === 'chuva' ? 'horas_24' : 'levelnow'];
    const data = p[tipo === 'chuva' ? 'ultima_leitura' : 'datacoleta'];
    const hora = p[tipo === 'chuva' ? 'ultima_leitura_hora' : 'horacoleta'];
    const dataValida = typeof data === 'string' && dataCivilValida(data);
    const horaValida = typeof hora === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(hora);
    const instante = dataValida && horaValida ? `${data.slice(6)}-${data.slice(3, 5)}-${data.slice(0, 2)}T${hora.length === 5 ? hora + ':00' : hora}-03:00` : null;
    resultado.push({ id: `${tipo}-${String(p[tipo === 'chuva' ? 'objectid' : 'id'] ?? resultado.length)}`, tipo,
      nome: nome.trim().slice(0, 150), latitude, longitude,
      valor: typeof bruto === 'number' && Number.isFinite(bruto) && bruto >= 0 ? bruto : null,
      leitura: dataValida && horaValida ? `${data} às ${hora.slice(0, 5)}` : 'Horário não informado', instante,
      ...(tipo === 'rio' && typeof p.river === 'string' ? { rio: p.river.slice(0, 120) } : {}) });
  }
  return resultado;
}
export function leituraAntiga(estacao: EstacaoAmbiental, agora = Date.now()): boolean {
  const momento = estacao.instante ? Date.parse(estacao.instante) : NaN;
  return !Number.isFinite(momento) || agora - momento > 3 * 60 * 60 * 1000 || momento - agora > 10 * 60 * 1000;
}
export function formatarMedicao(estacao: EstacaoAmbiental): string {
  return estacao.valor === null ? 'Sem medição' : `${estacao.valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ${estacao.tipo === 'chuva' ? 'mm / 24h' : 'cm'}`;
}
export async function carregarEstacoes(tipo: TipoEstacao, signal: AbortSignal): Promise<EstacaoAmbiental[]> {
  const resposta = await fetch(urlEstacoes(tipo), { signal, cache: 'no-store', headers: { Accept: 'application/geo+json, application/json' } });
  if (!resposta.ok) throw new Error('A APAC não respondeu à consulta. Tente atualizar a camada.');
  return normalizarEstacoes(await resposta.json(), tipo);
}
