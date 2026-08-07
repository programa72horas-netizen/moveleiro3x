# Sincronização entre aparelhos (planilha Google)

Por padrão, os dados do app ficam salvos **no aparelho de quem usa**. Com a
sincronização ativada, o celular das clientes e o computador/tablet da
recepção passam a **compartilhar os mesmos dados** (clientes, planos e
agendamentos), usando uma planilha Google gratuita como "banco de dados".

Leva uns 10 minutos e não precisa saber programar — é copiar e colar.

**Como a privacidade é protegida:** a lista completa de clientes (nomes e
telefones) só é entregue a quem apresentar o **código de acesso da equipe**,
conferido dentro do Google (fora do código público do app). O celular de uma
cliente recebe apenas o cadastro dela. Os agendamentos trafegam sem dados
pessoais — só códigos internos, datas e procedimentos.

## Passo 1 — Criar a planilha

1. Acesse [sheets.new](https://sheets.new) para criar uma planilha nova
2. Dê um nome, por exemplo **Spa Vanessa Lima — dados do app**

## Passo 2 — Colar o código

1. Na planilha, abra **Extensões → Apps Script**
2. Apague o que estiver no editor e cole o código abaixo
3. **Troque `TROQUE-AQUI` pelo código da recepção e `TROQUE-MASSO` pelo
   código das massoterapeutas usados no app**
4. Salve (ícone de disquete)

```js
// ====== Spa Vanessa Lima — sincronização do app (v3) ======
const ABA = 'dados';

// ⚠️ O MESMO código de acesso da recepção usado no app.
// É ele que libera a lista completa de clientes.
const CHAVE_EQUIPE = 'TROQUE-AQUI';

// ⚠️ O MESMO código das massoterapeutas usado no app.
// Libera apenas os NOMES das clientes (sem telefone, e-mail ou planos).
const CHAVE_MASSO = 'TROQUE-MASSO';

// limites anti-abuso
const MAX_REGISTROS_POR_ENVIO = 300;
const MAX_TAMANHO_REGISTRO = 20000; // caracteres por registro
const MAX_LINHAS = 50000;           // teto de linhas na planilha

function aba_() {
  const doc = SpreadsheetApp.getActiveSpreadsheet();
  let aba = doc.getSheetByName(ABA);
  if (!aba) {
    aba = doc.insertSheet(ABA);
    aba.appendRow(['id', 'tipo', 'up', 'json']);
  }
  return aba;
}

function resposta_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  const chave = (e && e.parameter && e.parameter.chave) || '';
  const whats = String((e && e.parameter && e.parameter.whats) || '').replace(/\D/g, '');
  const equipe = chave !== '' && chave === CHAVE_EQUIPE;
  const masso = chave !== '' && chave === CHAVE_MASSO;

  const linhas = aba_().getDataRange().getValues().slice(1);
  const saida = { clientes: [], agendamentos: [] };
  for (const [id, tipo, up, json] of linhas) {
    if (!id) continue;
    try {
      const reg = JSON.parse(json);
      if (tipo === 'agendamento') saida.agendamentos.push(reg);
      if (tipo === 'cliente') {
        // tudo para a recepção; só id + nome para as massoterapeutas;
        // só o próprio cadastro para a cliente
        if (equipe) saida.clientes.push(reg);
        else if (masso) saida.clientes.push({ id: reg.id, nome: reg.nome, up: reg.up });
        else if (whats && reg.whats === whats) saida.clientes.push(reg);
      }
    } catch (err) {}
  }
  return resposta_(saida);
}

function doPost(e) {
  const trava = LockService.getScriptLock();
  trava.waitLock(20000);
  try {
    const corpo = JSON.parse(e.postData.contents);
    const aba = aba_();
    if (aba.getLastRow() > MAX_LINHAS) return resposta_({ ok: false, erro: 'cheio' });

    const dados = aba.getDataRange().getValues();
    const posicao = {};
    for (let i = 1; i < dados.length; i++) posicao[dados[i][0]] = i + 1;

    const registros = (corpo.registros || []).slice(0, MAX_REGISTROS_POR_ENVIO);
    for (const item of registros) {
      const reg = item.dados;
      if (!reg || !reg.id) continue;
      const json = JSON.stringify(reg);
      if (json.length > MAX_TAMANHO_REGISTRO) continue;
      const linha = [reg.id, item.tipo, reg.up || 0, json];
      const pos = posicao[reg.id];
      if (pos) {
        const upAtual = Number(aba.getRange(pos, 3).getValue()) || 0;
        if ((reg.up || 0) >= upAtual) aba.getRange(pos, 1, 1, 4).setValues([linha]);
      } else {
        aba.appendRow(linha);
        posicao[reg.id] = aba.getLastRow();
      }
    }
    return resposta_({ ok: true });
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

> "Qualquer pessoa" aqui significa que o app consegue gravar e ler sem
> login Google — mas a lista de clientes continua protegida pela
> `CHAVE_EQUIPE`, conferida dentro do script.

## Passo 4 — Colar a URL no app

No arquivo `app.js`, preencha:

```js
SYNC_URL: 'https://script.google.com/macros/s/SUA-URL-AQUI/exec',
```

Publique o app de novo (commit no GitHub) e pronto: todos os aparelhos que
abrirem o app passam a sincronizar automaticamente (ao abrir, a cada minuto
e logo depois de cada alteração). A recepção entra com o código da equipe e
o app passa a usar esse código também para liberar os dados na sincronização.

## Dicas

- Para testar: agende pelo celular e veja a linha aparecer na planilha; abra
  o app no computador, entre como equipe e o agendamento estará lá.
- Se trocar o código de acesso da equipe no app, troque também a
  `CHAVE_EQUIPE` no Apps Script (e gere **Nova versão** da implantação).
- Se mudar o código do Apps Script, publique de novo
  (**Implantar → Gerenciar implantações → editar → Nova versão**).
- A planilha é o backup dos dados: não apague a aba `dados`.
