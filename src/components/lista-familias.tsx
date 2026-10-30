'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, MapPin } from 'lucide-react';
import { ESTILOS_RISCO, nomeDaFamilia } from '@/lib/pontos';
import type { CadastroFamilia } from '@/lib/familias';

const TAMANHO = 10;
export default function ListaFamilias({ familias, aoSelecionar, aoLocalizar }: {
  familias: readonly CadastroFamilia[]; aoSelecionar: (familia: CadastroFamilia) => void; aoLocalizar: (familia: CadastroFamilia) => void;
}) {
  const [pagina, setPagina] = useState(0);
  const totalPaginas = Math.max(1, Math.ceil(familias.length / TAMANHO));
  const paginaAtual = Math.min(pagina, totalPaginas - 1);
  const inicio = paginaAtual * TAMANHO;
  return <section className="painel-cadastros" aria-labelledby="titulo-cadastros"><header><div><h2 id="titulo-cadastros">Consultar famílias</h2><p>Abra um cadastro ou localize a residência no mapa.</p></div><span>{familias.length.toLocaleString('pt-BR')} {familias.length === 1 ? 'registro' : 'registros'}</span></header>
    <div className="rolagem-tabela"><table><caption className="somente-leitor">Famílias que correspondem à busca e à classificação selecionada</caption><thead><tr><th scope="col">Representante</th><th scope="col">Risco informado</th><th scope="col">Consulta</th></tr></thead><tbody>{familias.slice(inicio, inicio + TAMANHO).map(familia => <tr key={familia.id}><td><button type="button" className="nome-na-lista" onClick={() => aoSelecionar(familia)}>{nomeDaFamilia(familia)}</button></td><td><span className="risco-na-lista"><span className="amostra" aria-hidden="true" style={{ backgroundColor: ESTILOS_RISCO[familia.nivelRisco].cor }}>{ESTILOS_RISCO[familia.nivelRisco].letra}</span>{ESTILOS_RISCO[familia.nivelRisco].rotulo}</span></td><td><div className="acoes-lista"><button type="button" onClick={() => aoSelecionar(familia)} aria-label={`Ver cadastro de ${nomeDaFamilia(familia)}`}>Ver cadastro</button><button type="button" className="botao-icone" onClick={() => aoLocalizar(familia)} aria-label={`Localizar ${nomeDaFamilia(familia)} no mapa`}><MapPin size={17}/></button></div></td></tr>)}</tbody></table></div>
    {!familias.length && <p className="lista-vazia">Nenhuma família encontrada. Altere a busca ou a classificação.</p>}
    <footer className="paginacao"><span>{familias.length ? `${inicio + 1}–${Math.min(inicio + TAMANHO, familias.length)} de ${familias.length}` : '0 registros'}</span><div><button className="botao-icone" type="button" aria-label="Página anterior de famílias" disabled={paginaAtual === 0} onClick={() => setPagina(n => Math.max(0, n - 1))}><ChevronLeft size={17}/></button><span>Página {paginaAtual + 1} de {totalPaginas}</span><button className="botao-icone" type="button" aria-label="Próxima página de famílias" disabled={paginaAtual >= totalPaginas - 1} onClick={() => setPagina(n => n + 1)}><ChevronRight size={17}/></button></div></footer>
  </section>;
}
