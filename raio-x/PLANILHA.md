# Receber os resultados do Raio-X na planilha

A página do Raio-X já envia cada resposta para a **mesma planilha do
pré-check-in**. Sem mexer em nada, as respostas caem na aba *Pré-check-ins*
com nome, WhatsApp, loja e cargo (a coluna "Como soube" mostra
`Raio-X do Lucro`).

Para receber também o **faturamento, a nota geral, o nível e a nota de cada
pilar** numa aba própria chamada **Raio-X**, atualize o robô da planilha —
leva 2 minutos e **a URL não muda**:

## Passo a passo

1. Abra a planilha `Moveleiro 3X` → **Extensões → Apps Script**
2. **Substitua todo o código** pelo abaixo (ele continua atendendo o
   pré-check-in e a portaria normalmente):

```javascript
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const p = e.parameter;
    const planilha = SpreadsheetApp.getActiveSpreadsheet();

    // ---------- Raio-X do Lucro ----------
    if (p.tipo === 'raiox') {
      let aba = planilha.getSheetByName('Raio-X');
      if (!aba) aba = planilha.insertSheet('Raio-X');
      if (aba.getLastRow() === 0) {
        aba.appendRow(['Data/hora', 'Nome', 'WhatsApp', 'Loja/Fábrica', 'Cargo',
          'Faturamento', 'Nota geral', 'Nível', 'Pilar mais fraco',
          'Vendas %', 'Margem %', 'Entrega %', 'Gestão %', 'UTM']);
      }
      aba.appendRow([p.quando || new Date(), p.nome, p.tel, p.empresa, p.cargo,
        p.faturamento, p.score_geral, p.nivel, p.pilar_fraco,
        p.score_vendas, p.score_margem, p.score_entrega, p.score_gestao, p.utm]);
      return ContentService.createTextOutput(JSON.stringify({ ok: true }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // ---------- Pré-check-in e portaria (igual antes) ----------
    const nomeAba = p.tipo === 'checkin' ? 'Check-ins' : 'Pré-check-ins';
    let aba = planilha.getSheetByName(nomeAba);
    if (!aba) aba = planilha.insertSheet(nomeAba);
    if (aba.getLastRow() === 0) {
      aba.appendRow(p.tipo === 'checkin'
        ? ['Data/hora', 'Código', 'Nome', 'E-mail', 'Telefone', 'Empresa', 'Cargo', 'Cidade', 'Origem']
        : ['Data/hora', 'Código', 'Nome', 'E-mail', 'Telefone', 'Empresa', 'Cargo', 'Cidade', 'Como soube']);
    }
    aba.appendRow(p.tipo === 'checkin'
      ? [p.quando || new Date(), p.id, p.nome, p.email, p.tel, p.empresa, p.cargo, p.cidade, p.origem]
      : [p.quando || new Date(), p.id, p.nome, p.email, p.tel, p.empresa, p.cargo, p.cidade, p.fonte]);
    return ContentService.createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}
```

3. Salve (💾) e clique em **Implantar → Gerenciar implantações**
4. Clique no ✏️ (editar) da implantação existente
5. Em **Versão**, escolha **Nova versão** → **Implantar**

> ⚠️ Use **Gerenciar implantações → Nova versão** (e não "Nova implantação"),
> assim a URL continua a mesma e nada precisa mudar no site.

## Como testar

Abra a página do Raio-X, responda as 8 perguntas com dados de teste e
confira a aba **Raio-X** da planilha — a linha aparece em segundos.
Depois é só apagar as linhas de teste.

## O que fazer com esses dados no evento

- **Filtre por "Pilar mais fraco"** e prepare os atendimentos/mentorias
  já sabendo a dor de cada participante.
- **Cruze com a lista de pré-check-in** pelo WhatsApp para saber quem
  respondeu e quem ainda não (e cobrar no grupo).
- **Ordene por faturamento** para identificar os leads de maior potencial.
