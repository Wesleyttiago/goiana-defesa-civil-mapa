'use client';

import { useEffect, useRef } from 'react';
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
  const biblioteca = useRef<typeof Leaflet | null>(null);
  selecionar.current = aoSelecionar;
  local.current = localizacao;
  useEffect(() => {
    let cancelado = false;
    let instancia: Leaflet.Map | undefined;
    let observador: ResizeObserver | undefined;
    import('leaflet').then(({ default: L }) => {
      if (cancelado || !elemento.current) return;
      biblioteca.current = L;
      instancia = L.map(elemento.current, { center: local.current ? [local.current.latitude, local.current.longitude] : CENTRO_GOIANA, zoom: 16, minZoom: 3, maxZoom: 19, scrollWheelZoom: false });
      mapa.current = instancia;
      instancia.attributionControl.setPrefix('Leaflet');
      adicionarLimiteGoiana(L, instancia);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>' }).addTo(instancia);
      const escolher = (lat: number, lng: number) => selecionar.current({ latitude: Number(lat.toFixed(7)), longitude: Number(lng.toFixed(7)), origem: 'mapa' });
      instancia.on('click', (evento: Leaflet.LeafletMouseEvent) => escolher(evento.latlng.lat, evento.latlng.lng));
      const pin = document.createElement('span'); pin.className = 'pin-cadastro';
      marcador.current = L.marker(local.current ? [local.current.latitude, local.current.longitude] : CENTRO_GOIANA, { draggable: true, opacity: local.current ? 1 : 0, title: 'Residência selecionada. Arraste para ajustar.', keyboard: false,
        icon: L.divIcon({ html: pin, className: 'marcador-cadastro', iconSize: [30, 36], iconAnchor: [15, 34] }) }).addTo(instancia);
      marcador.current.on('dragend', () => { const posicao = marcador.current!.getLatLng(); escolher(posicao.lat, posicao.lng); });
      observador = new ResizeObserver(() => { if (!cancelado && elemento.current?.clientWidth && elemento.current.clientHeight) instancia?.invalidateSize({ animate: false }); });
      observador.observe(elemento.current);
    });
    return () => { cancelado = true; observador?.disconnect(); instancia?.remove(); mapa.current = null; marcador.current = null; };
  }, []);
  useEffect(() => {
    if (!localizacao || !mapa.current || !marcador.current) return;
    marcador.current.setLatLng([localizacao.latitude, localizacao.longitude]).setOpacity(1);
    if (!mapa.current.getBounds().contains([localizacao.latitude, localizacao.longitude])) mapa.current.setView([localizacao.latitude, localizacao.longitude], 16, { animate: false });
  }, [localizacao]);
  return <div className="seletor-localizacao"><div ref={elemento} className="mapa-selecao" role="region" aria-label="Mapa para localizar a residência"/>
    <button type="button" onClick={() => { const centro = mapa.current?.getCenter(); if (centro) selecionar.current({ latitude: Number(centro.lat.toFixed(7)), longitude: Number(centro.lng.toFixed(7)), origem: 'mapa' }); }}>Usar o centro do mapa</button>
    <p>Clique na residência ou mova o mapa com as setas e use o botão acima.</p>
  </div>;
}
