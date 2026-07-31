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
  (novo agendamento feito pela recepção)
- **Ficha da cliente**: frequência nos últimos 30 dias, sessões realizadas,
  **sessões restantes**, últimas sessões, **registrar compra/renovação de
  pacote** e ajuste manual de saldo (+1/−1)
- Cadastro de novas clientes

## Valores cadastrados

| Pacote | Sessões | Valor |
|---|---|---|
| Protocolo Vanessa Lima | 60 sessões | R$ 4.250,00 |
| Bye Celulite | 10 massagens + 10 radiofrequências + 10 mantas | R$ 2.570,00 |
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
  WHATS_COMERCIAL: '555492285445',  // WhatsApp comercial do spa (DDI+DDD+número)
  PIN_EQUIPE: '…',                  // código de acesso da recepção
  HORARIOS: {
    diasSemana: [1, 2, 3, 4, 5, 6],              // 0=dom, 1=seg … 6=sáb
    semana: { primeira: '08:00', ultima: '18:30' }, // seg–sex: 08h às 19h30
    sabado: { primeira: '08:00', ultima: '16:00' }, // sábado: 08h às 17h
    passoMin: 30,                                 // grade de meia em meia hora
    duracaoMin: 60,                               // duração de cada sessão
  },
  CAPACIDADE_POR_HORARIO: 1,        // atendimentos ao mesmo tempo
  FALTA_CONSOME: false,             // falta desconta sessão do pacote?
  SYNC_URL: '',                     // sincronização entre aparelhos (opcional)
};
```

Horário de funcionamento configurado: **segunda a sexta das 08h às 19h30**
(primeira sessão 08h, última 18h30) e **sábado das 08h às 17h** (primeira
08h, última 16h). A grade oferece horários de meia em meia hora e o app
bloqueia automaticamente sobreposição de sessões.

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

## Privacidade

Os dados das clientes ficam no aparelho de quem usa o app (e, se a
sincronização for ativada, na planilha Google **da sua conta**) — nada é
enviado a servidores de terceiros. O código de acesso da equipe é uma
proteção simples, adequada para o dia a dia da recepção, não para dados
sensíveis.
