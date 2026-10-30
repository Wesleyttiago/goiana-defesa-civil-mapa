'use client';

import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { Expand, Layers, LocateFixed, MapPin, RefreshCw, Users } from 'lucide-react';
import { contarNiveis, ESTILOS_RISCO, type NivelRisco, type PontoRisco } from '@/lib/pontos';
import { ESCALA_CALOR } from '@/lib/calor';
import type { EstadoPlotagem } from './mapa-base';
import type { EstadoCalor } from './use-camada-calor';
import type { ConfiguracaoAmbiente } from './camadas-ambientais-mapa';

const MapaBase = dynamic(() => import('./mapa-base'), { ssr: false,
  loading: () => <div className="carregando-mapa" role="status"><span className="spinner"/>Carregando o mapa de Goiana…</div> });

export interface MapaRiscosProps {
  pontos: readonly PontoRisco[];
  carregando?: boolean;
  erro?: string;
  descartados?: number;
  aoRecarregar?: () => void;
  aoSelecionarFamilia: (ponto: PontoRisco) => void;
  foco: { ponto: PontoRisco; revisao: number } | null;
  ambiente: ConfiguracaoAmbiente;
  filtroAtivo?: boolean;
}

/** RF03/RF04: mapa, pontos categorizados, agrupamentos e camada de densidade. */
function MapaRiscos({ pontos, carregando = false, erro, descartados = 0, aoRecarregar, aoSelecionarFamilia, foco, ambiente, filtroAtivo = false }: MapaRiscosProps) {
  useEffect(() => {
    if (!filtroAtivo || !pontos.length) return;
    const espera = setTimeout(() => setEnquadrarId(n => n + 1), 350);
    return () => clearTimeout(espera);
  }, [pontos, filtroAtivo]);
  const totais = useMemo(() => contarNiveis(pontos), [pontos]);
  const [centralizarId, setCentralizarId] = useState(0);
  const [enquadrarId, setEnquadrarId] = useState(0);
  const [calorAtivo, setCalorAtivo] = useState(false);
  const [estadoCalor, setEstadoCalor] = useState<EstadoCalor>({ fase: 'desligado', quantidade: 0 });
  const [plotagem, setPlotagem] = useState<EstadoPlotagem>({ fase: 'carregando', processados: 0, total: 0, duracaoMs: 0 });
  const atualizarPlotagem = useCallback((estado: EstadoPlotagem) => setPlotagem(estado), []);
  const atualizarCalor = useCallback((estado: EstadoCalor) => setEstadoCalor(estado), []);
  const ocupado = carregando || plotagem.fase === 'carregando';
  const niveis: NivelRisco[] = ['baixo', 'medio', 'alto'];
  if (totais.nao_informado) niveis.push('nao_informado');

  return <section className="painel-mapa" aria-label="Mapa de famílias e legenda de vulnerabilidade">
    <div className="barra-mapa"><div className="municipio"><MapPin size={17}/><strong>Goiana</strong><span>Pernambuco</span></div><div className="acoes-mapa">
      <button type="button" disabled={plotagem.fase !== 'pronto'} onClick={() => setCentralizarId(n => n + 1)}><LocateFixed size={16}/><span>Ir para Goiana</span></button>
      <button type="button" disabled={ocupado || !pontos.length} onClick={() => setEnquadrarId(n => n + 1)}><Expand size={16}/><span>Ajustar às famílias</span></button>
    </div></div>
    <div className="area-mapa"><MapaBase pontos={pontos} centralizarId={centralizarId} enquadrarId={enquadrarId} aoAtualizar={atualizarPlotagem} calorAtivo={calorAtivo} aoAtualizarCalor={atualizarCalor} aoSelecionarFamilia={aoSelecionarFamilia} foco={foco} ambiente={ambiente}/>
      {!carregando && !erro && plotagem.fase === 'pronto' && !pontos.length && <div className="aviso-vazio" role="status">Nenhum ponto disponível para exibir. O mapa continua pronto para receber dados.</div>}
      <div className="legenda">
        <div className="controle-calor"><Layers size={17}/><span>Mapa de calor</span><button type="button" role="switch" aria-label="Mapa de calor" aria-checked={calorAtivo} aria-describedby="estado-calor" disabled={!calorAtivo && (ocupado || !pontos.length || !!erro || plotagem.fase === 'erro')} onClick={() => setCalorAtivo(ativo => !ativo)}><span className="trilho-calor" aria-hidden="true"><span/></span></button></div>
        <output id="estado-calor" className="estado-calor" aria-live="polite">{!calorAtivo ? 'Desligado' : estadoCalor.fase === 'carregando' || estadoCalor.fase === 'desligado' ? <><span className="spinner pequeno"/>Preparando camada…</> : estadoCalor.fase === 'erro' ? 'Camada indisponível' : estadoCalor.fase === 'vazio' ? 'Nenhum ponto para gerar calor.' : `Ativado · ${estadoCalor.quantidade.toLocaleString('pt-BR')} ${estadoCalor.quantidade === 1 ? 'cadastro' : 'cadastros'}`}</output>
        <div className="expansao-calor" data-aberto={calorAtivo && estadoCalor.fase !== 'erro'} aria-hidden={!calorAtivo || estadoCalor.fase === 'erro'}><div><div className="legenda-calor"><strong>Concentração de famílias</strong><span className="escala-calor" style={{ backgroundImage: ESCALA_CALOR }} aria-hidden="true"/><div className="extremos-calor"><span>Menor</span><span>Maior</span></div><p>Mais cadastros próximos geram tons mais quentes. A suavização acompanha uma vizinhança de 250 m.</p></div></div></div>
        <div className="legenda-titulo">Famílias no mapa</div><p>Nível de risco informado no cadastro</p><ul aria-label="Legenda dos marcadores">{niveis.map(nivel => {
      const estilo = ESTILOS_RISCO[nivel];
      return <li key={nivel}><span className="amostra" style={{ backgroundColor: estilo.cor }} aria-hidden="true">{estilo.letra}</span><span>{estilo.rotulo}</span><span className="quantidade">{totais[nivel]}</span></li>;
      })}</ul><div className="orientacao leitura-marcadores">
        <div><span className="exemplo-grupo" aria-hidden="true"><Users size={13}/><b>3</b></span><span><strong>Grupo de famílias</strong>O número é a quantidade de cadastros. Clique para aproximar.</span></div>
        <div><span className="exemplo-pino" aria-hidden="true"><MapPin size={23}/></span><span><strong>Uma família</strong>Clique no pino para ver o representante e abrir o cadastro.</span></div>
      </div><small className="ajuda-mapa">Zoom: roda do mouse sobre o mapa, botões + e −, teclado ou gesto de pinça. Para rolar a página, use a área fora do mapa.</small></div>
    </div>
    {erro && <div className="aviso-dados erro-dados" role="alert"><span>{erro}{pontos.length > 0 && ' Os últimos dados carregados continuam visíveis.'}</span>{aoRecarregar && <button type="button" onClick={aoRecarregar}>Tentar novamente</button>}</div>}
    {descartados > 0 && <p className="aviso-dados" role="status">{descartados} {descartados === 1 ? 'registro inválido, duplicado ou fora do recorte não foi exibido' : 'registros inválidos, duplicados ou fora do recorte não foram exibidos'}.</p>}
    <footer className="estado-mapa"><output aria-live="polite" data-pontos-plotados={plotagem.processados} data-plotagem-ms={plotagem.duracaoMs}>
      {ocupado ? <><span className="spinner pequeno"/>{carregando ? (pontos.length ? 'Atualizando cadastros…' : 'Carregando cadastros…') : 'Localizando as famílias no mapa…'}</> : erro ? (pontos.length ? 'Falha ao atualizar os cadastros' : 'Cadastros indisponíveis') : plotagem.fase === 'erro' ? 'Mapa indisponível' : <><span className="sinal-pronto"/>{pontos.length.toLocaleString('pt-BR')} {pontos.length === 1 ? 'família no mapa' : 'famílias no mapa'}</>}
    </output>{aoRecarregar && <button type="button" disabled={ocupado} onClick={aoRecarregar}><RefreshCw size={14}/>{carregando ? 'Carregando…' : 'Recarregar cadastros'}</button>}</footer>
  </section>;
}

export default memo(MapaRiscos);
