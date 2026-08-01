# Guia de implantação — Copilotos ARS

Passo a passo operacional: **da venda confirmada até o cliente usando**.
Vale para os dois produtos (Copiloto de Vendas ARS — WhatsApp e Copiloto de
Tráfego ARS — Gerenciador). Tempo total por cliente: ~5 min de setup + uma
call de 30 min.

---

## Parte 0 — Setup único (antes do primeiro cliente)

Fazer UMA vez. Se já fez, pule para a Parte 1.

- [ ] **Worker no ar**: siga `extensao-copiloto-whatsapp/backend/wrangler.toml`
      (KVs LICENCAS e USO criados, `ANTHROPIC_API_KEY` como secret, deploy).
      Anote a URL: `https://copiloto-vendas-whatsapp.SEU-SUBDOMINIO.workers.dev`
- [ ] **Limite de gasto** definido na chave de API (console.anthropic.com → Limits)
- [ ] **Extensões publicadas na Chrome Web Store** (ideal) — enquanto não sai
      a revisão, use os zips no modo desenvolvedor (funciona, mas na call
      você é quem instala)
- [ ] **Vídeo de instalação de 3–5 min** gravado (instalar → configurar →
      primeira análise). Grave uma vez, use para sempre
- [ ] **Planilha de controle de assinantes** com as colunas: cliente,
      WhatsApp, e-mail, produto(s), licença, plano, data de início, status,
      link do playbook, data do check-in

---

## Parte 1 — Pagamento confirmado → licença criada (2 min)

**1.1** Gere o código da licença — cole no console do navegador (F12):

```js
"LIC-" + [...crypto.getRandomValues(new Uint8Array(20))].map(b => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[b % 32]).join("")
```

**1.2** Registre no servidor — terminal, pasta `extensao-copiloto-whatsapp/backend/`:

```bash
# Cliente dos DOIS copilotos (combo):
wrangler kv key put --binding=LICENCAS "LIC-XXXX" \
  '{"ativa": true, "cliente": "Loja Fulano", "plano": "mensal", "produtos": ["whats", "ads"]}'

# Só WhatsApp:  "produtos": ["whats"]     |     Só Tráfego:  "produtos": ["ads"]
# Plano anual: adicione "expira": "2027-08-01" (dispensa lembrar de cortar)
# Loja com 3 vendedores (3 assentos pagos): "maxInstalacoes": 3
```

**1.3** Anote na planilha de controle.

> Limites default por licença: 40 análises/dia, 600/mês, 2 navegadores.
> Para mudar: `"limiteDiario": 60, "limiteMensal": 900` no JSON acima.

---

## Parte 2 — Mensagem de boas-vindas (copiar e adaptar)

> Fala [NOME]! 🎉 Bem-vindo ao Copiloto ARS.
>
> Seus dados de acesso:
> 🔑 Licença: `LIC-XXXX`
> 🌐 Servidor: `https://SEU-WORKER.workers.dev`
>
> Pra deixar tudo redondo, vamos fazer juntos a configuração numa call de
> 30 min — é nela que eu monto o playbook do SEU negócio com você (é o que
> faz a IA sugerir coisa boa, e não resposta genérica).
>
> Me manda 2 horários que funcionam pra você esta semana?
>
> Enquanto isso, se quiser adiantar: instala a extensão aqui → [LINK DA
> WEB STORE ou vídeo de instalação]

**Regra de ouro: não pule a call.** Assinatura de ferramenta morre por
onboarding fraco, não por preço. Cliente que sai da call com o playbook
pronto e a primeira análise rodada fica; cliente que "depois eu configuro"
cancela no mês 2.

---

## Parte 3 — Call de implantação (30 min, com tela compartilhada)

### Roteiro

**(5 min) Instalar e conectar**
1. Cliente instala a extensão (Web Store) — ou você instala via zip se ainda
   estiver em modo desenvolvedor
