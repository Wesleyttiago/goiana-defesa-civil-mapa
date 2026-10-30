import { coordenadasValidas, type PontoRisco } from './pontos';

export type PontoCalor = [latitude: number, longitude: number, intensidade: number];

export const GRADIENTE_CALOR = {
  0.15: '#2563eb', 0.4: '#0891b2', 0.65: '#facc15', 0.82: '#f97316', 1: '#b91c1c',
};

/** O raio acompanha a escala do mapa; a intensidade não é atenuada pelo zoom.
 * A referência é o zoom inicial 14. Nos extremos, limitamos o tamanho do kernel
 * para evitar círculos invisíveis ou um canvas auxiliar de dezenas de MB. */
export function opcoesCalorNoZoom(zoom: number) {
  const nivel = Number.isFinite(zoom) ? Math.max(8, Math.min(zoom, 17)) : 14;
  const escala = 2 ** (nivel - 14);
  return {
    radius: 32 * escala, blur: 30 * escala,
    minOpacity: 0.06, maxZoom: 0, max: 8, gradient: GRADIENTE_CALOR,
  };
}

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
