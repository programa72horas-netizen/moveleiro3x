# Estúdio 72h · Criação de artes com IA

Aplicativo web para a equipe de design criar artes do **método 72 Horas**
(lojas de móveis de médio e baixo padrão) com qualidade e velocidade:

- **Cada designer tem seu acesso** (nome + código).
- **Modelos de layout travados em código** (1080×1350, formato feed):
  a IA escreve apenas os textos — o desenho nunca muda, então toda arte
  sai idêntica ao modelo aprovado.
- **Espaço de planejamento**: o designer cola o planejamento do post e a
  IA gera **3 variações de copy** seguindo à risca o que foi escrito
  (sem inventar preço, data ou condição).
- **Edição ao vivo**: qualquer campo pode ser ajustado na mão, com a
  arte atualizando na hora.
- **Exportação em PNG** (1080×1350) direto do navegador, com as fontes
  embutidas — pronto para postar.
- **Marcas/clientes**: logo, cores e contato de cada loja ficam salvos e
  entram automaticamente em todos os modelos.
- **Histórico** por designer, para reabrir e ajustar artes já feitas.

## Seus próprios modelos (o coração do app)

Na tela **Modelo**, a seção **"Meus modelos"** tem o botão
**"+ Adicionar um modelo meu"**. Dá para trazer um layout de 3 jeitos:

1. **Replicar de uma imagem (IA)** — envie o print/arquivo de um modelo
   que você já usa. A IA recria o layout como HTML fiel **uma única
   vez**; você confere na prévia ao vivo, ajusta os campos e salva.
   Depois disso o layout fica **travado**: no dia a dia a IA só escreve
   os textos, nunca mexe no desenho.
2. **Colar HTML** — cole um layout de 1080×1350 com marcadores
   `{{titulo}}`, `{{preco}}`, `{{imgFoto}}`… Cada marcador vira um campo
   editável automaticamente. Marcadores da marca (`{{marcaNome}}`,
   `{{marcaLogo}}`, `{{marcaWhatsapp}}`, `{{marcaEndereco}}`,
   `{{marcaCor1}}`, `{{marcaCor2}}`) são preenchidos pelo cadastro do
   cliente.
3. **Editar um existente** — todo modelo criado no app tem o botão
   **✎ Editar** no cartão.

Com o **KV configurado** (veja abaixo), os modelos salvos valem para
**toda a equipe**, em qualquer computador. Sem KV, cada navegador guarda
os seus.

Os modelos podem ser classificados nas fases do método ou em "Meus
modelos":

| Fase | Modelos de exemplo incluídos | Estilo |
|---|---|---|
| **1 · Curiosidade** | Comunicado Oficial · Acesso Restrito | Preto institucional, mistério, carimbo confidencial |
| **2 · Oferta** | Oferta com Produto · Oferta Percentual | Gradiente da marca, produto herói, preço gigante |
| **3 · Urgência** | Comando Gigante · Escassez de Estoque | Alerta, comandos curtos, prazo e estoque no fim |

Veja os modelos de exemplo preenchidos em `galeria.html` (ex.:
`https://SEU-APP.workers.dev/galeria.html`).

## Como publicar (Cloudflare Workers)

O app roda inteiro na Cloudflare: os arquivos estáticos ficam em
`public/` e o `worker.js` expõe a rota `POST /api/gerar`, que chama a IA
(Claude) usando uma chave que **nunca aparece no navegador**.

```bash
cd estudio
npx wrangler login          # primeira vez
npx wrangler deploy         # publica em https://estudio72h.<sua-conta>.workers.dev

# chave da API da Anthropic (https://console.anthropic.com)
npx wrangler secret put ANTHROPIC_API_KEY

# códigos de acesso da equipe — MESMOS nomes e códigos do CONFIG em public/app.js
# formato: Nome:codigo,Nome 2:codigo2
npx wrangler secret put ACCESS_CODES
# exemplo de valor:  Deborah:7272,Designer 1:1111,Designer 2:2222,Designer 3:3333

# (recomendado) armazenamento central dos SEUS modelos, para toda a equipe:
npx wrangler kv namespace create MODELOS
# copie o id que aparecer, descomente o bloco kv_namespaces no wrangler.jsonc
# colando o id, e rode `npx wrangler deploy` de novo
```

Pronto. O endereço do deploy já serve o app completo.

### Trocar o modelo de IA (opcional)

Por padrão o worker usa `claude-sonnet-5` (rápido e forte para copy).
Para trocar, defina a variável `MODEL` no `wrangler.jsonc` ou no painel
da Cloudflare (ex.: `claude-haiku-4-5-20251001` para custo mínimo).

## Como adicionar ou remover designers

1. Edite `CONFIG.DESIGNERS` no início de `public/app.js` (nome + código).
2. Atualize o segredo com os mesmos pares:
   `npx wrangler secret put ACCESS_CODES`
3. Publique de novo: `npx wrangler deploy`.

> O código do designer libera o app e também é validado no servidor a
> cada geração de IA. É uma proteção adequada para equipe interna — não
> use esses códigos para proteger dados sensíveis.

## Modelos de exemplo (avançado)

Os 6 modelos de exemplo vivem em `public/templates.js`, escritos em
código (`render(slots, marca)`). Só é preciso mexer neles se quiser
mudar os exemplos — os modelos do dia a dia se criam pelo próprio app,
na seção "Meus modelos".

## Estrutura

| Arquivo | Função |
|---|---|
| `public/index.html` | Telas do app (login, modelos, planejamento, estúdio, histórico) |
| `public/styles.css` | Interface (tema escuro de estúdio) |
| `public/app.js` | Fluxo do app + `CONFIG.DESIGNERS` |
| `public/templates.js` | **Os modelos de layout** (o coração do sistema) |
| `public/export.js` | Exportação PNG 1080×1350 com fontes embutidas |
| `public/galeria.html` | Catálogo de todos os modelos preenchidos |
| `public/fonts/` + `fonts.css` | Montserrat e Poppins locais (licença SIL OFL) |
| `worker.js` | API `/api/gerar` (chama o Claude com schema fixo) |
| `wrangler.jsonc` | Configuração do deploy na Cloudflare |

## Por que a qualidade não varia mais

No fluxo antigo, a IA desenhava a arte inteira a cada pedido — cada
resposta saía de um jeito. Aqui o desenho é **código**: posição, cores,
tipografia e hierarquia são fixos por modelo. A IA recebe um schema
com os campos e limites de caracteres e é obrigada a responder só com
os textos, seguindo o guia de tom da fase (curiosidade, oferta ou
urgência) e o planejamento do designer. Se a IA estiver fora do ar, o
designer preenche os mesmos campos na mão — o layout continua perfeito.
