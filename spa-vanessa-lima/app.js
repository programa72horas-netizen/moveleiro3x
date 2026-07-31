/* ============================================================
   Vanessa Lima · Spa & Estética — app de agendamentos
   100% estático (HTML + CSS + JS) · dados no aparelho
   Sincronização opcional entre aparelhos: veja SINCRONIZACAO.md
   ============================================================ */

'use strict';

/* ------------------------------------------------------------
   CONFIGURAÇÃO — edite aqui antes de publicar
   ------------------------------------------------------------ */
const CONFIG = {
  // ⚠️ WhatsApp comercial do spa, com DDI + DDD (só números)
  WHATS_COMERCIAL: '5548999999999',

  // ⚠️ Código de acesso da equipe/recepção — troque antes de publicar!
  PIN_EQUIPE: 'VL2026',

  // Funcionamento do spa
  HORARIOS: {
    diasSemana: [1, 2, 3, 4, 5, 6],  // 0=dom, 1=seg … 6=sáb
    abre: 8,                          // primeira sessão às 8h
    fecha: 19,                        // última sessão começa às 18h
    duracaoMin: 60,                   // duração de cada sessão
  },
  CAPACIDADE_POR_HORARIO: 1,          // atendimentos simultâneos

  // Falta (não compareceu) desconta sessão do pacote?
  FALTA_CONSOME: false,

  // URL do Apps Script para sincronizar entre aparelhos (SINCRONIZACAO.md)
  SYNC_URL: '',
};

/* ------------------------------------------------------------
   Procedimentos e pacotes
   ------------------------------------------------------------ */
const PROCEDIMENTOS = [
  { id: 'estetica',        nome: 'Massagem Estética',            cat: 'massagem' },
  { id: 'drenagem',        nome: 'Drenagem Linfática',           cat: 'massagem' },
  { id: 'terapeutica',     nome: 'Massagem Terapêutica',         cat: 'massagem' },
  { id: 'relaxante',       nome: 'Massagem Relaxante',           cat: 'massagem' },
  { id: 'pedras',          nome: 'Terapia com Pedras Quentes',   cat: 'massagem' },
  { id: 'radiofrequencia', nome: 'Radiofrequência',              cat: 'aparelho' },
  { id: 'manta',           nome: 'Manta Térmica',                cat: 'aparelho' },
];

const PACOTES = [
  {
    id: 'pvl', nome: 'Protocolo Vanessa Lima', preco: 4250,
    desc: '60 sessões · o protocolo completo do spa',
    pools: [{ label: 'Sessões', procs: 'todos', qtd: 60 }],
  },
  {
    id: 'bye', nome: 'Bye Celulite', preco: 2570,
    desc: '10 massagens + 10 radiofrequências + 10 mantas térmicas',
    pools: [
      { label: 'Massagens',        procs: ['estetica', 'drenagem', 'terapeutica', 'relaxante', 'pedras'], qtd: 10 },
      { label: 'Radiofrequências', procs: ['radiofrequencia'], qtd: 10 },
      { label: 'Mantas térmicas',  procs: ['manta'], qtd: 10 },
    ],
  },
  {
    id: 'drenagem10', nome: 'Drenagem Linfática', preco: 850,
    desc: '10 sessões de drenagem linfática',
    pools: [{ label: 'Sessões', procs: ['drenagem'], qtd: 10 }],
  },
  {
    id: 'estetica10', nome: 'Massagem Estética', preco: 980,
    desc: '10 sessões de massagem estética',
    pools: [{ label: 'Sessões', procs: ['estetica'], qtd: 10 }],
  },
  {
    id: 'relax10', nome: 'Protocolo Relaxante', preco: 650,
    desc: '10 sessões · relaxante ou pedras quentes',
    pools: [{ label: 'Sessões', procs: ['relaxante', 'pedras'], qtd: 10 }],
  },
];

/* ------------------------------------------------------------
   Utilidades
   ------------------------------------------------------------ */
const $  = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const DIAS_LONGO  = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const DIAS_CURTO  = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const MESES_LONGO = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const MESES_CURTO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
function agora() { return Date.now(); }

function dataISO(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function deISO(iso, hora) {
  const [a, m, d] = iso.split('-').map(Number);
  const [h, min] = (hora || '00:00').split(':').map(Number);
  return new Date(a, m - 1, d, h, min);
}
function hojeISO() { return dataISO(new Date()); }
function amanhaISO() { const d = new Date(); d.setDate(d.getDate() + 1); return dataISO(d); }

function fmtDataLonga(iso) {
  const d = deISO(iso);
  return DIAS_LONGO[d.getDay()] + ', ' + d.getDate() + ' de ' + MESES_LONGO[d.getMonth()];
}
function fmtDataCurta(iso) {
  const d = deISO(iso);
  return DIAS_CURTO[d.getDay()] + ' · ' + String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0');
}
function moeda(v) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function normWhats(str) {
  let d = String(str || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.length === 10 || d.length === 11) d = '55' + d;   // sem DDI → Brasil
  return d;
}
function fmtWhats(d) {
  const s = String(d || '').replace(/^55/, '');
  if (s.length === 11) return '(' + s.slice(0, 2) + ') ' + s.slice(2, 7) + '-' + s.slice(7);
  if (s.length === 10) return '(' + s.slice(0, 2) + ') ' + s.slice(2, 6) + '-' + s.slice(6);
  return s;
}
function primeiroNome(nome) { return String(nome || '').trim().split(/\s+/)[0] || ''; }
function iniciais(nome) {
  const p = String(nome || '').trim().split(/\s+/);
  return ((p[0] || ' ')[0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
}
function procPorId(id) { return PROCEDIMENTOS.find((p) => p.id === id); }
function nomeProc(id) { const p = procPorId(id); return p ? p.nome : id; }
function pacotePorId(id) { return PACOTES.find((p) => p.id === id); }

function linkZap(numero, msg) {
  return 'https://wa.me/' + numero + '?text=' + encodeURIComponent(msg);
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('mostrar');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => t.classList.remove('mostrar'), 3200);
}

/* ------------------------------------------------------------
   Banco de dados local + sincronização opcional
   ------------------------------------------------------------ */
const CHAVE_DB = 'vl_db_v1';
const CHAVE_SESSAO = 'vl_sessao_v1';
const CHAVE_LEMBRETES = 'vl_lembretes_v1';
const CHAVE_BANNERS = 'vl_banners_v1';
const CHAVE_OUTBOX = 'vl_outbox_v1';

let DB = { clientes: [], agendamentos: [] };

function carregarDB() {
  try {
    const bruto = localStorage.getItem(CHAVE_DB);
    if (bruto) {
      const d = JSON.parse(bruto);
      DB.clientes = Array.isArray(d.clientes) ? d.clientes : [];
      DB.agendamentos = Array.isArray(d.agendamentos) ? d.agendamentos : [];
    }
  } catch (e) { /* dados corrompidos → recomeça vazio */ }
}
function salvarDB() {
  localStorage.setItem(CHAVE_DB, JSON.stringify(DB));
}

function lerJSON(chave, padrao) {
  try { return JSON.parse(localStorage.getItem(chave)) || padrao; } catch (e) { return padrao; }
}
function gravarJSON(chave, valor) { localStorage.setItem(chave, JSON.stringify(valor)); }

function clientePorId(id) { return DB.clientes.find((c) => c.id === id); }
function clientePorWhats(w) { return DB.clientes.find((c) => !c.removido && c.whats === w); }

function salvarCliente(c) {
  c.up = agora();
  const i = DB.clientes.findIndex((x) => x.id === c.id);
  if (i >= 0) DB.clientes[i] = c; else DB.clientes.push(c);
  salvarDB();
  enfileirar('cliente', c);
}
function salvarAgendamento(a) {
  a.up = agora();
  const i = DB.agendamentos.findIndex((x) => x.id === a.id);
  if (i >= 0) DB.agendamentos[i] = a; else DB.agendamentos.push(a);
  salvarDB();
  enfileirar('agendamento', a);
}

/* --- sincronização (opcional, via Google Apps Script) --- */
let sincronizando = false;

function enfileirar(tipo, registro) {
  if (!CONFIG.SYNC_URL) return;
  const fila = lerJSON(CHAVE_OUTBOX, []);
  fila.push({ tipo, dados: registro });
  gravarJSON(CHAVE_OUTBOX, fila);
  clearTimeout(enfileirar._timer);
  enfileirar._timer = setTimeout(sincronizar, 1500);
}

async function sincronizar() {
  if (!CONFIG.SYNC_URL || sincronizando || !navigator.onLine) return;
  sincronizando = true;
  try {
    const fila = lerJSON(CHAVE_OUTBOX, []);
    if (fila.length) {
      // text/plain evita o preflight de CORS no Apps Script
      const r = await fetch(CONFIG.SYNC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ registros: fila }),
      });
      if (r.ok) {
        const atual = lerJSON(CHAVE_OUTBOX, []);
        gravarJSON(CHAVE_OUTBOX, atual.slice(fila.length));
      }
    }
    const resp = await fetch(CONFIG.SYNC_URL + '?t=' + agora());
    if (resp.ok) {
      const remoto = await resp.json();
      let mudou = false;
      mudou = mesclar(DB.clientes, remoto.clientes) || mudou;
      mudou = mesclar(DB.agendamentos, remoto.agendamentos) || mudou;
      if (mudou) { salvarDB(); renderizarTudo(); }
    }
  } catch (e) { /* sem rede ou URL indisponível — tenta de novo depois */ }
  sincronizando = false;
}

