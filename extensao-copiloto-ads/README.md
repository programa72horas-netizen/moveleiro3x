# 📊 Copiloto de Tráfego — Gerenciador de Anúncios (extensão Chrome)

Segunda extensão da família (irmã do [Copiloto de Vendas — WhatsApp](../extensao-copiloto-whatsapp/README.md)).
Lê a **tabela de métricas visível no Gerenciador de Anúncios do Meta** e usa a
Claude API para devolver, em segundos, com base **nas metas que você
configura** (CPL alvo, CPA máximo, ROAS mínimo, orçamento, regras de decisão):

- 🩺 **Saúde geral** da conta (bem / atenção / crítico) e diagnóstico em linguagem simples
- 🚨 **Alertas** — campanhas/conjuntos estourando as metas, com os números
- ✂️ **Otimizações recomendadas** — pausar, escalar, reduzir, ajustar, aguardar
- 🧪 **Novas campanhas e testes** — público, ângulo de criativo, orçamento inicial
- 🎓 **Explicar os números** — modo didático para dono de negócio leigo
- 📋 **Copiar análise** — texto pronto para colar no relatório ou WhatsApp do cliente

A extensão **só lê a tela** — não clica, não edita, não pausa nada nas
campanhas. Toda decisão continua na mão de quem opera.

## Instalar (modo desenvolvedor)

1. `chrome://extensions` → **Modo do desenvolvedor** → **Carregar sem compactação** → pasta `extensao-copiloto-ads/`
2. Clique no ícone da extensão → configure a chave da API e as **metas**
   (tem botão "Preencher com exemplo" para partir de um modelo)
3. Abra o Gerenciador de Anúncios na visão de **Campanhas / Conjuntos / Anúncios**
   (com as colunas de métricas que quer analisar visíveis) e clique no botão
   flutuante **📊**

> 💡 A qualidade da análise depende de duas coisas: **as metas configuradas**
> (sem CPL alvo a IA não sabe o que é "caro" para o seu negócio) e **as
> colunas visíveis** na tabela (adicione Valor gasto, Resultados, Custo por
> resultado, CTR — a IA avisa se faltar coluna importante).

## O campo de metas (o "playbook" deste produto)

É o lugar onde você passa as instruções para a IA — exatamente o que você
pediu: *"qual é o CPL"* etc. Estrutura sugerida (o exemplo embutido já vem
assim):

```
SOBRE O NEGÓCIO      → o que vende, ticket, margem, funil
METAS                → CPL alvo, CPA máx, ROAS mín, CTR referência, orçamento
REGRAS DE DECISÃO    → gasto mínimo antes de pausar, ritmo de escala, nº de criativos
CONTEXTO ATUAL       → oferta rodando, sazonalidade, histórico do que funciona
```

## Arquitetura

Idêntica à do Copiloto de Vendas (mesmos modos "chave própria" e
"assinatura"). A extração da tabela é **genérica por roles ARIA**
(`table/row/columnheader/gridcell`) — não depende de nomes de colunas nem de
classes CSS do Meta; a IA interpreta as colunas que vierem. Fallback para
`<table>` HTML clássica.

**O mesmo Cloudflare Worker atende os dois produtos**: esta extensão envia
`produto: "ads"` e o worker monta o prompt certo. A mesma licença pode valer
para os dois copilotos (campo opcional `"produtos": ["whats", "ads"]` na
licença — ausente = vale para tudo). Limites, instalações e todo o modelo de
assinatura são compartilhados — ver [`backend/`](../extensao-copiloto-whatsapp/backend/).

## Limitações conhecidas

- A extensão lê o que está **visível/renderizado** na tabela (até 60 linhas).
  Para contas gigantes, filtre a visão antes de analisar.
- O Gerenciador muda o layout com frequência; a extração genérica por ARIA é
  resistente, mas se quebrar, os seletores estão concentrados no topo do
  `content.js`.
- Período dos dados: a IA vê o que a tabela mostra — deixe o intervalo de
  datas desejado selecionado no Gerenciador antes de analisar.
