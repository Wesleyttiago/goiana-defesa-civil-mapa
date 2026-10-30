import { cpfValido } from './documentos';

export const PARENTESCOS = {
  conjuge: 'Cônjuge / companheiro(a)', filho: 'Filho(a)', pai_mae: 'Pai / mãe',
  avo: 'Avô / avó', neto: 'Neto(a)', irmao: 'Irmão / irmã', outro: 'Outro vínculo',
} as const;
export type Parentesco = keyof typeof PARENTESCOS;
export interface Familiar {
  id: string; nomeCompleto: string; parentesco: Parentesco;
  dataNascimento: string; cpf: string; apoio: string;
}
export interface PessoaDemonstrativa extends Omit<Familiar, 'parentesco'> {
  parentesco: Parentesco | 'representante';
}
export const hojeCivil = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Recife', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

/** Datas civis, sem conversão para UTC que altere o aniversário. */
export function calcularIdade(nascimento: string, hoje = hojeCivil()): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(nascimento) || !/^\d{4}-\d{2}-\d{2}$/.test(hoje)) return null;
  const [ano, mes, dia] = nascimento.split('-').map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  if (data.getUTCFullYear() !== ano || data.getUTCMonth() !== mes - 1 || data.getUTCDate() !== dia || nascimento > hoje) return null;
  const [a, m, d] = hoje.split('-').map(Number);
  const idade = a - ano - (m < mes || (m === mes && d < dia) ? 1 : 0);
  return idade >= 0 && idade <= 120 ? idade : null;
}
export function formatarNascimento(data: string): string {
  return calcularIdade(data) === null ? 'Não informada' : data.split('-').reverse().join('/');
}

/** Lista permitida: nunca espalha campos arbitrários recebidos da API. */
export function lerFamiliares(entrada: unknown): Familiar[] | null {
  if (!Array.isArray(entrada) || entrada.length > 98) return null;
  const ids = new Set<string>();
  const resultado: Familiar[] = [];
  for (const valor of entrada) {
    if (!valor || typeof valor !== 'object') return null;
    const p = valor as Record<string, unknown>;
    if (typeof p.id !== 'string' || !p.id.trim() || p.id.length > 100 || ids.has(p.id)
      || typeof p.nomeCompleto !== 'string' || p.nomeCompleto.trim().length < 3 || p.nomeCompleto.length > 120
      || !Object.hasOwn(PARENTESCOS, String(p.parentesco))
      || typeof p.dataNascimento !== 'string' || calcularIdade(p.dataNascimento) === null
      || typeof p.cpf !== 'string' || p.cpf.length > 14
      || typeof p.apoio !== 'string' || p.apoio.length > 300) return null;
    ids.add(p.id);
    resultado.push({ id: p.id, nomeCompleto: p.nomeCompleto.replace(/\s+/g, ' ').trim(), parentesco: p.parentesco as Parentesco,
      dataNascimento: p.dataNascimento, cpf: p.cpf, apoio: p.apoio.trim() });
  }
  return resultado;
}

export type ErrosFamiliar = Partial<Record<'nomeCompleto' | 'dataNascimento' | 'cpf' | 'apoio' | 'parentesco', string>>;
export function validarFamiliar(pessoa: Familiar, familiares: readonly Familiar[], cpfRepresentante: string): ErrosFamiliar {
  const erros: ErrosFamiliar = {};
  const nome = pessoa.nomeCompleto.replace(/\s+/g, ' ').trim();
  if (nome.length < 3 || nome.length > 120) erros.nomeCompleto = 'Informe o nome completo, entre 3 e 120 caracteres.';
  if (calcularIdade(pessoa.dataNascimento) === null) erros.dataNascimento = 'Informe uma data válida, sem data futura.';
  if (!Object.hasOwn(PARENTESCOS, pessoa.parentesco)) erros.parentesco = 'Escolha um parentesco válido.';
  if (pessoa.apoio.length > 300) erros.apoio = 'Use até 300 caracteres.';
  const cpf = pessoa.cpf.replace(/\D/g, '');
  if (pessoa.cpf.trim() && !cpfValido(pessoa.cpf)) erros.cpf = 'CPF inválido. Confira os dígitos ou deixe em branco se não informado.';
  else if (cpf && (cpf === cpfRepresentante.replace(/\D/g, '') || familiares.some(p => p.id !== pessoa.id && p.cpf.replace(/\D/g, '') === cpf))) erros.cpf = 'Este CPF já identifica outra pessoa da família.';
  return erros;
}
