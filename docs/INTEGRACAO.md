# Integração da gestão em campo

O projeto continua sendo um front-end React com exportação estática para GitHub Pages. O formulário inclui representante, CPF, telefone opcional, moradores, endereço, localização, avaliação informada, observações e fichas dos demais moradores (nome, parentesco, nascimento, CPF opcional e apoio para atendimento/evacuação). Não foi criado um servidor nem um banco de dados.

## Demonstração pública

Sem uma API configurada, os 500 pontos iniciais e seus representantes são fictícios. Cada ponto inclui uma composição familiar completa e inventada, com nomes, nascimentos, parentescos e necessidades de apoio, além da referência próxima de via local e a área do SGB. Todos os CPFs dessa base são `00000000000`: marcador explícito sem validade, nunca um CPF real ou um número aleatório válido. Telefone não integra a base. O botão **Cadastrar família** permite preencher um exemplo, validar os campos e adicionar um ponto à mesma visualização. O cadastro aparece na busca, na lista paginada, no cartão de detalhes e no calor. A lista e o mapa usam os mesmos filtros.

A distribuição está concentrada na sede (até 3,5 km do ponto da sede na base SGB), sem famílias demonstrativas nos distritos litorâneos. Foi cruzada com o polígono municipal **IBGE 2025, código 2606200**, as áreas edificadas do SGB e as manchas médias/altas: **67 pontos em alta suscetibilidade à inundação, 406 em média suscetibilidade à inundação e 27 em média suscetibilidade a movimento de massa**. Todos os 500 pontos estão dentro do município. A distribuição anterior incluía distritos pertencentes a Goiana; essa revisão concentra o cenário na sede, sem afirmar que Ponta de Pedras pertence a outra cidade. São posições aproximadas próximas de vias locais; não são endereços ou residências verificados. Foram evitados eixos viários, rios, córregos, mangues e praias com exclusões técnicas para a simulação. Esses afastamentos não definem APP, margem oficial ou zona de segurança.

O contorno azul tracejado no mapa mostra o limite municipal. O formulário bloqueia GPS, marcações e coordenadas fora desse polígono; o servidor deve repetir essa verificação. A normalização do JSON demonstrativo também descarta pontos fora de Goiana.

