'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';

/** Dialog nativo: foco contido, fundo inerte e retorno de foco ao acionador. */
export default function PainelDialogo({ aberto, aoFechar, titulo, subtitulo, ocupado = false, children, rodape, id }: {
  aberto: boolean; aoFechar: () => void; titulo: string; subtitulo?: string; ocupado?: boolean;
  children: ReactNode; rodape?: ReactNode | ((fechar: () => void) => ReactNode); id: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const acionador = useRef<HTMLElement | null>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [visivel, setVisivel] = useState(false);
  const fechar = useCallback(() => {
    if (ocupado || temporizador.current) return;
    setVisivel(false);
    temporizador.current = setTimeout(() => {
      temporizador.current = null;
      ref.current?.close(); aoFechar(); acionador.current?.focus();
    }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 260);
  }, [aoFechar, ocupado]);
  useEffect(() => {
    if (!aberto) return;
    acionador.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    ref.current?.showModal();
    let segundoFrame: number | undefined;
    // Dois frames garantem o estado inicial antes da transição, inclusive no Safari.
    const frame = requestAnimationFrame(() => { segundoFrame = requestAnimationFrame(() => { if (!temporizador.current) setVisivel(true); }); });
    const anterior = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { cancelAnimationFrame(frame); if (segundoFrame !== undefined) cancelAnimationFrame(segundoFrame); if (temporizador.current) clearTimeout(temporizador.current); temporizador.current = null; document.body.style.overflow = anterior; ref.current?.close(); setVisivel(false); };
  }, [aberto]);

  return <dialog ref={ref} className="painel-dialogo" data-visivel={visivel} aria-labelledby={`${id}-titulo`} aria-describedby={subtitulo ? `${id}-subtitulo` : undefined}
    onCancel={evento => { evento.preventDefault(); fechar(); }}>
    <div className="estrutura-dialogo">
      <header className="cabecalho-dialogo"><div><span className="sobretitulo">DEFESA CIVIL · GOIANA</span><h2 id={`${id}-titulo`}>{titulo}</h2>{subtitulo && <p id={`${id}-subtitulo`}>{subtitulo}</p>}</div>
        <button className="botao-icone" type="button" onClick={fechar} disabled={ocupado} aria-label={`Fechar ${titulo.toLowerCase()}`}><X size={21}/></button></header>
      <div className="corpo-dialogo">{children}</div>
      {rodape && <footer className="rodape-dialogo">{typeof rodape === 'function' ? rodape(fechar) : rodape}</footer>}
    </div>
  </dialog>;
}
