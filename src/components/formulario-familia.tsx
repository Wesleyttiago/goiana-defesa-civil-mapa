'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import dynamic from 'next/dynamic';
import { Check, FlaskConical, LocateFixed, MapPin, Save } from 'lucide-react';
import PainelDialogo from './painel-dialogo';
import CamposFamiliares from './campos-familiares';
import { hojeCivil, type Familiar } from '@/lib/integrantes';
import { dentroDeGoiana } from '@/lib/territorio';
import { ESTILOS_RISCO, coordenadasValidas, type NivelRisco } from '@/lib/pontos';
import { FORMULARIO_VAZIO, TIPOS_OCORRENCIA, exemploCadastro, formatarCpf, gerarIdentificador, lerCoordenada, prepararCadastro, validarCadastro,
  type CamposCadastro, type DadosFamilia, type ErrosCadastro, type LocalizacaoFamilia, type TipoOcorrencia } from '@/lib/familias';

const SeletorLocalizacao = dynamic(() => import('./seletor-localizacao'), { ssr: false, loading: () => <p role="status">Preparando mapa de localização…</p> });

export default function FormularioFamilia({ aberto, demonstracao, aoFechar, aoSalvar }: {
  aberto: boolean; demonstracao: boolean; aoFechar: () => void;
  aoSalvar: (dados: DadosFamilia, chave: string) => Promise<void>;
}) {
  const [campos, setCampos] = useState<CamposCadastro>({ ...FORMULARIO_VAZIO });
  const [erros, setErros] = useState<ErrosCadastro>({});
  const [modo, setModo] = useState<'gps' | 'mapa' | 'coordenadas'>('gps');
  const [latitude, setLatitude] = useState(''); const [longitude, setLongitude] = useState('');
  const [gps, setGps] = useState(false); const [erroGps, setErroGps] = useState('');
  const [enviando, setEnviando] = useState(false); const [erroEnvio, setErroEnvio] = useState('');
  const [consentimentoDemo, setConsentimentoDemo] = useState(false);
  const enviandoRef = useRef(false);
  const gpsTentativa = useRef(0);
  const chave = useRef('');
  const formulario = useRef<HTMLFormElement>(null);
  useEffect(() => () => { gpsTentativa.current++; }, []);
  useEffect(() => { if (!aberto) { gpsTentativa.current++; setGps(false); } }, [aberto]);
  const alterar = <K extends keyof CamposCadastro>(campo: K, valor: CamposCadastro[K]) => {
    setCampos(anterior => ({ ...anterior, [campo]: valor })); setErros(anterior => ({ ...anterior, [campo]: undefined })); setErroEnvio(''); chave.current = '';
  };
  const selecionarLocal = useCallback((local: LocalizacaoFamilia) => {
    if (enviandoRef.current) return;
    setCampos(anterior => ({ ...anterior, localizacao: local })); setLatitude(String(local.latitude)); setLongitude(String(local.longitude));
    setErros(anterior => ({ ...anterior, localizacao: dentroDeGoiana(local.latitude, local.longitude) ? undefined : 'O ponto está fora de Goiana–PE. Confira a localização da residência.' })); setErroGps(''); chave.current = '';
  }, []);
  function atualizarFamiliares(pessoas: Familiar[]) {
    alterar('familiares', pessoas);
    if (pessoas.length + 1 > Number(campos.moradores)) alterar('moradores', String(pessoas.length + 1));
  }
  function capturarGps() {
    setModo('gps'); setErroGps('');
    if (!window.isSecureContext || !navigator.geolocation) { setErroGps('GPS indisponível neste navegador. Marque a residência no mapa ou informe as coordenadas.'); return; }
    const tentativa = ++gpsTentativa.current; setGps(true);
    navigator.geolocation.getCurrentPosition(posicao => {
      if (tentativa !== gpsTentativa.current) return;
      setGps(false);
      if (!coordenadasValidas(posicao.coords.latitude, posicao.coords.longitude)) { setErroGps('O aparelho retornou uma posição inválida. Tente novamente.'); return; }
      selecionarLocal({ latitude: posicao.coords.latitude, longitude: posicao.coords.longitude, origem: 'gps', precisaoMetros: posicao.coords.accuracy });
    }, erro => {
      if (tentativa !== gpsTentativa.current) return;
      setGps(false); setErroGps(erro.code === 1 ? 'Permissão de localização negada. Você pode marcar a residência no mapa.' : erro.code === 3 ? 'A localização demorou para responder. Tente novamente ou marque no mapa.' : 'Não foi possível obter o GPS. Tente ao ar livre ou marque a residência no mapa.');
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  }
  function trocarModo(proximo: typeof modo) { gpsTentativa.current++; setGps(false); setModo(proximo); setErroGps(''); }
  async function enviar(evento: FormEvent) {
    evento.preventDefault(); if (enviandoRef.current) return;
    const validacao = validarCadastro(campos); setErros(validacao); setErroEnvio('');
    if (Object.keys(validacao).length) {
      requestAnimationFrame(() => formulario.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()); return;
    }
    if (demonstracao && !consentimentoDemo) { setErroEnvio('Confirme que os dados são fictícios para testar o cadastro.'); return; }
    enviandoRef.current = true; setEnviando(true);
    try {
      if (!chave.current) chave.current = gerarIdentificador();
      await aoSalvar(prepararCadastro(campos), chave.current);
      setCampos({ ...FORMULARIO_VAZIO }); setLatitude(''); setLongitude(''); setConsentimentoDemo(false); chave.current = ''; setModo('gps'); aoFechar();
    } catch (erro) { setErroEnvio(erro instanceof Error ? erro.message : 'Não foi possível confirmar o cadastro. Confira a conexão e tente novamente.'); }
    finally { enviandoRef.current = false; setEnviando(false); }
  }
  const ajuda = (campo: keyof CamposCadastro) => erros[campo] ? <span id={`erro-${campo}`} className="erro-campo">{erros[campo]}</span> : null;
  const propsCampo = (campo: keyof CamposCadastro) => ({ 'aria-invalid': !!erros[campo], 'aria-describedby': erros[campo] ? `erro-${campo}` : undefined });
  return <PainelDialogo id="cadastro" aberto={aberto} aoFechar={aoFechar} titulo="Cadastrar família" subtitulo="Identifique a família, seus integrantes e a residência." ocupado={enviando}
    rodape={fechar => <><span className="nota-rodape">{demonstracao ? 'Teste nesta aba · Dados apagados ao atualizar a página' : 'Envio para a API da equipe'}</span><div><button type="button" onClick={fechar} disabled={enviando}>Voltar ao mapa</button><button className="botao-primario" type="submit" form="formulario-familia" disabled={enviando || gps}>{enviando ? <span className="spinner"/> : <Save size={16}/>} {enviando ? 'Enviando cadastro…' : demonstracao ? 'Adicionar à demonstração' : 'Salvar cadastro'}</button></div></>}>
    <form id="formulario-familia" ref={formulario} onSubmit={enviar} noValidate aria-busy={enviando}>
      {demonstracao && <div className="aviso-formulario"><FlaskConical size={19}/><div><strong>Você está em uma demonstração</strong><p>Use apenas informações fictícias. Este teste fica nesta aba, sem envio de dados pessoais a um servidor.</p><button type="button" disabled={enviando} onClick={() => { gpsTentativa.current++; setGps(false); const exemplo = exemploCadastro(); setCampos(exemplo); setLatitude(String(exemplo.localizacao!.latitude)); setLongitude(String(exemplo.localizacao!.longitude)); setModo('mapa'); setErros({}); setErroEnvio(''); setErroGps(''); setConsentimentoDemo(true); chave.current = ''; }}>Preencher com exemplo fictício</button></div></div>}
      <fieldset disabled={enviando}><legend><span>1</span>Representante da família</legend><p className="ajuda-secao">Os campos com * são obrigatórios.</p>
        <label className="campo">Nome do representante *<input name="nomeRepresentante" autoComplete="off" maxLength={120} value={campos.nomeRepresentante} onChange={e => alterar('nomeRepresentante', e.target.value)} {...propsCampo('nomeRepresentante')}/>{ajuda('nomeRepresentante')}</label>
        <div className="grade-campos"><label className="campo">CPF *<input name="cpf" inputMode="numeric" autoComplete="off" placeholder="000.000.000-00" maxLength={14} value={campos.cpf} onChange={e => alterar('cpf', formatarCpf(e.target.value))} {...propsCampo('cpf')}/>{ajuda('cpf')}</label>
        <label className="campo">Telefone com DDD <span className="opcional">(opcional)</span><input name="telefone" type="tel" inputMode="tel" autoComplete="off" maxLength={20} placeholder="(81) 90000-0000" value={campos.telefone} onChange={e => alterar('telefone', e.target.value)} {...propsCampo('telefone')}/>{ajuda('telefone')}</label></div>
        <label className="campo">Data de nascimento do representante <span className="opcional">(opcional)</span><input name="nascimentoRepresentante" type="date" max={hojeCivil()} value={campos.nascimentoRepresentante || ''} onChange={e => alterar('nascimentoRepresentante', e.target.value)} {...propsCampo('nascimentoRepresentante')}/>{ajuda('nascimentoRepresentante')}</label>
        <label className="campo">Apoio para atendimento / evacuação <span className="opcional">(opcional)</span><textarea name="apoioRepresentante" rows={2} maxLength={300} value={campos.apoioRepresentante || ''} onChange={e => alterar('apoioRepresentante', e.target.value)} placeholder="Ex.: precisa de acompanhamento para sair da residência." {...propsCampo('apoioRepresentante')}/>{ajuda('apoioRepresentante')}</label>
        <label className="campo campo-curto">Pessoas na residência *<input name="moradores" type="number" min="1" max="99" inputMode="numeric" value={campos.moradores} onChange={e => alterar('moradores', e.target.value)} {...propsCampo('moradores')}/>{ajuda('moradores')}</label>
      </fieldset>
      <fieldset disabled={enviando}><legend><span>2</span>Demais integrantes da família</legend>
        <CamposFamiliares familiares={campos.familiares || []} moradores={Number(campos.moradores)} aoAlterar={atualizarFamiliares} erro={erros.familiares}/>
      </fieldset>
      <fieldset disabled={enviando}><legend><span>3</span>Endereço e localização</legend>
        <div className="grade-campos endereco"><label className="campo">Rua ou acesso *<input name="logradouro" maxLength={160} value={campos.logradouro} onChange={e => alterar('logradouro', e.target.value)} {...propsCampo('logradouro')}/>{ajuda('logradouro')}</label>
        <label className="campo">Número *<input name="numero" maxLength={20} placeholder="ou S/N" value={campos.numero} onChange={e => alterar('numero', e.target.value)} {...propsCampo('numero')}/>{ajuda('numero')}</label></div>
        <label className="campo">Bairro ou comunidade *<input name="bairro" maxLength={100} value={campos.bairro} onChange={e => alterar('bairro', e.target.value)} {...propsCampo('bairro')}/>{ajuda('bairro')}</label>
        <label className="campo">Complemento <span className="opcional">(opcional)</span><input name="complemento" maxLength={160} value={campos.complemento} onChange={e => alterar('complemento', e.target.value)} {...propsCampo('complemento')}/>{ajuda('complemento')}</label>
        <p className="municipio-formulario"><MapPin size={14}/> Goiana · Pernambuco</p>
        <div className="localizacao-cadastro" id="localizacao-cadastro" tabIndex={-1} {...propsCampo('localizacao')}><strong>Onde fica a residência? *</strong><p>Use o GPS somente quando estiver na residência. O contorno tracejado mostra Goiana; cadastros fora do limite municipal são bloqueados.</p>
          <div className="modos-localizacao" role="group" aria-label="Como localizar a residência"><button type="button" aria-pressed={modo === 'gps'} onClick={capturarGps} disabled={gps}><LocateFixed size={15}/>{gps ? 'Buscando GPS…' : 'Usar GPS'}</button><button type="button" aria-pressed={modo === 'mapa'} onClick={() => trocarModo('mapa')}>Marcar no mapa</button><button type="button" aria-pressed={modo === 'coordenadas'} onClick={() => trocarModo('coordenadas')}>Coordenadas</button></div>
          {erroGps && <p role="alert" className="erro-campo">{erroGps}</p>}
          {modo === 'mapa' && aberto && <SeletorLocalizacao localizacao={campos.localizacao} aoSelecionar={selecionarLocal}/>}
          {modo === 'coordenadas' && <div className="coordenadas-manuais"><div className="grade-campos"><label className="campo">Latitude<input name="latitude" inputMode="decimal" placeholder="-7.5606" value={latitude} onChange={e => { setLatitude(e.target.value); alterar('localizacao', null); }}/></label><label className="campo">Longitude<input name="longitude" inputMode="decimal" placeholder="-35.0025" value={longitude} onChange={e => { setLongitude(e.target.value); alterar('localizacao', null); }}/></label></div><button type="button" onClick={() => { const lat = lerCoordenada(latitude); const lng = lerCoordenada(longitude); if (lat === null || lng === null || !coordenadasValidas(lat, lng)) { setErros(a => ({ ...a, localizacao: 'Confira a latitude (-90 a 90) e a longitude (-180 a 180).' })); return; } selecionarLocal({ latitude: lat, longitude: lng, origem: 'coordenadas' }); }}>Confirmar coordenadas</button></div>}
          {campos.localizacao && <output className={`localizacao-confirmada${dentroDeGoiana(campos.localizacao.latitude, campos.localizacao.longitude) ? '' : ' fora-municipio'}`} aria-live="polite"><Check size={16}/><span>{dentroDeGoiana(campos.localizacao.latitude, campos.localizacao.longitude) ? 'Residência marcada em Goiana–PE' : 'Ponto fora de Goiana–PE'} <strong>{campos.localizacao.latitude.toFixed(6)}, {campos.localizacao.longitude.toFixed(6)}</strong>{campos.localizacao.origem === 'gps' && <small>Precisão aproximada: {Math.round(campos.localizacao.precisaoMetros || 0)} m. Confira o ponto antes de enviar.</small>}</span></output>}{ajuda('localizacao')}
        </div>
      </fieldset>
      <fieldset disabled={enviando}><legend><span>4</span>Vulnerabilidade informada</legend><p className="ajuda-secao">Registre a avaliação da equipe. O sistema não calcula risco automaticamente.</p>
        <div className="opcoes-risco" role="group" aria-label="Nível de risco">{(['baixo', 'medio', 'alto', 'nao_informado'] as NivelRisco[]).map(nivel => <label key={nivel} className="opcao-risco" data-selecionado={campos.nivelRisco === nivel}><input type="radio" name="nivelRisco" value={nivel} checked={campos.nivelRisco === nivel} onChange={() => alterar('nivelRisco', nivel)}/><span className="amostra" style={{ background: ESTILOS_RISCO[nivel].cor }} aria-hidden="true">{ESTILOS_RISCO[nivel].letra}</span>{ESTILOS_RISCO[nivel].rotulo}</label>)}</div>
        {ajuda('nivelRisco')}<label className="campo">Tipo de ocorrência<select name="tipoOcorrencia" value={campos.tipoOcorrencia} onChange={e => alterar('tipoOcorrencia', e.target.value as TipoOcorrencia)} {...propsCampo('tipoOcorrencia')}>{Object.entries(TIPOS_OCORRENCIA).map(([id, nome]) => <option value={id} key={id}>{nome}</option>)}</select>{ajuda('tipoOcorrencia')}</label>
        <label className="campo">Observações <span className="opcional">(opcional)</span><textarea name="observacoes" rows={3} maxLength={1000} placeholder="Informações úteis para a próxima visita." value={campos.observacoes} onChange={e => alterar('observacoes', e.target.value)} {...propsCampo('observacoes')}/><small>{campos.observacoes.length}/1.000 caracteres</small>{ajuda('observacoes')}</label>
      </fieldset>
      {demonstracao && <label className="confirmacao-demo"><input type="checkbox" checked={consentimentoDemo} onChange={e => setConsentimentoDemo(e.target.checked)} disabled={enviando}/> Estou usando apenas dados fictícios nesta demonstração.</label>}
      {erroEnvio && <p className="aviso-dados erro-dados erro-envio" role="alert">{erroEnvio}</p>}
    </form>
  </PainelDialogo>;
}