function mesclar(locais, remotos) {
  if (!Array.isArray(remotos)) return false;
  let mudou = false;
  for (const r of remotos) {
    if (!r || !r.id) continue;
    const i = locais.findIndex((l) => l.id === r.id);
    if (i < 0) { locais.push(r); mudou = true; }
    else if ((r.up || 0) > (locais[i].up || 0)) { locais[i] = r; mudou = true; }
  }
  return mudou;
}

/* ------------------------------------------------------------
   Motor de créditos (sessões restantes por pacote)
   ------------------------------------------------------------ */
function agsDoCliente(id) {
  return DB.agendamentos.filter((a) => a.clienteId === id);
}

/**
 * Situação de cada "bolsa" de sessões dos planos ativos da cliente.
 * usadas   = sessões concluídas (e faltas, se FALTA_CONSOME)
 * reservadas = sessões futuras já agendadas
 * restantes  = o que ainda dá para agendar
 */
function poolsDoCliente(cli) {
  const ags = agsDoCliente(cli.id);
  const saida = [];
  for (const plano of (cli.planos || [])) {
    if (plano.removido) continue;
    plano.pools.forEach((pool, ix) => {
      const doPool = ags.filter((a) => a.planoId === plano.id && a.poolIx === ix);
      const usadas = doPool.filter((a) => a.status === 'concluida' || (CONFIG.FALTA_CONSOME && a.status === 'falta')).length;
      const reservadas = doPool.filter((a) => a.status === 'agendada').length;
      const total = pool.qtd + (pool.ajuste || 0);
      saida.push({
        plano, pool, poolIx: ix,
        chave: plano.id + ':' + ix,
        nomePacote: plano.nome, label: pool.label,
        total, usadas, reservadas,
        restantes: Math.max(0, total - usadas - reservadas),
      });
    });
  }
  return saida;
}

function poolCobre(pool, procId) {
  return pool.procs === 'todos' || pool.procs.includes(procId);
}

/** Escolhe a bolsa que cobre um procedimento (específicas antes das "todos", plano mais antigo primeiro). */
function coberturaParaProc(cli, procId, tally) {
  tally = tally || {};
  const candidatos = poolsDoCliente(cli)
    .filter((p) => poolCobre(p.pool, procId))
    .filter((p) => p.restantes - (tally[p.chave] || 0) > 0)
    .sort((a, b) => {
      const espA = a.pool.procs === 'todos' ? 1 : 0;
      const espB = b.pool.procs === 'todos' ? 1 : 0;
      if (espA !== espB) return espA - espB;
      return (a.plano.compradoEm || 0) - (b.plano.compradoEm || 0);
    });
  return candidatos[0] || null;
}

function restantesParaProc(cli, procId) {
  return poolsDoCliente(cli)
    .filter((p) => poolCobre(p.pool, procId))
    .reduce((s, p) => s + p.restantes, 0);
}

function restantesTotais(cli) {
  return poolsDoCliente(cli).reduce((s, p) => s + p.restantes, 0);
}

function criarPlano(pacoteId, origem) {
  const pac = pacotePorId(pacoteId);
  return {
    id: uid(),
    pacoteId: pac.id,
    nome: pac.nome,
    pools: pac.pools.map((p) => ({ label: p.label, procs: p.procs, qtd: p.qtd, ajuste: 0 })),
    compradoEm: agora(),
    origem: origem || 'cliente',
  };
}

/* ------------------------------------------------------------
   Agenda: horários e conflitos
   ------------------------------------------------------------ */
function horariosDoDia() {
  const hs = [];
  for (let h = CONFIG.HORARIOS.abre; h < CONFIG.HORARIOS.fecha; h++) {
    hs.push(String(h).padStart(2, '0') + ':00');
  }
  return hs;
}

function ocupacoes(dataStr, hora) {
  return DB.agendamentos.filter(
    (a) => a.data === dataStr && a.hora === hora && (a.status === 'agendada' || a.status === 'concluida')
  ).length;
}
function horarioLivre(dataStr, hora) {
  return ocupacoes(dataStr, hora) < CONFIG.CAPACIDADE_POR_HORARIO;
}
function diaAberto(d) {
  return CONFIG.HORARIOS.diasSemana.includes(d.getDay());
}

/** Datas semanais para uma série; semanas com horário ocupado são puladas e compensadas no fim. */
function gerarDatasSerie(inicioISO, hora, qtd) {
  const datas = [];
  const puladas = [];
  let d = deISO(inicioISO);
  let guarda = 0;
  while (datas.length < qtd && guarda < qtd + 60) {
    const ds = dataISO(d);
    if (horarioLivre(ds, hora)) datas.push(ds);
    else puladas.push(ds);
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7);
    guarda++;
  }
  return { datas, puladas };
}

/* ------------------------------------------------------------
   Sessão do aparelho (quem está logado)
   ------------------------------------------------------------ */
let SESSAO = lerJSON(CHAVE_SESSAO, null);

function definirSessao(s) {
  SESSAO = s;
  if (s) gravarJSON(CHAVE_SESSAO, s); else localStorage.removeItem(CHAVE_SESSAO);
}
function clienteLogado() {
  return SESSAO && SESSAO.clienteId ? clientePorId(SESSAO.clienteId) : null;
}

/* ------------------------------------------------------------
   Telas e navegação
   ------------------------------------------------------------ */
function mostrarTela(id) {
  $$('.tela').forEach((t) => t.classList.toggle('ativa', t.id === id));
  window.scrollTo(0, 0);
}

let vistaAtual = 'inicio';
function irPara(vista) {
  vistaAtual = vista;
  $$('#tela-app .vista').forEach((v) => { v.hidden = v.id !== 'vista-' + vista; });
  $$('.nav-item').forEach((n) => n.classList.toggle('ativo', n.dataset.ir === vista));
  renderizarVista(vista);
  window.scrollTo(0, 0);
}

function renderizarVista(vista) {
  const cli = clienteLogado();
  if (!cli) return;
  if (vista === 'inicio') renderInicio(cli);
  if (vista === 'agendar') renderAgendar(cli);
  if (vista === 'sessoes') { renderProximas(cli); renderHistorico(cli); }
  if (vista === 'planos') renderPlanos(cli);
}

function renderizarTudo() {
  if (SESSAO && SESSAO.admin) { renderAdmin(); return; }
  const cli = clienteLogado();
  if (cli && $('#tela-app').classList.contains('ativa')) {
    renderizarVista(vistaAtual);
    renderBanners();
  }
}

/* ------------------------------------------------------------
   Modais
   ------------------------------------------------------------ */
function abrirModal(id) { $('#' + id).classList.add('aberto'); }
function fecharModal(id) { $('#' + id).classList.remove('aberto'); }

function confirmar(titulo, texto, botoes) {
  $('#conf-titulo').textContent = titulo;
  $('#conf-texto').innerHTML = texto;
  const area = $('#conf-botoes');
  area.innerHTML = '';
  botoes.forEach((b) => {
    const btn = document.createElement('button');
    btn.className = b.classe || 'btn-contorno';
    btn.style.marginTop = '8px';
    btn.textContent = b.rotulo;
    btn.addEventListener('click', () => { fecharModal('modal-confirma'); if (b.acao) b.acao(); });
    area.appendChild(btn);
  });
  abrirModal('modal-confirma');
}

/* ------------------------------------------------------------
   Login e primeiro acesso
   ------------------------------------------------------------ */
function renderPerfisConhecidos() {
  const area = $('#login-perfis');
  const conhecidos = DB.clientes.filter((c) => !c.removido).slice(0, 6);
  area.innerHTML = '';
  for (const c of conhecidos) {
    const b = document.createElement('button');
    b.className = 'chip';
    b.textContent = primeiroNome(c.nome);
    b.addEventListener('click', () => { $('#login-whats').value = fmtWhats(c.whats); entrar(); });
    area.appendChild(b);
  }
}

function entrar() {
  const whats = normWhats($('#login-whats').value);
  if (whats.length < 12) { toast('Digite seu WhatsApp com DDD 😉'); return; }

  const existente = clientePorWhats(whats);
  if (existente) {
    definirSessao({ clienteId: existente.id });
    if (existente.onboarded) abrirApp(); else abrirOnboarding(existente);
    return;
  }

  const campoNome = $('#login-novo');
  if (campoNome.hidden) {
    campoNome.hidden = false;
    $('#login-nome').focus();
    return;
  }
  const nome = $('#login-nome').value.trim();
  if (nome.length < 3) { toast('Digite seu nome completo 💛'); return; }

  const novo = {
    id: uid(), nome, whats,
    criadoEm: agora(), planos: [], onboarded: false,
  };
  salvarCliente(novo);
  definirSessao({ clienteId: novo.id });
  abrirOnboarding(novo);
}

