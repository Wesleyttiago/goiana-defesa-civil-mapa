'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type * as Leaflet from 'leaflet';
import { adicionarLimiteGoiana } from '@/lib/territorio';
import { CENTRO_GOIANA } from '@/lib/pontos';
import type { LocalizacaoFamilia } from '@/lib/familias';

export default function SeletorLocalizacao({ localizacao, aoSelecionar }: {
  localizacao: LocalizacaoFamilia | null; aoSelecionar: (local: LocalizacaoFamilia) => void;
}) {
  const elemento = useRef<HTMLDivElement>(null);
  const mapa = useRef<Leaflet.Map | null>(null);
  const marcador = useRef<Leaflet.Marker | null>(null);
  const selecionar = useRef(aoSelecionar);
  const local = useRef(localizacao);
  const [estado, setEstado] = useState<'carregando' | 'pronto' | 'erro'>('carregando');
  const [tentativa, setTentativa] = useState(0);
  selecionar.current = aoSelecionar;
  local.current = localizacao;

  const atualizarMarcador = useCallback(() => {
    const pin = marcador.current, instancia = mapa.current, posicao = local.current;
    if (!pin || !instancia) return;
    if (!posicao) { pin.setOpacity(0); pin.dragging?.disable(); return; }
    pin.setLatLng([posicao.latitude, posicao.longitude]).setOpacity(1);
    pin.dragging?.enable();
    if (!instancia.getBounds().contains([posicao.latitude, posicao.longitude])) {
      instancia.setView([posicao.latitude, posicao.longitude], 16, { animate: false });
    }
  }, []);

  useEffect(() => {
    let cancelado = false;
    let instancia: Leaflet.Map | undefined;
    let observador: ResizeObserver | undefined;
    setEstado('carregando');
    import('leaflet').then(({ default: L }) => {
      if (cancelado || !elemento.current) return;
      instancia = L.map(elemento.current, {
        center: local.current ? [local.current.latitude, local.current.longitude] : CENTRO_GOIANA,
        zoom: 16, minZoom: 3, maxZoom: 19, scrollWheelZoom: false, zoomControl: false,
        doubleClickZoom: false, zoomAnimation: !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      });
      mapa.current = instancia;
      instancia.attributionControl.setPrefix('Leaflet');
      L.control.zoom({ zoomInTitle: 'Aproximar localização', zoomOutTitle: 'Afastar localização' }).addTo(instancia);
      adicionarLimiteGoiana(L, instancia);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>',
      }).addTo(instancia);
      const escolher = (lat: number, lng: number) => selecionar.current({ latitude: Number(lat.toFixed(7)), longitude: Number(lng.toFixed(7)), origem: 'mapa' });
      instancia.on('click', (evento: Leaflet.LeafletMouseEvent) => escolher(evento.latlng.lat, evento.latlng.lng));
      const pin = document.createElement('span'); pin.className = 'pin-cadastro';
      marcador.current = L.marker(CENTRO_GOIANA, {
        draggable: true, opacity: 0, keyboard: false, title: 'Residência selecionada. Arraste para ajustar.',
        icon: L.divIcon({ html: pin, className: 'marcador-cadastro', iconSize: [30, 36], iconAnchor: [15, 34] }),
      }).addTo(instancia);
      marcador.current.on('dragend', () => { const posicao = marcador.current!.getLatLng(); escolher(posicao.lat, posicao.lng); });
      atualizarMarcador();
      observador = new ResizeObserver(() => {
        if (!cancelado && elemento.current?.clientWidth && elemento.current.clientHeight) instancia?.invalidateSize({ animate: false });
      });
      observador.observe(elemento.current);
      setEstado('pronto');
    }).catch(() => {
      instancia?.remove(); mapa.current = null; marcador.current = null;
      if (!cancelado) setEstado('erro');
    });
    return () => { cancelado = true; observador?.disconnect(); instancia?.remove(); mapa.current = null; marcador.current = null; };
  }, [tentativa, atualizarMarcador]);

  useEffect(atualizarMarcador, [localizacao, atualizarMarcador]);

  return <div className="seletor-localizacao">
    <div ref={elemento} className="mapa-selecao" role="region" aria-label="Mapa para localizar a residência"/>
    {estado === 'carregando' && <p role="status">Preparando o mapa…</p>}
    {estado === 'erro' && <p role="alert" className="erro-campo">Não foi possível iniciar o mapa. <button type="button" onClick={() => setTentativa(n => n + 1)}>Tentar novamente</button> Você também pode informar as coordenadas.</p>}
    <button type="button" disabled={estado !== 'pronto'} onClick={() => {
      const centro = mapa.current?.getCenter();
      if (centro) selecionar.current({ latitude: Number(centro.lat.toFixed(7)), longitude: Number(centro.lng.toFixed(7)), origem: 'mapa' });
    }}>Usar o centro do mapa</button>
    <p>Clique na residência ou mova o mapa com as setas e use o botão acima. Para aproximar, use + e − ou o gesto de pinça.</p>
  </div>;
}
