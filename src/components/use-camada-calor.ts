'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type * as Leaflet from 'leaflet';
import { opcoesCalorNoZoom, prepararPontosCalor, type PontoCalor } from '@/lib/calor';
import type { PontoRisco } from '@/lib/pontos';

export interface EstadoCalor {
  fase: 'desligado' | 'carregando' | 'ativo' | 'vazio' | 'erro';
  quantidade: number;
}

interface Props { mapa: Leaflet.Map | null; pontos: readonly PontoRisco[]; ativo: boolean }

/** Canvas com agrupamento por grade do Leaflet.heat; sem um nó DOM por ponto. */
export function useCamadaCalor({ mapa, pontos, ativo }: Props) {
  // Alternar a camada e mover o mapa não refazem a conversão das coordenadas.
  const dados = useMemo(() => prepararPontosCalor(pontos), [pontos]);
  const dadosRef = useRef(dados);
  const camadaRef = useRef<Leaflet.HeatLayer | null>(null);
  const aplicadosRef = useRef<PontoCalor[] | null>(null);
  const [fase, setFase] = useState<EstadoCalor['fase']>('desligado');
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => () => {
    camadaRef.current?.remove();
    camadaRef.current = null;
    aplicadosRef.current = null;
  }, [mapa]);

  // Atualiza somente a camada existente quando a API retorna um novo conjunto.
  useEffect(() => {
    dadosRef.current = dados;
    const camada = camadaRef.current;
    if (ativo && camada && mapa?.hasLayer(camada) && aplicadosRef.current !== dados) {
      camada.setLatLngs(dados);
      aplicadosRef.current = dados;
      setFase(dados.length ? 'ativo' : 'vazio');
    }
  }, [dados, mapa, ativo]);

  useEffect(() => {
    let cancelado = false;
    let quadro: number | undefined;
    let remocao: ReturnType<typeof setTimeout> | undefined;
    let removerEscutaZoom: (() => void) | undefined;
    const canvas = () => mapa?.getPanes().overlayPane.querySelector<HTMLCanvasElement>('.leaflet-heatmap-layer');
    if (!ativo || !mapa) {
      setFase('desligado');
      const camada = camadaRef.current;
      const elemento = canvas();
      if (elemento) elemento.style.opacity = '0';
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !elemento) camada?.remove();
      else remocao = setTimeout(() => camada?.remove(), 180);
      return () => { if (remocao) clearTimeout(remocao); };
    }
    const mapaAtual = mapa;
    setFase('carregando');
    async function mostrar() {
      const L = (await import('leaflet')).default;
      await import('leaflet.heat');
      if (cancelado) return;
      // A mesma camada e o mesmo canvas são reaproveitados nas alternâncias.
      if (!camadaRef.current) {
        camadaRef.current = L.heatLayer(dadosRef.current, opcoesCalorNoZoom(mapaAtual.getZoom()));
        aplicadosRef.current = dadosRef.current;
      }
      const camada = camadaRef.current;
      // Reanexa antes de atualizar: o plugin precisa de um mapa para redesenhar.
      const estavaVisivel = mapaAtual.hasLayer(camada);
      if (!estavaVisivel) camada.addTo(mapaAtual);
      if (aplicadosRef.current !== dadosRef.current) {
        camada.setLatLngs(dadosRef.current);
        aplicadosRef.current = dadosRef.current;
      }
      const ajustarEscala = () => {
        const opcoes = opcoesCalorNoZoom(mapaAtual.getZoom());
        camada.setOptions(opcoes);
        canvas()?.setAttribute('data-raio-calor', String(opcoes.radius));
      };
      ajustarEscala();
      mapaAtual.on('zoomend', ajustarEscala);
      removerEscutaZoom = () => mapaAtual.off('zoomend', ajustarEscala);
      // A descrição textual fica na legenda; os marcadores continuam acessíveis.
      const elemento = canvas();
      if (elemento) {
        elemento.setAttribute('aria-hidden', 'true');
        if (!estavaVisivel) elemento.style.opacity = '0';
        quadro = requestAnimationFrame(() => { if (!cancelado) elemento.style.opacity = '0.84'; });
      }
      setFase(dadosRef.current.length ? 'ativo' : 'vazio');
    }
    mostrar().catch(() => {
      if (!cancelado) { camadaRef.current?.remove(); setFase('erro'); }
    });
    return () => { cancelado = true; removerEscutaZoom?.(); if (quadro !== undefined) cancelAnimationFrame(quadro); };
  }, [ativo, mapa, tentativa]);

  const estado = useMemo<EstadoCalor>(() => ({ fase, quantidade: dados.length }), [fase, dados.length]);
  return { estado, tentarNovamente: () => setTentativa(n => n + 1) };
}
