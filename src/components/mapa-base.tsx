'use client';

import { memo, useEffect, useRef, useState } from 'react';
import type * as Leaflet from 'leaflet';
import { CENTRO_GOIANA, ESTILOS_RISCO, maiorNivel, type NivelRisco, type PontoRisco } from '@/lib/pontos';

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
}

function MapaBase({ pontos, centralizarId, enquadrarId, aoAtualizar }: Props) {
  const elementoRef = useRef<HTMLDivElement>(null);
  const mapaRef = useRef<Leaflet.Map | null>(null);
  const bibliotecaRef = useRef<typeof Leaflet | null>(null);
  const mosaicoRef = useRef<Leaflet.TileLayer | null>(null);
  const [pronto, setPronto] = useState(false);
  const [erroInicial, setErroInicial] = useState(false);
  const [erroRuas, setErroRuas] = useState(false);
  const [tentativa, setTentativa] = useState(0);

  // A instância do mapa é criada uma vez; os pontos são atualizados em outra camada.
  useEffect(() => {
    let cancelado = false;
    let mapa: Leaflet.Map | undefined;
    let observador: ResizeObserver | undefined;
    let falhas = 0;
    setPronto(false); setErroInicial(false); setErroRuas(false);
    aoAtualizar({ fase: 'carregando', processados: 0, total: 0, duracaoMs: 0 });
    async function iniciar() {
      const L = (await import('leaflet')).default;
      (window as unknown as { L: typeof Leaflet }).L = L;
      await import('leaflet.markercluster');
      if (cancelado || !elementoRef.current) return;
      bibliotecaRef.current = L;
      mapa = L.map(elementoRef.current, {
        center: CENTRO_GOIANA, zoom: 14, minZoom: 3, maxZoom: 19,
        zoomControl: false, preferCanvas: true,
      });
      mapaRef.current = mapa;
      mapa.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener noreferrer">Leaflet</a>');
      const mosaico = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>',
      });
      mosaico.on('tileerror', () => { falhas++; if (!cancelado && falhas >= 3) setErroRuas(true); });
      mosaico.on('tileload', () => { falhas = 0; if (!cancelado) setErroRuas(false); });
      mosaico.addTo(mapa); mosaicoRef.current = mosaico;
      L.control.zoom({ position: 'topright', zoomInTitle: 'Aproximar mapa', zoomOutTitle: 'Afastar mapa' }).addTo(mapa);
      L.control.scale({ position: 'bottomleft', imperial: false }).addTo(mapa);
      observador = new ResizeObserver(() => mapa?.invalidateSize());
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
    const inicio = performance.now();
    const niveis = new WeakMap<Leaflet.Marker, NivelRisco>();
    aoAtualizar({ fase: 'carregando', processados: 0, total: pontos.length, duracaoMs: 0 });
    const grupos = L.markerClusterGroup({
      chunkedLoading: true,
      chunkInterval: 32,
      chunkDelay: 8,
      animate: false,
      animateAddingMarkers: false,
      maxClusterRadius: 55,
      removeOutsideVisibleBounds: true,
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      chunkProgress: (processados, total) => {
        if (!cancelado) aoAtualizar({ fase: processados === total ? 'pronto' : 'carregando', processados,
          total, duracaoMs: Math.round(performance.now() - inicio) });
      },
      iconCreateFunction: grupo => {
        const nivel = maiorNivel(grupo.getAllChildMarkers().map(m => niveis.get(m) ?? 'nao_informado'));
        const estilo = ESTILOS_RISCO[nivel];
        const titulo = `${grupo.getChildCount()} pontos agrupados. Maior nível informado: ${estilo.rotulo.toLowerCase()}. Ative para aproximar.`;
        const circulo = document.createElement('span');
        circulo.style.setProperty('--cor-risco', estilo.cor);
        circulo.textContent = String(grupo.getChildCount());
        circulo.title = titulo;
        circulo.setAttribute('aria-label', titulo);
        return L.divIcon({ html: circulo, className: 'agrupamento', iconSize: [44, 44], iconAnchor: [22, 22] });
      },
    }).addTo(mapa);

    const marcadores = pontos.map(ponto => {
      const estilo = ESTILOS_RISCO[ponto.nivelRisco];
      const pin = document.createElement('span');
      pin.className = 'corpo-marcador';
      pin.style.setProperty('--cor-risco', estilo.cor);
      const letra = document.createElement('b'); letra.textContent = estilo.letra; pin.append(letra);
      const titulo = `Ponto ${ponto.id} — risco ${estilo.rotulo.toLowerCase()}`;
      const marcador = L.marker([ponto.latitude, ponto.longitude], {
        title: titulo,
        alt: `Risco ${estilo.rotulo.toLowerCase()}`,
        keyboard: true,
        icon: L.divIcon({ html: pin, className: 'marcador-risco', iconSize: [36, 44], iconAnchor: [18, 41], tooltipAnchor: [0, -39] }),
      });
      marcador.on('add', () => marcador.getElement()?.setAttribute('aria-label', titulo));
      niveis.set(marcador, ponto.nivelRisco);
      const rotulo = document.createElement('span'); rotulo.textContent = `Risco ${estilo.rotulo.toLowerCase()}`;
      marcador.bindTooltip(rotulo).on('click', () => marcador.openTooltip());
      return marcador;
    });
    grupos.addLayers(marcadores);
    if (!pontos.length) aoAtualizar({ fase: 'pronto', processados: 0, total: 0, duracaoMs: 0 });
    return () => { cancelado = true; grupos.remove(); };
  }, [pontos, pronto, aoAtualizar]);

  useEffect(() => { if (pronto) mapaRef.current?.setView(CENTRO_GOIANA, 14, { animate: false }); }, [centralizarId, pronto]);
  useEffect(() => {
    if (!pronto || !enquadrarId || !bibliotecaRef.current || !mapaRef.current) return;
    if (pontos.length) mapaRef.current.fitBounds(bibliotecaRef.current.latLngBounds(pontos.map(p => [p.latitude, p.longitude])), { padding: [45, 45], maxZoom: 17, animate: false });
  // Os pontos não alteram a câmera: enquadrar depende da ação explícita do usuário.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enquadrarId, pronto]);

  return <div className="mapa-base">
    <div className="superficie-mapa" ref={elementoRef} role="region" aria-label="Mapa interativo de Goiana com marcadores de risco" />
    {!pronto && !erroInicial && <div className="carregando-mapa" role="status"><span className="spinner"/>Carregando o mapa de Goiana…</div>}
    {(erroInicial || erroRuas) && <div className="erro-mapa" role="alert"><span>{erroInicial ? 'Não foi possível iniciar o mapa.' : 'Não foi possível carregar as ruas. Verifique a conexão com a internet.'}</span>
      <button type="button" onClick={() => { if (erroInicial) setTentativa(n => n + 1); else { setErroRuas(false); mosaicoRef.current?.redraw(); } }}>Tentar novamente</button></div>}
  </div>;
}

export default memo(MapaBase);
