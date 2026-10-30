'use client';

import { useEffect, useState } from 'react';
import { MapPin, Users } from 'lucide-react';
import PainelDialogo from './painel-dialogo';
import ComposicaoFamilia from './composicao-familia';
import type { PessoaDemonstrativa } from '@/lib/integrantes';
import { carregarDetalhe, TIPOS_OCORRENCIA, type CadastroFamilia, type DadosFamilia } from '@/lib/familias';
import { ESTILOS_RISCO, nomeDaFamilia } from '@/lib/pontos';

export default function DetalhesFamilia({ familia, endpoint, demonstracao, aoFechar, aoLocalizar }: {
  familia: CadastroFamilia | null; endpoint?: string; demonstracao: boolean; aoFechar: () => void; aoLocalizar: (familia: CadastroFamilia) => void;
}) {
  const [dados, setDados] = useState<DadosFamilia | null>(familia?.dados || null);
  const [carregando, setCarregando] = useState(!!familia && !familia.dados && !!endpoint); const [erro, setErro] = useState('');
  const [tentativa, setTentativa] = useState(0);
  useEffect(() => {
    setDados(familia?.dados || null); setErro(''); setCarregando(false);
    if (!familia || familia.dados || !endpoint) return;
    const abortar = new AbortController(); let cancelado = false;
    const timeout = setTimeout(() => abortar.abort(), 20000); setCarregando(true);
    carregarDetalhe(endpoint, familia.id, abortar.signal).then(d => { if (!cancelado) setDados(d); }).catch(() => { if (!cancelado) setErro('Não foi possível consultar os detalhes. Confira a conexão e tente novamente.'); }).finally(() => { clearTimeout(timeout); if (!cancelado) setCarregando(false); });
    return () => { cancelado = true; clearTimeout(timeout); abortar.abort(); };
  }, [familia, endpoint, tentativa]);
  const pessoas: PessoaDemonstrativa[] = dados ? [{ id: 'representante', nomeCompleto: dados.nomeRepresentante, parentesco: 'representante',
    dataNascimento: dados.nascimentoRepresentante || '', cpf: dados.cpf, apoio: dados.apoioRepresentante || '' }, ...(dados.familiares || [])] : familia?.resumoDemonstrativo?.integrantes || [];
  const estilo = familia ? ESTILOS_RISCO[familia.nivelRisco] : null;
  return <PainelDialogo id="detalhes" aberto={!!familia} aoFechar={aoFechar} titulo="Cadastro da família" subtitulo={demonstracao ? 'Registro fictício · Ambiente de demonstração' : 'Informações do cadastro selecionado'}
    rodape={familia && <button className="botao-primario" type="button" onClick={() => aoLocalizar(familia)}><MapPin size={16}/>Localizar no mapa</button>}>
    {familia && <><div className="resumo-familia"><span className="avatar-familia"><Users size={26}/></span><div><span className="sobretitulo">REPRESENTANTE FAMILIAR</span><h3>{nomeDaFamilia(familia)}</h3><span className="badge-risco" style={{ color: estilo!.cor }}><span className="amostra" style={{ backgroundColor: estilo!.cor }}>{estilo!.letra}</span>{familia.resumoDemonstrativo ? 'Risco simulado' : 'Risco informado'}: {estilo!.rotulo.toLowerCase()}</span></div></div>
      {carregando && <p className="estado-consulta" role="status"><span className="spinner"/>Consultando os dados da família…</p>}
      {erro && <div className="aviso-dados erro-dados" role="alert">{erro}<button type="button" onClick={() => setTentativa(n => n + 1)}>Tentar novamente</button></div>}
      {pessoas.length > 0 && <ComposicaoFamilia pessoas={pessoas} total={dados?.moradores || familia.resumoDemonstrativo?.moradores || pessoas.length} demonstracao={!!familia.resumoDemonstrativo}/>}
      {dados && <><section className="secao-detalhe"><h4>Contato e residência</h4><dl><div><dt>Telefone</dt><dd>{dados.telefone || 'Não informado'}</dd></div><div><dt>Pessoas na residência</dt><dd>{dados.moradores}</dd></div></dl></section>
      <section className="secao-detalhe"><h4>Endereço</h4><p>{dados.logradouro}, {dados.numero}<br/>{dados.bairro} · Goiana–PE{dados.complemento && <><br/>{dados.complemento}</>}</p></section>
      <section className="secao-detalhe"><h4>Avaliação registrada</h4><dl><div><dt>Ocorrência</dt><dd>{TIPOS_OCORRENCIA[dados.tipoOcorrencia]}</dd></div><div><dt>Observações</dt><dd className="texto-observacoes">{dados.observacoes || 'Não informadas'}</dd></div></dl></section></>}
      {!dados && familia.resumoDemonstrativo && <><section className="secao-detalhe"><h4>Família fictícia de demonstração</h4><dl><div><dt>Pessoas na residência simulada</dt><dd>{familia.resumoDemonstrativo.moradores}</dd></div><div><dt>Referência aproximada de localização</dt><dd>{familia.resumoDemonstrativo.referenciaLocal}</dd></div><div><dt>Núcleo urbano de referência</dt><dd>{familia.resumoDemonstrativo.nucleo}</dd></div></dl></section><section className="secao-detalhe"><h4>Área de referência do SGB</h4><dl><div><dt>Processo mapeado</dt><dd>{familia.resumoDemonstrativo.areaSgb.camada === 'inundacao' ? 'Inundação' : 'Movimento de massa'}</dd></div><div><dt>Suscetibilidade territorial</dt><dd>{familia.resumoDemonstrativo.areaSgb.classe} · Carta SGB 2025</dd></div></dl><p className="nota-detalhe">O ponto foi simulado em uma área urbana suscetível. O nome, o número de moradores e o risco da família são fictícios. A localização não identifica uma residência ou família verificada.</p></section></>}
      {!dados && !familia.resumoDemonstrativo && !carregando && !erro && <p className="aviso-detalhe">Este ponto contém o representante, a classificação e a localização. Os demais dados da família não foram fornecidos pela origem do cadastro.</p>}
      <section className="secao-detalhe"><h4>Localização da residência</h4><dl><div><dt>Latitude / longitude</dt><dd className="coordenadas-detalhe">{familia.latitude.toFixed(6)}, {familia.longitude.toFixed(6)}</dd></div>{dados && <div><dt>Localização obtida por</dt><dd>{dados.localizacao.origem === 'gps' ? 'GPS do dispositivo' : dados.localizacao.origem === 'mapa' ? 'Marcação no mapa' : 'Coordenadas confirmadas'}</dd></div>}</dl></section>
      <p className="nota-detalhe">{familia.resumoDemonstrativo ? 'A classificação desta família é fictícia e não é uma avaliação oficial da residência.' : 'A classificação é informada pela equipe.'} O mapa de calor indica concentração de cadastros.</p>
    </>}
  </PainelDialogo>;
}
