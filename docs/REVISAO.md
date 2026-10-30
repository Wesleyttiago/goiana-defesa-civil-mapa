# Revisão da interface — 30/10/2026

## Ajustes entregues

- O mapa aguarda o fim do agrupamento antes de localizar uma família. Limpar um filtro e localizar o cadastro agora abre o representante correto.
- A roda do mouse rola a página; o zoom continua pelos botões, teclado e gesto de pinça. A legenda fica ao lado no computador e abaixo no tablet/celular, sem cobrir residências.
- A consulta vira uma lista de cartões em telas pequenas. A busca aceita acentos, espaços extras e palavras em qualquer ordem. Filtros enquadram os resultados após uma pausa na digitação.
- A paginação volta ao início quando o critério da busca muda e mantém a página ao recarregar os mesmos dados.
- O formulário permite limpar a marcação. O pino acompanha as coordenadas atuais e desaparece sem localização. Falha ao iniciar o seletor oferece nova tentativa e preenchimento por coordenadas.
- Erros de nome, nascimento e CPF aparecem junto ao familiar correspondente. O envio continua bloqueado sem localização válida. CPFs já usados por representantes ou familiares da sessão não podem ser repetidos em outra família.
- A perda de conexão mostra um aviso. Cancelar a consulta ambiental não deixa o carregamento preso; datas impossíveis da APAC não aparecem como medições recentes. Zero de chuva continua sendo uma medição válida.
- IDs repetidos na origem são descartados para manter lista, mapa e calor consistentes. Nomes e documentos foram separados em funções pequenas para facilitar a manutenção.
- Os painéis mantêm as transições leves e respeitam a preferência de reduzir movimentos. Fechar um painel retorna o foco; localizar uma família transfere o foco ao mapa.
- No mapa de calor, os agrupamentos agora usam uma etiqueta branca com ícone de pessoas e quantidade. Os números deixaram de parecer soltos sobre as manchas; a legenda distingue grupo de famílias e pino individual. O alvo de toque continua com 44 px.

## Verificação

`npm test` cobre 56 testes, incluindo regressões de busca, documentos repetidos, erros por familiar, IDs duplicados e datas de medições. Também foram executados `npm run typecheck` e a geração estática com o caminho do GitHub Pages.

Conferência no navegador: busca e localização após filtro; envio bloqueado sem coordenadas; CPF inválido no familiar; correção e inclusão de cadastro fictício; consulta em celular; redimensionamento entre celular e tablet com um único canvas de calor e os mesmos 500 pontos.

## Limites da entrega

Esta é a interface de demonstração. Os 500 cadastros iniciais são fictícios; novos cadastros e rascunhos ficam somente na memória da aba. Atualizar ou fechar a página apaga esses dados de teste. Autenticação, armazenamento permanente e uso de dados reais dependem da API protegida da equipe, conforme [INTEGRACAO.md](INTEGRACAO.md). As camadas ambientais são consultivas, sem previsão automática de inundação ou despacho de equipes.
