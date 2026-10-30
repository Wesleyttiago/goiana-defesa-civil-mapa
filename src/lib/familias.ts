import { coordenadasValidas, normalizarPontos, type NivelRisco, type PontoRisco } from './pontos';

export const TIPOS_OCORRENCIA = {
  nao_informado: 'Não informado', inundacao: 'Inundação de rio', alagamento: 'Alagamento',
  deslizamento: 'Deslizamento', erosao: 'Erosão', outro: 'Outro',
} as const;
export type TipoOcorrencia = keyof typeof TIPOS_OCORRENCIA;
export interface LocalizacaoFamilia {
  latitude: number; longitude: number; origem: 'gps' | 'mapa' | 'coordenadas'; precisaoMetros?: number;
}
export interface DadosFamilia {
  nomeRepresentante: string; cpf: string; telefone: string;
  logradouro: string; numero: string; bairro: string; complemento: string;
  moradores: number; nivelRisco: NivelRisco; tipoOcorrencia: TipoOcorrencia;
  observacoes: string; localizacao: LocalizacaoFamilia;
}
export interface CadastroFamilia extends PontoRisco {
  dados?: DadosFamilia; criadoEm?: string;
  resumoDemonstrativo?: ResumoDemonstrativo;
}
export interface ResumoDemonstrativo {
  moradores: number;
  referenciaLocal: string;
  nucleo: string;
  areaSgb: { id: string; classe: 'Alta' | 'Média'; camada: 'inundacao' | 'movimento' };
}
export type CamposCadastro = Omit<DadosFamilia, 'moradores' | 'localizacao'> & {
  moradores: string; localizacao: LocalizacaoFamilia | null;
};
export type ErrosCadastro = Partial<Record<keyof CamposCadastro, string>>;
export const FORMULARIO_VAZIO: CamposCadastro = {
  nomeRepresentante: '', cpf: '', telefone: '', logradouro: '', numero: '', bairro: '',
  complemento: '', moradores: '1', nivelRisco: 'nao_informado', tipoOcorrencia: 'nao_informado',
  observacoes: '', localizacao: null,
};
export function gerarIdentificador(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return [...crypto.getRandomValues(new Uint8Array(16))].map(n => n.toString(16).padStart(2, '0')).join('');
}
const limpar = (s: string) => s.replace(/\s+/g, ' ').trim();
const digitos = (s: string) => s.replace(/\D/g, '');

