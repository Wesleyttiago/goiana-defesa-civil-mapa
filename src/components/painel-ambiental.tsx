'use client';

import Recolhivel from './recolhivel';
import { CloudRain, ExternalLink, Layers, RefreshCw, Waves } from 'lucide-react';
import { FONTES_AMBIENTAIS, formatarMedicao, leituraAntiga, type EstacaoAmbiental } from '@/lib/ambiente';
import type { AreaPlanejada, CamadaTerritorial } from './camadas-ambientais-mapa';

interface Leitura { estacoes: EstacaoAmbiental[]; carregando: boolean; erro: string }
export default function PainelAmbiental({ chuvaAtiva, rioAtivo, aoChuva, aoRio, chuva, rio, aoAtualizar,
  camada, aoCamada, apenasAlta, aoApenasAlta, area, aoLimparArea, aoCadastrar, areas, aoSelecionarArea }: {
  chuvaAtiva: boolean; rioAtivo: boolean; aoChuva: (ativa: boolean) => void; aoRio: (ativo: boolean) => void;
  chuva: Leitura; rio: Leitura; aoAtualizar: () => void;
  camada: CamadaTerritorial; aoCamada: (camada: CamadaTerritorial) => void;
  apenasAlta: boolean; aoApenasAlta: (ativo: boolean) => void; area: AreaPlanejada | null; aoLimparArea: () => void; aoCadastrar: () => void;
  areas: AreaPlanejada[]; aoSelecionarArea: (area: AreaPlanejada | null) => void;
}) {
  const ativo = chuvaAtiva || rioAtivo || camada !== 'nenhuma';
  return <section className="painel-ambiental" aria-label="Contexto ambiental e planejamento"><Recolhivel cabecalho={<><span className="icone-contexto"><Layers size={19}/></span><span><strong>Camadas ambientais</strong><small>Chuva, rios e referência geológica para apoiar as visitas.</small></span><span className="estado-contexto">{ativo ? 'Camadas ativadas' : 'Explorar camadas'}</span></>}>
    <div className="conteudo-ambiental"><p className="nota-ambiente">Leituras públicas da APAC e cartografia do SGB. Essas camadas são independentes dos cadastros fictícios da demonstração.</p>
      <div className="grade-ambiental">{(['chuva', 'rio'] as const).map(tipo => {
        const dados = tipo === 'chuva' ? chuva : rio; const ligado = tipo === 'chuva' ? chuvaAtiva : rioAtivo;
        return <section className="cartao-fonte" key={tipo}><header>{tipo === 'chuva' ? <CloudRain size={19}/> : <Waves size={19}/>}<div><h3>{tipo === 'chuva' ? 'Chuva nas últimas 24h' : 'Nível dos rios'}</h3><p>{tipo === 'chuva' ? 'Estações em Goiana' : 'Estações da bacia do Goiana'}</p></div><input type="checkbox" role="switch" aria-label={tipo === 'chuva' ? 'Mostrar chuva no mapa' : 'Mostrar rios no mapa'} checked={ligado} onChange={e => tipo === 'chuva' ? aoChuva(e.target.checked) : aoRio(e.target.checked)}/></header>
          {!ligado && <p className="camada-desligada">Ative para consultar e mostrar as estações no mapa.</p>}
          {ligado && dados.carregando && <p role="status" className="consulta-ambiental"><span className="spinner pequeno"/>Consultando a APAC…</p>}
          {ligado && dados.erro && <p role="alert" className="erro-campo">{dados.erro}</p>}
          {ligado && !dados.carregando && !dados.erro && !dados.estacoes.length && <p className="camada-desligada">A fonte não retornou estações para esse recorte.</p>}
          {ligado && <ul className="leituras-estacoes">{dados.estacoes.map(estacao => <li key={estacao.id}><div><strong>{estacao.nome}</strong><span>{formatarMedicao(estacao)}</span></div><small>Leitura: {estacao.leitura}</small>{leituraAntiga(estacao) && <span className="medicao-antiga">Leitura antiga ou horário não validado · confira a fonte</span>}</li>)}</ul>}
          <a href={FONTES_AMBIENTAIS[tipo]} target="_blank" rel="noopener noreferrer">Fonte APAC / SIRH <ExternalLink size={12}/></a>
        </section>;
      })}</div>
      <div className="cartao-geologia"><div><h3>Território e suscetibilidade</h3><p>Contorno azul: limite municipal · IBGE 2025</p></div><label className="campo"><span className="somente-leitor">Camada territorial</span><select aria-label="Camada territorial" value={camada} onChange={e => aoCamada(e.target.value as CamadaTerritorial)}><option value="nenhuma">Sem camada territorial</option><option value="inundacao">Suscetibilidade à inundação</option><option value="movimento">Suscetibilidade a movimento de massa</option><option value="geologia">Geologia do território</option><option value="historico">Setores históricos de risco · SGB 2014</option></select></label>
        {(camada === 'inundacao' || camada === 'movimento') && <><label className="filtro-alta"><input type="checkbox" checked={apenasAlta} onChange={e => aoApenasAlta(e.target.checked)}/>Mostrar somente alta suscetibilidade</label><div className="legenda-territorio"><span><i style={{ background: '#718d5c' }}/>Baixa</span><span><i style={{ background: '#b98b1e' }}/>Média</span><span><i style={{ background: '#c04b28' }}/>Alta</span></div><p className="orientacao-territorio">Clique em uma área colorida para consultar a classe e selecioná-la para planejamento de visitas.</p></>}
        {areas.length > 0 && <label className="campo">Selecionar uma área para visitas<select value={area?.id || ''} onChange={e => aoSelecionarArea(areas.find(a => a.id === e.target.value) || null)}><option value="">Escolha uma área do SGB</option>{areas.map(a => <option key={a.id} value={a.id}>Classe {a.descricao.toLocaleLowerCase('pt-BR')} · Área {a.id.split('-').pop()}</option>)}</select></label>}
        {camada === 'historico' && <p className="limite-cartografia">Os três setores em roxo foram delimitados em 2014: Baldo do Rio / Vila Operária, Barreira da Cocota e Bueiro das Malvinas. São referências históricas, sem atualização automática ou previsão de desastre. <a href="https://rigeo.sgb.gov.br/handle/doc/19968" target="_blank" rel="noopener noreferrer">Consultar estudo SGB 2014 <ExternalLink size={12}/></a></p>}
        <p className="limite-cartografia">Escala da carta: 1:45.000. Geologia: base 1:100.000. As manchas são referências territoriais; a avaliação de cada residência e a prioridade das equipes dependem da Defesa Civil.</p>
        <a href={FONTES_AMBIENTAIS.solo} target="_blank" rel="noopener noreferrer">Consultar publicação e arquivos originais do SGB <ExternalLink size={12}/></a>
      </div>
      <div className="referencias-risco"><h3>Histórico que orienta a demonstração</h3><p>O Plano de Contingência municipal registra enchentes no Canal do Rio Goiana em 2011, 2018 e 2022, e deslizamento em Cocota em 2022. Os 500 cadastros fictícios estão concentrados em áreas urbanas suscetíveis da sede, sem representar famílias atingidas de verdade.</p><a href="https://goiana.pe.gov.br/wp-content/uploads/2023/08/Plano-de-Conting%C3%AAncia.pdf" target="_blank" rel="noopener noreferrer">Plano de Contingência · seção 11 <ExternalLink size={12}/></a><a href="https://www.goiana.pe.gov.br/portal/noticias/0/3/4800/prefeitura-de-goiana-habilita-moradores-atingidos-pelas-chuvas-para-saque-do-fgts-calamidade" target="_blank" rel="noopener noreferrer">Localidades atingidas · Prefeitura, 2026 <ExternalLink size={12}/></a></div>
      <footer className="rodape-ambiental"><span>Horários de leitura informados pela origem. Medições de estação não são previsões de inundação.</span><button type="button" disabled={(!chuvaAtiva && !rioAtivo) || chuva.carregando || rio.carregando} onClick={aoAtualizar}><RefreshCw size={14}/>Atualizar leituras</button></footer>
    </div>
  </Recolhivel>{area && <div className="area-planejada"><div><strong>Área selecionada para visitas</strong><p>{area.camada === 'inundacao' ? 'Inundação' : 'Movimento de massa'} · Suscetibilidade {area.descricao.toLocaleLowerCase('pt-BR')} · SGB 2025</p><small>Seleção do gestor nesta sessão. A localização de cada residência será confirmada no cadastro.</small></div><div><button type="button" onClick={aoLimparArea}>Limpar área</button><button className="botao-primario" type="button" onClick={aoCadastrar}>Cadastrar família</button></div></div>}</section>;
}
