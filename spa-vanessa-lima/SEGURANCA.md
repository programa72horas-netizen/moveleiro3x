# Segurança do app

Resumo honesto de como o app se protege — e do que ele não protege, por ser
um aplicativo 100% estático (sem servidor próprio).

## Proteções ativas

- **HTTPS obrigatório** — o GitHub Pages serve tudo com criptografia.
- **Content Security Policy (CSP)** — o navegador só executa o script do
  próprio app. Mesmo que algum conteúdo malicioso fosse parar na página,
  código injetado não roda; conexões só são permitidas com o próprio site e
  com o Google (fontes e planilha de sincronização).
- **Código da equipe fora do fonte** — o código de acesso não aparece no
  código público: o app guarda apenas a impressão digital criptográfica
  (SHA-256) e compara na hora do login. Além disso, após **5 tentativas
  erradas o acesso trava por 5 minutos** naquele aparelho.
- **Sincronização com privacidade** — a lista completa de clientes (nomes e
  telefones) só sai da planilha mediante o código da equipe, conferido
  dentro do Google (fora do código público). O celular de uma cliente
  recebe apenas o próprio cadastro; agendamentos trafegam sem dados
  pessoais (ids, datas e procedimentos).
- **Validação de tudo que chega de fora** — registros vindos da
  sincronização são conferidos campo a campo (formato de data, hora,
  status, tamanhos máximos) e todo texto exibido passa por escape de HTML.
  Uma planilha adulterada não consegue injetar código no app.
- **Limites anti-abuso na planilha** — o script Google recusa envios em
  massa (máx. 300 registros por chamada, 20 mil caracteres por registro,
  teto de linhas) e usa trava de concorrência.
- **Service worker restrito** — só faz cache de arquivos do próprio site e
  apenas de respostas válidas.
- **Sem rastreadores** — nenhum dado vai para servidores de terceiros além
  da planilha Google da sua própria conta (se ativada).

## Boas práticas para a equipe

- Use um **código de acesso forte** e não o reutilize em outros serviços.
- Para **trocar o código**: abra o app, aperte F12 (console do navegador) e
  rode `await gerarHashPin('NovoCodigo')`; cole o resultado em
  `PIN_EQUIPE_HASH` no `app.js` e atualize também a `CHAVE_EQUIPE` no Apps
  Script (veja `SINCRONIZACAO.md`).
- Trate a **URL do Apps Script** como senha; se vazar, gere uma nova
  implantação no Google (a antiga para de funcionar) e atualize o app.
- No computador/tablet da recepção, use o bloqueio de tela do aparelho —
  quem tem o aparelho desbloqueado tem o painel aberto.

## Limitações conhecidas (por desenho)

- O login da cliente é **pelo número de WhatsApp, sem senha** — simples de
  usar, adequado ao risco (a cliente só vê os próprios horários). Quem
  souber o número de alguém conseguiria ver os agendamentos dessa pessoa.
- Um app estático roda inteiro no navegador: nenhuma proteção do lado do
  cliente é inviolável. Para dados realmente sensíveis (prontuários,
  pagamentos), o caminho seria um sistema com servidor e login individual.
- Os dados no aparelho ficam no armazenamento do navegador: apagar os dados
  de navegação apaga o que não estiver sincronizado.
