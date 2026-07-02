# Moveleiro 3X · Pré-check-in digital

Aplicativo web de pré-check-in para o evento **Moveleiro 3X**. O participante
se cadastra antes do evento, recebe um **ingresso digital com QR Code** e, na
portaria, a equipe faz a leitura do código em segundos — sem fila e sem papel.

O app é 100% estático (HTML + CSS + JavaScript): não precisa de servidor nem
banco de dados, e pode ser hospedado gratuitamente no **GitHub Pages**.

## Funcionalidades

### Para o participante
- **Pré-check-in** com nome, e-mail, WhatsApp, empresa, cargo e cidade
- **Ingresso digital com QR Code**, salvo no próprio celular
- **Download do ingresso em PNG** para guardar na galeria
- **Compartilhamento** do pré-check-in pelo WhatsApp
- Cadastro de **várias pessoas no mesmo aparelho** (colegas de equipe)

### Para a equipe do evento (portaria)
- **Leitor de QR Code pela câmera** do celular ou tablet
- Leitura de QR Code **a partir de uma foto** (se a câmera falhar)
- **Alerta de ingresso já utilizado** (evita entrada duplicada)
- **Check-in manual** para quem chegar sem pré-cadastro
- **Lista de check-ins** com busca por nome, empresa ou código
- **Exportação para CSV** (abre direto no Excel)
- **Apagar registros** (útil para limpar os testes antes do dia do evento)
- **Painel em tempo real**: total de check-ins, ritmo da última hora,
  meta de público e gráfico de check-ins por hora

## Como publicar (GitHub Pages)

1. No GitHub, abra **Settings → Pages** deste repositório
2. Em **Source**, escolha *Deploy from a branch*
3. Selecione a branch principal e a pasta `/ (root)` e salve
4. Em alguns minutos o app estará no ar em `https://SEU-USUARIO.github.io/ARS/`

> A câmera do leitor de QR Code só funciona em endereços **https** — o
> GitHub Pages já fornece isso automaticamente.

## Como usar no dia do evento

1. Divulgue o link do app para os participantes fazerem o pré-check-in
2. Na portaria, abra o link em um celular/tablet e toque em **Equipe**
3. Digite o código de acesso (veja abaixo) e toque em **Ligar câmera**
4. Aponte para o QR Code de cada participante — o app confirma na hora
5. Ao final, exporte a lista de presença em **Check-ins → Exportar CSV**

## Configuração

Toda a configuração fica no início do arquivo [`app.js`](app.js):

```js
const CONFIG = {
  EVENTO: {
    nome: 'Moveleiro 3X',
    dataTexto: '28 de julho de 2026',
    localTexto: 'Majestic Palace Hotel · Florianópolis/SC',
  },
  PIN_EQUIPE: '3X2026',  // ⚠️ troque este código antes do evento!
  META_PUBLICO: 300,     // meta usada no painel de estatísticas
};
```

## Como funciona (e limitações)

- O QR Code do participante **carrega os próprios dados do cadastro**, por
  isso a portaria consegue ler o ingresso sem precisar de internet nem de um
  banco de dados central.
- Os check-ins ficam salvos **no aparelho da portaria** (localStorage) e podem
  ser exportados em CSV a qualquer momento.
- Se houver **mais de um ponto de entrada**, cada aparelho terá sua própria
  lista — exporte o CSV de cada um e junte as planilhas no final.
- O código de acesso da equipe é uma proteção simples (o app roda todo no
  navegador). Para um controle de acesso robusto ou uma lista central de
  pré-cadastrados em tempo real, o próximo passo seria conectar o app a um
  backend (ex.: Firebase ou Supabase).

## Estrutura do projeto

| Arquivo | Descrição |
|---|---|
| `index.html` | Estrutura das telas (cadastro, ingresso, portaria, painel) |
| `styles.css` | Tema escuro do evento |
| `app.js` | Lógica do app e configuração do evento |
| `assets/qrcode.js` | Geração de QR Code ([qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator), MIT) |
| `assets/html5-qrcode.min.js` | Leitura de QR Code pela câmera ([html5-qrcode](https://github.com/mebjas/html5-qrcode), Apache-2.0) |

As bibliotecas estão salvas no repositório (sem CDN), então o app continua
funcionando mesmo com internet instável no local do evento.

## Privacidade (LGPD)

O cadastro pede consentimento explícito do participante. Os dados ficam
apenas no aparelho de quem se cadastrou e, após a leitura na portaria, no
aparelho da equipe — nada é enviado a servidores de terceiros.
