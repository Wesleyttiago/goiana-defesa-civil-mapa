'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type * as Leaflet from 'leaflet';
import { prepararPontosCalor, type PontoCalor } from '@/lib/calor';
import type { CamadaCalor } from '@/lib/camada-calor';
import type { PontoRisco } from '@/lib/pontos';

export interface EstadoCalor {
  fase: 'desligado' | 'carregando' | 'ativo' | 'vazio' | 'erro';
  quantidade: number;
}

interface Props { mapa: Leaflet.Map | null; pontos: readonly PontoRisco[]; ativo: boolean }

/** Densidade em um canvas reutilizado, sem um nó DOM por família. */
export function useCamadaCalor({ mapa, pontos, ativo }: Props) {
  // Alternar a camada e mover o mapa não refazem a conversão das coordenadas.
  const dados = useMemo(() => prepararPontosCalor(pontos), [pontos]);
  const dadosRef = useRef(dados);
  const camadaRef = useRef<CamadaCalor | null>(null);
  const aplicadosRef = useRef<PontoCalor[] | null>(null);
  const [fase, setFase] = useState<EstadoCalor['fase']>('desligado');
  const erroRef = useRef(() => {});
  erroRef.current = () => setFase('erro');
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
    let segundoQuadro: number | undefined;
    let remocao: ReturnType<typeof setTimeout> | undefined;
    const canvas = () => camadaRef.current?.getElement();
    if (!ativo || !mapa) {
      setFase('desligado');
      const camada = camadaRef.current;
      const elemento = canvas();
      if (elemento) elemento.style.opacity = '0';
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !elemento) camada?.remove();
      else remocao = setTimeout(() => camada?.remove(), 220);
      return () => { if (remocao) clearTimeout(remocao); };
    }
    const mapaAtual = mapa;
    setFase('carregando');
    async function mostrar() {
      const L = (await import('leaflet')).default;
      const { criarCamadaCalor } = await import('@/lib/camada-calor');
      if (cancelado) return;
      // A mesma camada e o mesmo canvas são reaproveitados nas alternâncias.
      if (!camadaRef.current) {
        camadaRef.current = criarCamadaCalor(L, dadosRef.current, () => erroRef.current());
        aplicadosRef.current = dadosRef.current;
      }
      const camada = camadaRef.current;
      // Reanexa a mesma instância antes de redesenhar os dados atualizados.
      const estavaVisivel = mapaAtual.hasLayer(camada);
      if (!estavaVisivel) camada.addTo(mapaAtual);
      if (aplicadosRef.current !== dadosRef.current) {
        camada.setLatLngs(dadosRef.current);
        aplicadosRef.current = dadosRef.current;
      }
      // A descrição textual fica na legenda; os marcadores continuam acessíveis.
      const elemento = canvas();
      if (elemento) {
        elemento.setAttribute('aria-hidden', 'true');
        if (!estavaVisivel) elemento.style.opacity = '0';
        quadro = requestAnimationFrame(() => { segundoQuadro = requestAnimationFrame(() => { if (!cancelado) elemento.style.opacity = '1'; }); });
      }
      setFase(dadosRef.current.length ? 'ativo' : 'vazio');
    }
    mostrar().catch(() => {
      if (!cancelado) { camadaRef.current?.remove(); setFase('erro'); }
    });
    return () => { cancelado = true; if (quadro !== undefined) cancelAnimationFrame(quadro); if (segundoQuadro !== undefined) cancelAnimationFrame(segundoQuadro); };
  }, [ativo, mapa, tentativa]);

  const estado = useMemo<EstadoCalor>(() => ({ fase, quantidade: dados.length }), [fase, dados.length]);
  return { estado, tentarNovamente: () => setTentativa(n => n + 1) };
}
