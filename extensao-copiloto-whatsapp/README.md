# 🧠 Copiloto de Vendas — WhatsApp (extensão Chrome)

Extensão que lê a conversa aberta no **WhatsApp Web** e usa a **Claude API** para
devolver, em segundos, direcionamento de vendas com base no **seu playbook**:

- 🌡️ **Temperatura do lead** (frio / morno / quente) e estágio da negociação
- 📝 **Resumo** da situação
- 💬 **2–3 mensagens prontas** para copiar (ou inserir direto no campo de texto)
- 🛡️ **Objeções detectadas** e como responder cada uma
- 👉 **Próximo passo** — a única ação mais importante agora

A extensão **só lê e sugere**. Nada é enviado ao cliente automaticamente — o
vendedor sempre revisa e aperta o enviar. Isso é proposital: reduz o risco com
os termos de uso do WhatsApp e mantém o humano no controle.

## Instalar (modo desenvolvedor — para testar hoje)

1. Abra `chrome://extensions` no Chrome
2. Ative **Modo do desenvolvedor** (canto superior direito)
3. Clique em **Carregar sem compactação** e selecione a pasta `extensao-copiloto-whatsapp/`
4. Clique no ícone da extensão → abre a página de **configurações**:
   - Cole sua chave da API da Anthropic (crie em [console.anthropic.com](https://console.anthropic.com))
   - Edite o **playbook** (já vem um exemplo de loja de móveis planejados)
5. Abra [web.whatsapp.com](https://web.whatsapp.com), entre numa conversa e
   clique no botão flutuante **🧠** (canto inferior direito)

## Como funciona

```
WhatsApp Web ──(content.js lê o DOM da conversa)──▶ background.js
                                                        │
                              modo "chave própria"      │      modo "assinatura"
                         ┌──────────────────────────────┴─────────────────────┐
                         ▼                                                    ▼
                 api.anthropic.com                              seu Cloudflare Worker
                 (prompt montado na extensão,               (a extensão envia só os DADOS;
                  chave do usuário)                          o worker valida licença, limites
                                                             e instalações, monta o prompt e
                                                             chama a API com a SUA chave)
```

No modo assinatura o prompt é montado **no servidor** de propósito: uma
licença vazada não vira proxy genérico da sua chave de API — o worker só
aceita os campos do produto (ação, conversa, playbook), com teto de tamanho
em cada um.

| Arquivo | Função |
|---|---|
| `manifest.json` | Manifest V3, permissões mínimas (`storage` + host da API) |
| `content.js` | Extrai a conversa do DOM (com emojis e horários) e injeta a sidebar. **Seletores concentrados no objeto `SELETORES` no topo** — e, no modo assinatura, atualizáveis remotamente via `GET /config` do worker (chave `_seletores` no KV): quando o WhatsApp mudar o layout, você corrige em minutos sem esperar a revisão da Chrome Web Store. |
| `background.js` | Monta a chamada para a Claude API (saída estruturada em JSON garantida via `output_config.format`); mantém o service worker vivo durante chamadas longas |
| `sidebar.css` | Visual da sidebar (prefixo `cw-` para não colidir com o WhatsApp) |
| `options.html/js` | Configurações: modo, chave, modelo, tom de voz e playbook |
| `backend/worker.js` | Servidor de licenciamento (Cloudflare Worker): valida licença, limita instalações/uso por licença, monta o prompt e chama a API |

> A extensão não usa build/bundler de propósito — é JavaScript puro, igual ao
> resto deste repositório. Por isso a chamada à API é feita com `fetch` direto
> (o SDK oficial da Anthropic requer bundler; num service worker MV3 sem build,
> HTTP puro é o caminho).

## Vender por assinatura (modo backend)

No modo **assinatura**, o cliente recebe apenas uma **chave de licença** — a sua
chave da API fica no servidor, o modelo e os limites são travados lá, e quem
cancela a assinatura perde o acesso na hora. Proteções já incluídas no worker:

- **Prompt montado no servidor** — a licença não serve como proxy genérico da API
- **Limites por licença**: 40 análises/dia e 600/mês (configuráveis por licença no KV)
- **Máximo de 2 navegadores por licença** (preço por vendedor tem enforcement)
- **Teto de tamanho de input** (conversa/playbook) — protege o custo por chamada
- **Fail closed**: sem o KV de uso configurado, o worker recusa tudo
- **Seletores remotos** (`_seletores` no KV) — correção de layout sem republicar

Deploy em ~10 minutos:

```bash
cd backend
npm install -g wrangler && wrangler login
wrangler kv namespace create LICENCAS   # cole o id no wrangler.toml
wrangler kv namespace create USO        # idem
wrangler secret put ANTHROPIC_API_KEY   # sua chave sk-ant-...
wrangler deploy
# criar licença de teste:
wrangler kv key put --binding=LICENCAS "LIC-TESTE-123" '{"ativa": true, "cliente": "Beta"}'
```

Depois, nas opções da extensão: modo **Assinatura**, endereço do worker e a
licença. A emissão automática de licenças se conecta ao webhook da sua
plataforma de pagamento (Stripe/Hotmart/Kiwify) — ver comentários no
`worker.js`.

## Privacidade e limites (importante para vender)

- **LGPD**: a conversa aberta é enviada para a API da Anthropic no momento da
  análise e **não é armazenada** pela extensão nem pelo worker. Deixe isso
  claro na sua política de privacidade e no onboarding do cliente.
- **Termos do WhatsApp**: a extensão não automatiza envio, não faz disparo em
  massa e não usa API não-oficial de conexão — ela lê a tela que o próprio
  vendedor está vendo. Ainda assim, não é um produto oficial do WhatsApp;
  seja transparente com o cliente sobre isso.
- **Custo por análise** (ordem de grandeza — varia com o tamanho da conversa e
  do playbook; **meça no beta** antes de precificar): ~R$ 0,25–0,35 com
  `claude-opus-5`; ~R$ 0,05 com `claude-haiku-4-5`. Alavancas baratas de custo:
  truncamento de conversa (já aplicado no worker), prompt caching do playbook
  (já aplicado) e escolha do modelo. O worker limita uso por licença
  (40/dia, 600/mês por padrão) e o limite de gasto da chave no console da
  Anthropic é o freio final.
- **Segurança (decisões de MVP, documentadas)**: no modo "chave própria" a
  chave da API fica em `chrome.storage.local` (texto puro — aceitável porque
  esse modo é só para você e betas); o worker responde com CORS aberto
  (`*`) porque extensões não têm origin fixa — a autenticação real é a
  licença, nunca o CORS.
- **Manutenção**: o WhatsApp Web muda o HTML periodicamente. Quando a extração
  falhar, ajuste os seletores no topo do `content.js` — ou, com o worker no ar,
  publique a correção na chave `_seletores` do KV (propaga em até 6h para
  todas as instalações, sem revisão da Web Store).

## Publicar na Chrome Web Store (quando for escalar)

1. Adicione ícones 16/48/128px no `manifest.json` (campo `icons`)
2. Crie uma conta de desenvolvedor ([chrome.google.com/webstore/devconsole](https://chrome.google.com/webstore/devconsole), taxa única de US$ 5)
3. Publique com política de privacidade (obrigatória, pois a extensão processa conteúdo de conversa)
4. Na revisão, descreva claramente: "lê a conversa aberta apenas quando o usuário clica, para gerar sugestões; não armazena dados"

Para a estratégia completa de validação e venda em massa, leia
[`COMO-VENDER.md`](COMO-VENDER.md).
