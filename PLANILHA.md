# Receber os pré-check-ins numa planilha Google

Com esta configuração, **cada pré-check-in cai na sua planilha na hora**, com
nome, e-mail, telefone, empresa, cargo, cidade e como soube do evento. Os
check-ins feitos na portaria também entram, numa aba separada — assim você tem
a lista de presença centralizada mesmo usando vários celulares na entrada.

Leva uns 5 minutos e é tudo de graça.

## Parte 1 — Criar a planilha e o robô que grava nela

1. Acesse [sheets.google.com](https://sheets.google.com) com sua conta Google
   e crie uma **planilha em branco**. Dê o nome de `Moveleiro 3X`.
2. No menu da planilha, clique em **Extensões → Apps Script**.
3. Vai abrir uma tela de código. **Apague tudo** que estiver lá e cole o
   código abaixo:

```javascript
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const p = e.parameter;
    const planilha = SpreadsheetApp.getActiveSpreadsheet();
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

4. Clique no ícone de **disquete** (Salvar projeto).
5. Clique no botão azul **Implantar → Nova implantação**.
6. Clique na engrenagem ⚙ ao lado de "Selecionar tipo" e escolha **App da Web**.
7. Preencha:
   - **Executar como:** Eu (seu e-mail)
   - **Quem pode acessar:** **Qualquer pessoa**
8. Clique em **Implantar**. O Google vai pedir autorização:
   - **Autorizar acesso** → escolha sua conta
   - Se aparecer "O Google não verificou este app": clique em **Avançado →
     Acessar … (não seguro)** → **Permitir** (é o seu próprio código, é seguro)
9. Copie a **URL do app da Web** — ela termina com `/exec`.

## Parte 2 — Colar a URL no aplicativo

1. No GitHub, abra o arquivo `app.js` do seu repositório
2. Clique no **lápis** (Edit) no canto superior direito do arquivo
3. Perto do topo, ache a linha:
   ```js
   PLANILHA_URL: '',
   ```
4. Cole a URL entre as aspas:
   ```js
   PLANILHA_URL: 'https://script.google.com/macros/s/SEU_CODIGO/exec',
   ```
5. Clique em **Commit changes**. Em ~2 minutos o site atualiza.

## Como testar

Abra o app, faça um pré-check-in de teste e olhe a planilha: a linha aparece
em segundos na aba **Pré-check-ins**. Depois apague as linhas de teste
normalmente, como em qualquer planilha.

## Bom saber

- A planilha pode ser **baixada em Excel** a qualquer momento
  (Arquivo → Fazer download → Microsoft Excel).
- Se o participante estiver **sem internet** na hora do cadastro, o ingresso
  sai normalmente e o envio fica numa fila que tenta de novo quando a conexão
  volta naquele aparelho.
- A URL do robô fica visível no código do site, então alguém mal-intencionado
  poderia inserir linhas falsas na planilha. Para um evento é um risco baixo —
  e na portaria vale sempre o QR Code, não a planilha.
- Se refizer a implantação no Apps Script, o Google gera uma URL nova —
  lembre-se de atualizá-la no `app.js`.
