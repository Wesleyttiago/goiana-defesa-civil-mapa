'use client';

import { Plus, Trash2 } from 'lucide-react';
import { formatarCpf, gerarIdentificador } from '@/lib/familias';
import { hojeCivil, PARENTESCOS, type Familiar, type Parentesco } from '@/lib/integrantes';

export default function CamposFamiliares({ familiares, moradores, aoAlterar, erro }: {
  familiares: Familiar[]; moradores: number; aoAlterar: (pessoas: Familiar[]) => void; erro?: string;
}) {
  function alterar(id: string, campo: keyof Familiar, valor: string) {
    aoAlterar(familiares.map(p => p.id === id ? { ...p, [campo]: valor } : p));
  }
  return <div className="campos-familiares" tabIndex={-1} aria-invalid={!!erro} aria-describedby={erro ? 'erro-familiares' : undefined}>
    <p className="ajuda-secao">Inclua quem mora com o representante. O CPF pode ficar em branco quando não informado. Identificados: {familiares.length + 1} de {Number.isFinite(moradores) ? moradores : '—'} moradores.</p>
    {familiares.map((p, i) => <section className="ficha-familiar" key={p.id} aria-label={`Familiar ${i + 1}`}>
      <header><strong>Familiar {i + 1}</strong><button type="button" className="remover-familiar" aria-label={`Remover familiar ${i + 1}: ${p.nomeCompleto || 'sem nome'}`} onClick={() => aoAlterar(familiares.filter(item => item.id !== p.id))}><Trash2 size={14}/>Remover</button></header>
      <label className="campo">Nome completo *<input name={`nome-${p.id}`} autoComplete="off" maxLength={120} value={p.nomeCompleto} onChange={e => alterar(p.id, 'nomeCompleto', e.target.value)}/></label>
      <div className="grade-campos"><label className="campo">Parentesco com o representante *<select name={`parentesco-${p.id}`} value={p.parentesco} onChange={e => alterar(p.id, 'parentesco', e.target.value as Parentesco)}>{Object.entries(PARENTESCOS).map(([valor, nome]) => <option key={valor} value={valor}>{nome}</option>)}</select></label><label className="campo">Data de nascimento *<input name={`nascimento-${p.id}`} type="date" max={hojeCivil()} value={p.dataNascimento} onChange={e => alterar(p.id, 'dataNascimento', e.target.value)}/></label></div>
      <label className="campo">CPF <span className="opcional">(opcional)</span><input name={`cpf-${p.id}`} inputMode="numeric" autoComplete="off" maxLength={14} placeholder="000.000.000-00" value={p.cpf} onChange={e => alterar(p.id, 'cpf', formatarCpf(e.target.value))}/></label>
      <label className="campo">Apoio para atendimento / evacuação <span className="opcional">(opcional)</span><textarea name={`apoio-${p.id}`} rows={2} maxLength={300} placeholder="Ex.: mobilidade reduzida, acompanhamento de responsável." value={p.apoio} onChange={e => alterar(p.id, 'apoio', e.target.value)}/></label>
    </section>)}
    {erro && <p id="erro-familiares" className="erro-campo" role="alert">{erro}</p>}
    <button className="adicionar-familiar" type="button" disabled={familiares.length >= 98} onClick={() => aoAlterar([...familiares, { id: gerarIdentificador(), nomeCompleto: '', parentesco: 'filho', dataNascimento: '', cpf: '', apoio: '' }])}><Plus size={16}/>Adicionar familiar</button>
  </div>;
}
