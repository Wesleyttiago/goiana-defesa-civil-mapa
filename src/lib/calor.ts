import { coordenadasValidas, type PontoRisco } from './pontos';

export type PontoCalor = [latitude: number, longitude: number, intensidade: number];

export const GRADIENTE_CALOR = {
  0.15: '#2563eb', 0.4: '#0891b2', 0.65: '#facc15', 0.82: '#f97316', 1: '#b91c1c',
};

export const ESCALA_CALOR = `linear-gradient(to right, ${Object.entries(GRADIENTE_CALOR)
  .sort(([a], [b]) => Number(a) - Number(b)).map(([, cor]) => cor).join(', ')})`;

/** RF04: peso igual por cadastro. A concentração vem da proximidade dos pontos,
 * independentemente de sua classificação de risco. A API define o recorte dos cadastros. */
export function prepararPontosCalor(pontos: readonly PontoRisco[]): PontoCalor[] {
  const resultado: PontoCalor[] = [];
  for (const ponto of pontos) {
    if (coordenadasValidas(ponto.latitude, ponto.longitude)) {
      resultado.push([ponto.latitude, ponto.longitude, 1]);
    }
  }
  return resultado;
}
