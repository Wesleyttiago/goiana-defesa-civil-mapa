'use client';

import { useEffect, useState } from 'react';
import { carregarEstacoes, type EstacaoAmbiental, type TipoEstacao } from '@/lib/ambiente';

export function useDadosAmbientais(tipo: TipoEstacao, ativo: boolean, revisao: number) {
  const [estacoes, setEstacoes] = useState<EstacaoAmbiental[]>([]);
  const [carregando, setCarregando] = useState(false); const [erro, setErro] = useState('');
  useEffect(() => {
    if (!ativo) { setCarregando(false); setErro(''); return; }
    const controle = new AbortController(); let cancelado = false;
    const timeout = setTimeout(() => controle.abort(), 15000);
    setCarregando(true); setErro('');
    carregarEstacoes(tipo, controle.signal).then(dados => { if (!cancelado) setEstacoes(dados); }).catch(() => {
      if (!cancelado) { setEstacoes([]); setErro('Não foi possível consultar a APAC. A camada não será exibida até uma nova consulta.'); }
    }).finally(() => { clearTimeout(timeout); if (!cancelado) setCarregando(false); });
    return () => { cancelado = true; clearTimeout(timeout); controle.abort(); };
  }, [ativo, tipo, revisao]);
  return { estacoes, carregando, erro };
}
