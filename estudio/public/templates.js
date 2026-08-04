/*
 * Estúdio 72h · Modelos de layout
 * ------------------------------------------------------------------
 * Cada modelo é um layout FIXO em HTML/CSS (1080×1350). A IA (ou o
 * designer) preenche apenas os "slots" de texto — o desenho em si é
 * garantido por código, por isso toda arte sai idêntica ao modelo.
 *
 * Para criar um modelo novo: copie um objeto do array MODELOS, mude
 * id/nome/slots e escreva o render(). Ele aparece sozinho no app.
 */

'use strict';

/* ---------- utilidades ---------- */

const Fmt = {
  esc(texto) {
    return String(texto ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  },
  // escapa e converte quebras de linha em <br/>
  linhas(texto) {
    return Fmt.esc(texto).replace(/\n/g, '<br/>');
  },
  hex(cor, padrao) {
    return /^#[0-9a-fA-F]{6}$/.test(cor || '') ? cor : padrao;
  },
  // clareia (pct > 0) ou escurece (pct < 0) uma cor hexadecimal
  tom(cor, pct) {
    const n = parseInt(Fmt.hex(cor, '#E3242B').slice(1), 16);
    const canal = (c) => {
      const v = pct >= 0 ? c + (255 - c) * pct : c * (1 + pct);
      return Math.max(0, Math.min(255, Math.round(v)));
    };
    const r = canal(n >> 16), g = canal((n >> 8) & 255), b = canal(n & 255);
    return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
  },
  rgba(cor, alfa) {
    const n = parseInt(Fmt.hex(cor, '#000000').slice(1), 16);
    return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${alfa})`;
  },
  // tamanho de fonte que encolhe conforme o texto cresce: considera a
  // linha mais longa E o total de linhas (contando a quebra automática),
  // para blocos multilinha não estourarem sobre os vizinhos
  tamanhoAuto(texto, base, min, idealPorLinha, maxLinhas = 3) {
    const linhas = String(texto || '').split('\n').map((l) => l.trim()).filter(Boolean);
    if (!linhas.length) return base;
    const maior = Math.max(...linhas.map((l) => l.length));
    const fatorLargura = Math.min(1, idealPorLinha / maior);
    const linhasEfetivas = linhas.reduce(
      (soma, l) => soma + Math.max(1, Math.ceil(l.length / idealPorLinha)), 0);
    const fatorAltura = Math.min(1, maxLinhas / linhasEfetivas);
    return Math.round(Math.max(min, base * Math.min(fatorLargura, fatorAltura)));
  },
};

/* ---------- ícones (SVG embutido, sem dependência externa) ---------- */

const Icones = {
  whatsapp(cor = 'currentColor') {
    return `<svg viewBox="0 0 24 24" fill="${cor}" xmlns="http://www.w3.org/2000/svg"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5.1-1.3A10 10 0 1 0 12 2zm0 18.2c-1.6 0-3.1-.4-4.4-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.6-6.1c-.3-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1-.2.3-.7.8-.8 1-.1.2-.3.2-.6.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4 0-.5.1-.7l.5-.6c.1-.2.1-.4 0-.5l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.2.3-.9.9-.9 2.2s.9 2.5 1.1 2.7c.1.2 1.8 2.8 4.4 3.9.6.3 1.1.4 1.5.5.6.2 1.2.2 1.6.1.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.6-.3z"/></svg>`;
  },
  cadeado(cor = 'currentColor') {
    return `<svg viewBox="0 0 24 24" fill="${cor}" xmlns="http://www.w3.org/2000/svg"><path d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5zm-3 5a3 3 0 1 1 6 0v3H9V7zm3 7a1.8 1.8 0 0 1 1 3.3V19a1 1 0 0 1-2 0v-1.7a1.8 1.8 0 0 1 1-3.3z"/></svg>`;
  },
  relogio(cor = 'currentColor') {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="${cor}" stroke-width="2.2" stroke-linecap="round" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.8 2.8M9 2h6"/></svg>`;
  },
  pino(cor = 'currentColor') {
    return `<svg viewBox="0 0 24 24" fill="${cor}" xmlns="http://www.w3.org/2000/svg"><path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z"/></svg>`;
  },
};

/* ---------- blocos reutilizados pelos modelos ---------- */

// Logotipo: usa a imagem enviada; sem imagem, escreve o nome da marca
// (nomes longos encolhem em vez de vazar da arte)
function blocoLogo(marca, opcoes = {}) {
  const altura = opcoes.altura || 84;
  const tema = opcoes.tema || 'claro'; // cor do texto quando não há imagem
  if (marca.logo) {
    return `<img class="a72-logo-img" style="height:${altura}px" src="${marca.logo}" alt=""/>`;
  }
  const cor = tema === 'claro' ? '#FFFFFF' : '#141414';
  const nome = marca.nome || 'SUA LOJA';
  const tam = Math.round(Math.min(altura * 0.5, 900 / Math.max(1, nome.length * 0.78)));
  return `<div class="a72-logo-texto" style="color:${cor};font-size:${Math.max(20, tam)}px">${Fmt.esc(nome)}</div>`;
}

