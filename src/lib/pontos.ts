/** Contrato usado pelo RF03 e RF04. Os dados pertencem à API da equipe. */
export interface PontoRisco {
  id: string;
  latitude: number;
  longitude: number;
  nivelRisco: NivelRisco;
}

export type NivelRisco = 'baixo' | 'medio' | 'alto' | 'nao_informado';

export const CENTRO_GOIANA: [number, number] = [-7.5606, -35.0025];

// Data-driven styling: cada marcador recebe sua aparência a partir do nível informado.
// As letras reforçam a cor para que a classificação não dependa só da visão cromática.
export const ESTILOS_RISCO = {
  baixo: { cor: '#176348', rotulo: 'Baixo', letra: 'B', prioridade: 1 },
  medio: { cor: '#805100', rotulo: 'Médio', letra: 'M', prioridade: 2 },
  alto: { cor: '#B52D39', rotulo: 'Alto', letra: 'A', prioridade: 3 },
  nao_informado: { cor: '#526176', rotulo: 'Sem classificação', letra: '?', prioridade: 0 },
} as const;

export function normalizarNivel(valor: unknown): NivelRisco {
  if (typeof valor !== 'string') return 'nao_informado';
  const nivel = valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  return nivel === 'baixo' || nivel === 'medio' || nivel === 'alto' ? nivel : 'nao_informado';
}

export function coordenadasValidas(latitude: unknown, longitude: unknown): boolean {
  return typeof latitude === 'number' && typeof longitude === 'number'
    && Number.isFinite(latitude) && Number.isFinite(longitude)
    && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}

/** Adapte este ponto de entrada quando a equipe confirmar o contrato definitivo da API. */
export function normalizarPontos(dados: unknown): { pontos: PontoRisco[]; descartados: number } {
  if (!Array.isArray(dados)) throw new Error('Os dados recebidos não estão no formato esperado.');
  const pontos: PontoRisco[] = [];
  let descartados = 0;
  dados.forEach((dado: unknown, indice) => {
    if (!dado || typeof dado !== 'object') { descartados++; return; }
    const item = dado as Record<string, unknown>;
    if (!coordenadasValidas(item.latitude, item.longitude)) { descartados++; return; }
    const id = typeof item.id === 'string' || typeof item.id === 'number' ? String(item.id) : `ponto-${indice + 1}`;
    pontos.push({ id, latitude: item.latitude as number, longitude: item.longitude as number,
      nivelRisco: normalizarNivel(item.nivelRisco) });
  });
  return { pontos, descartados };
}

export function contarNiveis(pontos: readonly PontoRisco[]): Record<NivelRisco, number> {
  const totais = { baixo: 0, medio: 0, alto: 0, nao_informado: 0 };
  for (const ponto of pontos) totais[ponto.nivelRisco]++;
  return totais;
}

export function maiorNivel(niveis: Iterable<NivelRisco>): NivelRisco {
  let maior: NivelRisco = 'nao_informado';
  for (const nivel of niveis) if (ESTILOS_RISCO[nivel].prioridade > ESTILOS_RISCO[maior].prioridade) maior = nivel;
  return maior;
}

export async function carregarPontos(endereco: string, signal?: AbortSignal) {
  const resposta = await fetch(endereco, { signal, cache: 'no-store', headers: { Accept: 'application/json' } });
  if (!resposta.ok) throw new Error('Não foi possível carregar os pontos. Verifique a conexão e tente novamente.');
  let dados: unknown;
  try { dados = await resposta.json(); }
  catch { throw new Error('Não foi possível ler os pontos recebidos.'); }
  return normalizarPontos(dados);
}