O script [gerar-familias-demonstracao.py](../scripts/gerar-familias-demonstracao.py) reproduz a base com semente fixa, a partir de `base_cartografica.gpkg` do SIG público do SGB, usando `shapely` e `pyproj` somente na manutenção. A origem, o hash e os critérios estão em [demonstracao/fontes.json](../public/demonstracao/fontes.json). Vias e hidrografia dessa base contêm dados © OpenStreetMap contributors, sob [ODbL](https://www.openstreetmap.org/copyright). Nomes, nascimentos, apoios, número de moradores e níveis de risco das famílias são inventados; a avaliação da família não é calculada pela classe de suscetibilidade territorial. A API real continua aceitando o contrato mínimo do mapa e não incorpora o resumo demonstrativo.

Novos cadastros e rascunhos ficam **somente na memória da aba**. Recarregar os dados pelo botão do mapa os preserva; atualizar ou fechar a página os apaga. Não há localStorage, sessionStorage, IndexedDB ou envio de formulários para terceiros no modo demonstrativo. Use somente dados de teste. O formulário não reproduz ainda o documento de cadastro municipal, que não foi disponibilizado neste repositório.

## Conectar à API da equipe

Defina `NEXT_PUBLIC_FAMILIAS_API_URL` antes de gerar o site, por exemplo `https://api.da-equipe/familias`. O endereço é público e não pode conter senhas, tokens ou chaves. A API deve usar HTTPS, verificar a sessão do usuário, autorizar cada operação, validar os dados novamente e permitir CORS somente para os domínios autorizados. Para autenticação por cookie entre domínios, o servidor deve configurar cookies e proteção CSRF adequados. O front-end usa `credentials: include`; nenhuma credencial é criada ou gravada no navegador por este módulo.

O GitHub Pages hospeda a interface. **Ele não recebe nem armazena os cadastros.** O uso com dados reais exige API protegida, autenticação e armazenamento sob responsabilidade da equipe e da prefeitura.

### Listar pontos: GET no endereço configurado

Retorne um array com apenas os campos necessários ao mapa:

```json
[{"id":"123","nomeRepresentante":"Nome autorizado","latitude":-7.5606,"longitude":-35.0025,"nivelRisco":"medio"}]
```

Níveis: `baixo`, `medio`, `alto`, `nao_informado`. O nome é opcional para manter a compatibilidade com a fonte antiga. CPF e demais detalhes não devem integrar essa lista pública de pinos; os dados completos são consultados individualmente.

`NEXT_PUBLIC_RF03_API_URL` permanece como alternativa antiga de consulta. Se apenas essa variável estiver preenchida, o cadastro fica indisponível até a equipe configurar a API completa.

### Cadastrar: POST no mesmo endereço

O corpo contém:

```json
{
  "nomeRepresentante": "Família de teste",
  "cpf": "11144477735",
  "telefone": "",
  "logradouro": "Rua de demonstração",
  "numero": "10",
  "bairro": "Centro",
  "complemento": "",
  "moradores": 2,
  "nascimentoRepresentante": "1988-04-12",
  "apoioRepresentante": "",
  "familiares": [{
    "id": "identificador-estavel-do-integrante",
    "nomeCompleto": "Pessoa de teste",
    "parentesco": "filho",
    "dataNascimento": "2018-03-20",
    "cpf": "",
    "apoio": "Acompanhamento de responsável"
  }],
  "nivelRisco": "medio",
  "tipoOcorrencia": "inundacao",
  "observacoes": "Registro fictício",
  "localizacao": {"latitude": -7.5608, "longitude": -35.0009, "origem": "mapa"}
}
```

`tipoOcorrencia`: `nao_informado`, `inundacao`, `alagamento`, `deslizamento`, `erosao`, `outro`. `localizacao.origem`: `gps`, `mapa` ou `coordenadas`; GPS pode incluir `precisaoMetros`. Coordenadas nunca são preenchidas automaticamente com zero ou com o centro de Goiana. O agente precisa obter ou confirmar a residência. O GPS só é solicitado por ação do usuário, com a permissão do navegador.

O front-end bloqueia campos inválidos, CPF com verificadores incorretos, CPFs repetidos na composição, datas impossíveis/futuras, quantidade menor que a composição identificada, ausência de coordenadas e localizações fora de Goiana. O total de moradores inclui o representante. A lista `familiares` contém somente os demais moradores; o formulário aumenta o total ao adicionar pessoas, permitindo fichas parciais sem inventar quem não foi informado. Nascimento, apoio e familiares são opcionais para manter compatibilidade com cadastros anteriores. Parentescos aceitos: `conjuge`, `filho`, `pai_mae`, `avo`, `neto`, `irmao`, `outro`. Apoio é texto livre de até 300 caracteres, para necessidades práticas de atendimento. A idade é calculada pelo aniversário civil, no horário de Pernambuco; não é armazenada como número que fica desatualizado. Durante o envio, bloqueia repetição e mostra o estado. O tempo limite é de 20 segundos; erros preservam os campos. Cada tentativa usa `Idempotency-Key`; repetições do mesmo conteúdo reutilizam a chave. **A API deve implementar idempotência e unicidade de CPF**, pois o bloqueio visual não impede duplicidade no servidor.

Responda com `201` e um ponto com `id`, `latitude`, `longitude`, `nivelRisco`, `nomeRepresentante` e, opcionalmente, `criadoEm` ISO. Sem ID ou coordenadas válidas, a interface não confirma sucesso. São tratados conflitos `409`, sessão `401/403`, validação `400/422`, limite `429` e falhas de rede.

### Detalhes: GET /:id

Consulte após o clique em **Ver cadastro da família**. Retorne `{ "id": "123", "dados": { ...mesmos campos do POST... } }`. O CPF de cada pessoa começa oculto na interface e pode ser revelado individualmente. Os cartões mostram nome, idade, parentesco, nascimento e apoio; os totais de crianças, idosos e pessoas com apoio informado são calculados apenas sobre fichas individuais disponíveis. Fichas ausentes são sinalizadas. A lista de pontos do mapa continua sem trazer esses detalhes; `familiares` só é consumido no GET individual protegido ou no retorno do cadastro feito na sessão. Conteúdos textuais são renderizados como texto, sem inserção de HTML recebido. Se a origem só fornecer o ponto, o painel informa quais detalhes não foram disponibilizados.

## Fontes ambientais

| Camada | Origem | Recorte e unidade |
| --- | --- | --- |
| Chuva em 24h | [APAC / SIRH](https://geoportal.apac.pe.gov.br/server/rest/services/met_monitoramento_chuvas_pe/MapServer/4) | Estações do município de Goiana; milímetros acumulados em 24h |
| Rios | [APAC / SIRH](https://geoportal.apac.pe.gov.br/server/rest/services/SIRH/mon_nivel_rios_pe/MapServer/0) | Estações da bacia do Goiana, incluindo Canal do Goiana; cota na régua em centímetros |
| Setores históricos de risco | [SGB/CPRM — Goiana, 2014](https://rigeo.sgb.gov.br/handle/doc/19968) | Três setores: Baldo do Rio/Vila Operária, Barreira da Cocota e Bueiro das Malvinas; não é vistoria atual |
| Limite municipal | [IBGE — Malha Municipal 2025](https://www.ibge.gov.br/geociencias/organizacao-do-territorio/malhas-territoriais/15774-malhas.html) | Goiana–PE, código 2606200; geometria sem simplificação |
| Inundação, movimento de massa e geologia | [Carta de Goiana — SGB](https://rigeo.sgb.gov.br/handle/doc/25401) | Publicação de 2025; carta 1:45.000 e base litológica 1:100.000 |

As estações são consultadas quando a camada é ativada ou quando o usuário pede atualização; não há promessa de atualização em tempo real. Cada valor exibe a data/hora de medição da fonte, interpretada no horário de Pernambuco (UTC−3). Leitura com mais de três horas ou horário não validado recebe aviso de desatualização, sem gerar classificação de emergência. Valor zero de chuva é preservado; ausência, número inválido e sentinela negativa aparecem como **Sem medição**. Falha na consulta não é substituída por valores inventados.

A unidade de cota em centímetros segue o monitoramento da APAC, também documentado no [protocolo público da Sala de Situação, disponibilizado pela ANA](https://progestao.ana.gov.br/progestao-1/certificacao/certificacoes-2013-a-2018/certificacao-2022/contestacao-2022/contestacoes-2022/pe_oficio_contesta_meta_i_4.pdf). Não foram copiados limiares de alerta desse documento antigo nem calculados avisos de cheia.

A cartografia veio do GeoPackage público `suscetibilidade.gpkg`, integrante do SIG do item SGB, de Gilmar Dias Pauli, Rafaelly Rocha Cavalcanti de Lira e Guilherme Terra. Foram preservadas todas as classes de 473 feições de inundação, 989 de movimento de massa e 55 de litologia. Os dados foram reprojetados para WGS84 e simplificados em 10 m para a visualização web, com validação das geometrias. A origem, as transformações e o SHA-256 do GeoPackage estão em [fontes-sgb.json](../public/camadas/fontes-sgb.json). O script [preparar-camadas-sgb.py](../scripts/preparar-camadas-sgb.py) permite repetir a conversão com `shapely` e `pyproj`, sem alterar as dependências do site.

O gestor pode selecionar uma área no mapa ou pela lista acessível para planejar visitas nesta sessão. A seleção não despacha equipes, não persiste em servidor e não determina automaticamente o risco de uma residência. **Suscetibilidade territorial, densidade de cadastros, leitura de estação e risco informado de uma família são informações distintas.** Prioridades operacionais e previsão de impactos precisam de critérios e validação da Defesa Civil.

## Pesquisa de ocorrências e limites de interpretação

O [Plano de Contingência municipal, seção 11](https://goiana.pe.gov.br/wp-content/uploads/2023/08/Plano-de-Conting%C3%AAncia.pdf) registra enchentes no Canal do Rio Goiana em 2011, 2018 e 2022 e deslizamento de encosta em Cocota, distrito de Ponta de Pedras, em 2022. A [Prefeitura lista localidades atingidas pelas chuvas em maio de 2026](https://www.goiana.pe.gov.br/portal/noticias/0/3/4800/prefeitura-de-goiana-habilita-moradores-atingidos-pelas-chuvas-para-saque-do-fgts-calamidade), incluindo Baldo do Rio, Impoeira, Bom Tempo e Boa Vista. O [Decreto 022/2026](https://www.goiana.pe.gov.br/portal/leis_decretos/9012/) documenta elevação dos rios da bacia e novas inundações no final de junho. Essas referências justificam o cenário territorial, sem provar que um ponto fictício é uma residência atingida.

A camada roxa **Setores históricos de risco · SGB 2014** preserva as três geometrias oficiais e mostra a tipologia e o grau registrados em março de 2014. Não foi atualizada para o presente por inferência. Ela é apenas consultiva: o planejamento usa as áreas da carta de suscetibilidade de 2025. Nenhum ponto de ocorrência foi inventado a partir de uma notícia. A demonstração de famílias fica na sede; os setores históricos de Cocota e Malvinas continuam no litoral de Goiana, em suas posições oficiais.

O script [extrair-territorio-goiana.py](../scripts/extrair-territorio-goiana.py), com `pyshp` somente na manutenção, extrai o polígono municipal do ZIP `PE_Municipios_2025.zip` e os setores de `sig_goiana_pe_risco.zip`. O hash e a URL da malha original acompanham o GeoJSON em `src/data/limite-goiana.json`. Os setores foram extraídos do arquivo `PE_GOI_SR_CPRM_atualizado`, em WGS84, preservando a geometria; apenas os atributos públicos úteis foram mantidos.

## Mapa de calor e transições

O calor usa uma camada própria de canvas sobre o Leaflet. O renderizador anterior (`leaflet.heat` 0.2.0 / simpleheat) desenhava o kernel com deslocamento de sombra fixo de 200 px; raios maiores deixavam o disco original visível, causando recortes e manchas opacas. Ele foi removido das dependências. A correção não altera plugins nem arquivos de `node_modules`.

A nova camada soma um kernel radial suave por cadastro, com peso igual e influência de 250 metros na latitude de Goiana. Esse raio é uma escolha de visualização de concentração, **não uma área de inundação ou distância de segurança**. A projeção e o raio acompanham os zooms 3 a 19. A grade é ancorada nas coordenadas mundiais, inclui contribuições de pontos fora da borda e limita a amostragem a 32 passos por raio. A escala de cores é logarítmica e fixa (referência 60), sem recalibrar pelo máximo da janela ou do filtro. Um cadastro isolado continua azul. A transparência máxima de 64% preserva a leitura do mapa base.

Uma instância e um canvas visível são reutilizados nas alternâncias. Há uma amostra auxiliar fora do DOM para interpolação das cores; não se cria um elemento por cadastro. Eventos de movimentação, zoom e redimensionamento são agrupados em `requestAnimationFrame`; remoção cancela o frame e os listeners. Uma margem de desenho acompanha pequenos deslocamentos durante o arraste; quando essa margem se aproxima da borda, o desenho é renovado em um único frame agendado. A transformação do Leaflet acompanha o zoom animado. Filtrar, cadastrar e recarregar atualiza os mesmos pontos do mapa e do calor.

Cartões de familiares e camadas ambientais têm expansão/recolhimento com altura e opacidade animadas. O conteúdo fechado fica `inert` e fora da leitura assistiva; os botões mantêm `aria-expanded` e `aria-controls`. O painel de cadastro entra e sai em 260 ms, com dois frames para garantir a transição inicial. Há efeitos discretos de entrada nos indicadores, de troca das linhas e de interação em botões/campos. `prefers-reduced-motion` reduz ou elimina essas transições. Não há animação contínua do mapa nem biblioteca adicional de animação.

## Verificação

Execute `npm test` e `npm run build`. Os testes cobrem validações, contrato de envio, falhas e idempotência, coordenadas, calor, normalização de medições e integridade da cartografia. A interface também deve ser conferida com teclado e em telas pequenas. A API real e o acesso a dados confidenciais precisam de testes de integração no ambiente protegido da equipe.
