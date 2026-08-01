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
                 (chave do usuário)                          (valida licença → repassa
                                                              com a SUA chave de API)
```

| Arquivo | Função |
|---|---|
| `manifest.json` | Manifest V3, permissões mínimas (`storage` + host da API) |
| `content.js` | Extrai a conversa do DOM e injeta a sidebar. **Seletores concentrados no objeto `SELETORES` no topo** — quando o WhatsApp mudar o layout, ajusta-se ali. |
| `background.js` | Monta a chamada para a Claude API (saída estruturada em JSON garantida via `output_config.format`) |
| `sidebar.css` | Visual da sidebar (prefixo `cw-` para não colidir com o WhatsApp) |
| `options.html/js` | Configurações: modo, chave, modelo, tom de voz e playbook |
| `backend/worker.js` | Servidor de licenciamento (Cloudflare Worker) para vender por assinatura |

> A extensão não usa build/bundler de propósito — é JavaScript puro, igual ao
> resto deste repositório. Por isso a chamada à API é feita com `fetch` direto
> (o SDK oficial da Anthropic requer bundler; num service worker MV3 sem build,
> HTTP puro é o caminho).

## Vender por assinatura (modo backend)

No modo **assinatura**, o cliente recebe apenas uma **chave de licença** — a sua
chave da API fica no servidor, o modelo e os limites são travados lá, e quem
cancela a assinatura perde o acesso na hora. Deploy em ~10 minutos:

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
- **Custo por análise** (ordem de grandeza, medir no beta): ~R$ 0,25–0,35 com
  `claude-opus-5`; ~R$ 0,05 com `claude-haiku-4-5`. O worker já vem com limite
  diário por licença (200 análises) como proteção de custo.
- **Manutenção**: o WhatsApp Web muda o HTML periodicamente. Quando a extração
  falhar, ajuste os seletores no topo do `content.js`.

## Publicar na Chrome Web Store (quando for escalar)

1. Adicione ícones 16/48/128px no `manifest.json` (campo `icons`)
2. Crie uma conta de desenvolvedor ([chrome.google.com/webstore/devconsole](https://chrome.google.com/webstore/devconsole), taxa única de US$ 5)
3. Publique com política de privacidade (obrigatória, pois a extensão processa conteúdo de conversa)
4. Na revisão, descreva claramente: "lê a conversa aberta apenas quando o usuário clica, para gerar sugestões; não armazena dados"

Para a estratégia completa de validação e venda em massa, leia
[`COMO-VENDER.md`](COMO-VENDER.md).
