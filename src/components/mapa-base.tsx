'use client';

import { memo, useEffect, useRef, useState } from 'react';
import type * as Leaflet from 'leaflet';
import { CENTRO_GOIANA, ESTILOS_RISCO, maiorNivel, nomeDaFamilia, type NivelRisco, type PontoRisco } from '@/lib/pontos';
import { adicionarLimiteGoiana } from '@/lib/territorio';
import { useCamadaCalor, type EstadoCalor } from './use-camada-calor';
import CamadasAmbientaisMapa, { type ConfiguracaoAmbiente } from './camadas-ambientais-mapa';

export interface EstadoPlotagem {
  fase: 'carregando' | 'pronto' | 'erro';
  processados: number;
  total: number;
  duracaoMs: number;
}

interface Props {
  pontos: readonly PontoRisco[];
  centralizarId: number;
  enquadrarId: number;
  aoAtualizar: (estado: EstadoPlotagem) => void;
  calorAtivo: boolean;
  aoAtualizarCalor: (estado: EstadoCalor) => void;
  aoSelecionarFamilia: (ponto: PontoRisco) => void;
  foco: { ponto: PontoRisco; revisao: number } | null;
  ambiente: ConfiguracaoAmbiente;
}

const permiteMovimento = () => !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Uma etiqueta visual compartilhada por grupos e famílias no modo de calor. */
function criarEtiquetaQuantidade(total: number) {
  const etiqueta = document.createElement('span');
  etiqueta.className = 'etiqueta-quantidade';
  const icone = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  icone.classList.add('icone-grupo');
  icone.setAttribute('viewBox', '0 0 24 24');
  icone.setAttribute('fill', 'none'); icone.setAttribute('stroke', 'currentColor');
  icone.setAttribute('stroke-width', '2'); icone.setAttribute('stroke-linecap', 'round');
  icone.setAttribute('stroke-linejoin', 'round'); icone.setAttribute('aria-hidden', 'true');
  for (const desenho of ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M22 21v-2a4 4 0 0 0-3-3.87', 'M16 3.13a4 4 0 0 1 0 7.75', 'M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0']) {
    const caminho = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    caminho.setAttribute('d', desenho); icone.append(caminho);
  }
  const quantidade = document.createElement('b');
  quantidade.textContent = String(total);
  etiqueta.append(icone, quantidade);
  return etiqueta;
}

