'use client';

import { memo, useCallback, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { Expand, LocateFixed, MapPin, RefreshCw } from 'lucide-react';
import { contarNiveis, ESTILOS_RISCO, type NivelRisco, type PontoRisco } from '@/lib/pontos';
import type { EstadoPlotagem } from './mapa-base';

const MapaBase = dynamic(() => import('./mapa-base'), { ssr: false,
  loading: () => <div className="carregando-mapa" role="status"><span className="spinner"/>Carregando o mapa de Goiana…</div> });

export interface MapaRiscosProps {
  pontos: readonly PontoRisco[];
  carregando?: boolean;
  erro?: string;
  descartados?: number;
  aoRecarregar?: () => void;
}

/** RF03: mapa base, pontos categorizados, legenda e clusterização. Sem dados do cidadão. */
function MapaRiscos({ pontos, carregando = false, erro, descartados = 0, aoRecarregar }: MapaRiscosProps) {
  const totais = useMemo(() => contarNiveis(pontos), [pontos]);
  const [centralizarId, setCentralizarId] = useState(0);
  const [enquadrarId, setEnquadrarId] = useState(0);
  const [plotagem, setPlotagem] = useState<EstadoPlotagem>({ fase: 'carregando', processados: 0, total: 0, duracaoMs: 0 });
  const atualizarPlotagem = useCallback((estado: EstadoPlotagem) => setPlotagem(estado), []);
  const ocupado = carregando || plotagem.fase === 'carregando';
  const niveis: NivelRisco[] = ['baixo', 'medio', 'alto'];
  if (totais.nao_informado) niveis.push('nao_informado');

  return <section className="painel-mapa" aria-label="Mapa e legenda de riscos">
    <div className="barra-mapa"><div className="municipio"><MapPin size={17}/><strong>Goiana</strong><span>Pernambuco</span></div><div className="acoes-mapa">
      <button type="button" disabled={plotagem.fase !== 'pronto'} onClick={() => setCentralizarId(n => n + 1)}><LocateFixed size={16}/><span>Ir para Goiana</span></button>
      <button type="button" disabled={ocupado || !pontos.length} onClick={() => setEnquadrarId(n => n + 1)}><Expand size={16}/><span>Ajustar aos pontos</span></button>
    </div></div>
    <div className="area-mapa"><MapaBase pontos={pontos} centralizarId={centralizarId} enquadrarId={enquadrarId} aoAtualizar={atualizarPlotagem}/>
      {!carregando && !erro && plotagem.fase === 'pronto' && !pontos.length && <div className="aviso-vazio" role="status">Nenhum ponto disponível para exibir. O mapa continua pronto para receber dados.</div>}
      <div className="legenda"><div className="legenda-titulo">Leitura do mapa</div><p>Nível de risco dos cadastros</p><ul aria-label="Legenda dos marcadores">{niveis.map(nivel => {
      const estilo = ESTILOS_RISCO[nivel];
      return <li key={nivel}><span className="amostra" style={{ backgroundColor: estilo.cor }} aria-hidden="true">{estilo.letra}</span><span>{estilo.rotulo}</span><span className="quantidade">{totais[nivel]}</span></li>;
      })}</ul><span className="orientacao">Pontos = cadastros localizados.<br/>Aproxime os grupos para ver os pontos.</span></div>
    </div>
    {erro && <div className="aviso-dados erro-dados" role="alert"><span>{erro}</span>{aoRecarregar && <button type="button" onClick={aoRecarregar}>Tentar novamente</button>}</div>}
    {descartados > 0 && <p className="aviso-dados" role="status">{descartados} {descartados === 1 ? 'registro sem coordenadas válidas não foi exibido' : 'registros sem coordenadas válidas não foram exibidos'}.</p>}
    <footer className="estado-mapa"><output aria-live="polite" data-pontos-plotados={plotagem.processados} data-plotagem-ms={plotagem.duracaoMs}>
      {ocupado ? <><span className="spinner pequeno"/>{carregando ? 'Carregando pontos…' : 'Representando os pontos no mapa…'}</> : erro ? 'Pontos indisponíveis' : plotagem.fase === 'erro' ? 'Mapa indisponível' : <><span className="sinal-pronto"/>{pontos.length.toLocaleString('pt-BR')} {pontos.length === 1 ? 'ponto representado' : 'pontos representados'}</>}
    </output>{aoRecarregar && <button type="button" disabled={ocupado} onClick={aoRecarregar}><RefreshCw size={14}/>{carregando ? 'Carregando…' : 'Recarregar pontos'}</button>}</footer>
  </section>;
}

export default memo(MapaRiscos);
