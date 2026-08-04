# Como publicar o Estúdio 72h (passo a passo completo)

Tempo estimado: **10 a 15 minutos**. Ao final você terá um link
definitivo (ex.: `https://estudio72h.SUACONTA.workers.dev`) para mandar
para a equipe.

## O que você precisa antes

1. **Conta na Cloudflare** (o plano grátis serve) — https://dash.cloudflare.com/sign-up
2. **Chave da API da Anthropic** (a IA que escreve os textos) —
   https://console.anthropic.com → *API Keys* → *Create Key*.
   Copie a chave (começa com `sk-ant-…`) e guarde.
3. **Node.js** instalado no computador — https://nodejs.org (versão LTS).
   Para conferir, abra o terminal e rode `node -v`.

> **Windows:** use o "Prompt de Comando" ou "PowerShell".
> **Mac:** use o "Terminal".

## Passo 1 · Baixar o código

Sem precisar de git: baixe o ZIP da branch e descompacte:

```
https://github.com/programa72horas-netizen/moveleiro3x/archive/refs/heads/claude/designer-art-generation-jwxjd0.zip
```

Depois entre na pasta `estudio` pelo terminal:

```bash
cd caminho/para/moveleiro3x/estudio
```

*(Se preferir git: `git clone -b claude/designer-art-generation-jwxjd0
https://github.com/programa72horas-netizen/moveleiro3x.git`)*

## Passo 2 · Entrar na Cloudflare

```bash
npx wrangler login
```

Abre o navegador pedindo autorização — clique em **Allow**. (Na primeira
vez, o `npx` pergunta se pode instalar o wrangler: responda `y`.)

## Passo 3 · Criar o armazenamento central (KV)

É ele que faz os **modelos**, os **acessos** e a **produtividade**
valerem para toda a equipe, em qualquer computador:

```bash
npx wrangler kv namespace create MODELOS
```

O comando devolve um bloco com um **id** (letras e números). Abra o
arquivo `wrangler.jsonc` desta pasta num editor de texto, **descomente**
o bloco `kv_namespaces` (remova as barras `//`) e cole o id no lugar de
`COLE_AQUI_O_ID_GERADO`. Salve o arquivo.

## Passo 4 · Publicar

```bash
npx wrangler deploy
```

No final aparece a URL do app, algo como:

```
https://estudio72h.SUACONTA.workers.dev
```

Esse é o link definitivo. (Ainda falta a chave da IA — próximo passo.)

## Passo 5 · Configurar os segredos

Três comandos; cada um pede para você **digitar/colar o valor** e dar
Enter (o valor não aparece na tela — é normal):

```bash
npx wrangler secret put ANTHROPIC_API_KEY
# cole a chave sk-ant-…

npx wrangler secret put ACCESS_CODES
# os acessos iniciais, no formato Nome:codigo separados por vírgula, ex.:
# Deborah:7272,Rafa:1111,Bia:2222

npx wrangler secret put ADMINS
# quem é administradora (vê a tela Equipe), ex.:
# Deborah
```

Os segredos entram em vigor sozinhos — não precisa publicar de novo.

## Passo 6 · Testar

1. Abra a URL do Passo 4 e entre com um dos acessos do `ACCESS_CODES`.
2. Como administradora, abra **★ Equipe** e confira a lista de acessos.
   A partir daqui, adicione/remova designers **pelo próprio app** — o
   `ACCESS_CODES` era só o pontapé inicial.
3. Crie o primeiro modelo em **Meus modelos** (envie os prints dos seus
   layouts e deixe a IA replicar).

## Problemas comuns

| Sintoma | Causa provável | Solução |
|---|---|---|
| `node: command not found` | Node.js não instalado | Instale em https://nodejs.org e feche/abra o terminal |
| Login não abre o navegador | terminal remoto/restrito | copie o link que o wrangler mostra e abra manualmente |
| "Acesso não autorizado" no app | nome/código diferentes do `ACCESS_CODES` | o nome precisa ser idêntico (com acentos e maiúsculas) |
| "A IA não conseguiu responder" | chave da Anthropic errada/sem crédito | confira o Passo 5 e o saldo em console.anthropic.com |
| Modelo salvo não aparece para os colegas | KV não configurado | Passo 3 + `npx wrangler deploy` de novo |
| Tela Equipe diz que precisa de KV | idem | idem |

## Custos

- **Cloudflare:** o plano grátis cobre o uso de uma equipe de design
  com folga (100 mil requisições/dia).
- **Anthropic:** paga por uso; cada geração de 3 variações custa poucos
  centavos de dólar. A replicação de um modelo por imagem custa um
  pouco mais (envia imagens), mas acontece só uma vez por modelo.

## Para atualizar o app no futuro

Baixe/atualize o código e rode `npx wrangler deploy` de novo dentro da
pasta `estudio`. Os segredos, o KV, os modelos e a equipe continuam
onde estão.
