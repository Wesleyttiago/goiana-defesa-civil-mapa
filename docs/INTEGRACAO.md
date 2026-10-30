# Integração da gestão em campo

O projeto continua sendo um front-end React com exportação estática para GitHub Pages. O formulário inclui representante, CPF, telefone opcional, moradores, endereço, localização, avaliação informada e observações. Não foi criado um servidor nem um banco de dados.

## Demonstração pública

Sem uma API configurada, os 500 pontos iniciais e seus representantes são fictícios. Cada ponto inclui um resumo simulado com moradores, referência próxima de via local e a área do SGB na qual foi posicionado. CPF e telefone não integram essa base. O botão **Cadastrar família** permite preencher um exemplo, validar os campos e adicionar um ponto à mesma visualização. O cadastro aparece na busca, na lista paginada, no cartão de detalhes e no calor. A lista e o mapa usam os mesmos filtros.

A distribuição foi cruzada com as áreas edificadas da base cartográfica do SGB e as manchas médias/altas: 34 pontos em alta suscetibilidade à inundação, 376 em média suscetibilidade à inundação e 90 em média suscetibilidade a movimento de massa. São posições aproximadas próximas de vias locais; não são endereços ou residências verificados. Foram evitados eixos viários, rios, córregos, mangues e praias com exclusões técnicas para a simulação. Esses afastamentos não definem APP, margem oficial ou zona de segurança.

O script [gerar-familias-demonstracao.py](../scripts/gerar-familias-demonstracao.py) reproduz a base com semente fixa, a partir de `base_cartografica.gpkg` do SIG público do SGB, usando `shapely` e `pyproj` somente na manutenção. A origem, o hash e os critérios estão em [demonstracao/fontes.json](../public/demonstracao/fontes.json). Vias e hidrografia dessa base contêm dados © OpenStreetMap contributors, sob [ODbL](https://www.openstreetmap.org/copyright). Nomes, número de moradores e níveis de risco das famílias são inventados; a avaliação da família não é calculada pela classe de suscetibilidade territorial. A API real continua aceitando o contrato mínimo do mapa e não incorpora o resumo demonstrativo.

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
  "moradores": 4,
  "nivelRisco": "medio",
  "tipoOcorrencia": "inundacao",
  "observacoes": "Registro fictício",
  "localizacao": {"latitude": -7.5608, "longitude": -35.0009, "origem": "mapa"}
}
```

`tipoOcorrencia`: `nao_informado`, `inundacao`, `alagamento`, `deslizamento`, `erosao`, `outro`. `localizacao.origem`: `gps`, `mapa` ou `coordenadas`; GPS pode incluir `precisaoMetros`. Coordenadas nunca são preenchidas automaticamente com zero ou com o centro de Goiana. O agente precisa obter ou confirmar a residência. O GPS só é solicitado por ação do usuário, com a permissão do navegador.

O front-end bloqueia campos inválidos, CPF com verificadores incorretos e ausência de coordenadas. Durante o envio, bloqueia repetição e mostra o estado. O tempo limite é de 20 segundos; erros preservam os campos. Cada tentativa usa `Idempotency-Key`; repetições do mesmo conteúdo reutilizam a chave. **A API deve implementar idempotência e unicidade de CPF**, pois o bloqueio visual não impede duplicidade no servidor.

Responda com `201` e um ponto com `id`, `latitude`, `longitude`, `nivelRisco`, `nomeRepresentante` e, opcionalmente, `criadoEm` ISO. Sem ID ou coordenadas válidas, a interface não confirma sucesso. São tratados conflitos `409`, sessão `401/403`, validação `400/422`, limite `429` e falhas de rede.

### Detalhes: GET /:id

Consulte após o clique em **Ver cadastro da família**. Retorne `{ "id": "123", "dados": { ...mesmos campos do POST... } }`. O CPF começa oculto na interface. Conteúdos textuais são renderizados como texto, sem inserção de HTML recebido. Se a origem só fornecer o ponto, o painel informa quais detalhes não foram disponibilizados.

## Fontes ambientais

| Camada | Origem | Recorte e unidade |
| --- | --- | --- |
| Chuva em 24h | [APAC / SIRH](https://geoportal.apac.pe.gov.br/server/rest/services/met_monitoramento_chuvas_pe/MapServer/4) | Estações do município de Goiana; milímetros acumulados em 24h |
| Rios | [APAC / SIRH](https://geoportal.apac.pe.gov.br/server/rest/services/SIRH/mon_nivel_rios_pe/MapServer/0) | Estações da bacia do Goiana, incluindo Canal do Goiana; cota na régua em centímetros |
| Inundação, movimento de massa e geologia | [Carta de Goiana — SGB](https://rigeo.sgb.gov.br/handle/doc/25401) | Publicação de 2025; carta 1:45.000 e base litológica 1:100.000 |

As estações são consultadas quando a camada é ativada ou quando o usuário pede atualização; não há promessa de atualização em tempo real. Cada valor exibe a data/hora de medição da fonte, interpretada no horário de Pernambuco (UTC−3). Leitura com mais de três horas ou horário não validado recebe aviso de desatualização, sem gerar classificação de emergência. Valor zero de chuva é preservado; ausência, número inválido e sentinela negativa aparecem como **Sem medição**. Falha na consulta não é substituída por valores inventados.

A unidade de cota em centímetros segue o monitoramento da APAC, também documentado no [protocolo público da Sala de Situação, disponibilizado pela ANA](https://progestao.ana.gov.br/progestao-1/certificacao/certificacoes-2013-a-2018/certificacao-2022/contestacao-2022/contestacoes-2022/pe_oficio_contesta_meta_i_4.pdf). Não foram copiados limiares de alerta desse documento antigo nem calculados avisos de cheia.

A cartografia veio do GeoPackage público `suscetibilidade.gpkg`, integrante do SIG do item SGB, de Gilmar Dias Pauli, Rafaelly Rocha Cavalcanti de Lira e Guilherme Terra. Foram preservadas todas as classes de 473 feições de inundação, 989 de movimento de massa e 55 de litologia. Os dados foram reprojetados para WGS84 e simplificados em 10 m para a visualização web, com validação das geometrias. A origem, as transformações e o SHA-256 do GeoPackage estão em [fontes-sgb.json](../public/camadas/fontes-sgb.json). O script [preparar-camadas-sgb.py](../scripts/preparar-camadas-sgb.py) permite repetir a conversão com `shapely` e `pyproj`, sem alterar as dependências do site.

O gestor pode selecionar uma área no mapa ou pela lista acessível para planejar visitas nesta sessão. A seleção não despacha equipes, não persiste em servidor e não determina automaticamente o risco de uma residência. **Suscetibilidade territorial, densidade de cadastros, leitura de estação e risco informado de uma família são informações distintas.** Prioridades operacionais e previsão de impactos precisam de critérios e validação da Defesa Civil.

## Verificação

Execute `npm test` e `npm run build`. Os testes cobrem validações, contrato de envio, falhas e idempotência, coordenadas, calor, normalização de medições e integridade da cartografia. A interface também deve ser conferida com teclado e em telas pequenas. A API real e o acesso a dados confidenciais precisam de testes de integração no ambiente protegido da equipe.
