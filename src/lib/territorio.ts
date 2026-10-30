import limite from '../data/limite-goiana.json';
import type { Feature, Polygon, MultiPolygon } from 'geojson';
import type * as Leaflet from 'leaflet';

export const LIMITE_GOIANA = limite as Feature<Polygon | MultiPolygon>;
type Posicao = number[];
function situacaoNoAnel(x: number, y: number, anel: Posicao[]): 'dentro' | 'fora' | 'borda' {
  let dentro = false;
  for (let i = 0, j = anel.length - 1; i < anel.length; j = i++) {
    const [xi, yi] = anel[i], [xj, yj] = anel[j];
    const dx = xj - xi, dy = yj - yi;
    const comprimento = Math.hypot(dx, dy);
    if (comprimento > 0 && Math.abs((x - xi) * dy - (y - yi) * dx) <= 1e-10 * comprimento
      && x >= Math.min(xi, xj) - 1e-10 && x <= Math.max(xi, xj) + 1e-10
      && y >= Math.min(yi, yj) - 1e-10 && y <= Math.max(yi, yj) + 1e-10) return 'borda';
    if ((yi > y) !== (yj > y) && x < dx * (y - yi) / dy + xi) dentro = !dentro;
  }
  return dentro ? 'dentro' : 'fora';
}
/** Limite IBGE 2025, código 2606200. SIRGAS 2000 em coordenadas geográficas. */
export function dentroDeGoiana(latitude: number, longitude: number): boolean {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
  const geometria = LIMITE_GOIANA.geometry;
  const poligonos = geometria.type === 'Polygon' ? [geometria.coordinates] : geometria.coordinates;
  return poligonos.some(p => {
    const exterior = situacaoNoAnel(longitude, latitude, p[0]);
    return exterior !== 'fora' && !p.slice(1).some(anel => situacaoNoAnel(longitude, latitude, anel) === 'dentro');
  });
}
export function adicionarLimiteGoiana(L: typeof Leaflet, mapa: Leaflet.Map) {
  return L.geoJSON(LIMITE_GOIANA, { interactive: false,
    attribution: '<a href="https://www.ibge.gov.br/geociencias/organizacao-do-territorio/malhas-territoriais/15774-malhas.html" target="_blank" rel="noopener noreferrer">Limite: IBGE · 2025</a>',
    style: { color: '#245ba3', weight: 2, dashArray: '7 6', fill: false, opacity: .8 },
  }).addTo(mapa);
}