let onbEscolha; // pacoteId ou 'nenhum'

function abrirOnboarding(cli) {
  onbEscolha = undefined;
  $('#onb-ola').textContent = 'Que bom ter você aqui, ' + primeiroNome(cli.nome) + '!';
  const area = $('#onb-pacotes');
  area.innerHTML = '';
  const opcoes = PACOTES.map((p) => ({ id: p.id, nome: p.nome, desc: p.desc }))
    .concat([{ id: 'nenhum', nome: 'Ainda não tenho plano', desc: 'Quero agendar sessões avulsas ou conhecer os pacotes' }]);
  for (const op of opcoes) {
    const b = document.createElement('button');
    b.className = 'opcao-plano';
    b.innerHTML = '<strong>' + esc(op.nome) + '</strong><small>' + esc(op.desc) + '</small>';
    b.addEventListener('click', () => {
      onbEscolha = op.id;
      $$('#onb-pacotes .opcao-plano').forEach((x) => x.classList.remove('sel'));
      b.classList.add('sel');
      $('#btn-onb-ok').disabled = false;
    });
    area.appendChild(b);
  }
  $('#btn-onb-ok').disabled = true;
  mostrarTela('tela-onboarding');
}

function concluirOnboarding() {
  const cli = clienteLogado();
  if (!cli || onbEscolha === undefined) return;
  if (onbEscolha !== 'nenhum') {
    cli.planos = cli.planos || [];
    cli.planos.push(criarPlano(onbEscolha, 'cliente'));
  }
  cli.onboarded = true;
  salvarCliente(cli);
  toast(onbEscolha !== 'nenhum' ? 'Plano registrado! Agora é só agendar 💛' : 'Perfil criado! Conheça nossos planos 💛');
  abrirApp();
}

function pedirNotificacao() {
  if (!('Notification' in window)) { toast('Este navegador não aceita notificações — os lembretes aparecerão aqui no app.'); return; }
  Notification.requestPermission().then((p) => {
    toast(p === 'granted' ? 'Lembretes ativados! 🔔' : 'Sem problema — os lembretes aparecerão aqui no app.');
  });
}

function abrirApp() {
  mostrarTela('tela-app');
  irPara('inicio');
  renderBanners();
  verificarLembretes();
}

function sair() {
  definirSessao(null);
  $('#login-whats').value = '';
  $('#login-nome').value = '';
  $('#login-novo').hidden = true;
  renderPerfisConhecidos();
  mostrarTela('tela-login');
}

/* ------------------------------------------------------------
   Vista: Início
   ------------------------------------------------------------ */
function saudacao() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

function proximasDoCliente(cli) {
  const agoraMs = agora();
  return agsDoCliente(cli.id)
    .filter((a) => a.status === 'agendada' && deISO(a.data, a.hora).getTime() >= agoraMs - 30 * 60000)
    .sort((a, b) => deISO(a.data, a.hora) - deISO(b.data, b.hora));
}

function renderInicio(cli) {
  $('#inicio-ola').textContent = saudacao() + ', ' + primeiroNome(cli.nome) + ' 🤍';

  const prox = proximasDoCliente(cli)[0];
  const areaProx = $('#inicio-proxima');
  if (prox) {
    areaProx.innerHTML =
      '<div class="cartao" style="display:flex;gap:16px;align-items:center">' +
        '<div class="sessao-data"><div class="dia">' + deISO(prox.data).getDate() + '</div>' +
        '<div class="mes">' + MESES_CURTO[deISO(prox.data).getMonth()] + '</div></div>' +
        '<div style="flex:1"><strong style="font-weight:500">' + esc(nomeProc(prox.procId)) + '</strong><br>' +
        '<small class="texto-suave">' + fmtDataLonga(prox.data) + ' · <b>' + prox.hora + '</b></small></div>' +
      '</div>';
  } else {
    areaProx.innerHTML =
      '<div class="vazio"><span class="vazio-icone">🌿</span>Nenhuma sessão marcada.<br>Que tal reservar seu momento?</div>';
  }

  const pools = poolsDoCliente(cli).filter((p) => p.total > 0);
  const areaCred = $('#inicio-creditos');
  if (!pools.length) {
    areaCred.innerHTML =
      '<div class="vazio"><span class="vazio-icone">✨</span>Você ainda não tem um plano ativo.<br>Conheça nossos protocolos na aba <b>Planos</b>.</div>';
  } else {
    areaCred.innerHTML = '<div class="cartao">' + pools.map(barraPool).join('') + '</div>';
  }
}

function barraPool(p) {
  const disponiveis = p.restantes + p.reservadas; // ainda não concluídas
  const pct = p.total ? Math.round((disponiveis / p.total) * 100) : 0;
  return (
    '<div class="pool">' +
      '<div class="pool-topo"><strong>' + esc(p.nomePacote) + (p.label !== 'Sessões' ? ' · ' + esc(p.label) : '') + '</strong>' +
      '<span>' + disponiveis + ' de ' + p.total + '</span></div>' +
      '<div class="pool-barra"><i style="width:' + pct + '%"></i></div>' +
      (p.reservadas ? '<small class="texto-suave" style="font-size:.78rem">' + p.reservadas + ' já agendada' + (p.reservadas > 1 ? 's' : '') + '</small>' : '') +
    '</div>'
  );
}

/* ------------------------------------------------------------
   Vista: Agendar
   ------------------------------------------------------------ */
const agSel = { procId: null, data: null, hora: null };
let calMes = new Date(); // mês exibido no calendário

function renderAgendar(cli) {
  // chips de procedimentos
  const area = $('#ag-procs');
  area.innerHTML = '';
  for (const p of PROCEDIMENTOS) {
    const b = document.createElement('button');
    b.className = 'chip' + (agSel.procId === p.id ? ' ativo' : '');
    b.textContent = p.nome;
    b.addEventListener('click', () => {
      agSel.procId = p.id;
      renderAgendar(clienteLogado());
    });
    area.appendChild(b);
  }

  // cobertura do plano
  const cob = $('#ag-proc-cobertura');
  if (agSel.procId) {
    const rest = restantesParaProc(cli, agSel.procId);
    cob.innerHTML = rest > 0
      ? '✨ Coberto pelo seu plano — <b>' + rest + '</b> ' + (rest === 1 ? 'sessão restante' : 'sessões restantes') + ' para este procedimento.'
      : 'Este procedimento será <b>avulso</b> — combine o valor com a recepção pelo WhatsApp. 💛';
  } else {
    cob.textContent = '';
  }

  renderCalendario(cli);
  renderSlots();
  atualizarRecorrencia(cli);
}

function renderCalendario(cli) {
  const ano = calMes.getFullYear(), mes = calMes.getMonth();
  $('#cal-titulo').textContent = MESES_LONGO[mes] + ' ' + ano;

  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const inicioMesAtual = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  $('#cal-ant').disabled = new Date(ano, mes, 1) <= inicioMesAtual;

  const minhasDatas = new Set(
    agsDoCliente(cli.id).filter((a) => a.status === 'agendada').map((a) => a.data)
  );

  const grade = $('#cal-grade');
  grade.innerHTML = DIAS_CURTO.map((d) => '<div class="cal-dow">' + d + '</div>').join('');

  const primeiro = new Date(ano, mes, 1);
  for (let i = 0; i < primeiro.getDay(); i++) grade.appendChild(document.createElement('div'));

  const ultimoDia = new Date(ano, mes + 1, 0).getDate();
  for (let dia = 1; dia <= ultimoDia; dia++) {
    const d = new Date(ano, mes, dia);
    const iso = dataISO(d);
    const b = document.createElement('button');
    b.className = 'cal-dia';
    b.textContent = dia;
    if (iso === hojeISO()) b.classList.add('hoje');
    if (agSel.data === iso) b.classList.add('sel');
    if (minhasDatas.has(iso)) b.innerHTML += '<span class="pontinho"></span>';
    if (d < hoje || !diaAberto(d)) {
      b.disabled = true;
    } else {
      b.addEventListener('click', () => {
        agSel.data = iso;
        agSel.hora = null;
        renderAgendar(clienteLogado());
      });
    }
    grade.appendChild(b);
  }
}

function renderSlots() {
  const area = $('#ag-slots');
  area.innerHTML = '';
  if (!agSel.data) {
    area.innerHTML = '<p class="texto-suave" style="grid-column:1/-1">Escolha um dia no calendário. 🗓️</p>';
    return;
  }
  const agoraD = new Date();
  for (const h of horariosDoDia()) {
    const b = document.createElement('button');
    b.className = 'slot' + (agSel.hora === h ? ' ativo' : '');
    b.textContent = h;
    const inicio = deISO(agSel.data, h);
    const passado = inicio.getTime() <= agoraD.getTime();
    if (passado || !horarioLivre(agSel.data, h)) {
      b.disabled = true;
    } else {
      b.addEventListener('click', () => {
        agSel.hora = h;
        renderSlots();
        atualizarRecorrencia(clienteLogado());
      });
    }
    area.appendChild(b);
  }
}

