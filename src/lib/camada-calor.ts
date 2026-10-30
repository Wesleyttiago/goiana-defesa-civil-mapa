import type * as Leaflet from 'leaflet';
import { calcularCampoCalor, colorirCampoCalor, projetarPontosCalor, RAIO_CALOR_METROS, type PontoCalor } from './calor';

/** Camada única de canvas. Usa APIs públicas do Leaflet e não modifica plugins/protótipos. */
export function criarCamadaCalor(L: typeof Leaflet, pontos: readonly PontoCalor[], aoFalhar: () => void) {
  return new class extends L.Layer {
    private mapa: Leaflet.Map | null = null;
    private canvas = document.createElement('canvas');
    private amostra = document.createElement('canvas');
    private projetados = projetarPontosCalor(pontos);
    private quadro: number | null = null;
    private origem: Leaflet.LatLng | null = null;
    private zoomDesenhado = 14;
    private renderizacoes = 0;
    private limitesDesenhados: Leaflet.Bounds | null = null;
    private emZoom = false;

    constructor() {
      super();
      this.canvas.className = 'leaflet-heatmap-layer leaflet-layer';
      this.canvas.style.transformOrigin = '0 0';
      this.canvas.setAttribute('aria-hidden', 'true');
      this.canvas.dataset.renderizadorCalor = 'radial-canvas';
      this.canvas.dataset.raioMetros = String(RAIO_CALOR_METROS);
    }
    getElement() { return this.canvas; }
    setLatLngs(dados: readonly PontoCalor[]) {
      this.projetados = projetarPontosCalor(dados);
      return this.redraw();
    }
    onAdd(mapa: Leaflet.Map) {
      this.mapa = mapa;
      L.DomUtil.addClass(this.canvas, mapa.options.zoomAnimation && L.Browser.any3d ? 'leaflet-zoom-animated' : 'leaflet-zoom-hide');
      mapa.getPanes().overlayPane.appendChild(this.canvas);
      mapa.on('moveend resize viewreset', this.redraw, this);
      mapa.on('move', this.acompanharArraste, this);
      mapa.on('zoomstart', this.iniciarZoom, this);
      mapa.on('zoomend', this.terminarZoom, this);
      mapa.on('zoomanim', this.animarZoom, this);
      this.redraw();
      return this;
    }
    onRemove(mapa: Leaflet.Map) {
      mapa.off('moveend resize viewreset', this.redraw, this);
      mapa.off('move', this.acompanharArraste, this);
      mapa.off('zoomstart', this.iniciarZoom, this);
      mapa.off('zoomend', this.terminarZoom, this);
      mapa.off('zoomanim', this.animarZoom, this);
      if (this.quadro !== null) cancelAnimationFrame(this.quadro);
      this.quadro = null; this.canvas.remove(); this.mapa = null; this.origem = null;
      this.limitesDesenhados = null; this.emZoom = false;
      return this;
    }
    redraw() {
      if (this.mapa && this.quadro === null) this.quadro = requestAnimationFrame(() => {
        this.quadro = null;
        try { this.desenhar(); } catch { this.remove(); aoFalhar(); }
      });
      return this;
    }
    private desenhar() {
      const mapa = this.mapa;
      if (!mapa) return;
      const tamanho = mapa.getSize();
      if (tamanho.x <= 0 || tamanho.y <= 0) return;
      const inicio = performance.now();
      const margemX = Math.min(160, Math.ceil(tamanho.x * .25));
      const margemY = Math.min(160, Math.ceil(tamanho.y * .25));
      const origem = mapa.getPixelBounds().min!.subtract([margemX, margemY]);
      const largura = tamanho.x + margemX * 2, altura = tamanho.y + margemY * 2;
      const zoom = mapa.getZoom();
      const campo = calcularCampoCalor(this.projetados, { x: origem.x, y: origem.y, largura, altura, zoom });
      this.amostra.width = campo.colunas; this.amostra.height = campo.linhas;
      const contextoAmostra = this.amostra.getContext('2d');
      const contexto = this.canvas.getContext('2d');
      if (!contextoAmostra || !contexto) throw new Error('Canvas indisponível.');
      const imagem = contextoAmostra.createImageData(campo.colunas, campo.linhas);
      imagem.data.set(colorirCampoCalor(campo.valores));
      contextoAmostra.putImageData(imagem, 0, 0);
      if (this.canvas.width !== largura) this.canvas.width = largura;
      if (this.canvas.height !== altura) this.canvas.height = altura;
      contexto.clearRect(0, 0, largura, altura);
      contexto.imageSmoothingEnabled = true;
      contexto.imageSmoothingQuality = 'high';
      // O centro de cada pixel da amostra corresponde ao nó da grade mundial.
      contexto.drawImage(this.amostra, campo.origemX - origem.x - campo.passo / 2,
        campo.origemY - origem.y - campo.passo / 2, campo.colunas * campo.passo, campo.linhas * campo.passo);
      L.DomUtil.setPosition(this.canvas, mapa.containerPointToLayerPoint([-margemX, -margemY]));
      this.origem = mapa.unproject(origem, zoom); this.zoomDesenhado = zoom;
      this.limitesDesenhados = L.bounds(origem, origem.add([largura, altura]));
      this.canvas.dataset.raioCalor = String(campo.radius);
      this.canvas.dataset.zoomCalor = String(zoom);
      this.canvas.dataset.celulasCalor = String(campo.valores.length);
      this.canvas.dataset.quadrosCalor = String(++this.renderizacoes);
      this.canvas.dataset.calculoMs = String(Math.round(performance.now() - inicio));
    }
    private acompanharArraste() {
      if (!this.mapa || this.emZoom || !this.limitesDesenhados) return;
      const visivel = this.mapa.getPixelBounds();
      const comFolga = L.bounds(visivel.min!.subtract([24, 24]), visivel.max!.add([24, 24]));
      // Recalcula durante arrastes longos apenas quando a margem está acabando.
      if (!this.limitesDesenhados.contains(comFolga)) this.redraw();
    }
    private iniciarZoom() { this.emZoom = true; }
    private terminarZoom() { this.emZoom = false; this.redraw(); }
    private animarZoom(evento: Leaflet.ZoomAnimEvent) {
      const mapa = this.mapa;
      if (!mapa || !this.origem) return;
      const escala = mapa.getZoomScale(evento.zoom, this.zoomDesenhado);
      // Equivalente ao novo pixel origin, construído somente com APIs públicas.
      const pane = mapa.containerPointToLayerPoint([0, 0]).multiplyBy(-1);
      const novaOrigem = mapa.project(evento.center, evento.zoom).subtract(mapa.getSize().divideBy(2)).add(pane).round();
      const deslocamento = mapa.project(this.origem, evento.zoom).subtract(novaOrigem);
      L.DomUtil.setTransform(this.canvas, deslocamento, escala);
    }
  }();
}
export type CamadaCalor = ReturnType<typeof criarCamadaCalor>;