// Linha de contato (WhatsApp + endereço), usada nos rodapés — encolhe e
// quebra em duas linhas quando o endereço é comprido
function blocoContato(marca, corTexto) {
  const partes = [];
  if (marca.whatsapp) {
    partes.push(`<span class="a72-contato-item"><span class="a72-ico">${Icones.whatsapp(corTexto)}</span>${Fmt.esc(marca.whatsapp)}</span>`);
  }
  if (marca.endereco) {
    partes.push(`<span class="a72-contato-item"><span class="a72-ico">${Icones.pino(corTexto)}</span>${Fmt.esc(marca.endereco)}</span>`);
  }
  if (!partes.length) return '';
  const total = (marca.whatsapp || '').length + (marca.endereco || '').length;
  const tam = total > 68 ? 22 : total > 52 ? 24 : 27;
  return `<div class="a72-contato" style="color:${corTexto};font-size:${tam}px">${partes.join('')}</div>`;
}

// Divide "1.299,90" em parte inteira e centavos para compor o preço grande
function partesPreco(valor) {
  const bruto = String(valor || '').replace(/R\$\s*/i, '').trim();
  const virgula = bruto.lastIndexOf(',');
  if (virgula > -1 && /^\d{2}$/.test(bruto.slice(virgula + 1))) {
    return { inteiro: bruto.slice(0, virgula) || '0', centavos: ',' + bruto.slice(virgula + 1) };
  }
  return { inteiro: bruto || '0', centavos: '' };
}

/* ---------- CSS base compartilhado por todas as artes ---------- */
/* Fica embutido também no PNG exportado — não depende de arquivo externo. */

const ARTE_CSS = `
.a72 { position: relative; width: 1080px; height: 1350px; overflow: hidden;
  font-family: 'Montserrat', 'Helvetica Neue', Arial, sans-serif;
  -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility; }
.a72 * { margin: 0; padding: 0; box-sizing: border-box; }
.a72 img { display: block; }
.a72-abs { position: absolute; }
.a72-col { display: flex; flex-direction: column; align-items: center; }
.a72-logo-img { width: auto; max-width: 460px; object-fit: contain; }
.a72-logo-texto { font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; white-space: nowrap; }
.a72-contato { display: flex; justify-content: center; align-items: center; gap: 28px;
  font-size: 27px; font-weight: 600; letter-spacing: 0.02em;
  flex-wrap: wrap; max-width: 960px; margin: 0 auto; row-gap: 8px; }
.a72-contato-item { display: inline-flex; align-items: center; gap: 12px; white-space: nowrap; }
.a72-ico { display: inline-flex; width: 32px; height: 32px; }
.a72-ico svg { width: 100%; height: 100%; }
.a72-carimbo { display: inline-block; padding: 18px 44px; border: 6px solid currentColor;
  border-radius: 14px; font-weight: 900; letter-spacing: 0.22em; text-transform: uppercase;
  box-shadow: inset 0 0 0 3px currentColor; }
.a72-listra-alerta { background: repeating-linear-gradient(-45deg,
  #FFC400 0 42px, #111111 42px 84px); }
`;

/* ---------- os modelos ---------- */

