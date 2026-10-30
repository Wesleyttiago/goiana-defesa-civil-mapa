import { coordenadasValidas, type PontoRisco } from './pontos';

export type PontoCalor = [latitude: number, longitude: number, intensidade: number];
export type PontoProjetadoCalor = [x: number, y: number, intensidade: number];
export const ZOOM_CALOR_REFERENCIA = 14;
export const RAIO_CALOR_METROS = 250;
// Escala visual fixa: filtrar ou mover o mapa não transforma um ponto isolado em vermelho.
export const DENSIDADE_CALOR_REFERENCIA = 60;
const TAMANHO_MUNDO = 256 * 2 ** ZOOM_CALOR_REFERENCIA;
const METROS_PIXEL_GOIANA = 40075016.68557849 * Math.cos(7.5606 * Math.PI / 180) / TAMANHO_MUNDO;
export const GRADIENTE_CALOR = {
  0.15: '#2563eb', 0.4: '#0891b2', 0.65: '#facc15', 0.82: '#f97316', 1: '#b91c1c',
};
export const ESCALA_CALOR = `linear-gradient(to right, ${Object.entries(GRADIENTE_CALOR)
  .sort(([a], [b]) => Number(a) - Number(b)).map(([, cor]) => cor).join(', ')})`;

/** A influência tem 250 m na latitude de Goiana, inclusive nos zooms de detalhe.
 * A amostragem limita o custo a até 32 passos por raio, sem limitar o raio geográfico. */
export function opcoesCalorNoZoom(zoom: number) {
  const nivel = Number.isFinite(zoom) ? Math.max(3, Math.min(zoom, 19)) : ZOOM_CALOR_REFERENCIA;
  const escala = 2 ** (nivel - ZOOM_CALOR_REFERENCIA);
  const radius = RAIO_CALOR_METROS / METROS_PIXEL_GOIANA * escala;
  return { zoom: nivel, escala, radius, passo: Math.max(2, radius / 32) };
}

/** Peso igual por cadastro: o calor representa concentração, independentemente do risco. */
export function prepararPontosCalor(pontos: readonly PontoRisco[]): PontoCalor[] {
  return pontos.filter(p => coordenadasValidas(p.latitude, p.longitude)).map(p => [p.latitude, p.longitude, 1]);
}
export function projetarPontosCalor(pontos: readonly PontoCalor[]): PontoProjetadoCalor[] {
  return pontos.map(([lat, lng, peso]) => {
    const seno = Math.sin(Math.max(-85.05112878, Math.min(85.05112878, lat)) * Math.PI / 180);
    return [(lng + 180) / 360 * TAMANHO_MUNDO,
      (.5 - Math.log((1 + seno) / (1 - seno)) / (4 * Math.PI)) * TAMANHO_MUNDO, peso];
  });
}
export interface JanelaCalor { x: number; y: number; largura: number; altura: number; zoom: number }
export interface CampoCalor {
  valores: Float32Array; colunas: number; linhas: number;
  origemX: number; origemY: number; passo: number; radius: number;
}
/** Kernel radial compacto C2: chega a zero suavemente, sem sombras ou discos opacos.
 * A grade é ancorada no mundo, não no canto da tela; arrastar não muda a densidade. */
export function calcularCampoCalor(pontos: readonly PontoProjetadoCalor[], janela: JanelaCalor): CampoCalor {
  if (![janela.x, janela.y, janela.largura, janela.altura].every(Number.isFinite) || janela.largura <= 0 || janela.altura <= 0) throw new Error('Dimensões inválidas para o calor.');
  const { radius, passo, escala } = opcoesCalorNoZoom(janela.zoom);
  const origemX = Math.floor(janela.x / passo) * passo;
  const origemY = Math.floor(janela.y / passo) * passo;
  const colunas = Math.ceil((janela.x + janela.largura - origemX) / passo) + 2;
  const linhas = Math.ceil((janela.y + janela.altura - origemY) / passo) + 2;
  if (colunas * linhas > 2000000) throw new Error('A área de desenho excede o limite do calor.');
  const valores = new Float32Array(colunas * linhas);
  const raioQuadrado = radius * radius;
  for (const [xBase, yBase, peso] of pontos) {
    if (![xBase, yBase, peso].every(Number.isFinite) || peso <= 0) continue;
    const x = xBase * escala, y = yBase * escala;
    const inicioX = Math.max(0, Math.ceil((x - radius - origemX) / passo));
    const fimX = Math.min(colunas - 1, Math.floor((x + radius - origemX) / passo));
    const inicioY = Math.max(0, Math.ceil((y - radius - origemY) / passo));
    const fimY = Math.min(linhas - 1, Math.floor((y + radius - origemY) / passo));
    for (let iy = inicioY; iy <= fimY; iy++) {
      const dy = origemY + iy * passo - y;
      for (let ix = inicioX; ix <= fimX; ix++) {
        const dx = origemX + ix * passo - x;
        const u = 1 - (dx * dx + dy * dy) / raioQuadrado;
        if (u > 0) valores[iy * colunas + ix] += peso * u * u * u;
      }
    }
  }
  return { valores, colunas, linhas, origemX, origemY, passo, radius };
}

const PARADAS = Object.entries(GRADIENTE_CALOR).map(([posicao, hex]) => ({ posicao: Number(posicao),
  rgb: [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)) })).sort((a, b) => a.posicao - b.posicao);
const CORES = Array.from({ length: 1024 }, (_, indice) => {
  const nivel = indice / 1023;
  const direita = PARADAS.find(p => p.posicao >= nivel) || PARADAS[PARADAS.length - 1];
  const esquerda = [...PARADAS].reverse().find(p => p.posicao <= nivel) || PARADAS[0];
  const t = direita.posicao === esquerda.posicao ? 0 : (nivel - esquerda.posicao) / (direita.posicao - esquerda.posicao);
  return esquerda.rgb.map((cor, i) => Math.round(cor + (direita.rgb[i] - cor) * t));
});
/** Mesma escala em qualquer janela/zoom/filtro. Alfa máximo de 64% preserva as ruas. */
export function colorirCampoCalor(valores: Float32Array): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(valores.length * 4);
  const normalizacao = Math.log1p(DENSIDADE_CALOR_REFERENCIA);
  for (let i = 0; i < valores.length; i++) {
    const densidade = valores[i];
    if (!Number.isFinite(densidade) || densidade <= 0) continue;
    const nivel = Math.min(1, Math.log1p(densidade) / normalizacao);
    const cor = CORES[Math.round(nivel * 1023)];
    rgba[i * 4] = cor[0]; rgba[i * 4 + 1] = cor[1]; rgba[i * 4 + 2] = cor[2];
    rgba[i * 4 + 3] = Math.round(255 * Math.min(.64, densidade * .5));
  }
  return rgba;
}