function atualizarRecorrencia(cli) {
  const marcado = $('#ag-rec').checked;
  $('#ag-rec-opcoes').hidden = !marcado;
  if (!marcado) return;
  const dica = $('#ag-rec-dica');
  const campo = $('#ag-rec-qtd');
  const rest = agSel.procId ? restantesParaProc(cli, agSel.procId) : 0;
  if (!campo.value || campo._auto) {
    campo.value = Math.max(2, Math.min(rest || 4, 60));
    campo._auto = true;
  }
  const partes = [];
  if (agSel.data && agSel.hora) {
    partes.push('Toda <b>' + DIAS_LONGO[deISO(agSel.data).getDay()] + '</b> às <b>' + agSel.hora + '</b>.');
  }
  if (agSel.procId) {
    partes.push(rest > 0
      ? 'Seu plano cobre <b>' + rest + '</b> ' + (rest === 1 ? 'sessão' : 'sessões') + ' deste procedimento.'
      : 'Sem plano para este procedimento — as sessões serão avulsas.');
  }
  dica.innerHTML = partes.join(' ');
}

/* --- revisão e confirmação da série --- */
let seriePendente = null;

function revisarAgendamento() {
  const cli = clienteLogado();
  if (!agSel.procId) { toast('Escolha o procedimento 💆‍♀️'); return; }
  if (!agSel.data) { toast('Escolha o dia no calendário 🗓️'); return; }
  if (!agSel.hora) { toast('Escolha o horário ⏰'); return; }

  const recorrente = $('#ag-rec').checked;
  let qtd = 1;
  if (recorrente) {
    qtd = parseInt($('#ag-rec-qtd').value, 10);
    if (!qtd || qtd < 2) { toast('Para recorrência, escolha 2 ou mais sessões.'); return; }
    qtd = Math.min(qtd, 60);
  }

  const { datas, puladas } = gerarDatasSerie(agSel.data, agSel.hora, qtd);
  if (!datas.length) { toast('Não encontramos horários livres — tente outro horário.'); return; }

  // simula o consumo dos créditos sessão a sessão
  const tally = {};
  const itens = datas.map((ds) => {
    const cob = coberturaParaProc(cli, agSel.procId, tally);
    if (cob) tally[cob.chave] = (tally[cob.chave] || 0) + 1;
    return { data: ds, hora: agSel.hora, cobertura: cob };
  });

  seriePendente = { procId: agSel.procId, itens, recorrente };

  const d0 = deISO(datas[0]);
  $('#serie-resumo').innerHTML =
    '<div class="cartao" style="padding:16px">' +
      '<strong style="font-weight:500">' + esc(nomeProc(agSel.procId)) + '</strong><br>' +
      '<small class="texto-suave">' +
      (recorrente
        ? 'Toda ' + DIAS_LONGO[d0.getDay()] + ' às ' + agSel.hora + ' · ' + itens.length + ' sessões'
        : fmtDataLonga(datas[0]) + ' · ' + agSel.hora) +
      '</small></div>' +
    (puladas.length
      ? '<p class="texto-suave mt-8" style="font-size:.84rem">⚠️ Pulamos ' + puladas.length + ' semana' + (puladas.length > 1 ? 's' : '') +
        ' com horário ocupado (' + puladas.map(fmtDataCurta).join(', ') + ') e compensamos no final.</p>'
      : '');

  $('#serie-lista').innerHTML = itens.map((it, i) =>
    '<div class="linha-flex" style="justify-content:space-between;padding:8px 4px;border-bottom:1px solid var(--linha)">' +
      '<span style="flex:none;color:var(--suave);font-size:.82rem">' + (i + 1) + 'ª</span>' +
      '<span style="flex:1">' + fmtDataCurta(it.data) + ' · ' + it.hora + '</span>' +
      (it.cobertura
        ? '<span class="tag ouro" style="flex:none">' + esc(it.cobertura.nomePacote) + '</span>'
        : '<span class="tag cinza" style="flex:none">avulsa</span>') +
    '</div>'
  ).join('');

  abrirModal('modal-serie');
}

function confirmarSerie() {
  const cli = clienteLogado();
  if (!cli || !seriePendente) return;
  const serieId = seriePendente.itens.length > 1 ? uid() : null;
  for (const it of seriePendente.itens) {
    salvarAgendamento({
      id: uid(),
      clienteId: cli.id,
      procId: seriePendente.procId,
      data: it.data,
      hora: it.hora,
      status: 'agendada',
      planoId: it.cobertura ? it.cobertura.plano.id : null,
      poolIx: it.cobertura ? it.cobertura.poolIx : null,
      serieId,
      criadoEm: agora(),
    });
  }
  fecharModal('modal-serie');
  seriePendente = null;
  agSel.data = null; agSel.hora = null;
  $('#ag-rec').checked = false;
  const campo = $('#ag-rec-qtd'); campo.value = ''; campo._auto = false;
  toast('Sessões agendadas! Até breve 💛');
  irPara('sessoes');
}

/* ------------------------------------------------------------
   Vista: Minhas sessões
   ------------------------------------------------------------ */
function renderProximas(cli) {
  const lista = $('#lista-proximas');
  const prox = proximasDoCliente(cli);
  if (!prox.length) {
    lista.innerHTML = '<div class="vazio"><span class="vazio-icone">🗓️</span>Nenhuma sessão marcada.<br>Toque em <b>Agendar</b> para reservar seu horário.</div>';
    return;
  }
  let html = '';
  if (prox.length > 1) {
    html += '<button class="btn-contorno mb-14" id="btn-ics-todas">📅 Adicionar todas à agenda do celular</button>';
  }
  html += prox.map((a) => {
    const d = deISO(a.data);
    return (
      '<div class="sessao-item">' +
        '<div class="sessao-data"><div class="dia">' + d.getDate() + '</div><div class="mes">' + MESES_CURTO[d.getMonth()] + '</div></div>' +
        '<div class="sessao-info"><strong>' + esc(nomeProc(a.procId)) + '</strong>' +
        '<small>' + DIAS_LONGO[d.getDay()] + ' · <b>' + a.hora + '</b>' +
        (a.serieId ? ' · <span class="tag ouro">recorrente</span>' : '') + '</small></div>' +
        '<div class="sessao-acoes"><div class="linha-btns">' +
          '<button class="btn-mini dourado" data-ics="' + a.id + '" title="Adicionar à agenda">📅</button>' +
          '<a class="btn-mini verde" target="_blank" rel="noopener" href="' + esc(zapRemarcar(cli, a)) + '" title="Remarcar pelo WhatsApp">✏️</a>' +
          '<button class="btn-mini vermelho" data-cancela="' + a.id + '" title="Cancelar">✕</button>' +
        '</div></div>' +
      '</div>'
    );
  }).join('');
  lista.innerHTML = html;

  const btnTodas = $('#btn-ics-todas');
  if (btnTodas) btnTodas.addEventListener('click', () => baixarICS(prox, cli));
  lista.querySelectorAll('[data-ics]').forEach((b) =>
    b.addEventListener('click', () => {
      const a = DB.agendamentos.find((x) => x.id === b.dataset.ics);
      if (a) baixarICS([a], cli);
    })
  );
  lista.querySelectorAll('[data-cancela]').forEach((b) =>
    b.addEventListener('click', () => pedirCancelamento(b.dataset.cancela))
  );
}

function zapRemarcar(cli, a) {
  return linkZap(CONFIG.WHATS_COMERCIAL,
    'Olá! Sou ' + cli.nome + ' 💛 Preciso remarcar minha sessão de ' + nomeProc(a.procId) +
    ' do dia ' + fmtDataCurta(a.data) + ' às ' + a.hora + '. Quais horários vocês têm?');
}

function pedirCancelamento(agId) {
  const a = DB.agendamentos.find((x) => x.id === agId);
  if (!a) return;
  const daSerie = a.serieId
    ? DB.agendamentos.filter((x) => x.serieId === a.serieId && x.status === 'agendada' &&
        deISO(x.data, x.hora) >= deISO(a.data, a.hora))
    : [a];
  const botoes = [
    { rotulo: 'Cancelar só esta sessão', classe: 'btn', acao: () => { cancelarAgs([a]); } },
  ];
  if (a.serieId && daSerie.length > 1) {
    botoes.push({
      rotulo: 'Cancelar esta e as próximas (' + daSerie.length + ')',
      classe: 'btn-contorno',
      acao: () => { cancelarAgs(daSerie); },
    });
  }
  botoes.push({ rotulo: 'Voltar', classe: 'btn-suave', acao: null });
  confirmar('Cancelar sessão',
    esc(nomeProc(a.procId)) + ' · ' + fmtDataLonga(a.data) + ' às ' + a.hora +
    '.<br>A sessão volta para o seu saldo. Deseja cancelar?', botoes);
}

