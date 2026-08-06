# Vanessa Lima · Spa & Estética — App de agendamentos

Aplicativo web do **Spa Vanessa Lima** para as clientes agendarem suas sessões
e a recepção acompanhar tudo — com o visual clean e sofisticado da marca
(mármore, dourado e tipografia fina).

O app é 100% estático (HTML + CSS + JavaScript): não precisa de servidor nem
banco de dados, e pode ser hospedado gratuitamente no **GitHub Pages**. É um
PWA — a cliente pode "instalar" na tela inicial do celular.

## Funcionalidades

### Para a cliente
- **Login pelo WhatsApp** — no primeiro acesso ela informa o nome e **qual
  plano/pacote já tem** (ou "ainda não tenho plano")
- **Agendamento** escolhendo o procedimento, o dia (calendário) e o horário
- **Sessões recorrentes**: toda semana no mesmo dia e horário — dá para
  agendar **todas as sessões do pacote de uma vez** (semanas com horário
  ocupado são puladas e compensadas no final)
- **Saldo do plano sempre à vista**: quantas sessões restam de cada pacote
  (o Bye Celulite mostra massagens, radiofrequências e mantas separadas)
- **Lembretes**: aviso **1 dia antes** e **2 horas antes** de cada sessão
  (aviso dentro do app + notificação do navegador). Além disso, dá para
  **adicionar as sessões à agenda do celular** (arquivo .ics) com alarmes de
  1 dia e 2 horas antes — o jeito mais garantido de ser avisada mesmo com o
  app fechado
- **Histórico** de todas as sessões já realizadas
- **Planos & valores**: tabela completa com botão **Comprar/Renovar pelo
  WhatsApp** do comercial do spa
- Cancelamento e remarcação (a sessão cancelada volta para o saldo)

### Para a equipe (recepção)
- Acesso com **código da equipe** (botão "Acesso da equipe" na tela inicial)
- **Painel**: atendimentos de hoje, da semana e clientes ativas
- **Lembretes a enviar**: sessões de hoje e de amanhã com botão que abre o
  WhatsApp da cliente com a mensagem pronta
- **Renovações**: lista automática de clientes com 2 sessões ou menos no plano
- **Agenda do dia** com ✓ concluir, falta e cancelar, além de **encaixe**
  (novo agendamento feito pela recepção, avulso ou **recorrente semanal**)
- **Ficha da cliente**: frequência nos últimos 30 dias, sessões realizadas,
  **sessões restantes**, últimas sessões, **registrar compra/renovação de
  pacote** e ajuste manual de saldo (+1/−1)
- Cadastro de novas clientes

## Pacotes cadastrados

> Os **valores não são exibidos no app** (mudam com frequência — a cliente
> consulta pelo WhatsApp). Para voltar a exibi-los, mude
> `MOSTRAR_PRECOS: true` no `app.js`. A tabela abaixo é só referência
> interna dos preços gravados no código.

| Pacote | Sessões | Valor |
|---|---|---|
| Protocolo Vanessa Lima | 60 sessões | R$ 4.250,00 |
| Bye Celulite | 10 massagens + 10 radiofrequências + 10 mantas | R$ 2.570,00 |
| Protocolo Transforme | 10 radiofrequências + 10 massagens com manta | R$ 1.570,00 |
| Protocolo Recupera | 10 drenagens + 10 estéticas com manta | sob consulta |
| Estética + Drenagem | 20 sessões (10 + 10) | R$ 1.250,00 |
| Radiofrequência | 10 sessões | R$ 800,00 |
| Manta Térmica | 10 sessões | R$ 800,00 |
| Drenagem Linfática | 10 sessões | R$ 850,00 |
| Massagem Estética | 10 sessões | R$ 980,00 |
| Protocolo Relaxante | 10 sessões | R$ 650,00 |

Procedimentos: Massagem Estética, Drenagem Linfática, Massagem Terapêutica,
Massagem Relaxante, Terapia com Pedras Quentes, Radiofrequência e Manta
Térmica. Para mudar qualquer nome ou valor, edite as listas `PROCEDIMENTOS`
e `PACOTES` no início do [`app.js`](app.js).