2. Clicar no ícone da extensão → abre configurações
3. Modo de acesso: **Assinatura (servidor licenciado)**
4. Colar: endereço do servidor + chave de licença → **Salvar**

**(15–20 min) Montar o playbook JUNTO — o coração da call**

*Copiloto de Vendas (WhatsApp) — pergunte e vá preenchendo:*
- O que você vende? Faixas de preço? Condições de pagamento?
- Como é o processo ideal de venda? (primeiro contato → ? → fechamento)
- Quais as 5 objeções que você mais ouve? Como seu melhor vendedor responde?
- O que NUNCA pode ser dito por mensagem? (ex.: preço fechado sem medição)
- Tom de voz: formal ou próximo? Chama por nome? Usa emoji?

*Copiloto de Tráfego (Gerenciador) — pergunte e vá preenchendo:*
- Qual o CPL alvo? A partir de quanto o lead está caro?
- CPA máximo / ROAS mínimo para a conta dar lucro? Ticket médio e margem?
- Orçamento mensal? Regras de escala? (quanto % por vez)
- Gasto mínimo antes de pausar um conjunto?
- O que já foi testado e funcionou/falhou nessa conta?

**(5 min) Primeira análise ao vivo**
- WhatsApp: abrir uma conversa REAL travada → **🔥 Cadência infernal** (efeito
  uau garantido: sai a sequência de follow-up pronta)
- Gerenciador: abrir Campanhas com colunas de gasto/resultado/custo →
  **📊 Diagnóstico geral**
- Mostrar o botão **Copiar** / **Inserir no campo** e onde ajustar o playbook
  depois (ele vai querer mexer — deixe à vontade, é dele)

**(2 min) Combinar o acompanhamento**
- "Qualquer coisa estranha, me chama aqui" (suporte = você, por enquanto)
- Agendar o **check-in do dia 7** já na call

### Erros comuns na call (resolver na hora)

| Sintoma | Causa provável | Solução |
|---|---|---|
| "Licença inválida" | Digitou errado / não registrou no KV | Conferir código; rodar o `kv key put` de novo |
| "Servidor mal configurado (KV USO ausente)" | Worker sem o binding USO | Conferir wrangler.toml e redeploy |
| Botão da extensão não aparece no WhatsApp/Gerenciador | Página aberta antes de instalar | F5 na aba |
| "Não consegui ler as mensagens/tabela" | Layout mudou | Testar você mesmo; se reproduzir, corrigir `_seletores` no KV (WhatsApp) ou me acionar |
| "Limite diário atingido" no primeiro dia | Cliente empolgado testando | Bom sinal 😄 — subir `limiteDiario` da licença dele |

---

## Parte 4 — Pós-implantação

- **Dia 7 — check-in** (WhatsApp mesmo): "E aí, o copiloto te ajudou em
  alguma venda essa semana?" → colher a primeira história de resultado
  (vira depoimento) + ajustar playbook se as sugestões estiverem genéricas
- **Uso real** (não pergunte, olhe): 
  `wrangler kv key get --binding=USO "LIC-XXXX:2026-08"` → análises no mês.
  Uso caindo = risco de churn → chamar antes que cancele
- **Dia 60+, cliente usando bem** → régua da agência: oferecer o diagnóstico
  gratuito de funil/tráfego → proposta do serviço principal

## Parte 5 — Cancelamento / estorno (30 s)

```bash
wrangler kv key put --binding=LICENCAS "LIC-XXXX" '{"ativa": false}'
```

Atualizar a planilha. Acesso morre na próxima análise. (Se voltar, é só
reativar com o mesmo JSON de antes.)

---

## Quando automatizar

Com **15–20 assinantes**, o fluxo manual começa a doer. Aí sim: webhook da
plataforma de pagamento → worker cria a licença e envia o e-mail sozinho
(1–2 dias de dev). Antes disso, o manual é uma feature: cada venda é uma
conversa 1:1 sua com o cliente — e é dela que saem os depoimentos e os
contratos de agência.