function MapaBase({ pontos, centralizarId, enquadrarId, aoAtualizar, calorAtivo, aoAtualizarCalor, aoSelecionarFamilia, foco, ambiente }: Props) {
  const elementoRef = useRef<HTMLDivElement>(null);
  const mapaRef = useRef<Leaflet.Map | null>(null);
  const bibliotecaRef = useRef<typeof Leaflet | null>(null);
  const mosaicoRef = useRef<Leaflet.TileLayer | null>(null);
  const gruposRef = useRef<Leaflet.MarkerClusterGroup | null>(null);
  const marcadoresRef = useRef(new Map<string, Leaflet.Marker>());
  const selecionarRef = useRef(aoSelecionarFamilia);
  selecionarRef.current = aoSelecionarFamilia;
  const [pronto, setPronto] = useState(false);
  const geracao = useRef(0);
  const [grupoPronto, setGrupoPronto] = useState(0);
  const focoAplicado = useRef<number | null>(null);
  const [erroInicial, setErroInicial] = useState(false);
  const [erroRuas, setErroRuas] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  const calor = useCamadaCalor({ mapa: pronto ? mapaRef.current : null, pontos, ativo: calorAtivo });
  useEffect(() => { aoAtualizarCalor(calor.estado); }, [calor.estado, aoAtualizarCalor]);

  // A instância do mapa é criada uma vez; os pontos são atualizados em outra camada.
  useEffect(() => {
    let cancelado = false;
    let mapa: Leaflet.Map | undefined;
    let observador: ResizeObserver | undefined;
    let falhas = 0;
    focoAplicado.current = null; setPronto(false); setErroInicial(false); setErroRuas(false);
    aoAtualizar({ fase: 'carregando', processados: 0, total: 0, duracaoMs: 0 });
    async function iniciar() {
      const L = (await import('leaflet')).default;
      (window as unknown as { L: typeof Leaflet }).L = L;
      await import('leaflet.markercluster');
      if (cancelado || !elementoRef.current) return;
      bibliotecaRef.current = L;
      mapa = L.map(elementoRef.current, {
        center: CENTRO_GOIANA, zoom: 14, minZoom: 3, maxZoom: 19,
        zoomControl: false, preferCanvas: true, scrollWheelZoom: true, doubleClickZoom: false,
        zoomAnimation: permiteMovimento(), fadeAnimation: permiteMovimento(),
      });
      mapaRef.current = mapa;
      mapa.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener noreferrer">Leaflet</a>');
      const mosaico = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>',
      });
      mosaico.on('tileerror', () => { falhas++; if (!cancelado && falhas >= 3) setErroRuas(true); });
      mosaico.on('tileload', () => { falhas = 0; if (!cancelado) setErroRuas(false); });
      mosaico.addTo(mapa); mosaicoRef.current = mosaico;
      adicionarLimiteGoiana(L, mapa);
      L.control.zoom({ position: 'topright', zoomInTitle: 'Aproximar mapa', zoomOutTitle: 'Afastar mapa' }).addTo(mapa);
      L.control.scale({ position: 'bottomleft', imperial: false }).addTo(mapa);
      observador = new ResizeObserver(() => {
        const elemento = elementoRef.current;
        // Um contêiner oculto ou desmontado não pode gerar um canvas de tamanho zero.
        if (!cancelado && elemento?.isConnected && elemento.clientWidth > 0 && elemento.clientHeight > 0) {
          mapa?.invalidateSize({ animate: false, debounceMoveend: true });
        }
      });
      observador.observe(elementoRef.current);
      setPronto(true);
    }
    iniciar().catch(() => {
      if (!cancelado) {
        setErroInicial(true);
        aoAtualizar({ fase: 'erro', processados: 0, total: 0, duracaoMs: 0 });
      }
    });
    return () => { cancelado = true; observador?.disconnect(); mapa?.remove(); mapaRef.current = null; mosaicoRef.current = null; };
  }, [aoAtualizar, tentativa]);

  useEffect(() => {
    const mapa = mapaRef.current; const L = bibliotecaRef.current;
    if (!pronto || !mapa || !L) return;
    let cancelado = false;
    const lote = ++geracao.current;
    const inicio = performance.now();
    const niveis = new WeakMap<Leaflet.Marker, NivelRisco>();
    aoAtualizar({ fase: 'carregando', processados: 0, total: pontos.length, duracaoMs: 0 });
    const grupos = L.markerClusterGroup({
      chunkedLoading: true,
      chunkInterval: 32,
      chunkDelay: 8,
      animate: permiteMovimento(),
      animateAddingMarkers: false,
      maxClusterRadius: 55,
      removeOutsideVisibleBounds: true,
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      chunkProgress: (processados, total) => {
        if (!cancelado && processados === total) setGrupoPronto(lote);
        if (!cancelado) aoAtualizar({ fase: processados === total ? 'pronto' : 'carregando', processados,
          total, duracaoMs: Math.round(performance.now() - inicio) });
      },
      iconCreateFunction: grupo => {
        const nivel = maiorNivel(grupo.getAllChildMarkers().map(m => niveis.get(m) ?? 'nao_informado'));
        const estilo = ESTILOS_RISCO[nivel];
        const titulo = `${grupo.getChildCount()} famílias agrupadas. Maior nível de risco informado: ${estilo.rotulo.toLowerCase()}. Ative para aproximar.`;
        const circulo = criarEtiquetaQuantidade(grupo.getChildCount());
        circulo.style.setProperty('--cor-risco', estilo.cor);
        circulo.title = `${grupo.getChildCount()} famílias. Clique para aproximar.`;
        circulo.setAttribute('aria-label', titulo);
        return L.divIcon({ html: circulo, className: 'agrupamento', iconSize: [44, 44], iconAnchor: [22, 22] });
      },
    }).addTo(mapa);
    gruposRef.current = grupos;
    marcadoresRef.current.clear();

    const marcadores = pontos.map(ponto => {
      const estilo = ESTILOS_RISCO[ponto.nivelRisco];
      const nome = nomeDaFamilia(ponto);
      const pin = document.createElement('span');
      pin.className = 'corpo-marcador';
      pin.style.setProperty('--cor-risco', estilo.cor);
      pin.setAttribute('aria-hidden', 'true');
      const letra = document.createElement('b'); letra.textContent = estilo.letra; pin.append(letra);
      const etiqueta = criarEtiquetaQuantidade(1);
      etiqueta.setAttribute('aria-hidden', 'true');
      const conteudo = document.createElement('div');
      conteudo.append(pin, etiqueta);
      const titulo = `${nome} — representante familiar. Risco ${estilo.rotulo.toLowerCase()}`;
      const marcador = L.marker([ponto.latitude, ponto.longitude], {
        title: titulo,
        alt: nome,
        keyboard: true,
        icon: L.divIcon({ html: conteudo, className: 'marcador-risco', iconSize: [44, 44], iconAnchor: [22, 22], tooltipAnchor: [0, -39] }),
      });
      const fecharPeloTeclado = (evento: KeyboardEvent) => {
        if (evento.key !== 'Escape') return;
        evento.preventDefault(); evento.stopPropagation();
        marcador.closePopup(); marcador.getElement()?.focus();
      };
      marcador.on('add', () => {
        const elemento = marcador.getElement();
        elemento?.setAttribute('aria-label', titulo);
        elemento?.setAttribute('aria-expanded', String(marcador.isPopupOpen()));
        if (elemento) elemento.onkeydown = evento => {
          if (evento.key === ' ') {
            evento.preventDefault(); evento.stopPropagation(); marcador.togglePopup();
          } else fecharPeloTeclado(evento);
        };
      });
      niveis.set(marcador, ponto.nivelRisco);
      // Conteúdo como nós de texto: nomes recebidos da API nunca viram HTML.
      const cartao = document.createElement('div'); cartao.className = 'identificacao-familia';
      const descricao = document.createElement('span'); descricao.className = 'tipo-representante';
      descricao.textContent = 'Representante familiar';
      const nomeElemento = document.createElement('strong'); nomeElemento.className = 'nome-representante'; nomeElemento.textContent = nome;
      const classificacao = document.createElement('span'); classificacao.className = 'classificacao-familia';
      const amostra = document.createElement('span'); amostra.className = 'amostra'; amostra.style.backgroundColor = estilo.cor; amostra.textContent = estilo.letra;
      amostra.setAttribute('aria-hidden', 'true');
      const texto = document.createElement('span'); texto.textContent = `Risco informado: ${estilo.rotulo.toLowerCase()}`;
      classificacao.append(amostra, texto); cartao.append(descricao, nomeElemento, classificacao);
      const consultar = document.createElement('button'); consultar.type = 'button'; consultar.className = 'consultar-no-mapa';
      consultar.textContent = 'Ver cadastro da família';
      consultar.onclick = () => selecionarRef.current(ponto);
      cartao.append(consultar);
      marcador.bindPopup(cartao, {
        className: 'popup-familia', minWidth: 195, maxWidth: 265,
        offset: [0, -30], autoPanPadding: [24, 24], closeButton: true,
      });
      marcador.on('popupopen', () => {
        const elemento = marcador.getElement();
        elemento?.classList.add('familia-selecionada');
        elemento?.setAttribute('aria-expanded', 'true');
        const popup = marcador.getPopup()?.getElement();
        const fechar = popup?.querySelector<HTMLAnchorElement>('.leaflet-popup-close-button');
        fechar?.setAttribute('aria-label', 'Fechar identificação da família');
        fechar?.setAttribute('title', 'Fechar identificação da família');
        if (fechar) fechar.onclick = () => marcador.getElement()?.focus();
        if (popup) popup.onkeydown = evento => {
          if (evento.key === ' ' && evento.target === fechar) {
            evento.preventDefault(); marcador.closePopup(); marcador.getElement()?.focus();
          } else fecharPeloTeclado(evento);
        };
      }).on('popupclose', () => {
        marcador.getElement()?.classList.remove('familia-selecionada');
        marcador.getElement()?.setAttribute('aria-expanded', 'false');
      });
      marcadoresRef.current.set(ponto.id, marcador);
      return marcador;
    });
    grupos.addLayers(marcadores);
    if (!pontos.length) { setGrupoPronto(lote); aoAtualizar({ fase: 'pronto', processados: 0, total: 0, duracaoMs: 0 }); }
    return () => { cancelado = true; grupos.remove(); gruposRef.current = null; marcadoresRef.current.clear(); };
  }, [pontos, pronto, aoAtualizar]);

  useEffect(() => {
    if (!pronto || !foco || !mapaRef.current || grupoPronto !== geracao.current || focoAplicado.current === foco.revisao) return;
    const marcador = marcadoresRef.current.get(foco.ponto.id);
    const grupos = gruposRef.current;
    if (!marcador || !grupos) return;
    let cancelado = false;
    grupos.zoomToShowLayer(marcador, () => {
      if (cancelado || grupos !== gruposRef.current || marcadoresRef.current.get(foco.ponto.id) !== marcador) return;
      focoAplicado.current = foco.revisao;
      marcador.openPopup();
    });
    return () => { cancelado = true; };
  }, [foco, pronto, grupoPronto, pontos]);

  useEffect(() => { if (pronto) mapaRef.current?.setView(CENTRO_GOIANA, 14, { animate: permiteMovimento(), duration: 0.45 }); }, [centralizarId, pronto]);
  useEffect(() => {
    if (!pronto || !enquadrarId || !bibliotecaRef.current || !mapaRef.current) return;
    if (pontos.length) mapaRef.current.fitBounds(bibliotecaRef.current.latLngBounds(pontos.map(p => [p.latitude, p.longitude])), { padding: [45, 45], maxZoom: 17, animate: permiteMovimento(), duration: 0.45 });
  // A câmera muda por solicitação de enquadramento, incluindo filtros estabilizados.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enquadrarId, pronto]);

  return <div className="mapa-base" data-camada-calor={calor.estado.fase} data-pontos-calor={calor.estado.quantidade}>
    <div className="superficie-mapa" ref={elementoRef} role="region" aria-label="Mapa interativo de Goiana com famílias cadastradas" />
    {pronto && mapaRef.current && <CamadasAmbientaisMapa mapa={mapaRef.current} configuracao={ambiente}/>}
    {!pronto && !erroInicial && <div className="carregando-mapa" role="status"><span className="spinner"/>Carregando o mapa de Goiana…</div>}
    {(erroInicial || erroRuas) && <div className="erro-mapa" role="alert"><span>{erroInicial ? 'Não foi possível iniciar o mapa.' : 'Não foi possível carregar as ruas. Verifique a conexão com a internet.'}</span>
      <button type="button" onClick={() => { if (erroInicial) setTentativa(n => n + 1); else { setErroRuas(false); mosaicoRef.current?.redraw(); } }}>Tentar novamente</button></div>}
    {calor.estado.fase === 'erro' && <div className="erro-mapa" role="alert"><span>Não foi possível carregar o mapa de calor.</span><button type="button" onClick={calor.tentarNovamente}>Tentar carregar o calor</button></div>}
  </div>;
}

export default memo(MapaBase);
