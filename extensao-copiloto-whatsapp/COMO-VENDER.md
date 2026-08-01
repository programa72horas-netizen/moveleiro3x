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
canal de contato aberto e contexto de confiança (o evento). Não comece "para
todo mundo": comece **nichado no moveleiro**, onde você já tem audiência,
autoridade e um palco.

## Fase 1 — Validar com 10 vendedores reais (semanas 1–4)

Objetivo: provar que a extensão faz vendedor vender mais, e sair com provas.

1. **Use você mesmo primeiro.** Instale, configure o playbook de um cliente
   seu (ou o exemplo de móveis planejados que já vem pronto) e rode em
   conversas reais por alguns dias. Ajuste o playbook até as sugestões ficarem
   boas de verdade — o playbook importa mais que o modelo.
2. **Recrute 10 betas.** Da lista do Moveleiro 3X (ou clientes atuais), chame
   lojistas com 1–3 vendedores que atendem por WhatsApp. Oferta: *"teste
   grátis por 30 dias, eu configuro o playbook da sua loja com você, em troca
   quero seu feedback semanal"*. Nesta fase, cada beta usa uma licença sua no
   worker (você paga a API — custo estimado de R$ 30–150/beta/mês dependendo
   do modelo; é seu custo de pesquisa).
3. **Configure o playbook COM o dono.** Uma call de 40 minutos por loja:
   produtos, faixas de preço, condições, objeções comuns. Esse ritual é ouro:
   você aprende o setor, o cliente sente o produto "dele", e você já está
   fazendo diagnóstico de agência sem cobrar.
4. **Meça 3 números por semana** (pergunte, é o suficiente no início):
   - Análises usadas por vendedor (uso = valor percebido)
   - Tempo de resposta ao cliente (antes/depois)
   - Vendas fechadas que o vendedor atribui às sugestões
5. **Colete depoimentos** em áudio/vídeo assim que aparecer o primeiro
   *"fechei uma cozinha com a mensagem que a IA sugeriu"*. Esse depoimento é a
   sua página de vendas inteira.

**Critério para avançar:** ≥6 dos 10 betas usando toda semana no dia 30 e
dispostos a pagar. Menos que isso: o problema é playbook, UX ou público —
conserte antes de escalar. (Se ninguém usar, você gastou 4 semanas e quase
nada de dinheiro para descobrir — isso é sucesso de validação também.)

## Fase 2 — Transformar em assinatura (semanas 5–8)

1. **Preço:** R$ 88/mês ou R$ 880/ano (2 meses grátis) **por vendedor**, com
   14 dias grátis. Não venda vitalício; a mensalidade é o modelo do jogo.
2. **Unit economics (a decisão mais importante da fase):** com
   `claude-opus-5`, um vendedor intenso (~20 análises/dia útil) custa
   ~R$ 110–150/mês de API — não fecha com R$ 88. Dois caminhos honestos:
   - **Trocar o modelo servido** no worker para `claude-haiku-4-5`
     (~R$ 20–30/mês por vendedor intenso) **se** a qualidade se mantiver — 
     teste nos betas comparando os dois antes de decidir; ou
   - **Reposicionar o preço** (ex.: R$ 149/mês) mantendo a qualidade máxima.
   O worker já vem com limite diário por licença justamente para o pior caso
   não estourar sua conta. Meça o custo real no beta antes de fixar o preço.
3. **Pagamento → licença automática:** checkout na Kiwify/Hotmart/Stripe;
   o webhook de "compra aprovada" grava a licença no KV do worker e dispara o
   e-mail com o código; "cancelamento/estorno" desativa. (São ~50 linhas a
   mais no worker; a estrutura já está pronta.)
4. **Onboarding que segura o cliente:** vídeo de 5 min (instalar + configurar)
   e uma call de 20 min para montar o playbook juntos no primeiro acesso.
   Assinatura de ferramenta morre por falta de onboarding, não por preço.
5. **Publique na Chrome Web Store** (ver README) — instalar "sem compactação"
   não escala e assusta cliente leigo.

## Fase 3 — Vender em massa (a partir da semana 8)

Canais, na ordem de custo-benefício para você:

1. **O palco do Moveleiro 3X.** Demo ao vivo: abre um WhatsApp com uma
   negociação travada, clica em "Quebrar objeção", a resposta aparece na tela
   do telão. Oferta do evento: primeiro mês por R$ 1 para quem assinar ali.
   Um evento com 300 lojistas + demo ao vivo + oferta de palco é o seu
   lançamento inteiro.
2. **A base do pré-check-in.** Sequência de WhatsApp/e-mail pós-evento para
   quem não assinou: caso real do beta → vídeo de 90s da extensão → oferta.
3. **Conteúdo nichado.** Reels/carrosséis "cliente sumiu depois do orçamento?
   olha o que a IA sugeriu" — a tela da extensão é o criativo. Você já tem a
   máquina de conteúdo (Academia das Redes Sociais) para isso.
4. **Parcerias B2B2C.** Fabricantes de MDF, softwares de projeto (Promob etc.),
   associações lojistas: eles têm a base de lojas, você dá comissão recorrente
   (20–30%) ou white-label com a marca deles. É o caminho para sair de dezenas
   para centenas de assinantes sem mídia paga.
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
| WhatsApp muda o layout e a extração quebra | Seletores centralizados no `content.js`; monitorar grupo de betas; corrigir e republicar (atualização da Web Store propaga sozinha) |
| Termos de uso do WhatsApp | A extensão só lê a tela e nunca envia nada sozinha — mantenha assim; nada de "disparo em massa" no roadmap, é outro produto e outro risco |
| Custo de API estoura a margem | Limite diário por licença no worker + medir custo real no beta antes de fixar preço/modelo |
| LGPD / privacidade | Não armazenar conversas (já é assim); política de privacidade clara; contrato do assinante autorizando o processamento |
| Cliente cancela após onboarding fraco | Call de configuração do playbook no primeiro acesso + check-in no dia 7 |
| Dependência de uma pessoa (você) | Documentar o processo de onboarding e a manutenção dos seletores desde o beta |

## Checklist — próximos 7 dias

- [ ] Instalar a extensão e testar com sua chave da API numa conversa real
- [ ] Ajustar o playbook de exemplo para um cliente real
- [ ] Fazer o deploy do worker e testar o modo assinatura com `LIC-TESTE-123`
- [ ] Listar 20 nomes da base do Moveleiro 3X para convidar ao beta
- [ ] Gravar um vídeo de 90s mostrando a extensão funcionando (esse vídeo recruta os betas)
