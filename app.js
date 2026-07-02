/* ==========================================================================
   Moveleiro 3X · Pré-check-in
   App 100% client-side: funciona hospedado em qualquer site estático
   (GitHub Pages, Netlify…) e continua operando sem internet depois de aberto.
   ========================================================================== */

/* ------------------------- Configuração do evento ------------------------ */
const CONFIG = {
  EVENTO: {
    nome: 'Moveleiro 3X',
    dataTexto: '28 de julho de 2026',
    localTexto: 'Majestic Palace Hotel · Florianópolis/SC',
  },
  // Código de acesso da área da equipe (portaria). Troque antes do evento!
  PIN_EQUIPE: '3X2026',
  // Meta de público usada no painel de estatísticas
  META_PUBLICO: 300,
  // Prefixo que identifica os QR Codes deste evento
  QR_PREFIXO: 'MVX1|',
};

/* ------------------------------ Utilidades ------------------------------- */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.hidden = true; }, 2600);
}

function fmtHora(ts) {
  return new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function fmtDataHora(ts) {
  return new Date(ts).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

// ID legível tipo MVX-7K3F9Q (sem caracteres ambíguos: 0/O, 1/I/L)
function gerarId() {
  const abc = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  let s = '';
  for (const b of bytes) s += abc[b % abc.length];
  return 'MVX-' + s;
}

function beep(tipo) {
  try {
    const ctx = beep._ctx || (beep._ctx = new (window.AudioContext || window.webkitAudioContext)());
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = tipo === 'ok' ? 880 : tipo === 'dup' ? 520 : 220;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.start(); osc.stop(ctx.currentTime + 0.25);
  } catch (_) { /* áudio é opcional */ }
}

/* ------------------------------ Armazenamento ---------------------------- */
const store = {
  get(chave, padrao) {
    try { return JSON.parse(localStorage.getItem(chave)) ?? padrao; }
    catch (_) { return padrao; }
  },
  set(chave, valor) { localStorage.setItem(chave, JSON.stringify(valor)); },
};

const KEY_TICKETS = 'mvx3x_tickets';   // ingressos gerados neste aparelho
const KEY_CHECKINS = 'mvx3x_checkins'; // check-ins registrados neste aparelho (portaria)

function meusTickets() { return store.get(KEY_TICKETS, []); }
function salvarTicket(t) {
  const lista = meusTickets();
  lista.unshift(t);
  store.set(KEY_TICKETS, lista);
}

function checkins() { return store.get(KEY_CHECKINS, {}); }
function salvarCheckin(c) {
  const todos = checkins();
  todos[c.id] = c;
  store.set(KEY_CHECKINS, todos);
}

/* ------------------------------- QR Code --------------------------------- */
// qrcode-generator usa latin-1 por padrão; nomes com acento precisam de UTF-8
if (typeof qrcode !== 'undefined') {
  qrcode.stringToBytes = (s) => Array.from(new TextEncoder().encode(s));
}

function payloadDoTicket(t) {
  return CONFIG.QR_PREFIXO + JSON.stringify({
    id: t.id, n: t.nome, e: t.email, p: t.tel,
    c: t.empresa, g: t.cargo, ci: t.cidade,
  });
}

function parsePayload(texto) {
  if (typeof texto !== 'string' || !texto.startsWith(CONFIG.QR_PREFIXO)) return null;
  try {
    const d = JSON.parse(texto.slice(CONFIG.QR_PREFIXO.length));
    if (!d.id || !d.n) return null;
    return {
      id: String(d.id), nome: String(d.n), email: String(d.e || ''),
      tel: String(d.p || ''), empresa: String(d.c || ''),
      cargo: String(d.g || ''), cidade: String(d.ci || ''),
    };
  } catch (_) { return null; }
}

function criarQr(texto) {
  const qr = qrcode(0, 'M'); // tipo automático, correção de erro M
  qr.addData(texto, 'Byte');
  qr.make();
  return qr;
}

/* -------------------------------- Router --------------------------------- */
const views = ['home', 'cadastro', 'ingresso', 'meus-ingressos', 'pin', 'equipe'];

function mostrarView(nome) {
  views.forEach((v) => { $('#view-' + v).hidden = v !== nome; });
  if (nome !== 'equipe') pararScanner();
  window.scrollTo({ top: 0 });
}

function rota() {
  const hash = location.hash.replace(/^#/, '') || '/';
  const [, base, param] = hash.match(/^\/([^/]*)\/?(.*)$/) || [];

  switch (base) {
    case '':
      renderHome();
      mostrarView('home');
      break;
    case 'cadastro':
      $('#form-cadastro').reset();
      mostrarView('cadastro');
      break;
    case 'ingresso': {
      const t = meusTickets().find((x) => x.id === param);
      if (!t) { location.hash = '#/'; return; }
      renderIngresso(t, false);
      mostrarView('ingresso');
      break;
    }
    case 'meus-ingressos':
      renderMeusIngressos();
      mostrarView('meus-ingressos');
      break;
    case 'equipe':
      if (sessionStorage.getItem('mvx3x_staff') === 'ok') {
        renderEquipe();
        mostrarView('equipe');
      } else {
        $('#f-pin').value = '';
        $('#pin-error').hidden = true;
        mostrarView('pin');
      }
      break;
    default:
      location.hash = '#/';
  }
}

window.addEventListener('hashchange', rota);

/* --------------------------------- Home ---------------------------------- */
function renderHome() {
  const { dataTexto, localTexto } = CONFIG.EVENTO;
  const info = [dataTexto, localTexto].filter(Boolean).join(' · ');
  $('#home-event-info').textContent = info || 'Data e local em breve';
  $('#btn-my-tickets').hidden = meusTickets().length === 0;
}

/* ------------------------------- Cadastro -------------------------------- */
// Máscara simples de telefone brasileiro: (00) 00000-0000
function mascaraTel(input) {
  input.addEventListener('input', () => {
    const d = input.value.replace(/\D/g, '').slice(0, 11);
    let v = d;
    if (d.length > 2) v = `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length > 7) v = `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
    input.value = v;
  });
}
mascaraTel($('#f-tel'));
mascaraTel($('#m-tel'));

function marcarErro(id, temErro) {
  const campo = $('#' + id);
  const msg = document.querySelector(`[data-error-for="${id}"]`);
  if (campo.type !== 'checkbox') campo.classList.toggle('invalid', temErro);
  if (msg) msg.hidden = !temErro;
  return temErro;
}

$('#form-cadastro').addEventListener('submit', (ev) => {
  ev.preventDefault();

  const nome = $('#f-nome').value.trim();
  const email = $('#f-email').value.trim();
  const tel = $('#f-tel').value.trim();

  let invalido = false;
  invalido = marcarErro('f-nome', nome.length < 5 || !nome.includes(' ')) || invalido;
  invalido = marcarErro('f-email', !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) || invalido;
  invalido = marcarErro('f-tel', tel.replace(/\D/g, '').length < 10) || invalido;
  invalido = marcarErro('f-lgpd', !$('#f-lgpd').checked) || invalido;
  if (invalido) return;

  const ticket = {
    id: gerarId(),
    nome, email, tel,
    empresa: $('#f-empresa').value.trim(),
    cargo: $('#f-cargo').value.trim(),
    cidade: $('#f-cidade').value.trim(),
    fonte: $('#f-fonte').value,
    criadoEm: Date.now(),
  };
  salvarTicket(ticket);
  renderIngresso(ticket, true);
  mostrarView('ingresso');
  history.replaceState(null, '', '#/ingresso/' + ticket.id);
});

/* ------------------------------- Ingresso -------------------------------- */
let ticketAtual = null;

function renderIngresso(t, recemCriado) {
  ticketAtual = t;
  $('#ingresso-success').hidden = !recemCriado;
  const infoEvento = [CONFIG.EVENTO.dataTexto, CONFIG.EVENTO.localTexto].filter(Boolean).join(' · ');
  $('#ticket-event').textContent = infoEvento;
  $('#ticket-event').hidden = !infoEvento;
  $('#ticket-id').textContent = t.id;
  $('#ticket-name').textContent = t.nome;
  const meta = [t.empresa, t.cargo, t.cidade].filter(Boolean).join(' · ');
  $('#ticket-meta').textContent = meta || ' ';

  const qr = criarQr(payloadDoTicket(t));
  $('#ticket-qr').innerHTML = qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
}

$('#btn-download-ticket').addEventListener('click', () => {
  if (!ticketAtual) return;
  const url = desenharTicketPng(ticketAtual);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ingresso-moveleiro3x-${ticketAtual.id}.png`;
  a.click();
});

$('#btn-share-ticket').addEventListener('click', async () => {
  if (!ticketAtual) return;
  const texto = `Fiz meu pré-check-in no ${CONFIG.EVENTO.nome}! ` +
    `Meu código de acesso é ${ticketAtual.id}. Faça o seu também: ${location.origin}${location.pathname}`;
  if (navigator.share) {
    try { await navigator.share({ title: CONFIG.EVENTO.nome, text: texto }); } catch (_) {}
  } else {
    await navigator.clipboard.writeText(texto);
    toast('Texto copiado! Cole no WhatsApp para compartilhar.');
  }
});

// Desenha o ingresso completo (marca + QR + dados) num canvas e retorna PNG
function desenharTicketPng(t) {
  const W = 720, H = 980;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#0b0b0b';
  ctx.font = '700 34px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('MOVELEIRO 3X', 48, 76);

  ctx.fillStyle = '#eda100';
  ctx.font = '700 22px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('PRÉ-CHECK-IN', W - 48, 76);

  const infoEvento = [CONFIG.EVENTO.dataTexto, CONFIG.EVENTO.localTexto].filter(Boolean).join(' · ');
  if (infoEvento) {
    ctx.fillStyle = '#52514e';
    ctx.font = '400 22px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(infoEvento, W / 2, 118, W - 96);
  }

  const qr = criarQr(payloadDoTicket(t));
  const n = qr.getModuleCount();
  const qrSize = 480;
  const cell = qrSize / n;
  const qx = (W - qrSize) / 2, qy = 150;
  ctx.fillStyle = '#0b0b0b';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.isDark(r, c)) {
        ctx.fillRect(qx + c * cell, qy + r * cell, Math.ceil(cell), Math.ceil(cell));
      }
    }
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = '#52514e';
  ctx.font = '700 26px system-ui, sans-serif';
  ctx.fillText(t.id, W / 2, qy + qrSize + 58);

  ctx.strokeStyle = '#d8d6cd';
  ctx.setLineDash([8, 8]);
  ctx.beginPath();
  ctx.moveTo(48, qy + qrSize + 88);
  ctx.lineTo(W - 48, qy + qrSize + 88);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = '#0b0b0b';
  ctx.font = '700 36px system-ui, sans-serif';
  ctx.fillText(t.nome, W / 2, qy + qrSize + 148, W - 96);

  const meta = [t.empresa, t.cargo, t.cidade].filter(Boolean).join(' · ');
  if (meta) {
    ctx.fillStyle = '#52514e';
    ctx.font = '400 24px system-ui, sans-serif';
    ctx.fillText(meta, W / 2, qy + qrSize + 190, W - 96);
  }

  ctx.fillStyle = '#898781';
  ctx.font = '400 22px system-ui, sans-serif';
  ctx.fillText('Apresente este QR Code na entrada do evento.', W / 2, H - 60);

  return cv.toDataURL('image/png');
}

/* ---------------------------- Meus ingressos ----------------------------- */
function renderMeusIngressos() {
  const lista = meusTickets();
  const el = $('#my-tickets-list');
  if (lista.length === 0) {
    el.innerHTML = '<p class="empty-note">Nenhum ingresso neste aparelho ainda.</p>';
    return;
  }
  el.innerHTML = lista.map((t) => `
    <div class="row">
      <a class="row-main" href="#/ingresso/${esc(t.id)}" style="text-decoration:none;color:inherit">
        <div class="row-title">${esc(t.nome)}</div>
        <div class="row-sub">${esc([t.empresa, t.cidade].filter(Boolean).join(' · ') || t.email)}</div>
      </a>
      <div class="row-side">
        <span class="badge badge-qr">${esc(t.id)}</span>
        <button class="btn-x" data-del="${esc(t.id)}" title="Remover ingresso deste aparelho" aria-label="Remover ingresso ${esc(t.id)}">×</button>
      </div>
    </div>
  `).join('');

  el.querySelectorAll('[data-del]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!confirm('Remover este ingresso deste aparelho? (O QR Code baixado continua valendo.)')) return;
      store.set(KEY_TICKETS, meusTickets().filter((x) => x.id !== btn.dataset.del));
      renderMeusIngressos();
    });
  });
}

/* ----------------------------- Equipe: PIN ------------------------------- */
$('#form-pin').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const pin = $('#f-pin').value.trim();
  if (pin === CONFIG.PIN_EQUIPE) {
    sessionStorage.setItem('mvx3x_staff', 'ok');
    renderEquipe();
    mostrarView('equipe');
  } else {
    $('#pin-error').hidden = false;
  }
});

/* --------------------------- Equipe: navegação --------------------------- */
$$('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    $$('.tab').forEach((t) => t.classList.toggle('is-active', t === tab));
    const alvo = tab.dataset.tab;
    $('#pane-scanner').hidden = alvo !== 'scanner';
    $('#pane-lista').hidden = alvo !== 'lista';
    $('#pane-stats').hidden = alvo !== 'stats';
    if (alvo !== 'scanner') pararScanner();
    if (alvo === 'lista') renderLista();
    if (alvo === 'stats') renderStats();
  });
});

function renderEquipe() {
  renderLista();
  renderStats();
}

/* ------------------------------- Scanner --------------------------------- */
let scanner = null;
let scannerAtivo = false;
let processando = false;
let ultimoTexto = '';
let ultimoTextoEm = 0;

async function iniciarScanner() {
  if (scannerAtivo) return;
  try {
    scanner = scanner || new Html5Qrcode('qr-reader');
    await scanner.start(
      { facingMode: 'environment' },
      {
        fps: 10,
        qrbox: (w, h) => {
          const lado = Math.min(280, Math.floor(Math.min(w, h) * 0.8));
          return { width: lado, height: lado };
        },
      },
      onQrLido,
      () => {} // erros de frame são normais durante a leitura
    );
    scannerAtivo = true;
    $('#btn-start-scan').hidden = true;
    $('#btn-stop-scan').hidden = false;
  } catch (e) {
    toast('Não foi possível acessar a câmera. Verifique a permissão do navegador.');
  }
}

async function pararScanner() {
  if (!scannerAtivo || !scanner) return;
  try { await scanner.stop(); } catch (_) {}
  scannerAtivo = false;
  $('#btn-start-scan').hidden = false;
  $('#btn-stop-scan').hidden = true;
}

$('#btn-start-scan').addEventListener('click', iniciarScanner);
$('#btn-stop-scan').addEventListener('click', pararScanner);

$('#file-scan').addEventListener('change', async (ev) => {
  const arquivo = ev.target.files[0];
  ev.target.value = '';
  if (!arquivo) return;
  const estavaAtivo = scannerAtivo;
  await pararScanner();
  try {
    scanner = scanner || new Html5Qrcode('qr-reader');
    const texto = await scanner.scanFile(arquivo, false);
    onQrLido(texto);
  } catch (_) {
    toast('Nenhum QR Code encontrado na imagem.');
  }
  if (estavaAtivo) iniciarScanner();
});

function onQrLido(texto) {
  const agora = Date.now();
  if (processando) return;
  // evita reprocessar o mesmo QR que continua na frente da câmera
  if (texto === ultimoTexto && agora - ultimoTextoEm < 5000) return;
  ultimoTexto = texto;
  ultimoTextoEm = agora;
  processando = true;

  const dados = parsePayload(texto);
  if (!dados) {
    beep('bad');
    mostrarResultado('bad', 'QR Code não reconhecido', `
      <p>Este código não é um ingresso do ${esc(CONFIG.EVENTO.nome)}.</p>
    `);
    return;
  }

  const existente = checkins()[dados.id];
  if (existente) {
    beep('dup');
    mostrarResultado('dup', '⚠ Ingresso já utilizado', `
      <p class="who">${esc(existente.nome)}</p>
      <p>Check-in já registrado às <strong>${esc(fmtDataHora(existente.checkinEm))}</strong>.</p>
      <p>Código: ${esc(dados.id)}</p>
    `);
    return;
  }

  const registro = { ...dados, checkinEm: agora, origem: 'qr' };
  salvarCheckin(registro);
  beep('ok');
  mostrarResultado('ok', '✓ Check-in confirmado', `
    <p class="who">${esc(registro.nome)}</p>
    <p>${esc([registro.empresa, registro.cidade].filter(Boolean).join(' · '))}</p>
    <p>Código ${esc(registro.id)} · ${esc(fmtHora(agora))}</p>
  `);
  renderLista();
  renderStats();
}

function mostrarResultado(tipo, titulo, corpoHtml) {
  const box = $('#scan-result');
  box.className = 'scan-result ' + tipo;
  box.hidden = false;
  $('#scan-result-status').textContent = titulo;
  $('#scan-result-body').innerHTML = corpoHtml;
  $('#scan-result-actions').innerHTML =
    '<button class="btn btn-primary" id="btn-next-scan">Ler próximo</button>';
  $('#btn-next-scan').addEventListener('click', liberarScanner);
  clearTimeout(mostrarResultado._t);
  mostrarResultado._t = setTimeout(liberarScanner, 4000);
}

function liberarScanner() {
  processando = false;
  $('#scan-result').hidden = true;
}

/* ----------------------- Lista de check-ins / CSV ------------------------ */
function listaCheckinsOrdenada() {
  return Object.values(checkins()).sort((a, b) => b.checkinEm - a.checkinEm);
}

function renderLista() {
  const busca = $('#list-search').value.trim().toLowerCase();
  const todos = listaCheckinsOrdenada();
  const filtrados = busca
    ? todos.filter((c) =>
        [c.nome, c.empresa, c.id, c.cidade].join(' ').toLowerCase().includes(busca))
    : todos;

  $('#list-empty').hidden = todos.length > 0;
  $('#checkin-list').innerHTML = filtrados.map((c) => `
    <div class="row">
      <div class="row-main">
        <div class="row-title">${esc(c.nome)}</div>
        <div class="row-sub">${esc([c.empresa, c.cidade].filter(Boolean).join(' · ') || c.id)}</div>
      </div>
      <div class="row-side">
        <div class="row-time">${esc(fmtHora(c.checkinEm))}</div>
        <span class="badge ${c.origem === 'qr' ? 'badge-qr' : 'badge-manual'}">
          ${c.origem === 'qr' ? 'QR CODE' : 'PORTARIA'}
        </span>
      </div>
    </div>
  `).join('');
}

$('#list-search').addEventListener('input', renderLista);

$('#btn-export-csv').addEventListener('click', () => {
  const linhas = listaCheckinsOrdenada();
  if (linhas.length === 0) { toast('Nenhum check-in para exportar.'); return; }

  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const cabecalho = ['Código', 'Nome', 'E-mail', 'Telefone', 'Empresa', 'Cargo', 'Cidade', 'Origem', 'Check-in em'];
  const csv = '\uFEFF' + [ // BOM para o Excel abrir acentos corretamente
    cabecalho.join(';'),
    ...linhas.map((c) => [
      q(c.id), q(c.nome), q(c.email), q(c.tel), q(c.empresa), q(c.cargo), q(c.cidade),
      q(c.origem === 'qr' ? 'QR Code' : 'Portaria'),
      q(new Date(c.checkinEm).toLocaleString('pt-BR')),
    ].join(';')),
  ].join('\r\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'checkins-moveleiro3x.csv';
  a.click();
  URL.revokeObjectURL(a.href);
});

$('#btn-clear-all').addEventListener('click', () => {
  const total = listaCheckinsOrdenada().length;
  if (total === 0) { toast('Não há registros para apagar.'); return; }
  if (!confirm(`Apagar TODOS os ${total} check-in(s) deste aparelho? Essa ação não pode ser desfeita.`)) return;
  if (!confirm('Tem certeza? Se precisar da lista, exporte o CSV antes.')) return;
  store.set(KEY_CHECKINS, {});
  renderLista();
  renderStats();
  toast('Todos os registros foram apagados.');
});

/* --------------------------- Check-in manual ----------------------------- */
$('#btn-manual-add').addEventListener('click', () => {
  $('#form-manual').hidden = false;
  $('#m-nome').focus();
});
$('#btn-manual-cancel').addEventListener('click', () => {
  $('#form-manual').hidden = true;
  $('#form-manual').reset();
});

$('#form-manual').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const nome = $('#m-nome').value.trim();
  if (nome.length < 3) { toast('Informe o nome do participante.'); return; }

  salvarCheckin({
    id: gerarId(),
    nome,
    email: $('#m-email').value.trim(),
    tel: $('#m-tel').value.trim(),
    empresa: $('#m-empresa').value.trim(),
    cargo: '', cidade: '',
    checkinEm: Date.now(),
    origem: 'manual',
  });

  $('#form-manual').reset();
  $('#form-manual').hidden = true;
  toast(`Check-in de ${nome} registrado.`);
  renderLista();
  renderStats();
});

/* ------------------------- Painel de estatísticas ------------------------ */
function renderStats() {
  const todos = listaCheckinsOrdenada();
  const total = todos.length;
  const agora = Date.now();
  const ultimaHora = todos.filter((c) => agora - c.checkinEm <= 3600e3).length;
  const viaQr = todos.filter((c) => c.origem === 'qr').length;
  const naPorta = total - viaQr;

  // Tiles: rótulo em caixa de frase, valor em semibold (figuras proporcionais)
  $('#stat-tiles').innerHTML = `
    <div class="tile tile-hero">
      <p class="tile-label">Check-ins realizados</p>
      <p class="tile-value">${total.toLocaleString('pt-BR')}</p>
    </div>
    <div class="tile">
      <p class="tile-label">Na última hora</p>
      <p class="tile-value">${ultimaHora.toLocaleString('pt-BR')}</p>
    </div>
    <div class="tile">
      <p class="tile-label">Com pré-check-in</p>
      <p class="tile-value">${viaQr.toLocaleString('pt-BR')}</p>
    </div>
    <div class="tile">
      <p class="tile-label">Cadastros na porta</p>
      <p class="tile-value">${naPorta.toLocaleString('pt-BR')}</p>
    </div>
  `;

  // Medidor da meta (preenchimento âmbar sobre trilho da mesma rampa)
  const meta = CONFIG.META_PUBLICO;
  const pct = meta > 0 ? Math.min(100, Math.round((total / meta) * 100)) : 0;
  $('#meter-value').textContent = `${total.toLocaleString('pt-BR')} / ${meta.toLocaleString('pt-BR')}`;
  $('#meter-pct').textContent = pct + '%';
  $('#meter-fill').style.width = pct + '%';

  renderHourly(todos);
}

function renderHourly(todos) {
  const chart = $('#hourly-chart');
  const eixo = $('.hourly-x');
  if (eixo) eixo.remove();

  const hoje = new Date().toDateString();
  const doDia = todos.filter((c) => new Date(c.checkinEm).toDateString() === hoje);

  $('#hourly-empty').hidden = doDia.length > 0;
  if (doDia.length === 0) { chart.innerHTML = ''; return; }

  const porHora = new Map();
  for (const c of doDia) {
    const h = new Date(c.checkinEm).getHours();
    porHora.set(h, (porHora.get(h) || 0) + 1);
  }
  const horas = Array.from(porHora.keys());
  const hMin = Math.min(...horas);
  const hMax = Math.max(...horas);

  const barras = [];
  for (let h = hMin; h <= hMax; h++) {
    barras.push({ hora: h, qtd: porHora.get(h) || 0 });
  }

  const maior = Math.max(...barras.map((b) => b.qtd));
  const poucos = barras.length <= 8;

  chart.innerHTML = barras.map((b) => {
    const alturaPct = maior > 0 ? Math.round((b.qtd / maior) * 100) : 0;
    // Rótulos seletivos: todos quando há poucas colunas; senão só o pico
    const rotulo = (poucos || b.qtd === maior) && b.qtd > 0
      ? `<span class="hourly-cap">${b.qtd}</span>` : '';
    return `
      <div class="hourly-col" data-hora="${b.hora}" data-qtd="${b.qtd}">
        ${rotulo}
        <div class="hourly-bar" style="height:${Math.max(alturaPct, b.qtd > 0 ? 4 : 1)}%"></div>
      </div>
    `;
  }).join('');

  const eixoNovo = document.createElement('div');
  eixoNovo.className = 'hourly-x';
  eixoNovo.innerHTML = barras.map((b) => `<span>${b.hora}h</span>`).join('');
  chart.after(eixoNovo);

  // Tooltip por coluna (camada de hover)
  const tooltip = $('#chart-tooltip');
  chart.querySelectorAll('.hourly-col').forEach((col) => {
    col.addEventListener('mouseenter', () => {
      tooltip.textContent = `${col.dataset.hora}h — ${col.dataset.qtd} check-in(s)`;
      tooltip.hidden = false;
    });
    col.addEventListener('mousemove', (ev) => {
      tooltip.style.left = Math.min(ev.clientX + 12, window.innerWidth - 160) + 'px';
      tooltip.style.top = (ev.clientY - 36) + 'px';
    });
    col.addEventListener('mouseleave', () => { tooltip.hidden = true; });
  });
}

/* -------------------------------- Início --------------------------------- */
// Se algum arquivo do app não carregou, avisa em vez de mostrar página em branco
(function verificarArquivos() {
  const faltando = [];
  if (typeof qrcode === 'undefined') faltando.push('qrcode.js');
  if (typeof Html5Qrcode === 'undefined') faltando.push('html5-qrcode.min.js');
  if (faltando.length) {
    const aviso = document.createElement('div');
    aviso.style.cssText =
      'background:#d03b3b;color:#fff;padding:12px 16px;text-align:center;font-size:14px';
    aviso.textContent =
      'Atenção: arquivo(s) não carregado(s): ' + faltando.join(', ') +
      '. Verifique se TODOS os arquivos do aplicativo foram publicados juntos.';
    document.body.prepend(aviso);
  }
})();

rota();