## Configuração (obrigatório antes de publicar)

Tudo fica no início do arquivo [`app.js`](app.js):

```js
const CONFIG = {
  WHATS_COMERCIAL: '555491431746',  // WhatsApp comercial do spa (DDI+DDD+número)
  PIN_EQUIPE_HASH: '…',             // impressão digital (SHA-256) do código da
                                    // recepção — o código em si não fica no fonte;
                                    // para trocar, veja SEGURANCA.md
  HORARIOS: {
    duracaoMin: 60,   // duração de cada sessão
    vagas: {          // vagas por horário em cada dia (1=seg … 6=sáb)
      1: { '08:00': 3, /* … */ '18:30': 3 },
      // veja a tabela completa no app.js — o número é quantas clientes
      // podem agendar no MESMO horário naquele dia
    },
  },
  FALTA_CONSOME: false,             // falta desconta sessão do pacote?
  SYNC_URL: '',                     // sincronização entre aparelhos (opcional)
};
```

Grade configurada: **08h · 09h15 · 10h30 · 12h · 13h30 · 14h45 · 16h ·
17h15 · 18h30** de segunda a sexta (sábado: 08h–10h30 e 13h30–16h, sem o
horário de 12h). Cada horário tem um número de **vagas simultâneas** por
dia (3 ou 4, conforme a equipe do dia) — o horário só some do app quando
todas as vagas daquele dia/horário estiverem tomadas. No primeiro acesso
a cliente informa nome, **e-mail e data de nascimento**.

## Como publicar (GitHub Pages)

1. No GitHub, abra **Settings → Pages** deste repositório
2. Em **Source**, escolha *Deploy from a branch*, branch principal, pasta `/ (root)`
3. Em alguns minutos o app estará em
   `https://SEU-USUARIO.github.io/NOME-DO-REPO/spa-vanessa-lima/`
4. Divulgue esse link para as clientes (elas podem "Adicionar à tela inicial")

## Sincronização entre aparelhos (recomendado)

Por padrão os dados ficam **no aparelho de quem usa** (localStorage). Para a
recepção enxergar os agendamentos feitos no celular das clientes (e
vice-versa), configure a sincronização gratuita via planilha Google — passo a
passo em [`SINCRONIZACAO.md`](SINCRONIZACAO.md). Com ela ativada, todos os
aparelhos passam a compartilhar clientes, planos e agendamentos.

## Sobre os lembretes (importante)

- O app avisa **1 dia antes** e **2 horas antes**: banner dentro do app e
  notificação do navegador (se a cliente permitir).
- Como o app roda todo no navegador, a notificação dispara quando o app/site
  está aberto ou em segundo plano — por isso o app também oferece o botão
  **"Adicionar à agenda do celular"** (.ics), que cria alarmes nativos de
  1 dia e 2 horas antes, funcionando sempre.
- A recepção tem o painel **"Lembretes a enviar"** com mensagem pronta de
  WhatsApp para cada sessão de hoje e de amanhã — o toque humano que cliente
  de spa adora. 💛

## Estrutura

| Arquivo | Descrição |
|---|---|
| `index.html` | Telas (login, primeiro acesso, app da cliente, admin) |
| `styles.css` | Tema mármore & dourado da marca |
| `app.js` | Lógica, configuração, pacotes e valores |
| `sw.js` | Funcionamento offline (PWA) |
| `manifest.webmanifest` | Instalação na tela inicial |
| `SINCRONIZACAO.md` | Passo a passo da sincronização entre aparelhos |
| `SEGURANCA.md` | Proteções ativas, boas práticas e limitações |

## Privacidade e segurança

Os dados das clientes ficam no aparelho de quem usa o app (e, se a
sincronização for ativada, na planilha Google **da sua conta**) — nada é
enviado a servidores de terceiros. O app usa política de segurança de
conteúdo (CSP), código da equipe protegido por hash com trava de
tentativas, validação de todos os dados sincronizados e sincronização que
só entrega a lista de clientes mediante o código da equipe. Detalhes,
boas práticas e limitações em [`SEGURANCA.md`](SEGURANCA.md).
