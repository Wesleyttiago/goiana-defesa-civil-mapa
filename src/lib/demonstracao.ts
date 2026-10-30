import { normalizarPontos } from './pontos';
import type { CadastroFamilia, ResumoDemonstrativo } from './familias';
import { lerFamiliares, type PessoaDemonstrativa } from './integrantes';
import { dentroDeGoiana } from './territorio';

function lerResumo(valor: unknown): ResumoDemonstrativo | undefined {
  if (!valor || typeof valor !== 'object') return;
  const item = valor as Record<string, unknown>;
  const area = item.areaSgb as Record<string, unknown> | undefined;
  if (!Number.isInteger(item.moradores) || Number(item.moradores) < 1 || Number(item.moradores) > 12
    || typeof item.referenciaLocal !== 'string' || !item.referenciaLocal.trim()
    || typeof item.nucleo !== 'string' || !item.nucleo.trim()
    || !area || typeof area.id !== 'string' || !/^(inundacao|movimento)-\d+$/.test(area.id)
    || !['Alta', 'Média'].includes(String(area.classe)) || !['inundacao', 'movimento'].includes(String(area.camada))
    || !area.id.startsWith(`${area.camada}-`)) return;
  if (!Array.isArray(item.integrantes) || item.integrantes.length !== item.moradores
    || item.integrantes.some((p, i) => !p || typeof p !== 'object' || p.cpf !== '00000000000' || (i === 0 ? p.parentesco !== 'representante' : p.parentesco === 'representante'))) return;
  const familiares = lerFamiliares(item.integrantes.map((p, i) => ({ ...p, parentesco: i === 0 ? 'outro' : p.parentesco })));
  if (!familiares) return;
  const integrantes: PessoaDemonstrativa[] = familiares.map((p, i) => ({ ...p, parentesco: i === 0 ? 'representante' : p.parentesco }));
  return { moradores: Number(item.moradores), integrantes, referenciaLocal: item.referenciaLocal.trim().slice(0, 160), nucleo: item.nucleo.trim().slice(0, 100),
    areaSgb: { id: area.id, classe: area.classe as 'Alta' | 'Média', camada: area.camada as 'inundacao' | 'movimento' } };
}

/** Somente o JSON local da demonstração. A API real continua usando o contrato mínimo do mapa. */
export function normalizarDemonstracao(entrada: unknown): { pontos: CadastroFamilia[]; descartados: number } {
  const base = normalizarPontos(entrada);
  const resumos = new Map<string, ResumoDemonstrativo>();
  for (const item of entrada as unknown[]) {
    if (!item || typeof item !== 'object') continue;
    const dado = item as Record<string, unknown>;
    if (typeof dado.id !== 'string') continue;
    const resumo = lerResumo(dado.resumoDemonstrativo);
    if (resumo) resumos.set(dado.id, resumo);
  }
  const pontos = base.pontos.filter(p => dentroDeGoiana(p.latitude, p.longitude));
  return { descartados: base.descartados + base.pontos.length - pontos.length, pontos: pontos.map(ponto => {
    const resumoDemonstrativo = resumos.get(ponto.id);
    return { ...ponto, ...(resumoDemonstrativo && resumoDemonstrativo.integrantes[0].nomeCompleto === ponto.nomeRepresentante ? { resumoDemonstrativo } : {}) };
  }) };
}

export async function carregarDemonstracao(endereco: string, signal?: AbortSignal) {
  const resposta = await fetch(endereco, { signal, cache: 'no-store', headers: { Accept: 'application/json' } });
  if (!resposta.ok) throw new Error('Não foi possível carregar as famílias de demonstração. Tente novamente.');
  return normalizarDemonstracao(await resposta.json());
}
