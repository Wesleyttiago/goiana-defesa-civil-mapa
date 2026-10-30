'use client';

import { useId, useState, type ReactNode } from 'react';

/** Expansão com altura fluida. Conteúdo recolhido fica fora do foco e da leitura assistiva. */
export default function Recolhivel({ cabecalho, children, classe = '', abertoInicial = false }: {
  cabecalho: ReactNode; children: ReactNode; classe?: string; abertoInicial?: boolean;
}) {
  const [aberto, setAberto] = useState(abertoInicial);
  const id = useId();
  return <div className={`recolhivel ${classe}`} data-aberto={aberto}>
    <button className="acionador-recolhivel" type="button" aria-expanded={aberto} aria-controls={id} onClick={() => setAberto(v => !v)}>{cabecalho}</button>
    <div className="expansao-recolhivel" id={id} aria-hidden={!aberto} inert={!aberto}>
      <div className="miolo-recolhivel">{children}</div>
    </div>
  </div>;
}
