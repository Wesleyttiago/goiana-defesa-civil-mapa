import type { CadastroFamilia, DadosFamilia } from './familias';
import { nomeDaFamilia, type NivelRisco } from './pontos';

export function normalizarBusca(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLocaleLowerCase('pt-BR');
}
export function filtrarFamilias(familias: readonly CadastroFamilia[], busca: string, nivel: NivelRisco | '') {
  const termos = normalizarBusca(busca).split(' ').filter(Boolean);
  return familias.filter(f => (!nivel || f.nivelRisco === nivel) && termos.every(t => normalizarBusca(nomeDaFamilia(f)).includes(t)));
}
export function documentosDaFamilia(dados: DadosFamilia): string[] {
  return [dados.cpf, ...(dados.familiares || []).map(p => p.cpf)].map(cpf => cpf.replace(/\D/g, '')).filter(Boolean);
}
/** Compara somente dados já disponíveis na sessão, sem expor CPFs na lista do mapa. */
export function possuiDocumentoCadastrado(familias: readonly CadastroFamilia[], dados: DadosFamilia): boolean {
  const documentos = new Set(familias.flatMap(f => f.dados ? documentosDaFamilia(f.dados) : []));
  return documentosDaFamilia(dados).some(cpf => documentos.has(cpf));
}
