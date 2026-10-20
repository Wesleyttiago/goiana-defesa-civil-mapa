'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type * as Leaflet from 'leaflet';
import { GRADIENTE_CALOR, prepararPontosCalor, type PontoCalor } from '@/lib/calor';
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
    if (camada && mapa?.hasLayer(camada)) {
      camada.setLatLngs(dados);
      aplicadosRef.current = dados;
      setFase(dados.length ? 'ativo' : 'vazio');
    }
  }, [dados, mapa]);

  useEffect(() => {
    let cancelado = false;
    if (!ativo || !mapa) {
      camadaRef.current?.remove();
      setFase('desligado');
      return;
    }
    const mapaAtual = mapa;
    setFase('carregando');
    async function mostrar() {
      const L = (await import('leaflet')).default;
      await import('leaflet.heat');
      if (cancelado) return;
      // A mesma camada e o mesmo canvas são reaproveitados nas alternâncias.
      if (!camadaRef.current) {
        camadaRef.current = L.heatLayer(dadosRef.current, {
          radius: 30, blur: 24, minOpacity: 0.26, maxZoom: 14, max: 3,
          gradient: GRADIENTE_CALOR,
        });
        aplicadosRef.current = dadosRef.current;
      }
      const camada = camadaRef.current;
      // Reanexa antes de atualizar: o plugin precisa de um mapa para redesenhar.
      if (!mapaAtual.hasLayer(camada)) camada.addTo(mapaAtual);
      if (aplicadosRef.current !== dadosRef.current) {
        camada.setLatLngs(dadosRef.current);
        aplicadosRef.current = dadosRef.current;
      }
      // A descrição textual fica na legenda; os marcadores continuam acessíveis.
      mapaAtual.getPanes().overlayPane.querySelector('.leaflet-heatmap-layer')?.setAttribute('aria-hidden', 'true');
      setFase(dadosRef.current.length ? 'ativo' : 'vazio');
    }
    mostrar().catch(() => {
      if (!cancelado) { camadaRef.current?.remove(); setFase('erro'); }
    });
    return () => { cancelado = true; camadaRef.current?.remove(); };
  }, [ativo, mapa, tentativa]);

  const estado = useMemo<EstadoCalor>(() => ({ fase, quantidade: dados.length }), [fase, dados.length]);
  return { estado, tentarNovamente: () => setTentativa(n => n + 1) };
}