function cancelarAgs(lista) {
  for (const a of lista) { a.status = 'cancelada'; salvarAgendamento(a); }
  toast(lista.length > 1 ? lista.length + ' sessões canceladas.' : 'Sessão cancelada.');
  renderizarTudo();
}

function renderHistorico(cli) {
  const lista = $('#lista-historico');
  const agoraMs = agora();
  const passadas = agsDoCliente(cli.id)
    .filter((a) => (a.status === 'concluida' || a.status === 'falta') ||
                   (a.status === 'agendada' && deISO(a.data, a.hora).getTime() < agoraMs - 30 * 60000))
    .sort((a, b) => deISO(b.data, b.hora) - deISO(a.data, a.hora));

  const feitas = passadas.filter((a) => a.status === 'concluida').length;
  if (!passadas.length) {
    lista.innerHTML = '<div class="vazio"><span class="vazio-icone">🌸</span>Seu histórico aparecerá aqui após a primeira sessão.</div>';
    return;
  }
  let html = '<div class="cartao texto-centro mb-14" style="padding:16px">' +
    '<span style="font-family:var(--fonte-serif);font-size:2rem;color:var(--ouro-2)">' + feitas + '</span><br>' +
    '<small class="texto-suave">' + (feitas === 1 ? 'sessão realizada' : 'sessões realizadas') + ' 💛</small></div>';

  let mesAtual = '';
  for (const a of passadas) {
    const d = deISO(a.data);
    const chaveMes = MESES_LONGO[d.getMonth()] + ' ' + d.getFullYear();
    if (chaveMes !== mesAtual) {
      mesAtual = chaveMes;
      html += '<div class="titulo-secao" style="margin-top:18px">' + chaveMes + '</div>';
    }
    const tag = a.status === 'concluida' ? '<span class="tag verde">realizada</span>'
      : a.status === 'falta' ? '<span class="tag vermelho">falta</span>'
      : '<span class="tag cinza">a confirmar</span>';
    html += '<div class="sessao-item">' +
      '<div class="sessao-data"><div class="dia">' + d.getDate() + '</div><div class="mes">' + MESES_CURTO[d.getMonth()] + '</div></div>' +
      '<div class="sessao-info"><strong>' + esc(nomeProc(a.procId)) + '</strong><small>' + a.hora + '</small></div>' +
      tag +
    '</div>';
  }
  lista.innerHTML = html;
}

/* ------------------------------------------------------------
   Vista: Planos & valores
   ------------------------------------------------------------ */
function renderPlanos(cli) {
  // meu plano
  const area = $('#meu-plano');
  const pools = poolsDoCliente(cli);
  const planosAtivos = (cli.planos || []).filter((p) => !p.removido);
  if (!planosAtivos.length) {
    area.innerHTML = '<div class="vazio"><span class="vazio-icone">✨</span>Você ainda não tem um plano.<br>Escolha um protocolo abaixo e fale com a gente. 💛</div>';
  } else {
    area.innerHTML = planosAtivos.map((plano) => {
      const doPlano = pools.filter((p) => p.plano.id === plano.id);
      const dc = new Date(plano.compradoEm);
      return '<div class="cartao mb-14">' +
        '<div class="linha-flex" style="justify-content:space-between;margin-bottom:10px">' +
          '<strong style="font-weight:500;flex:1">' + esc(plano.nome) + '</strong>' +
          '<small class="texto-suave" style="flex:none">desde ' + String(dc.getDate()).padStart(2, '0') + '/' + String(dc.getMonth() + 1).padStart(2, '0') + '/' + dc.getFullYear() + '</small>' +
        '</div>' +
        doPlano.map(barraPool).join('') +
        '<a class="btn-zap mt-8" target="_blank" rel="noopener" href="' +
          esc(linkZap(CONFIG.WHATS_COMERCIAL, 'Olá! Sou ' + cli.nome + ' 💛 Gostaria de renovar meu plano *' + plano.nome + '*.')) +
        '">Renovar pelo WhatsApp</a>' +
      '</div>';
    }).join('');
  }

  // catálogo
  $('#catalogo').innerHTML = PACOTES.map((p) =>
    '<div class="pacote-cartao">' +
      '<h3>' + esc(p.nome) + '</h3>' +
      '<p class="pacote-desc">' + esc(p.desc) + '</p>' +
      '<div class="pacote-preco">' + moeda(p.preco) + '</div>' +
      '<a class="btn-zap" target="_blank" rel="noopener" href="' +
        esc(linkZap(CONFIG.WHATS_COMERCIAL,
          'Olá! Vim pelo app do Spa Vanessa Lima 💛 Tenho interesse no pacote *' + p.nome + '* (' + p.desc + ') — ' + moeda(p.preco) + '. Pode me ajudar?')) +
      '">Comprar · Renovar</a>' +
    '</div>'
  ).join('');

  // procedimentos
  $('#lista-procedimentos').innerHTML = PROCEDIMENTOS.map((p) =>
    '<div style="padding:8px 2px;border-bottom:1px solid var(--linha)"><span style="color:var(--ouro)">✦</span>&nbsp; ' + esc(p.nome) + '</div>'
  ).join('');
  $('#zap-avulsa').href = linkZap(CONFIG.WHATS_COMERCIAL,
    'Olá! Vim pelo app do Spa Vanessa Lima 💛 Gostaria de saber os valores das sessões avulsas.');
}

/* ------------------------------------------------------------
   Lembretes (1 dia antes e 2 horas antes)
   ------------------------------------------------------------ */
function verificarLembretes() {
  const cli = clienteLogado();
  if (!cli) return;
  const flags = lerJSON(CHAVE_LEMBRETES, {});
  const banners = lerJSON(CHAVE_BANNERS, []);
  let mudou = false;

  for (const a of proximasDoCliente(cli)) {
    const mins = (deISO(a.data, a.hora).getTime() - agora()) / 60000;
    if (mins <= 0) continue;
    const f = flags[a.id] || (flags[a.id] = {});
    if (mins <= 120 && !f.h2) {
      f.h2 = true; f.d1 = true; mudou = true;
      const texto = '⏰ É hoje! Sua sessão de <b>' + esc(nomeProc(a.procId)) + '</b> é às <b>' + a.hora + '</b>.';
      banners.push({ id: uid(), clienteId: cli.id, texto });
      notificar('É quase hora do seu momento ✨', 'Sua sessão de ' + nomeProc(a.procId) + ' é hoje às ' + a.hora + '.');
    } else if (mins <= 1440 && !f.d1) {
      f.d1 = true; mudou = true;
      const quando = a.data === hojeISO() ? 'hoje' : 'amanhã';
      const texto = '🌿 Lembrete: sua sessão de <b>' + esc(nomeProc(a.procId)) + '</b> é <b>' + quando + '</b> às <b>' + a.hora + '</b>.';
      banners.push({ id: uid(), clienteId: cli.id, texto });
      notificar('Seu momento está chegando 🌿', 'Sessão de ' + nomeProc(a.procId) + ' ' + quando + ' às ' + a.hora + '.');
    }
  }

  if (mudou) {
    gravarJSON(CHAVE_LEMBRETES, flags);
    gravarJSON(CHAVE_BANNERS, banners);
    renderBanners();
  }
}

function notificar(titulo, corpo) {
  if ('Notification' in window && Notification.permission === 'granted') {
    try { new Notification(titulo, { body: corpo, icon: 'data:,' }); } catch (e) { /* alguns Androids exigem service worker */ }
  }
}

function renderBanners() {
  const cli = clienteLogado();
  const area = $('#area-banners');
  if (!cli || !area) return;
  const banners = lerJSON(CHAVE_BANNERS, []).filter((b) => b.clienteId === cli.id);
  area.innerHTML = '';
  for (const b of banners) {
    const div = document.createElement('div');
    div.className = 'banner';
    div.innerHTML = '<span class="banner-icone">🔔</span><p>' + b.texto + '</p>';
    const x = document.createElement('button');
    x.className = 'fechar'; x.textContent = '×'; x.setAttribute('aria-label', 'Dispensar');
    x.addEventListener('click', () => {
      const todos = lerJSON(CHAVE_BANNERS, []).filter((y) => y.id !== b.id);
      gravarJSON(CHAVE_BANNERS, todos);
      renderBanners();
    });
    div.appendChild(x);
    area.appendChild(div);
  }
}

