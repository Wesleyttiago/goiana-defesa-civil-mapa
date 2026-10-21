'use client';

import { useEffect, useState } from 'react';
import { ChevronRight, FlaskConical, Info, Map, MapPin, ShieldCheck } from 'lucide-react';
import MapaRiscos from './mapa-riscos';
import { carregarPontos, type PontoRisco } from '@/lib/pontos';

const apiUrl = process.env.NEXT_PUBLIC_RF03_API_URL;
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
const fonte = apiUrl || `${basePath}/dados-exemplo.json`;

export default function VisaoMapa() {
  const [pontos, setPontos] = useState<PontoRisco[]>([]);
  const [descartados, setDescartados] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [revisao, setRevisao] = useState(0);

  useEffect(() => {
    const controlador = new AbortController();
    let cancelado = false;
    const limite = setTimeout(() => controlador.abort(), 20000);
    setCarregando(true); setErro(''); setPontos([]); setDescartados(0);
    carregarPontos(fonte, controlador.signal).then(dados => {
      if (!cancelado) { setPontos(dados.pontos); setDescartados(dados.descartados); }
    }).catch(e => {
      if (!cancelado) setErro(e instanceof Error && e.name !== 'AbortError' ? e.message : 'O carregamento demorou mais que o esperado. Verifique a conexão e tente novamente.');
    }).finally(() => { clearTimeout(limite); if (!cancelado) setCarregando(false); });
    return () => { cancelado = true; clearTimeout(limite); controlador.abort(); };
  }, [revisao]);

  return <div className="pagina-mapa">
    <a href="#conteudo" className="pular-conteudo">Ir para o conteúdo</a>
    <aside className="barra-lateral" aria-label="Defesa Civil de Goiana">
      <div className="marca-prefeitura"><img src={`${basePath}/logo-goiana.png`} width="142" height="76" alt="Prefeitura de Goiana — Crescendo juntos, cuidando da gente"/></div>
      <div className="identidade-sistema"><span className="icone-defesa"><ShieldCheck size={25} strokeWidth={1.6}/></span><div><span>Prefeitura de Goiana</span><strong>Defesa Civil</strong></div></div>
      <p className="descricao-sistema">Sistema de Redução de<br/>Riscos de Desastres</p>
      <nav className="navegacao" aria-label="Monitoramento social"><span className="titulo-navegacao">MONITORAMENTO SOCIAL</span><a href="#conteudo" aria-current="page"><Map size={20}/><span>Mapa social</span><ChevronRight size={15}/></a></nav>
      <div className="base-lateral">{!apiUrl && <div className="aviso-demonstracao"><strong><FlaskConical size={16}/>Ambiente demonstrativo</strong><p>Pontos fictícios. Não utilizar para decisões operacionais.</p></div>}<div className="assinatura-lateral"><ShieldCheck size={18}/><span>Defesa Civil de Goiana<small>Pernambuco</small></span></div></div>
    </aside>
    <main id="conteudo" tabIndex={-1}>
      <header className="cabecalho"><div><div className="caminho">DRP <ChevronRight size={12}/> Mapa social</div><div className="titulo-pagina"><h1>Monitoramento social</h1><span className="municipio-cabecalho"><MapPin size={13}/>Goiana–PE</span></div></div>{!apiUrl && <span className="etiqueta-demo"><Info size={16}/>Dados fictícios · Demonstração</span>}</header>
      <div className="conteudo-mapa"><div className="introducao-mapa"><h2>Mapa de riscos</h2><p>Localização dos cadastros por nível de vulnerabilidade.</p></div>
        <MapaRiscos pontos={pontos} carregando={carregando} erro={erro} descartados={descartados} aoRecarregar={() => setRevisao(n => n + 1)}/>
        <footer className="rodape-pagina"><span>Defesa Civil de Goiana · Pernambuco</span><span>Classificações informadas na origem dos dados.</span></footer>
      </div>
    </main>
  </div>;
}
