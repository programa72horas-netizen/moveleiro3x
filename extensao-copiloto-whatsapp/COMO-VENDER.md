# Como fazer dar certo — e vender em massa

Este documento é o plano de negócio da extensão. O produto técnico está pronto
para testar hoje (ver [`README.md`](README.md)); o que decide se isso vira
receita é a sequência abaixo.

## A tese (a mesma do seu amigo, aplicada ao seu contexto)

A extensão não é (só) o produto — é o **degrau de entrada da jornada do cliente
com você**. O lojista testa algo tangível por um preço baixo, vê resultado na
própria operação em dias, e passa a confiar em você para o contrato maior
(tráfego, social, consultoria). O jogo:

```
Extensão R$ 88/mês  →  confiança + dados reais da operação  →  contrato de agência
```

E você tem uma vantagem que quase ninguém tem: **o Moveleiro 3X**. O app de
pré-check-in deste repositório captura nome, WhatsApp, empresa e cargo de ~300
pessoas do setor moveleiro — donos e equipes de loja que **vendem móveis pelo
WhatsApp todos os dias**. Isso é o público-alvo perfeito desta extensão, com
contexto de confiança (o evento). Não comece "para todo mundo": comece
**nichado no moveleiro**, onde você já tem audiência, autoridade e um palco.