/* --- arquivo .ics com alarmes de 1 dia e 2 horas antes --- */
function baixarICS(ags, cli) {
  const dur = CONFIG.HORARIOS.duracaoMin;
  const linhas = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Spa Vanessa Lima//Agendamentos//PT', 'CALSCALE:GREGORIAN',
  ];
  for (const a of ags) {
    const ini = deISO(a.data, a.hora);
    const fim = new Date(ini.getTime() + dur * 60000);
    const carimbo = (d) =>
      d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0') +
      'T' + String(d.getHours()).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0') + '00';
    linhas.push(
      'BEGIN:VEVENT',
      'UID:' + a.id + '@spa-vanessa-lima',
      'DTSTAMP:' + carimbo(new Date()),
      'DTSTART:' + carimbo(ini),
      'DTEND:' + carimbo(fim),
      'SUMMARY:' + nomeProc(a.procId) + ' — Spa Vanessa Lima',
      'DESCRIPTION:Sessão agendada pelo app do Spa Vanessa Lima 💛',
      'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Sua sessão é amanhã', 'TRIGGER:-P1D', 'END:VALARM',
      'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Sua sessão é daqui a 2 horas', 'TRIGGER:-PT2H', 'END:VALARM',
      'END:VEVENT'
    );
  }
  linhas.push('END:VCALENDAR');
  const blob = new Blob([linhas.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const aEl = document.createElement('a');
  aEl.href = url;
  aEl.download = 'sessoes-vanessa-lima.ics';
  document.body.appendChild(aEl);
  aEl.click();
  aEl.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  toast('Abra o arquivo baixado para salvar na agenda 📅');
}

/* ------------------------------------------------------------
   ADMIN — recepção / equipe
   ------------------------------------------------------------ */
let admVista = 'painel';
let admDia = hojeISO();

function abrirAdmin() {
  mostrarTela('tela-admin');
  admVista = 'painel';
  admDia = hojeISO();
  renderAdmin();
}

function renderAdmin() {
  $$('[data-adm]').forEach((b) => b.classList.toggle('ativa', b.dataset.adm === admVista));
  $$('.adm-vista').forEach((v) => { v.hidden = v.id !== 'adm-' + admVista; });
  if (admVista === 'painel') renderAdmPainel();
  if (admVista === 'agenda') renderAdmAgenda();
  if (admVista === 'clientes') renderAdmClientes();
}

function agsAtivos() {
  return DB.agendamentos.filter((a) => a.status === 'agendada' || a.status === 'concluida');
}

function renderAdmPainel() {
  const hoje = hojeISO();
  const d = new Date();
  const inicioSemana = new Date(d); inicioSemana.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // segunda
  const fimSemana = new Date(inicioSemana); fimSemana.setDate(inicioSemana.getDate() + 6);
  const isoIni = dataISO(inicioSemana), isoFim = dataISO(fimSemana);

  $('#est-hoje').textContent = agsAtivos().filter((a) => a.data === hoje).length;
  $('#est-semana').textContent = agsAtivos().filter((a) => a.data >= isoIni && a.data <= isoFim).length;
  $('#est-ativas').textContent = DB.clientes.filter((c) => !c.removido &&
    (restantesTotais(c) > 0 || agsDoCliente(c.id).some((a) => a.status === 'agendada' && deISO(a.data, a.hora) > new Date()))
  ).length;

  // lembretes de hoje e amanhã
  const amanha = amanhaISO();
  const paraLembrar = DB.agendamentos
    .filter((a) => a.status === 'agendada' && (a.data === hoje || a.data === amanha))
    .filter((a) => deISO(a.data, a.hora) > new Date())
    .sort((a, b) => deISO(a.data, a.hora) - deISO(b.data, b.hora));

  const areaLem = $('#adm-lembretes');
  if (!paraLembrar.length) {
    areaLem.innerHTML = '<div class="vazio">Nenhuma sessão de hoje ou amanhã pendente de lembrete. ✅</div>';
  } else {
    areaLem.innerHTML = paraLembrar.map((a) => {
      const c = clientePorId(a.clienteId);
      if (!c) return '';
      const quando = a.data === hoje ? 'hoje' : 'amanhã';
      const msg = 'Olá, ' + primeiroNome(c.nome) + '! 🌿 Passando para lembrar da sua sessão de *' +
        nomeProc(a.procId) + '* ' + quando + ' às *' + a.hora + '* no Spa Vanessa Lima. Te esperamos! 💛';
      return '<div class="sessao-item">' +
        '<div class="sessao-info"><strong>' + esc(c.nome) + '</strong>' +
        '<small>' + esc(nomeProc(a.procId)) + ' · <b>' + quando + '</b> às <b>' + a.hora + '</b></small></div>' +
        '<a class="btn-mini verde" target="_blank" rel="noopener" href="' + esc(linkZap(c.whats, msg)) + '">Lembrar 💬</a>' +
      '</div>';
    }).join('');
  }

  // renovações
  const renovar = DB.clientes
    .filter((c) => !c.removido && (c.planos || []).some((p) => !p.removido))
    .map((c) => ({ c, rest: restantesTotais(c) }))
    .filter((x) => x.rest <= 2)
    .sort((a, b) => a.rest - b.rest);

  const areaRen = $('#adm-renovacoes');
  if (!renovar.length) {
    areaRen.innerHTML = '<div class="vazio">Nenhuma cliente perto de terminar o plano. 🎉</div>';
  } else {
    areaRen.innerHTML = renovar.map(({ c, rest }) => {
      const msg = 'Olá, ' + primeiroNome(c.nome) + '! 💛 Seu plano no Spa Vanessa Lima está ' +
        (rest === 0 ? 'finalizado' : 'quase no fim (' + rest + ' ' + (rest === 1 ? 'sessão restante' : 'sessões restantes') + ')') +
        '. Quer garantir a renovação com condições especiais? ✨';
      return '<div class="sessao-item">' +
        '<div class="avatar">' + esc(iniciais(c.nome)) + '</div>' +
        '<div class="sessao-info"><strong>' + esc(c.nome) + '</strong>' +
        '<small>' + (rest === 0 ? 'plano finalizado' : rest + ' ' + (rest === 1 ? 'sessão restante' : 'sessões restantes')) + '</small></div>' +
        '<a class="btn-mini verde" target="_blank" rel="noopener" href="' + esc(linkZap(c.whats, msg)) + '">Oferecer 💬</a>' +
      '</div>';
    }).join('');
  }
}

/* --- agenda do dia --- */
function renderAdmAgenda() {
  const d = deISO(admDia);
  const hoje = admDia === hojeISO();
  $('#adm-dia-titulo').textContent = (hoje ? 'Hoje · ' : '') + DIAS_LONGO[d.getDay()] + ', ' + d.getDate() + ' ' + MESES_CURTO[d.getMonth()];
  $('#adm-dia-hoje').style.display = hoje ? 'none' : '';

  const doDia = DB.agendamentos
    .filter((a) => a.data === admDia && a.status !== 'cancelada')
    .sort((a, b) => a.hora.localeCompare(b.hora));

  const area = $('#adm-agenda-lista');
  if (!doDia.length) {
    area.innerHTML = '<div class="vazio"><span class="vazio-icone">🗓️</span>Nenhum atendimento neste dia.</div>';
    return;
  }
  area.innerHTML = doDia.map((a) => {
    const c = clientePorId(a.clienteId);
    const nome = c ? c.nome : '(cliente removida)';
    const acoes = a.status === 'agendada'
      ? '<div class="linha-btns">' +
          '<button class="btn-mini dourado" data-conclui="' + a.id + '">✓ Concluir</button>' +
          '<button class="btn-mini" data-falta="' + a.id + '">Falta</button>' +
          '<button class="btn-mini vermelho" data-adm-cancela="' + a.id + '">✕</button>' +
        '</div>'
      : a.status === 'concluida' ? '<span class="tag verde">realizada</span>'
      : '<span class="tag vermelho">falta</span>';
    return '<div class="sessao-item">' +
      '<div class="sessao-data" style="min-width:46px"><div class="dia" style="font-size:1.15rem">' + a.hora + '</div></div>' +
      '<div class="sessao-info"><strong>' + esc(nome) + '</strong>' +
      '<small>' + esc(nomeProc(a.procId)) + (a.planoId ? '' : ' · <span class="tag cinza">avulsa</span>') + '</small></div>' +
      '<div class="sessao-acoes">' + acoes + '</div>' +
    '</div>';
  }).join('');

  area.querySelectorAll('[data-conclui]').forEach((b) =>
    b.addEventListener('click', () => mudarStatus(b.dataset.conclui, 'concluida')));
  area.querySelectorAll('[data-falta]').forEach((b) =>
    b.addEventListener('click', () => mudarStatus(b.dataset.falta, 'falta')));
  area.querySelectorAll('[data-adm-cancela]').forEach((b) =>
    b.addEventListener('click', () => {
      const a = DB.agendamentos.find((x) => x.id === b.dataset.admCancela);
      if (!a) return;
      const c = clientePorId(a.clienteId);
      confirmar('Cancelar sessão',
        esc((c ? c.nome : '') + ' · ' + nomeProc(a.procId)) + ' · ' + a.hora + '<br>A sessão volta para o saldo da cliente.',
        [
          { rotulo: 'Cancelar sessão', classe: 'btn', acao: () => mudarStatus(a.id, 'cancelada') },
          { rotulo: 'Voltar', classe: 'btn-suave', acao: null },
        ]);
    }));
}

function mudarStatus(agId, status) {
  const a = DB.agendamentos.find((x) => x.id === agId);
  if (!a) return;
  a.status = status;
  salvarAgendamento(a);
  const rotulos = { concluida: 'Sessão concluída ✓', falta: 'Falta registrada', cancelada: 'Sessão cancelada' };
  toast(rotulos[status] || 'Atualizado');
  renderAdmin();
}

function mudarDiaAdm(delta) {
  const d = deISO(admDia);
  d.setDate(d.getDate() + delta);
  admDia = dataISO(d);
  renderAdmAgenda();
}

/* --- encaixe (novo agendamento pela recepção) --- */
function abrirEncaixe() {
  const selC = $('#enc-cliente');
  selC.innerHTML = DB.clientes.filter((c) => !c.removido)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    .map((c) => '<option value="' + c.id + '">' + esc(c.nome) + '</option>').join('');
  $('#enc-proc').innerHTML = PROCEDIMENTOS
    .map((p) => '<option value="' + p.id + '">' + esc(p.nome) + '</option>').join('');
  $('#enc-data').value = admDia;
  atualizarHorasEncaixe();
  abrirModal('modal-encaixe');
}

function atualizarHorasEncaixe() {
  const data = $('#enc-data').value;
  const agoraD = new Date();
  $('#enc-hora').innerHTML = horariosDoDia().map((h) => {
    const livre = data && horarioLivre(data, h) && deISO(data, h) > agoraD;
    return '<option value="' + h + '"' + (livre ? '' : ' disabled') + '>' + h + (livre ? '' : ' — ocupado') + '</option>';
  }).join('');
}

function salvarEncaixe() {
  const clienteId = $('#enc-cliente').value;
  const procId = $('#enc-proc').value;
  const data = $('#enc-data').value;
  const hora = $('#enc-hora').value;
  const cli = clientePorId(clienteId);
  if (!cli) { toast('Cadastre a cliente primeiro (aba Clientes).'); return; }
  if (!data || !hora) { toast('Escolha data e horário.'); return; }
  if (!horarioLivre(data, hora)) { toast('Este horário acabou de ser ocupado.'); return; }
  const cob = coberturaParaProc(cli, procId);
  salvarAgendamento({
    id: uid(), clienteId, procId, data, hora,
    status: 'agendada',
    planoId: cob ? cob.plano.id : null,
    poolIx: cob ? cob.poolIx : null,
    serieId: null, criadoEm: agora(),
  });
  fecharModal('modal-encaixe');
  toast('Agendado para ' + fmtDataCurta(data) + ' às ' + hora + ' ✓');
  renderAdmin();
}

/* --- lista e ficha de clientes --- */
function renderAdmClientes() {
  const termo = ($('#adm-busca').value || '').trim().toLowerCase();
  const lista = DB.clientes
    .filter((c) => !c.removido)
    .filter((c) => !termo || c.nome.toLowerCase().includes(termo) || c.whats.includes(termo.replace(/\D/g, '')))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  const area = $('#adm-lista-clientes');
  let html = '<button class="btn-contorno mb-14" id="btn-nova-cliente">＋ Cadastrar cliente</button>';
  if (!lista.length) {
    html += '<div class="vazio">Nenhuma cliente ' + (termo ? 'encontrada.' : 'cadastrada ainda.') + '</div>';
  } else {
    html += lista.map((c) => {
      const rest = restantesTotais(c);
      return '<button class="cliente-item" data-cliente="' + c.id + '">' +
        '<div class="avatar">' + esc(iniciais(c.nome)) + '</div>' +
        '<div class="cliente-info"><strong>' + esc(c.nome) + '</strong><small>' + fmtWhats(c.whats) + '</small></div>' +
        '<div class="cliente-resto"><b>' + rest + '</b><span>restantes</span></div>' +
      '</button>';
    }).join('');
  }
  area.innerHTML = html;
  $('#btn-nova-cliente').addEventListener('click', abrirNovaCliente);
  area.querySelectorAll('[data-cliente]').forEach((b) =>
    b.addEventListener('click', () => abrirFichaCliente(b.dataset.cliente)));
}

function abrirNovaCliente() {
  const corpo = $('#modal-cliente-corpo');
  corpo.innerHTML =
    '<div class="modal-topo"><h3>Nova cliente</h3><button class="fechar" data-fecha="modal-cliente">×</button></div>' +
    '<label class="rotulo" for="nc-nome">Nome completo</label>' +
    '<input class="campo" id="nc-nome" type="text" placeholder="Nome da cliente">' +
    '<label class="rotulo" for="nc-whats">WhatsApp</label>' +
    '<input class="campo" id="nc-whats" type="tel" placeholder="(48) 99999-9999">' +
    '<label class="rotulo" for="nc-pacote">Plano (opcional)</label>' +
    '<select class="campo" id="nc-pacote"><option value="">Sem plano por enquanto</option>' +
      PACOTES.map((p) => '<option value="' + p.id + '">' + esc(p.nome) + ' — ' + moeda(p.preco) + '</option>').join('') +
    '</select>' +
    '<button class="btn mt-20" id="btn-nc-salvar">Cadastrar</button>';
  ligarFechamento(corpo);
  $('#btn-nc-salvar').addEventListener('click', () => {
    const nome = $('#nc-nome').value.trim();
    const whats = normWhats($('#nc-whats').value);
    if (nome.length < 3) { toast('Digite o nome completo.'); return; }
    if (whats.length < 12) { toast('Digite o WhatsApp com DDD.'); return; }
    if (clientePorWhats(whats)) { toast('Já existe cliente com este WhatsApp.'); return; }
    const nova = { id: uid(), nome, whats, criadoEm: agora(), planos: [], onboarded: true };
    const pac = $('#nc-pacote').value;
    if (pac) nova.planos.push(criarPlano(pac, 'admin'));
    salvarCliente(nova);
    fecharModal('modal-cliente');
    toast('Cliente cadastrada ✓');
    renderAdmClientes();
  });
  abrirModal('modal-cliente');
}

function abrirFichaCliente(id) {
  const c = clientePorId(id);
  if (!c) return;
  const pools = poolsDoCliente(c);
  const ags = agsDoCliente(c.id);
  const agoraD = new Date();

  const concluidas = ags.filter((a) => a.status === 'concluida')
    .sort((a, b) => deISO(b.data, b.hora) - deISO(a.data, a.hora));
  const corte30 = agora() - 30 * 24 * 3600 * 1000;
  const freq30 = concluidas.filter((a) => deISO(a.data, a.hora).getTime() >= corte30).length;
  const ultima = concluidas[0];
  const proxima = ags.filter((a) => a.status === 'agendada' && deISO(a.data, a.hora) > agoraD)
    .sort((a, b) => deISO(a.data, a.hora) - deISO(b.data, b.hora))[0];

  const historico = ags
    .filter((a) => a.status !== 'agendada' || deISO(a.data, a.hora) < agoraD)
    .sort((a, b) => deISO(b.data, b.hora) - deISO(a.data, a.hora))
    .slice(0, 12);

  const corpo = $('#modal-cliente-corpo');
  corpo.innerHTML =
    '<div class="modal-topo"><h3>' + esc(c.nome) + '</h3><button class="fechar" data-fecha="modal-cliente">×</button></div>' +

    '<div class="linha-flex mb-14">' +
      '<a class="btn-mini verde" style="flex:none" target="_blank" rel="noopener" href="' +
        esc(linkZap(c.whats, 'Olá, ' + primeiroNome(c.nome) + '! Aqui é do Spa Vanessa Lima 💛')) + '">💬 ' + fmtWhats(c.whats) + '</a>' +
    '</div>' +

    '<div class="estatisticas mb-14">' +
      '<div class="estat"><b>' + freq30 + '</b><span>últimos 30 dias</span></div>' +
      '<div class="estat"><b>' + concluidas.length + '</b><span>realizadas</span></div>' +
      '<div class="estat"><b>' + restantesTotais(c) + '</b><span>restantes</span></div>' +
    '</div>' +

    '<p class="texto-suave" style="font-size:.88rem">' +
      (ultima ? 'Última sessão: <b>' + fmtDataCurta(ultima.data) + '</b>' : 'Nenhuma sessão realizada ainda') +
      (proxima ? ' · Próxima: <b>' + fmtDataCurta(proxima.data) + ' às ' + proxima.hora + '</b>' : '') +
    '</p>' +

    '<div class="titulo-secao">Plano</div>' +
    (pools.length
      ? pools.map((p) =>
          '<div class="pool">' +
            '<div class="pool-topo"><strong>' + esc(p.nomePacote) + (p.label !== 'Sessões' ? ' · ' + esc(p.label) : '') + '</strong>' +
            '<span>' + p.restantes + ' restantes</span></div>' +
            '<div class="pool-barra"><i style="width:' + (p.total ? Math.round(((p.restantes + p.reservadas) / p.total) * 100) : 0) + '%"></i></div>' +
            '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:4px">' +
              '<small class="texto-suave" style="font-size:.78rem">' + p.usadas + ' concluídas · ' + p.reservadas + ' agendadas · ' + p.total + ' no total</small>' +
              '<span style="display:flex;gap:4px;flex:none">' +
                '<button class="btn-mini" data-ajuste="' + p.chave + '" data-delta="1">+1</button>' +
                '<button class="btn-mini" data-ajuste="' + p.chave + '" data-delta="-1">−1</button>' +
              '</span>' +
            '</div>' +
          '</div>'
        ).join('')
      : '<p class="texto-suave">Sem plano ativo.</p>') +

    '<div class="titulo-secao">Registrar compra / renovação</div>' +
    '<div class="linha-flex">' +
      '<select class="campo" id="ficha-pacote">' +
        PACOTES.map((p) => '<option value="' + p.id + '">' + esc(p.nome) + ' — ' + moeda(p.preco) + '</option>').join('') +
      '</select>' +
    '</div>' +
    '<button class="btn-contorno mt-8" id="btn-ficha-comprar">Adicionar pacote à cliente</button>' +

    '<div class="titulo-secao">Últimas sessões</div>' +
    (historico.length
      ? historico.map((a) => {
          const tag = a.status === 'concluida' ? '<span class="tag verde">realizada</span>'
            : a.status === 'falta' ? '<span class="tag vermelho">falta</span>'
            : a.status === 'cancelada' ? '<span class="tag cinza">cancelada</span>'
            : '<span class="tag cinza">a confirmar</span>';
          return '<div class="linha-flex" style="justify-content:space-between;padding:7px 2px;border-bottom:1px solid var(--linha);font-size:.9rem">' +
            '<span style="flex:1">' + fmtDataCurta(a.data) + ' · ' + a.hora + ' — ' + esc(nomeProc(a.procId)) + '</span>' + tag +
          '</div>';
        }).join('')
      : '<p class="texto-suave">Nenhuma sessão registrada.</p>') +

    '<hr class="divisor">' +
    '<button class="link-discreto" id="btn-ficha-arquivar" style="color:var(--alerta)">Arquivar cliente</button>';

  ligarFechamento(corpo);

  corpo.querySelectorAll('[data-ajuste]').forEach((b) =>
    b.addEventListener('click', () => {
      const [planoId, ixStr] = b.dataset.ajuste.split(':');
      const plano = (c.planos || []).find((p) => p.id === planoId);
      if (!plano) return;
      const pool = plano.pools[Number(ixStr)];
      pool.ajuste = (pool.ajuste || 0) + Number(b.dataset.delta);
      salvarCliente(c);
      toast('Saldo ajustado ✓');
      abrirFichaCliente(id);
      renderAdmClientes();
    }));

  $('#btn-ficha-comprar').addEventListener('click', () => {
    const pacId = $('#ficha-pacote').value;
    const pac = pacotePorId(pacId);
    confirmar('Registrar compra',
      'Adicionar <b>' + esc(pac.nome) + '</b> (' + moeda(pac.preco) + ') para <b>' + esc(c.nome) + '</b>?',
      [
        { rotulo: 'Confirmar compra', classe: 'btn', acao: () => {
            c.planos = c.planos || [];
            c.planos.push(criarPlano(pacId, 'admin'));
            salvarCliente(c);
            toast('Pacote adicionado ✓');
            abrirFichaCliente(id);
            renderAdmClientes();
          } },
        { rotulo: 'Voltar', classe: 'btn-suave', acao: null },
      ]);
  });

  $('#btn-ficha-arquivar').addEventListener('click', () => {
    confirmar('Arquivar cliente',
      '<b>' + esc(c.nome) + '</b> sairá das listas e as sessões futuras dela serão canceladas. Continuar?',
      [
        { rotulo: 'Arquivar', classe: 'btn', acao: () => {
            c.removido = true;
            salvarCliente(c);
            for (const a of agsDoCliente(c.id)) {
              if (a.status === 'agendada') { a.status = 'cancelada'; salvarAgendamento(a); }
            }
            fecharModal('modal-cliente');
            toast('Cliente arquivada.');
            renderAdmClientes();
          } },
        { rotulo: 'Voltar', classe: 'btn-suave', acao: null },
      ]);
  });

  abrirModal('modal-cliente');
}

/* ------------------------------------------------------------
   Ligações de eventos
   ------------------------------------------------------------ */
function ligarFechamento(raiz) {
  raiz.querySelectorAll('[data-fecha]').forEach((b) =>
    b.addEventListener('click', () => fecharModal(b.dataset.fecha)));
}

function ligarEventos() {
  // login
  $('#btn-entrar').addEventListener('click', entrar);
  $('#login-whats').addEventListener('keydown', (e) => { if (e.key === 'Enter') entrar(); });
  $('#login-nome').addEventListener('keydown', (e) => { if (e.key === 'Enter') entrar(); });
  $('#btn-abrir-equipe').addEventListener('click', () => { $('#pin-campo').value = ''; abrirModal('modal-pin'); });
  $('#btn-pin-ok').addEventListener('click', () => {
    if ($('#pin-campo').value.trim() === CONFIG.PIN_EQUIPE) {
      fecharModal('modal-pin');
      definirSessao({ admin: true });
      abrirAdmin();
    } else {
      toast('Código incorreto.');
    }
  });
  $('#pin-campo').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#btn-pin-ok').click(); });

  // onboarding
  $('#btn-onb-notif').addEventListener('click', pedirNotificacao);
  $('#btn-onb-ok').addEventListener('click', concluirOnboarding);

  // app cliente
  $('#btn-sair').addEventListener('click', sair);
  $$('[data-ir]').forEach((b) => b.addEventListener('click', () => irPara(b.dataset.ir)));
  $('#cal-ant').addEventListener('click', () => { calMes = new Date(calMes.getFullYear(), calMes.getMonth() - 1, 1); renderCalendario(clienteLogado()); });
  $('#cal-prox').addEventListener('click', () => { calMes = new Date(calMes.getFullYear(), calMes.getMonth() + 1, 1); renderCalendario(clienteLogado()); });
  $('#ag-rec').addEventListener('change', () => atualizarRecorrencia(clienteLogado()));
  $('#ag-rec-qtd').addEventListener('input', () => { $('#ag-rec-qtd')._auto = false; });
  $('#btn-ag-continuar').addEventListener('click', revisarAgendamento);
  $('#btn-serie-confirmar').addEventListener('click', confirmarSerie);

  $('#aba-proximas').addEventListener('click', () => {
    $('#aba-proximas').classList.add('ativa'); $('#aba-historico').classList.remove('ativa');
    $('#lista-proximas').hidden = false; $('#lista-historico').hidden = true;
  });
  $('#aba-historico').addEventListener('click', () => {
    $('#aba-historico').classList.add('ativa'); $('#aba-proximas').classList.remove('ativa');
    $('#lista-historico').hidden = false; $('#lista-proximas').hidden = true;
  });

  // admin
  $('#btn-adm-sair').addEventListener('click', () => { definirSessao(null); sair(); });
  $$('[data-adm]').forEach((b) => b.addEventListener('click', () => { admVista = b.dataset.adm; renderAdmin(); }));
  $('#adm-dia-ant').addEventListener('click', () => mudarDiaAdm(-1));
  $('#adm-dia-prox').addEventListener('click', () => mudarDiaAdm(1));
  $('#adm-dia-hoje').addEventListener('click', () => { admDia = hojeISO(); renderAdmAgenda(); });
  $('#btn-encaixe').addEventListener('click', abrirEncaixe);
  $('#enc-data').addEventListener('change', atualizarHorasEncaixe);
  $('#btn-enc-salvar').addEventListener('click', salvarEncaixe);
  $('#adm-busca').addEventListener('input', renderAdmClientes);

  // modais: fechar no × e no fundo
  $$('.modal-fundo').forEach((m) => {
    m.addEventListener('click', (e) => { if (e.target === m) m.classList.remove('aberto'); });
  });
  $$('[data-fecha]').forEach((b) => b.addEventListener('click', () => fecharModal(b.dataset.fecha)));
}

/* ------------------------------------------------------------
   Inicialização
   ------------------------------------------------------------ */
function iniciar() {
  carregarDB();
  ligarEventos();
  renderPerfisConhecidos();

  // restaura a sessão do aparelho
  if (SESSAO && SESSAO.admin) {
    abrirAdmin();
  } else {
    const cli = clienteLogado();
    if (cli) {
      if (cli.onboarded) abrirApp(); else abrirOnboarding(cli);
    } else {
      definirSessao(null);
      mostrarTela('tela-login');
    }
  }

  // lembretes: ao abrir, a cada 30s e ao voltar para o app
  verificarLembretes();
  setInterval(verificarLembretes, 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) verificarLembretes(); });

  // sincronização opcional
  sincronizar();
  setInterval(sincronizar, 60000);

  // PWA
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

document.addEventListener('DOMContentLoaded', iniciar);
