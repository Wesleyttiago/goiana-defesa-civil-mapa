'use client';

import { useState } from 'react';
import { Eye, EyeOff, Users } from 'lucide-react';
import { calcularIdade, formatarNascimento, PARENTESCOS, type PessoaDemonstrativa } from '@/lib/integrantes';
import { formatarCpf } from '@/lib/familias';

export default function ComposicaoFamilia({ pessoas, total, demonstracao }: {
  pessoas: PessoaDemonstrativa[]; total: number; demonstracao: boolean;
}) {
  const [documentosVisiveis, setDocumentosVisiveis] = useState<string[]>([]);
  const idades = pessoas.map(p => calcularIdade(p.dataNascimento));
  const criancas = idades.filter(i => i !== null && i < 12).length;
  const idosos = idades.filter(i => i !== null && i >= 60).length;
  const apoio = pessoas.filter(p => p.apoio.trim()).length;
  return <section className="secao-detalhe composicao-familia" aria-label="Integrantes da família">
    <h4><Users size={16}/>Integrantes da família <span>{pessoas.length} de {total} identificados</span></h4>
    <div className="resumo-composicao"><span><strong>{criancas}</strong>Crianças até 11 anos</span><span><strong>{idosos}</strong>Pessoas com 60+ anos</span><span><strong>{apoio}</strong>Com apoio informado</span></div>
    {demonstracao && <p className="nota-composicao">Todos os nomes, nascimentos e apoios são inventados. O CPF 000.000.000-00 é um marcador sem validade.</p>}
    <div className="lista-integrantes">{pessoas.map((p, i) => {
      const idade = idades[i]; const chave = `${i}:${p.id}`; const visivel = documentosVisiveis.includes(chave);
      return <details className="cartao-integrante" key={chave} open={i === 0 ? true : undefined}>
        <summary><span className="numero-integrante" aria-hidden="true">{i + 1}</span><span><strong>{p.nomeCompleto}</strong><small>{p.parentesco === 'representante' ? 'Representante familiar' : PARENTESCOS[p.parentesco]} · {idade === null ? 'Idade não informada' : idade === 0 ? 'Menos de 1 ano' : `${idade} ${idade === 1 ? 'ano' : 'anos'}`}</small></span><span className="abrir-integrante" aria-hidden="true">+</span></summary>
        <dl><div><dt>Data de nascimento</dt><dd>{formatarNascimento(p.dataNascimento)}</dd></div><div><dt>CPF</dt><dd>{demonstracao ? '000.000.000-00 · sem validade' : p.cpf ? <>{visivel ? formatarCpf(p.cpf) : `***.***.***-${p.cpf.replace(/\D/g, '').slice(-2)}`}<button className="revelar-cpf" type="button" aria-label={`${visivel ? 'Ocultar' : 'Mostrar'} CPF de ${p.nomeCompleto}`} aria-pressed={visivel} onClick={() => setDocumentosVisiveis(a => visivel ? a.filter(id => id !== chave) : [...a, chave])}>{visivel ? <EyeOff size={14}/> : <Eye size={14}/>}{visivel ? 'Ocultar' : 'Mostrar'}</button></> : 'Não informado'}</dd></div><div><dt>Apoio para atendimento / evacuação</dt><dd>{p.apoio || 'Não informado'}</dd></div></dl>
      </details>;
    })}</div>
    {pessoas.length < total && <p className="nota-composicao">Faltam as fichas individuais de {total - pessoas.length} {total - pessoas.length === 1 ? 'morador' : 'moradores'}. Os dados não foram informados no cadastro.</p>}
  </section>;
}