> ⚠️ **LGPD antes de qualquer disparo:** os dados do pré-check-in foram
> coletados para operar o evento. Usá-los para oferta de produto é outra
> finalidade e exige base legal. O caminho limpo: (1) adicionar **checkbox de
> opt-in** no app de pré-check-in ("aceito receber comunicações sobre produtos
> e ofertas", com registro de data/hora); (2) para quem já se cadastrou sem
> opt-in, **colher o consentimento no próprio evento** (palco + QR code);
> (3) **opt-out em toda mensagem** ("responda SAIR"); (4) envios **cadenciados
> e 1:1** — nunca broadcast de 300 números de uma vez de número comum, que
> além do risco legal derruba seu número no filtro anti-spam da Meta. Esses
> ~300 lojistas são o seu mercado inteiro e se conhecem entre si: uma
> reclamação pública no lançamento queima o nicho.

## Fase 1 — Validar com 10 vendedores reais (semanas 1–4)

Objetivo: provar que a extensão faz vendedor vender mais, e sair com provas.

1. **Use você mesmo primeiro.** Instale, configure o playbook de um cliente
   seu (ou o exemplo de móveis planejados) e rode em conversas reais por
   alguns dias. Ajuste o playbook até as sugestões ficarem boas de verdade —
   o playbook importa mais que o modelo.
2. **Recrute 10 betas.** De clientes atuais e da base do evento (com opt-in —
   ver acima), chame lojistas com 1–3 vendedores que atendem por WhatsApp.
   Oferta: *"teste grátis por 30 dias, eu configuro o playbook da sua loja com
   você, em troca quero seu feedback semanal"*. Cada beta usa uma licença sua
   no worker (você paga a API — R$ 30–150/beta/mês dependendo do modelo; é
   custo de pesquisa).
3. **Configure o playbook COM o dono.** Uma call de 40 minutos por loja:
   produtos, faixas de preço, condições, objeções comuns. Esse ritual é ouro:
   você aprende o setor, o cliente sente o produto "dele", e você já está
   fazendo diagnóstico de agência sem cobrar.
4. **Meça uso pelo servidor, não por autorrelato.** O worker já conta
   análises por licença/dia no KV `USO` — um script semanal que lê esses
   contadores diz quem usa e quem abandonou, com dado objetivo. Pergunte aos
   betas apenas o que o servidor não vê: tempo de resposta ao cliente e vendas
   que o vendedor atribui às sugestões.
5. **Colete depoimentos** em áudio/vídeo assim que aparecer o primeiro
   *"fechei uma cozinha com a mensagem que a IA sugeriu"*. Esse depoimento é a
   sua página de vendas inteira.

**Critério para avançar (dinheiro, não intenção):** no dia 30, converta os
betas para pagante com condição de fundador (ex.: R$ 44/mês nos 3 primeiros
meses). **Avance se ≥5 dos 10 passarem o cartão.** "Eu pagaria" de usuário de
beta grátis é o falso positivo clássico — o que valida é a cobrança aprovada,
não o valor. Menos que isso: o problema é playbook, UX ou público — conserte
antes de escalar. (Se ninguém pagar, você gastou 4 semanas e pouco dinheiro
para descobrir — isso também é sucesso de validação.)

## Fase 2 — Transformar em assinatura (semanas 5–8)

1. **Oferta de entrada única:** escolha UM funil — trial de 14 dias no site
   *ou* oferta de evento (1º mês por R$ 1). Não rode os dois ao mesmo tempo:
   coortes com ofertas diferentes embaralham a leitura de churn justamente
   quando você mais precisa dela.
2. **Faça o P&L por assento antes de fixar o preço.** A conta não é
   "R$ 88 − API". Exemplo com Haiku e câmbio a R$ 5,50 (declare a sua premissa
   de câmbio — o custo é dolarizado e o preço é em BRL):

   | Item | R$/assento/mês |
   |---|---|
   | Preço | 88,00 |
   | Taxa da plataforma (Kiwify/Hotmart ~9% + fixo) | −10,40 |
   | Imposto (Simples, faixa inicial ~6%) | −5,30 |
   | API (`claude-haiku-4-5`, ~440 análises) | −25,00 |
   | Rateio de manutenção (dev de plantão, ver Fase 3) | −15,00 |
   | **Contribuição por assento** | **≈ 32,00** |

   Com `claude-opus-5` (~R$ 110–150 de API), R$ 88 é **negativo** — os dois
   caminhos honestos são servir Haiku (teste a qualidade nos betas comparando
   os dois) ou reposicionar o preço (ex.: R$ 149). Defina também um **gatilho
   de reprecificação cambial** (ex.: dólar acima de R$ 6,20 → preço vai a
   R$ 99) e **meça o custo real por análise no beta** antes de travar o preço.
3. **Proteção de custo já embutida no worker** (não desligue): 40 análises/dia
   e 600/mês por licença, máx. 2 navegadores por licença, teto de tamanho de
   conversa/playbook, e *fail closed* sem o KV de uso. Além disso, **defina um
   limite de gasto mensal na sua chave de API** no console da Anthropic — é o
   freio de emergência que segura a fatura mesmo se tudo mais falhar. Sem
   esses limites, o pior caso por licença supera em muito os R$ 88.
4. **Cobrança por vendedor com enforcement real:** a extensão manda um
   identificador de instalação e o worker limita instalações por licença
   (padrão 2). Alternativa comercial que elimina a discussão: precificar **por
   loja com faixas de uso** (ex.: R$ 88 até 300 análises/mês; R$ 149 até 800)
   — mais honesto com loja pequena e sem policiamento de assento.
5. **Pagamento → licença automática:** checkout na Kiwify/Hotmart/Stripe; o
   webhook de "compra aprovada" grava a licença no KV (com código gerado com
   entropia criptográfica — ver `worker.js`) e dispara o e-mail;
   cancelamento/estorno desativa. Reserve **1–2 dias de trabalho** para essa
   integração (webhook + e-mail + testes de estorno) — não é "meia hora".
6. **Onboarding que segura o cliente:** vídeo de 5 min (instalar + configurar)
   e uma call de 20 min para montar o playbook juntos no primeiro acesso.
   Assinatura de ferramenta morre por falta de onboarding, não por preço.
   Check-in no dia 7.
7. **Publique na Chrome Web Store** (ver README) — instalar "sem compactação"
   não escala e assusta cliente leigo. Conte com **dias (às vezes 1–2
   semanas)** de revisão para extensão que lê conteúdo de conversa; publique
   cedo, antes do lançamento.

## Fase 3 — Vender em massa (a partir da semana 8)

Antes de escalar, resolva **quem mantém o produto** — você vende marketing, e
o software exige: ajustar seletores quando o WhatsApp mudar (recorrente e
imprevisível), redeploy do worker, atualizações exigidas pelo Chrome e
suporte. O tratamento mínimo: **retainer com um dev (R$ 500–1.500/mês)** como
linha de custo desde já, runbook + acesso de deploy para uma segunda pessoa, e
um SLA interno explícito (ex.: seletor corrigido em até 24h — a correção
remota via `_seletores` no KV torna isso viável em minutos, sem esperar a
revisão da Web Store).

Canais, na ordem de custo-benefício para você:

1. **O palco do Moveleiro 3X — com metas, não com fé.** Demo ao vivo com uma
   **conversa fictícia ensaiada** (nunca conversa real de cliente no telão — é
   problema de privacidade — e wifi de evento falha: tenha um vídeo gravado de
   backup). Oferta de palco: 1º mês por R$ 1. Metas explícitas: **40
   assinaturas no evento e ≥20 pagantes no dia 60** (coorte de R$ 1 churna
   40–60% na primeira renovação — 300 pessoas geram validação e caixa
   inicial, não "massa"). Capture mesmo quem não assinar: QR no palco para
   lista com opt-in explícito — o que também resolve a base LGPD do pós-evento.
2. **A base do pré-check-in (com opt-in).** Sequência cadenciada de
   WhatsApp/e-mail pós-evento: caso real do beta → vídeo de 90s → oferta.
3. **Conteúdo nichado.** Reels/carrosséis "cliente sumiu depois do orçamento?
   olha o que a IA sugeriu" — a tela da extensão é o criativo. Você já tem a
   máquina de conteúdo (Academia das Redes Sociais) para isso.
4. **Parcerias B2B2C — o canal de massa de verdade.** Fabricantes de MDF,
   softwares de projeto (Promob etc.), associações lojistas: eles têm a base
   de lojas, você dá comissão recorrente (20–30%) ou white-label. Trate como
   projeto com dono e prazo (ex.: 3 reuniões agendadas até o dia 90), não como
   item de lista — é ele que leva de dezenas para centenas de assinantes.
5. **Afiliados** dos próprios clientes: lojista que indica outro ganha mês
   grátis.
6. **Expandir o nicho por playbook, não por produto.** A mesma extensão vira
   "copiloto para secretária de clínica", "copiloto para imobiliária" trocando
   apenas o playbook padrão e a página de vendas. Cada nicho é um funil novo
   com o mesmo código.

## O jogo da agência (não esquecer o porquê)

Cada assinante da extensão é um lead qualificadíssimo para o serviço
principal: você conhece a operação dele, o playbook dele, e ele já paga e
confia. A régua: cliente com 60+ dias de uso e bom volume de conversas recebe
um diagnóstico gratuito de funil de WhatsApp → proposta de gestão de tráfego /
social / consultoria. A extensão paga a própria aquisição; o contrato de
agência é a margem.

## Riscos e como tratá-los

| Risco | Tratamento |
|---|---|
| WhatsApp muda o layout e a extração quebra | Seletores atualizáveis **remotamente** pelo worker (KV `_seletores`, propaga em até 6h) + mensagem amigável de degradação na sidebar; a republicação na Web Store vira o plano B, não o único caminho |
| Revisão da Chrome Web Store demora dias | Publicar cedo; correções críticas de seletor vão pelo canal remoto, que não depende de revisão |
| Termos de uso do WhatsApp | A extensão só lê a tela e nunca envia nada sozinha — mantenha assim; nada de "disparo em massa" no roadmap, é outro produto e outro risco |
| Custo de API estoura a margem | Limites por licença no worker (40/dia, 600/mês, fail closed) + teto de input + limite de gasto da chave no console da Anthropic + P&L por assento revisado mensalmente |
| LGPD — conversas processadas | Não armazenar conversas (já é assim); política de privacidade clara; contrato do assinante autorizando o processamento |
| LGPD — uso da base do evento para marketing | Opt-in no pré-check-in + consentimento no evento + opt-out em toda mensagem + envio cadenciado (ver aviso na abertura) |
| Compartilhamento de licença | Limite de instalações por licença já no worker; alternativa: preço por loja com faixas de uso |
| Cliente cancela após onboarding fraco | Call de configuração do playbook no primeiro acesso + check-in no dia 7 |
| Dependência de uma pessoa (você) | Retainer com dev + runbook + acesso de deploy para segunda pessoa + SLA interno de 24h |
| Câmbio encarece a API | Premissa de câmbio declarada no P&L + gatilho de reprecificação |

## Checklist — próximos 7 dias

- [ ] Instalar a extensão e testar com sua chave da API numa conversa real
- [ ] Ajustar o playbook de exemplo para um cliente real
- [ ] Fazer o deploy do worker e testar o modo assinatura com `LIC-TESTE-123`
- [ ] Definir limite de gasto mensal da chave de API no console da Anthropic
- [ ] Adicionar checkbox de opt-in no app de pré-check-in (para a base do próximo evento já nascer utilizável)
- [ ] Listar 20 nomes da base (com opt-in) para convidar ao beta
- [ ] Gravar um vídeo de 90s mostrando a extensão funcionando (esse vídeo recruta os betas)
