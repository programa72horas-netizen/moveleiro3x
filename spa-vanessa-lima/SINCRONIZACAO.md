# Sincronização entre aparelhos (planilha Google)

Por padrão, os dados do app ficam salvos **no aparelho de quem usa**. Com a
sincronização ativada, o celular das clientes e o computador/tablet da
recepção passam a **compartilhar os mesmos dados** (clientes, planos e
agendamentos), usando uma planilha Google gratuita como "banco de dados".

Leva uns 10 minutos e não precisa saber programar — é copiar e colar.

## Passo 1 — Criar a planilha

1. Acesse [sheets.new](https://sheets.new) para criar uma planilha nova
2. Dê um nome, por exemplo **Spa Vanessa Lima — dados do app**

## Passo 2 — Colar o código

1. Na planilha, abra **Extensões → Apps Script**
2. Apague o que estiver no editor e cole o código abaixo
3. Salve (ícone de disquete)

```js
// ====== Spa Vanessa Lima — sincronização do app ======
const ABA = 'dados';

function aba_() {
  const doc = SpreadsheetApp.getActiveSpreadsheet();
  let aba = doc.getSheetByName(ABA);
  if (!aba) {
    aba = doc.insertSheet(ABA);
    aba.appendRow(['id', 'tipo', 'up', 'json']);
  }
  return aba;
}

function doGet() {
  const aba = aba_();
  const linhas = aba.getDataRange().getValues().slice(1);
  const saida = { clientes: [], agendamentos: [] };
  for (const [id, tipo, up, json] of linhas) {
    if (!id) continue;
    try {
      const reg = JSON.parse(json);
      if (tipo === 'cliente') saida.clientes.push(reg);
      if (tipo === 'agendamento') saida.agendamentos.push(reg);
    } catch (e) {}
  }
  return ContentService.createTextOutput(JSON.stringify(saida))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const trava = LockService.getScriptLock();
  trava.waitLock(20000);
  try {
    const corpo = JSON.parse(e.postData.contents);
    const aba = aba_();
    const dados = aba.getDataRange().getValues();
    const posicao = {};
    for (let i = 1; i < dados.length; i++) posicao[dados[i][0]] = i + 1;

    for (const item of (corpo.registros || [])) {
      const reg = item.dados;
      if (!reg || !reg.id) continue;
      const linha = [reg.id, item.tipo, reg.up || 0, JSON.stringify(reg)];
      const pos = posicao[reg.id];
      if (pos) {
        const upAtual = Number(aba.getRange(pos, 3).getValue()) || 0;
        if ((reg.up || 0) >= upAtual) aba.getRange(pos, 1, 1, 4).setValues([linha]);
      } else {
        aba.appendRow(linha);
        posicao[reg.id] = aba.getLastRow();
      }
    }
    return ContentService.createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    trava.releaseLock();
  }
}
```

## Passo 3 — Publicar como app da web

1. No Apps Script, clique em **Implantar → Nova implantação**
2. Tipo: **App da web**
3. Em **Executar como**, escolha **Eu**
4. Em **Quem pode acessar**, escolha **Qualquer pessoa**
5. Clique em **Implantar**, autorize com sua conta Google e **copie a URL**
   (termina com `/exec`)

> "Qualquer pessoa" significa que quem tiver a URL consegue ler/gravar os
> dados do app. A URL é longa e impossível de adivinhar, mas trate-a como
> uma senha: só deixe no app.

## Passo 4 — Colar a URL no app

No arquivo `app.js`, preencha:

```js
SYNC_URL: 'https://script.google.com/macros/s/SUA-URL-AQUI/exec',
```

Publique o app de novo (commit no GitHub) e pronto: todos os aparelhos que
abrirem o app passam a sincronizar automaticamente (ao abrir, a cada minuto
e logo depois de cada alteração).

## Dicas

- Para testar: agende pelo celular e veja a linha aparecer na planilha; abra
  o app no computador e o agendamento estará lá.
- Se mudar a implantação no Apps Script, gere a URL de novo
  (**Implantar → Gerenciar implantações → editar → Nova versão**).
- A planilha é o backup dos dados: não apague a aba `dados`.