export function cpfValido(valor: string): boolean {
  const cpf = digitos(valor);
  if (/[^\d.\-\s]/.test(valor) || cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
  for (const tamanho of [9, 10]) {
    const soma = [...cpf.slice(0, tamanho)].reduce((total, n, i) => total + Number(n) * (tamanho + 1 - i), 0);
    const resto = (soma * 10) % 11;
    if (Number(cpf[tamanho]) !== (resto === 10 ? 0 : resto)) return false;
  }
  return true;
}
export function formatarCpf(valor: string): string {
  return digitos(valor).slice(0, 11).replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4');
}
export function lerCoordenada(valor: string): number | null {
  const texto = valor.trim().replace(',', '.');
  return /^-?\d+(\.\d+)?$/.test(texto) && Number.isFinite(Number(texto)) ? Number(texto) : null;
}
export function validarCadastro(campos: CamposCadastro): ErrosCadastro {
  const erros: ErrosCadastro = {};
  const nome = limpar(campos.nomeRepresentante);
  if (nome.length < 3 || nome.length > 120) erros.nomeRepresentante = 'Informe o nome do representante, entre 3 e 120 caracteres.';
  if (!cpfValido(campos.cpf)) erros.cpf = 'Confira o CPF: são 11 dígitos e os verificadores devem ser válidos.';
  if (campos.telefone.trim() && !/^\d{10,11}$/.test(digitos(campos.telefone))) erros.telefone = 'Informe o telefone com DDD (10 ou 11 dígitos).';
  if (!limpar(campos.logradouro) || campos.logradouro.length > 160) erros.logradouro = 'Informe a rua ou o acesso à residência (até 160 caracteres).';
  if (!limpar(campos.numero) || campos.numero.length > 20) erros.numero = 'Informe o número ou S/N.';
  if (!limpar(campos.bairro) || campos.bairro.length > 100) erros.bairro = 'Informe o bairro ou a comunidade (até 100 caracteres).';
  if (campos.complemento.length > 160) erros.complemento = 'Use até 160 caracteres.';
  if (!/^\d+$/.test(campos.moradores) || Number(campos.moradores) < 1 || Number(campos.moradores) > 99) erros.moradores = 'Informe entre 1 e 99 moradores.';
  if (!['baixo', 'medio', 'alto', 'nao_informado'].includes(campos.nivelRisco)) erros.nivelRisco = 'Selecione uma classificação válida.';
  if (!Object.hasOwn(TIPOS_OCORRENCIA, campos.tipoOcorrencia)) erros.tipoOcorrencia = 'Selecione um tipo de ocorrência válido.';
  if (campos.observacoes.length > 1000) erros.observacoes = 'Use até 1.000 caracteres.';
  const local = campos.localizacao;
  if (!local || !coordenadasValidas(local.latitude, local.longitude) || !['gps', 'mapa', 'coordenadas'].includes(local.origem)) erros.localizacao = 'Marque a residência no mapa, use o GPS ou confirme as coordenadas antes de cadastrar.';
  return erros;
}
export function prepararCadastro(campos: CamposCadastro): DadosFamilia {
  if (Object.keys(validarCadastro(campos)).length) throw new Error('Revise os campos do cadastro.');
  const local = campos.localizacao!;
  return {
    nomeRepresentante: limpar(campos.nomeRepresentante), cpf: digitos(campos.cpf), telefone: digitos(campos.telefone),
    logradouro: limpar(campos.logradouro), numero: limpar(campos.numero), bairro: limpar(campos.bairro),
    complemento: limpar(campos.complemento), moradores: Number(campos.moradores),
    nivelRisco: campos.nivelRisco, tipoOcorrencia: campos.tipoOcorrencia, observacoes: campos.observacoes.trim(),
    localizacao: { latitude: local.latitude, longitude: local.longitude, origem: local.origem,
      ...(local.origem === 'gps' && Number.isFinite(local.precisaoMetros) && local.precisaoMetros! >= 0 ? { precisaoMetros: local.precisaoMetros } : {}) },
  };
}
export function criarCadastroDemonstrativo(dados: DadosFamilia): CadastroFamilia {
  return { id: `demo-${gerarIdentificador()}`, nomeRepresentante: dados.nomeRepresentante,
    latitude: dados.localizacao.latitude, longitude: dados.localizacao.longitude,
    nivelRisco: dados.nivelRisco, dados, criadoEm: new Date().toISOString() };
}
export function exemploCadastro(): CamposCadastro {
  return { ...FORMULARIO_VAZIO, nomeRepresentante: 'Família Exemplo da Silva', cpf: '111.444.777-35',
    telefone: '', logradouro: 'Rua de demonstração', numero: '10', bairro: 'Centro', moradores: '4',
    nivelRisco: 'medio', tipoOcorrencia: 'inundacao', observacoes: 'Cadastro fictício para testar o fluxo.',
    localizacao: { latitude: -7.5608, longitude: -35.0009, origem: 'mapa' } };
}
function erroHttp(status: number): string {
  if (status === 401 || status === 403) return 'Sua sessão não permite esta operação. Entre novamente pelo sistema da equipe.';
  if (status === 409) return 'Já existe um cadastro para esse CPF. Confira os registros antes de tentar novamente.';
  if (status === 400 || status === 422) return 'O servidor recusou os dados. Revise o cadastro e tente novamente.';
  if (status === 429) return 'Muitas tentativas em pouco tempo. Aguarde um momento para tentar novamente.';
  return 'O servidor não confirmou o cadastro. Os campos foram mantidos para você tentar novamente.';
}
/** API da equipe: POST no recurso /familias. A mesma chave deve ser reaproveitada em uma repetição de envio. */
export async function enviarCadastro(endereco: string, dados: DadosFamilia, chave: string, signal?: AbortSignal): Promise<CadastroFamilia> {
  const resposta = await fetch(endereco, { method: 'POST', credentials: 'include', signal,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'Idempotency-Key': chave }, body: JSON.stringify(dados) });
  if (!resposta.ok) throw new Error(erroHttp(resposta.status));
  const recebido: unknown = await resposta.json();
  if (!recebido || typeof recebido !== 'object' || !('id' in recebido) || (typeof recebido.id !== 'string' && typeof recebido.id !== 'number') || String(recebido.id).trim() === '') throw new Error('O servidor não retornou a identificação do cadastro. Confira os registros antes de repetir o envio.');
  const { pontos } = normalizarPontos([recebido]);
  if (!pontos.length) throw new Error('O servidor retornou uma localização inválida. Confira os registros antes de repetir o envio.');
  return { ...pontos[0], nomeRepresentante: pontos[0].nomeRepresentante || dados.nomeRepresentante, dados,
    criadoEm: 'criadoEm' in recebido && typeof recebido.criadoEm === 'string' ? recebido.criadoEm : new Date().toISOString() };
}
/** Detalhes só são requisitados após uma ação explícita, nunca pelo carregamento dos pinos. */
export async function carregarDetalhe(endereco: string, id: string, signal?: AbortSignal): Promise<DadosFamilia | null> {
  const resposta = await fetch(`${endereco.replace(/\/$/, '')}/${encodeURIComponent(id)}`, { credentials: 'include', signal, cache: 'no-store', headers: { Accept: 'application/json' } });
  if (!resposta.ok) throw new Error(resposta.status === 401 || resposta.status === 403 ? erroHttp(resposta.status) : 'Não foi possível consultar os detalhes. Tente novamente.');
  const registro: unknown = await resposta.json();
  if (!registro || typeof registro !== 'object' || !('dados' in registro) || !registro.dados || typeof registro.dados !== 'object') return null;
  const dado = registro.dados as Record<string, unknown>;
  // Não se espalha conteúdo arbitrário da resposta na interface.
  const campos: CamposCadastro = { ...FORMULARIO_VAZIO };
  for (const campo of ['nomeRepresentante', 'cpf', 'telefone', 'logradouro', 'numero', 'bairro', 'complemento', 'observacoes'] as const) {
    campos[campo] = typeof dado[campo] === 'string' ? dado[campo] : '';
  }
  campos.moradores = String(dado.moradores ?? '');
  campos.nivelRisco = ['baixo', 'medio', 'alto'].includes(String(dado.nivelRisco)) ? dado.nivelRisco as NivelRisco : 'nao_informado';
  campos.tipoOcorrencia = Object.hasOwn(TIPOS_OCORRENCIA, String(dado.tipoOcorrencia)) ? dado.tipoOcorrencia as TipoOcorrencia : 'nao_informado';
  const local = dado.localizacao as Record<string, unknown> | undefined;
  if (local && coordenadasValidas(local.latitude, local.longitude)) campos.localizacao = { latitude: local.latitude as number, longitude: local.longitude as number, origem: ['gps', 'mapa', 'coordenadas'].includes(String(local.origem)) ? local.origem as LocalizacaoFamilia['origem'] : 'coordenadas' };
  if (Object.keys(validarCadastro(campos)).length) return null;
  return prepararCadastro(campos);
}