const MODELOS = [

  /* ============ FASE 1 · MODELO A · COMUNICADO OFICIAL ============ */
  {
    id: 'f1-comunicado',
    fase: 1,
    nome: 'Comunicado Oficial',
    resumo: 'Fundo preto institucional, manchete de jornal e carimbo confidencial.',
    slots: [
      { key: 'kicker', rotulo: 'Barra de notícia', tipo: 'texto', max: 30, exemplo: 'COMUNICADO OFICIAL' },
      { key: 'titulo', rotulo: 'Título principal', tipo: 'texto', max: 64, multilinha: true, exemplo: 'O MAIOR SEGREDO\nDO ANO VAI\nSER REVELADO' },
      { key: 'destaque', rotulo: 'Linha em vermelho', tipo: 'texto', max: 34, exemplo: 'E VOCÊ VERÁ PRIMEIRO' },
      { key: 'subtitulo', rotulo: 'Texto de apoio', tipo: 'texto', max: 110, exemplo: 'Uma condição que nunca apareceu em nossas lojas está prestes a ser liberada.' },
      { key: 'carimbo', rotulo: 'Carimbo', tipo: 'texto', max: 16, exemplo: 'CONFIDENCIAL' },
      { key: 'dataHora', rotulo: 'Data / hora', tipo: 'texto', max: 26, exemplo: 'AMANHÃ · 12H' },
    ],
    render(s, marca) {
      const tamTitulo = Fmt.tamanhoAuto(s.titulo, 100, 60, 13);
      return `
<div class="a72" style="background:
    radial-gradient(90% 60% at 50% 38%, #1B1B22 0%, #0A0A0D 70%, #050507 100%);color:#fff">
  <div class="a72-abs" style="left:0;top:0;right:0;height:76px;background:#17171D;
      display:flex;align-items:center;justify-content:center;gap:22px;
      border-bottom:1px solid #26262E">
    <span style="width:16px;height:16px;border-radius:50%;background:#E3242B;
        box-shadow:0 0 18px ${Fmt.rgba('#E3242B', 0.9)}"></span>
    <span style="font-size:30px;font-weight:700;letter-spacing:.34em;text-transform:uppercase;color:#EDEDF2">${Fmt.esc(s.kicker)}</span>
  </div>

  <div class="a72-abs" style="left:80px;right:80px;top:96px;height:4px;
      background:linear-gradient(90deg,transparent,#2A2A33,transparent)"></div>

  <div class="a72-abs a72-col" style="left:70px;right:70px;top:250px;gap:44px;text-align:center">
    <div style="font-weight:900;text-transform:uppercase;line-height:1.08;
        font-size:${tamTitulo}px;letter-spacing:.01em;color:#FFFFFF;
        text-shadow:0 6px 40px rgba(0,0,0,.65)">${Fmt.linhas(s.titulo)}</div>
    ${s.destaque ? `<div style="font-weight:900;text-transform:uppercase;font-size:52px;
        letter-spacing:.04em;color:#FF3B42">${Fmt.esc(s.destaque)}</div>` : ''}
    <div style="width:120px;height:6px;background:#E3242B"></div>
    ${s.subtitulo ? `<div style="max-width:760px;font-weight:500;font-size:36px;line-height:1.5;
        color:#B9B9C4">${Fmt.linhas(s.subtitulo)}</div>` : ''}
  </div>

  ${s.carimbo ? `<div class="a72-abs" style="right:64px;top:150px;transform:rotate(9deg);
      color:#E3242B;opacity:.92"><span class="a72-carimbo" style="font-size:34px;
      background:${Fmt.rgba('#E3242B', 0.08)}">${Fmt.esc(s.carimbo)}</span></div>` : ''}

  ${s.dataHora ? `<div class="a72-abs a72-col" style="left:0;right:0;top:1010px">
    <div style="background:#E3242B;color:#fff;font-weight:900;font-size:46px;
        letter-spacing:.1em;text-transform:uppercase;padding:24px 64px;border-radius:16px;
        box-shadow:0 18px 50px ${Fmt.rgba('#E3242B', 0.35)}">${Fmt.esc(s.dataHora)}</div>
  </div>` : ''}

  <div class="a72-abs a72-col" style="left:0;right:0;bottom:56px;gap:26px">
    ${blocoLogo(marca, { altura: 80, tema: 'claro' })}
    ${blocoContato(marca, '#8B8B96')}
  </div>
</div>`;
    },
  },

  /* ============ FASE 1 · MODELO B · ACESSO RESTRITO ============ */
  {
    id: 'f1-restrito',
    fase: 1,
    nome: 'Acesso Restrito',
    resumo: 'Foto escurecida com cadeado, clima de informação vazada.',
    slots: [
      { key: 'kicker', rotulo: 'Aviso do topo', tipo: 'texto', max: 30, exemplo: 'ACESSO RESTRITO' },
      { key: 'titulo', rotulo: 'Título principal', tipo: 'texto', max: 56, multilinha: true, exemplo: 'O ACESSO SERÁ\nFECHADO EM BREVE' },
      { key: 'subtitulo', rotulo: 'Texto de apoio', tipo: 'texto', max: 110, exemplo: 'Só quem estiver na lista vai conhecer a condição especial antes de todo mundo.' },
      { key: 'dataHora', rotulo: 'Data / hora', tipo: 'texto', max: 26, exemplo: 'QUINTA · 19H' },
      { key: 'foto', rotulo: 'Foto de fundo (loja/produto)', tipo: 'imagem', opcional: true },
    ],
    render(s, marca) {
      const tamTitulo = Fmt.tamanhoAuto(s.titulo, 88, 52, 14);
      const tamSubtitulo = Fmt.tamanhoAuto(s.subtitulo, 35, 26, 44, 3);
      const tamDataHora = Fmt.tamanhoAuto(s.dataHora, 42, 26, 16, 1);
      const fundo = s.foto
        ? `<img class="a72-abs" style="inset:0;width:100%;height:100%;object-fit:cover;
             filter:grayscale(.45) brightness(.62) contrast(1.05)" src="${s.foto}" alt=""/>`
        : `<div class="a72-abs" style="inset:0;background:
             radial-gradient(80% 55% at 50% 30%, #23232B 0%, #101014 65%, #08080A 100%)"></div>`;
      return `
<div class="a72" style="background:#08080A;color:#fff">
  ${fundo}
  <div class="a72-abs" style="inset:0;background:
      linear-gradient(180deg, rgba(5,5,8,.55) 0%, rgba(5,5,8,.25) 34%,
      rgba(5,5,8,.78) 70%, rgba(5,5,8,.96) 100%)"></div>

  <div class="a72-abs a72-col" style="left:70px;right:70px;top:120px;gap:38px;text-align:center">
    <div style="width:150px;height:150px;border-radius:50%;background:#E3242B;
        display:flex;align-items:center;justify-content:center;
        box-shadow:0 0 0 14px ${Fmt.rgba('#E3242B', 0.18)}, 0 24px 60px rgba(0,0,0,.55)">
      <span style="width:74px;height:74px;display:inline-flex">${Icones.cadeado('#FFFFFF')}</span>
    </div>
    <div style="font-size:30px;font-weight:700;letter-spacing:.4em;text-transform:uppercase;
        color:#FF4B52">${Fmt.esc(s.kicker)}</div>
  </div>

  <div class="a72-abs a72-col" style="left:70px;right:70px;top:490px;gap:38px;text-align:center">
    <div style="font-weight:900;text-transform:uppercase;line-height:1.1;font-size:${tamTitulo}px;
        text-shadow:0 8px 44px rgba(0,0,0,.8)">${Fmt.linhas(s.titulo)}</div>
    <div class="a72-col" style="gap:14px">
      <div style="display:flex;gap:12px">
        ${[190, 120, 150].map((w) => `<span style="width:${w}px;height:34px;background:#1D1D24;border-radius:6px"></span>`).join('')}
      </div>
      <div style="display:flex;gap:12px">
        ${[120, 210, 90].map((w) => `<span style="width:${w}px;height:34px;background:#1D1D24;border-radius:6px"></span>`).join('')}
      </div>
      <div style="margin-top:6px;font-size:24px;font-weight:600;letter-spacing:.24em;
          text-transform:uppercase;color:#6E6E7A">Informação censurada</div>
    </div>
    ${s.subtitulo ? `<div style="max-width:780px;font-weight:500;font-size:${tamSubtitulo}px;line-height:1.5;
        color:#C6C6CF">${Fmt.linhas(s.subtitulo)}</div>` : ''}
    ${s.dataHora ? `<div style="margin-top:10px;border:3px solid rgba(255,255,255,.85);color:#fff;
        font-weight:900;font-size:${tamDataHora}px;letter-spacing:.12em;text-transform:uppercase;
        white-space:nowrap;padding:20px 58px;border-radius:999px;
        background:rgba(10,10,14,.45)">${Fmt.esc(s.dataHora)}</div>` : ''}
  </div>

  <div class="a72-abs a72-col" style="left:0;right:0;bottom:54px;gap:26px">
    ${blocoLogo(marca, { altura: 78, tema: 'claro' })}
    ${blocoContato(marca, '#9A9AA6')}
  </div>
</div>`;
    },
  },

  /* ============ FASE 2 · MODELO A · OFERTA COM PRODUTO ============ */
  {
    id: 'f2-produto',
    fase: 2,
    nome: 'Oferta com Produto',
    resumo: 'Fundo em gradiente da marca, produto flutuando, preço gigante.',
    slots: [
      { key: 'chamada', rotulo: 'Chamada do topo', tipo: 'texto', max: 44, multilinha: true, exemplo: 'MEGA LIQUIDAÇÃO\nDE ANIVERSÁRIO' },
      { key: 'produtoNome', rotulo: 'Nome do produto', tipo: 'texto', max: 46, exemplo: 'SOFÁ RETRÁTIL PREMIUM 2,90M' },
      { key: 'selo', rotulo: 'Selo amarelo', tipo: 'texto', max: 18, exemplo: 'SÓ HOJE' },
      { key: 'precoDe', rotulo: 'Preço antigo (De:)', tipo: 'texto', max: 14, exemplo: '2.499,90' },
      { key: 'preco', rotulo: 'Preço da oferta', tipo: 'texto', max: 12, exemplo: '1.899,90' },
      { key: 'condicoes', rotulo: 'Condições de pagamento', tipo: 'texto', max: 52, exemplo: '10x de R$ 189,99 sem juros no cartão' },
      { key: 'cta', rotulo: 'Chamada de ação', tipo: 'texto', max: 34, exemplo: 'CHAMA NO WHATSAPP E GARANTA' },
      { key: 'produto', rotulo: 'Foto do produto (PNG recortado)', tipo: 'imagem' },
    ],
    render(s, marca) {
      const cor = Fmt.hex(marca.corPrimaria, '#E3242B');
      const amarelo = Fmt.hex(marca.corSecundaria, '#FFC400');
      const tamChamada = Fmt.tamanhoAuto(s.chamada, 78, 52, 17);
      const preco = partesPreco(s.preco);
      const produto = s.produto
        ? `<img style="max-width:820px;max-height:440px;object-fit:contain;
             filter:drop-shadow(0 46px 46px rgba(0,0,0,.45)) saturate(1.06) contrast(1.05)"
             src="${s.produto}" alt=""/>`
        : `<div style="width:700px;height:380px;border:4px dashed rgba(255,255,255,.5);
             border-radius:24px;display:flex;align-items:center;justify-content:center;
             font-size:34px;font-weight:700;color:rgba(255,255,255,.75)">Envie a foto do produto (PNG)</div>`;
      return `
<div class="a72" style="color:#fff;background:
    radial-gradient(85% 62% at 50% 34%, ${Fmt.tom(cor, 0.16)} 0%, ${cor} 46%, ${Fmt.tom(cor, -0.55)} 100%)">
  <div class="a72-abs" style="inset:0;background:
      repeating-conic-gradient(from 0deg at 50% 40%, rgba(255,255,255,.05) 0deg 7deg, transparent 7deg 22deg)"></div>
  <div class="a72-abs" style="inset:0;background:
      linear-gradient(180deg, rgba(0,0,0,.12) 0%, transparent 22%, transparent 62%, rgba(0,0,0,.4) 100%)"></div>

  <div class="a72-abs a72-col" style="left:0;right:0;top:52px;gap:34px">
    <div style="background:rgba(255,255,255,.96);border-radius:20px;padding:20px 46px;
        box-shadow:0 16px 40px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center">
      ${blocoLogo(marca, { altura: 64, tema: 'escuro' })}
    </div>
    <div style="text-align:center;font-weight:900;font-style:italic;text-transform:uppercase;
        line-height:1.06;font-size:${tamChamada}px;letter-spacing:.01em;
        text-shadow:0 10px 34px rgba(0,0,0,.45)">${Fmt.linhas(s.chamada)}</div>
  </div>

  <div class="a72-abs a72-col" style="left:0;right:0;top:392px">
    ${produto}
    <div style="margin-top:-26px;width:640px;height:74px;border-radius:50%;
        background:radial-gradient(50% 50% at 50% 50%, rgba(0,0,0,.5) 0%, transparent 72%)"></div>
  </div>

  ${s.selo ? `<div class="a72-abs" style="left:70px;top:372px;transform:rotate(-10deg)">
    <div style="background:${amarelo};color:#141414;border-radius:50%;width:230px;height:230px;
        display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;
        font-family:'Poppins',sans-serif;font-weight:900;font-size:44px;line-height:1.06;
        text-transform:uppercase;padding:26px;
        box-shadow:0 20px 50px rgba(0,0,0,.4), inset 0 0 0 10px rgba(0,0,0,.12)">${Fmt.esc(s.selo)}</div>
  </div>` : ''}

  <div class="a72-abs" style="left:0;right:0;top:846px;bottom:162px;display:flex;
      flex-direction:column;align-items:center;justify-content:flex-end;gap:8px;text-align:center">
    <div style="font-weight:700;font-size:36px;letter-spacing:.06em;text-transform:uppercase;
        color:rgba(255,255,255,.94)">${Fmt.esc(s.produtoNome)}</div>
    ${s.precoDe ? `<div style="font-weight:600;font-size:33px;color:rgba(255,255,255,.78)">
        de <span style="text-decoration:line-through">R$ ${Fmt.esc(s.precoDe)}</span> por</div>` : ''}
    <div style="display:flex;align-items:baseline;justify-content:center;gap:10px;
        font-family:'Poppins',sans-serif;font-weight:900;
        text-shadow:0 12px 40px rgba(0,0,0,.5)">
      <span style="font-size:58px">R$</span>
      <span style="font-size:${Math.round(150 * Math.min(1, 6 / Math.max(1, preco.inteiro.length)))}px;
          line-height:.95;letter-spacing:-.02em">${Fmt.esc(preco.inteiro)}</span>
      <span style="font-size:58px">${Fmt.esc(preco.centavos)}</span>
    </div>
    ${s.condicoes ? `<div style="margin-top:10px;background:${amarelo};color:#141414;
        font-family:'Poppins',sans-serif;font-weight:800;font-size:36px;padding:18px 50px;
        border-radius:999px;box-shadow:0 16px 40px rgba(0,0,0,.35)">${Fmt.esc(s.condicoes)}</div>` : ''}
  </div>

  <div class="a72-abs" style="left:0;right:0;bottom:0;background:rgba(0,0,0,.55);padding:24px 60px">
    <div class="a72-col" style="gap:12px">
      ${s.cta ? `<div style="font-weight:900;font-style:italic;font-size:38px;text-transform:uppercase;
          letter-spacing:.02em;color:${amarelo}">${Fmt.esc(s.cta)}</div>` : ''}
      ${blocoContato(marca, 'rgba(255,255,255,.92)')}
    </div>
  </div>
</div>`;
    },
  },

  /* ============ FASE 2 · MODELO B · OFERTA PERCENTUAL ============ */
  {
    id: 'f2-percentual',
    fase: 2,
    nome: 'Oferta Percentual',
    resumo: 'Foto de ambiente no topo, painel branco com desconto gigante.',
    slots: [
      { key: 'kicker', rotulo: 'Aviso vermelho', tipo: 'texto', max: 34, exemplo: 'SOMENTE ESTA SEMANA' },
      { key: 'descontoPrefixo', rotulo: 'Palavra antes do número', tipo: 'texto', max: 8, exemplo: 'ATÉ' },
      { key: 'desconto', rotulo: 'Número do desconto', tipo: 'texto', max: 5, exemplo: '30%' },
      { key: 'descontoSufixo', rotulo: 'Palavra depois do número', tipo: 'texto', max: 14, exemplo: 'OFF' },
      { key: 'titulo', rotulo: 'Em quê? (linha preta)', tipo: 'texto', max: 52, exemplo: 'em todos os guarda-roupas da loja' },
      { key: 'condicoes', rotulo: 'Faixa inferior', tipo: 'texto', max: 60, exemplo: 'Em até 12x no cartão · Entrega e montagem grátis' },
      { key: 'cta', rotulo: 'Botão', tipo: 'texto', max: 30, exemplo: 'QUERO APROVEITAR' },
      { key: 'foto', rotulo: 'Foto do ambiente/produto', tipo: 'imagem' },
    ],
    render(s, marca) {
      const cor = Fmt.hex(marca.corPrimaria, '#E3242B');
      const tamKicker = Fmt.tamanhoAuto(s.kicker, 32, 22, 24, 1);
      const tamTitulo = Fmt.tamanhoAuto(s.titulo, 42, 30, 40, 2);
      const tamCta = Fmt.tamanhoAuto(s.cta, 38, 26, 22, 1);
      const foto = s.foto
        ? `<img class="a72-abs" style="inset:0;width:100%;height:100%;object-fit:cover" src="${s.foto}" alt=""/>`
        : `<div class="a72-abs" style="inset:0;background:
             linear-gradient(160deg, #3A3A42 0%, #1C1C22 100%)"></div>
           <div class="a72-abs" style="left:0;right:0;top:44%;text-align:center;font-size:32px;
             font-weight:700;color:rgba(255,255,255,.55)">Envie a foto do ambiente</div>`;
      return `
<div class="a72" style="background:#FFFFFF;color:#17171C">
  <div class="a72-abs" style="left:0;top:0;right:0;height:700px;overflow:hidden">
    ${foto}
    <div class="a72-abs" style="inset:0;background:linear-gradient(180deg, rgba(0,0,0,.24) 0%, transparent 40%)"></div>
    <div class="a72-abs" style="left:52px;top:48px;background:rgba(255,255,255,.96);
        border-radius:16px;padding:16px 30px;box-shadow:0 12px 34px rgba(0,0,0,.3)">
      ${blocoLogo(marca, { altura: 56, tema: 'escuro' })}
    </div>
  </div>

  <div class="a72-abs" style="left:0;right:0;top:612px;height:120px;background:#FFFFFF;
      clip-path:polygon(0 62%, 100% 0, 100% 100%, 0 100%)"></div>
  <div class="a72-abs" style="left:0;right:0;top:598px;height:120px;background:${cor};
      clip-path:polygon(0 74%, 100% 12%, 100% 26%, 0 88%)"></div>

  <div class="a72-abs" style="left:70px;right:70px;top:724px;bottom:172px;display:flex;
      flex-direction:column;align-items:center;justify-content:center;gap:22px;text-align:center">
    <div style="color:${cor};font-weight:800;font-size:${tamKicker}px;letter-spacing:.3em;
        white-space:nowrap;text-transform:uppercase">${Fmt.esc(s.kicker)}</div>
    ${(() => {
      // a linha inteira precisa caber em 940px: os tamanhos encolhem
      // conforme o número e as palavras ao redor crescem
      const lados = (s.descontoPrefixo || '').length + (s.descontoSufixo || '').length;
      const tamNumero = Math.round(216 * Math.min(1, 3.6 / Math.max(1, (s.desconto || '').length)) *
        (lados > 10 ? 0.82 : 1));
      const tamLado = lados > 10 ? 54 : 72;
      return `<div style="display:flex;align-items:baseline;justify-content:center;gap:22px;
        font-family:'Poppins',sans-serif;font-weight:900;color:${cor};text-transform:uppercase">
      ${s.descontoPrefixo ? `<span style="font-size:${tamLado}px">${Fmt.esc(s.descontoPrefixo)}</span>` : ''}
      <span style="font-size:${tamNumero}px;line-height:.88;letter-spacing:-.03em;
          text-shadow:0 18px 44px ${Fmt.rgba(cor, 0.28)}">${Fmt.esc(s.desconto)}</span>
      ${s.descontoSufixo ? `<span style="font-size:${tamLado}px">${Fmt.esc(s.descontoSufixo)}</span>` : ''}
    </div>`;
    })()}
    ${s.titulo ? `<div style="font-weight:800;font-size:${tamTitulo}px;text-transform:uppercase;
        letter-spacing:.01em;color:#17171C;max-width:880px;text-wrap:balance">${Fmt.esc(s.titulo)}</div>` : ''}
    ${s.cta ? `<div style="background:${cor};color:#fff;font-weight:900;
        font-size:${tamCta}px;letter-spacing:.06em;text-transform:uppercase;padding:22px 64px;
        white-space:nowrap;border-radius:999px;
        box-shadow:0 18px 44px ${Fmt.rgba(cor, 0.4)}">${Fmt.esc(s.cta)}</div>` : ''}
  </div>

  <div class="a72-abs" style="left:0;right:0;bottom:0;background:${cor};padding:20px 60px">
    <div class="a72-col" style="gap:8px;color:#fff">
      ${s.condicoes ? `<div style="font-weight:700;font-size:${Fmt.tamanhoAuto(s.condicoes, 31, 24, 48, 1)}px;
          text-align:center">${Fmt.esc(s.condicoes)}</div>` : ''}
      ${blocoContato(marca, 'rgba(255,255,255,.95)')}
    </div>
  </div>
</div>`;
    },
  },

  /* ============ FASE 3 · MODELO A · COMANDO GIGANTE ============ */
  {
    id: 'f3-comando',
    fase: 3,
    nome: 'Comando Gigante',
    resumo: 'Fundo de alerta, frase de comando ocupando metade da arte.',
    slots: [
      { key: 'kicker', rotulo: 'Aviso do topo', tipo: 'texto', max: 34, exemplo: 'O ENCERRAMENTO CHEGOU' },
      { key: 'comando', rotulo: 'Frase de comando', tipo: 'texto', max: 24, multilinha: true, exemplo: 'É HOJE!' },
      { key: 'prazo', rotulo: 'Prazo (amarelo)', tipo: 'texto', max: 22, exemplo: 'ATÉ ÀS 20H' },
      { key: 'subtitulo', rotulo: 'Texto de apoio', tipo: 'texto', max: 90, exemplo: 'Depois disso, os preços da campanha 72 horas voltam ao normal.' },
      { key: 'cta', rotulo: 'Botão', tipo: 'texto', max: 36, exemplo: 'GARANTIR AGORA NO WHATSAPP' },
    ],
    render(s, marca) {
      const cor = Fmt.hex(marca.corPrimaria, '#E3242B');
      const amarelo = Fmt.hex(marca.corSecundaria, '#FFC400');
      const linhasComando = String(s.comando || '').split('\n').filter((l) => l.trim()).length || 1;
      // o bloco do comando nunca passa de ~330px de altura, mesmo com 3 linhas
      const tamComando = Math.min(Fmt.tamanhoAuto(s.comando, 208, 80, 8, 2),
        Math.round(330 / linhasComando));
      const tamPrazo = Fmt.tamanhoAuto(s.prazo, 96, 46, 11, 1);
      const tamSubtitulo = Fmt.tamanhoAuto(s.subtitulo, 37, 27, 44, 2);
      return `
<div class="a72" style="color:#fff;background:
    radial-gradient(120% 86% at 50% 30%, ${Fmt.tom(cor, 0.1)} 0%, ${cor} 52%, ${Fmt.tom(cor, -0.45)} 100%)">
  <div class="a72-abs a72-listra-alerta" style="left:-60px;right:-60px;top:64px;height:58px;
      transform:rotate(-3deg);box-shadow:0 14px 34px rgba(0,0,0,.35)"></div>
  <div class="a72-abs a72-listra-alerta" style="left:-60px;right:-60px;bottom:212px;height:58px;
      transform:rotate(3deg);box-shadow:0 -10px 30px rgba(0,0,0,.3)"></div>

  <div class="a72-abs a72-col" style="left:60px;right:60px;top:196px;gap:8px;text-align:center">
    <div style="background:#141414;color:#fff;font-weight:700;font-size:31px;letter-spacing:.28em;
        text-transform:uppercase;padding:18px 44px;border-radius:999px">${Fmt.esc(s.kicker)}</div>
  </div>

  <div class="a72-abs a72-col" style="left:40px;right:40px;top:330px;gap:34px;text-align:center">
    <div style="font-weight:900;font-style:italic;text-transform:uppercase;line-height:.98;
        font-size:${tamComando}px;letter-spacing:-.01em;
        text-shadow:0 16px 0 rgba(0,0,0,.22), 0 30px 70px rgba(0,0,0,.4)">${Fmt.linhas(s.comando)}</div>
    ${s.prazo ? `<div style="display:flex;align-items:center;justify-content:center;gap:24px;
        font-family:'Poppins',sans-serif;font-weight:900;font-style:italic;font-size:${tamPrazo}px;
        white-space:nowrap;text-transform:uppercase;color:${amarelo};
        text-shadow:0 12px 34px rgba(0,0,0,.45)">
      <span style="width:${Math.round(tamPrazo * 0.88)}px;height:${Math.round(tamPrazo * 0.88)}px;
          display:inline-flex">${Icones.relogio(amarelo)}</span>
      <span>${Fmt.esc(s.prazo)}</span>
    </div>` : ''}
    ${s.subtitulo ? `<div style="max-width:840px;font-weight:600;font-size:${tamSubtitulo}px;line-height:1.45;
        color:rgba(255,255,255,.95)">${Fmt.linhas(s.subtitulo)}</div>` : ''}
  </div>

  <div class="a72-abs a72-col" style="left:0;right:0;top:952px;gap:0">
    <div style="width:0;height:0;border-left:36px solid transparent;border-right:36px solid transparent;
        border-top:44px solid ${amarelo};filter:drop-shadow(0 10px 18px rgba(0,0,0,.35))"></div>
    ${s.cta ? `<div style="margin-top:20px;background:#141414;color:${amarelo};font-weight:900;
        font-size:42px;letter-spacing:.04em;text-transform:uppercase;padding:28px 74px;
        border-radius:999px;box-shadow:0 22px 54px rgba(0,0,0,.45)">${Fmt.esc(s.cta)}</div>` : ''}
  </div>

  <div class="a72-abs a72-col" style="left:0;right:0;bottom:44px;gap:22px">
    ${blocoLogo(marca, { altura: 72, tema: 'claro' })}
    ${blocoContato(marca, 'rgba(255,255,255,.85)')}
  </div>
</div>`;
    },
  },

  /* ============ FASE 3 · MODELO B · ESCASSEZ DE ESTOQUE ============ */
  {
    id: 'f3-escassez',
    fase: 3,
    nome: 'Escassez de Estoque',
    resumo: 'Foto em preto e branco, número gigante de unidades restantes.',
    slots: [
      { key: 'kicker', rotulo: 'Faixa de atenção', tipo: 'texto', max: 24, exemplo: 'ATENÇÃO' },
      { key: 'linha1', rotulo: 'Linha de cima', tipo: 'texto', max: 30, exemplo: 'SÓ RESTAM' },
      { key: 'numero', rotulo: 'Número gigante', tipo: 'texto', max: 4, exemplo: '3' },
      { key: 'linha2', rotulo: 'Linha de baixo', tipo: 'texto', max: 52, multilinha: true, exemplo: 'SOFÁS RETRÁTEIS\nCOM 40% OFF' },
      { key: 'carimbo', rotulo: 'Carimbo vermelho', tipo: 'texto', max: 20, exemplo: 'ÚLTIMAS UNIDADES' },
      { key: 'barraTexto', rotulo: 'Texto da barra de estoque', tipo: 'texto', max: 40, exemplo: 'ESTOQUE QUASE ESGOTADO' },
      { key: 'cta', rotulo: 'Botão', tipo: 'texto', max: 34, exemplo: 'RESERVAR O MEU AGORA' },
      { key: 'foto', rotulo: 'Foto do produto', tipo: 'imagem', opcional: true },
    ],
    render(s, marca) {
      const cor = Fmt.hex(marca.corPrimaria, '#E3242B');
      const amarelo = Fmt.hex(marca.corSecundaria, '#FFC400');
      const tamLinha1 = Fmt.tamanhoAuto(s.linha1, 56, 34, 18, 1);
      const tamLinha2 = Fmt.tamanhoAuto(s.linha2, 74, 44, 17, 3);
      const tamNumero = Math.round(360 * Math.min(1, 2.6 / Math.max(1, (s.numero || '').length)));
      const fundo = s.foto
        ? `<img class="a72-abs" style="inset:0;width:100%;height:100%;object-fit:cover;
             filter:grayscale(1) contrast(1.2) brightness(.5)" src="${s.foto}" alt=""/>`
        : `<div class="a72-abs" style="inset:0;background:
             radial-gradient(85% 60% at 50% 34%, #26262C 0%, #121216 62%, #0A0A0D 100%)"></div>`;
      return `
<div class="a72" style="background:#0A0A0D;color:#fff">
  ${fundo}
  <div class="a72-abs" style="inset:0;background:
      linear-gradient(180deg, rgba(8,8,10,.6) 0%, rgba(8,8,10,.3) 30%,
      rgba(8,8,10,.72) 66%, rgba(8,8,10,.95) 100%)"></div>

  <div class="a72-abs a72-listra-alerta" style="left:-40px;right:-40px;top:0;height:64px"></div>
  <div class="a72-abs a72-col" style="left:0;right:0;top:34px">
    <div style="background:${amarelo};color:#141414;font-weight:900;font-size:34px;
        letter-spacing:.3em;text-transform:uppercase;padding:14px 56px;border-radius:10px;
        box-shadow:0 12px 30px rgba(0,0,0,.5)">${Fmt.esc(s.kicker)}</div>
  </div>

  <div class="a72-abs a72-col" style="left:60px;right:60px;top:196px;gap:2px;text-align:center">
    <div style="font-weight:800;font-size:${tamLinha1}px;letter-spacing:.2em;white-space:nowrap;
        text-transform:uppercase;color:rgba(255,255,255,.96)">${Fmt.esc(s.linha1)}</div>
    <div style="font-family:'Poppins',sans-serif;font-weight:900;font-size:${tamNumero}px;line-height:.92;
        color:${amarelo};letter-spacing:-.02em;
        text-shadow:0 24px 0 rgba(0,0,0,.35), 0 40px 90px rgba(0,0,0,.6)">${Fmt.esc(s.numero)}</div>
    <div style="font-weight:900;font-size:${tamLinha2}px;line-height:1.12;text-transform:uppercase;
        text-shadow:0 8px 40px rgba(0,0,0,.7)">${Fmt.linhas(s.linha2)}</div>
  </div>

  ${s.carimbo ? `<div class="a72-abs" style="right:30px;top:470px;transform:rotate(10deg);
      color:${Fmt.tom(cor, 0.12)}"><span class="a72-carimbo" style="font-size:30px;
      background:${Fmt.rgba(cor, 0.14)}">${Fmt.esc(s.carimbo)}</span></div>` : ''}

  <div class="a72-abs a72-col" style="left:140px;right:140px;top:966px;gap:14px">
    <div style="width:100%;height:34px;border-radius:999px;background:rgba(255,255,255,.16);
        overflow:hidden;box-shadow:inset 0 2px 8px rgba(0,0,0,.5)">
      <div style="width:86%;height:100%;border-radius:999px;background:
          linear-gradient(90deg, ${Fmt.tom(cor, 0.06)}, ${cor})"></div>
    </div>
    ${s.barraTexto ? `<div style="font-weight:700;font-size:28px;letter-spacing:.18em;
        text-transform:uppercase;color:rgba(255,255,255,.88)">${Fmt.esc(s.barraTexto)}</div>` : ''}
  </div>

  <div class="a72-abs a72-col" style="left:0;right:0;top:1078px">
    ${s.cta ? `<div style="background:${amarelo};color:#141414;font-weight:900;font-size:40px;
        letter-spacing:.03em;text-transform:uppercase;padding:22px 64px;border-radius:999px;
        box-shadow:0 20px 50px rgba(0,0,0,.55)">${Fmt.esc(s.cta)}</div>` : ''}
  </div>

  <div class="a72-abs a72-col" style="left:0;right:0;bottom:34px;gap:16px">
    ${blocoLogo(marca, { altura: 62, tema: 'claro' })}
    ${blocoContato(marca, 'rgba(255,255,255,.75)')}
  </div>
</div>`;
    },
  },
];

/* ---------- API pública ---------- */

const Modelos = {
  lista: MODELOS,
  css: ARTE_CSS,
  porId(id) {
    return MODELOS.find((m) => m.id === id) || null;
  },
  fases: {
    1: { nome: 'Fase 1 · Curiosidade', resumo: 'Antecipação, mistério e comunicados oficiais.' },
    2: { nome: 'Fase 2 · Oferta', resumo: 'Venda explosiva: produto herói, preço e condições.' },
    3: { nome: 'Fase 3 · Urgência', resumo: 'Últimas horas: comandos curtos, prazo e escassez.' },
  },
  // valores de exemplo de um modelo (usados na galeria e no modo manual)
  exemplos(modelo) {
    const valores = {};
    for (const slot of modelo.slots) {
      valores[slot.key] = slot.tipo === 'imagem' ? null : slot.exemplo || '';
    }
    return valores;
  },
  // apenas os slots de texto (a IA nunca escolhe imagens)
  slotsDeTexto(modelo) {
    return modelo.slots.filter((s) => s.tipo !== 'imagem');
  },
};

// exporta para o app (navegador) e para testes (Node)
if (typeof module !== 'undefined' && module.exports) module.exports = { Modelos, Fmt };
