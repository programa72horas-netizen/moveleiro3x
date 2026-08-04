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
  // WhatsApp comercial do spa, com DDI + DDD (só números)
  WHATS_COMERCIAL: '555491431746',

  // Impressão digital (SHA-256) do código de acesso da equipe — o código em
  // si NÃO fica no fonte. Para trocar: abra o console do navegador no app e
  // rode  await gerarHashPin('NovoCodigo')  — cole o resultado aqui.
  PIN_EQUIPE_HASH: '2ae48495678af6fd98c5c36afa297fc3bd32eca791711ee7ab5327ed97cc92c6',

  // Funcionamento do spa — grade fixa de horários de início
  HORARIOS: {
    diasSemana: [1, 2, 3, 4, 5, 6],  // 0=dom, 1=seg … 6=sáb
    grade: ['08:00', '09:15', '10:30', '12:00', '13:30', '14:45', '16:00', '17:15', '18:30'],
    ultimaSabado: '16:00',           // sábado: última sessão às 16h
    duracaoMin: 60,                  // duração de cada sessão
  },
  CAPACIDADE_POR_HORARIO: 1,          // atendimentos simultâneos

  // Falta (não compareceu) desconta sessão do pacote?
  FALTA_CONSOME: false,

  // URL do Apps Script para sincronizar entre aparelhos (SINCRONIZACAO.md)
  SYNC_URL: 'https://script.google.com/macros/s/AKfycbwcyBTr4zLja-ftYz9aasK3rKEfq6hmO47Rvv8bBO1TtvmmQ61qhvvlQc2NUBjhRjKN/exec',
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
function fmtNascimento(iso) {
  const [a, m, d] = String(iso).split('-');
  return d + '/' + m + '/' + a;
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
function todoDia(idx) { return (idx === 0 || idx === 6 ? 'Todo ' : 'Toda ') + DIAS_LONGO[idx]; }
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

const ICONE_ZAP = '<svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.297-.497.1-.198.05-.371-.025-.52-.074-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>';

async function sha256Hex(texto) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
// usada só no console, para gerar um novo PIN_EQUIPE_HASH
window.gerarHashPin = sha256Hex;

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
const CHAVE_PERFIS = 'vl_perfis_v1';

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
    /* Privacidade: a lista completa de clientes (nomes e telefones) só é
       devolvida pelo Apps Script mediante a chave da equipe; o aparelho de
       uma cliente recebe apenas o próprio cadastro. Os agendamentos não
       carregam dados pessoais (só ids, datas e procedimentos). */
    let url = CONFIG.SYNC_URL + '?t=' + agora();
    if (SESSAO && SESSAO.admin && SESSAO.chave) {
      url += '&chave=' + encodeURIComponent(SESSAO.chave);
    } else {
      const cli = clienteLogado();
      if (cli) url += '&whats=' + cli.whats;
    }
    const resp = await fetch(url);
    if (resp.ok) {
      const remoto = await resp.json();
      let mudou = false;
      mudou = mesclar(DB.clientes, remoto.clientes, 'cliente') || mudou;
      mudou = mesclar(DB.agendamentos, remoto.agendamentos, 'agendamento') || mudou;
      if (mudou) { salvarDB(); renderizarTudo(); }
    }
  } catch (e) { /* sem rede ou URL indisponível — tenta de novo depois */ }
  sincronizando = false;
}

/* Busca pontual do cadastro no login: um aparelho novo não tem a cliente
   no banco local, então pergunta ao servidor só por aquele número. */
async function buscarClienteRemoto(whats) {
  if (!CONFIG.SYNC_URL || !navigator.onLine) return;
  try {
    const resp = await fetch(CONFIG.SYNC_URL + '?t=' + agora() + '&whats=' + whats);
    if (resp.ok) {
      const remoto = await resp.json();
      if (mesclar(DB.clientes, remoto.clientes, 'cliente')) salvarDB();
    }
  } catch (e) { /* sem rede — segue só com os dados locais */ }
}

/* Registros remotos são validados campo a campo: um endpoint comprometido
   (ou uma linha editada na planilha) não pode injetar HTML nem dados fora
   do formato esperado. */
const RE_ID = /^[a-z0-9:_-]{4,60}$/i;
const RE_DATA = /^\d{4}-\d{2}-\d{2}$/;
const RE_HORA = /^\d{2}:\d{2}$/;
const STATUS_VALIDOS = ['agendada', 'concluida', 'cancelada', 'falta'];

function idLimpo(v) { return RE_ID.test(String(v || '')) ? String(v) : null; }
function slug(v) { return String(v || '').replace(/[^a-z0-9_-]/gi, '').slice(0, 30); }

function sanearRegistro(tipo, r) {
  if (!r || typeof r !== 'object' || !idLimpo(r.id)) return null;
  if (tipo === 'agendamento') {
    if (!idLimpo(r.clienteId)) return null;
    if (!RE_DATA.test(String(r.data || '')) || !RE_HORA.test(String(r.hora || ''))) return null;
    if (!STATUS_VALIDOS.includes(r.status)) return null;
    return {
      id: String(r.id), clienteId: String(r.clienteId), procId: slug(r.procId),
      data: r.data, hora: r.hora, status: r.status,
      planoId: idLimpo(r.planoId), poolIx: Number.isInteger(r.poolIx) ? r.poolIx : null,
      serieId: idLimpo(r.serieId), criadoEm: Number(r.criadoEm) || 0, up: Number(r.up) || 0,
    };
  }
  const planos = (Array.isArray(r.planos) ? r.planos : []).map((p) => {
    if (!p || !idLimpo(p.id)) return null;
    const pools = (Array.isArray(p.pools) ? p.pools : []).map((b) => ({
      label: String((b && b.label) || '').slice(0, 40),
      procs: b && b.procs === 'todos' ? 'todos' : (Array.isArray(b && b.procs) ? b.procs.map(slug) : []),
      qtd: Number(b && b.qtd) || 0,
      ajuste: Number(b && b.ajuste) || 0,
    }));
    return {
      id: String(p.id), pacoteId: slug(p.pacoteId), nome: String(p.nome || '').slice(0, 60),
      pools, compradoEm: Number(p.compradoEm) || 0,
      origem: slug(p.origem), removido: !!p.removido,
    };
  }).filter(Boolean);
  return {
    id: String(r.id), nome: String(r.nome || '').slice(0, 120),
    whats: String(r.whats || '').replace(/\D/g, '').slice(0, 15),
    email: String(r.email || '').slice(0, 120),
    nascimento: RE_DATA.test(String(r.nascimento || '')) ? r.nascimento : '',
    criadoEm: Number(r.criadoEm) || 0, planos,
    onboarded: !!r.onboarded, removido: !!r.removido,
    excluido: !!r.excluido, up: Number(r.up) || 0,
  };
}

/* Planos ficam dentro do registro da cliente; a união por id garante que a
   compra registrada num aparelho não seja apagada por gravação de outro. */
function unirPlanos(preferidos, outros) {
  const mapa = new Map((preferidos || []).map((p) => [p.id, p]));
  for (const p of (outros || [])) if (!mapa.has(p.id)) mapa.set(p.id, p);
  return Array.from(mapa.values());
}

function mesclar(locais, remotos, tipo) {
  if (!Array.isArray(remotos)) return false;
  let mudou = false;
  for (const bruto of remotos) {
    const r = sanearRegistro(tipo, bruto);
    if (!r) continue;
    const i = locais.findIndex((l) => l.id === r.id);
    if (i < 0) { locais.push(r); mudou = true; continue; }
    const l = locais[i];
    if (tipo === 'cliente' && !r.excluido && !l.excluido) {
      const base = (r.up || 0) > (l.up || 0) ? r : l;
      const outro = base === r ? l : r;
      const unido = Object.assign({}, base, {
        planos: unirPlanos(base.planos, outro.planos),
        onboarded: !!(base.onboarded || outro.onboarded),
      });
      if (JSON.stringify(unido) !== JSON.stringify(l)) { locais[i] = unido; mudou = true; }
      if (JSON.stringify(unido) !== JSON.stringify(r)) enfileirar('cliente', unido);
    } else if ((r.up || 0) > (l.up || 0)) {
      // exclusão definitiva (ou agendamento): o registro mais novo vence,
      // sem união de planos — senão a exclusão ressuscitaria as compras
      locais[i] = r; mudou = true;
    }
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

/** Escolhe a bolsa que cobre um procedimento: a mais específica primeiro
    (pacote dedicado antes do flexível, "todos" por último), depois o plano
    mais antigo — preserva os créditos flexíveis. */
function coberturaParaProc(cli, procId, tally) {
  tally = tally || {};
  const largura = (p) => (p.pool.procs === 'todos' ? Infinity : p.pool.procs.length);
  const candidatos = poolsDoCliente(cli)
    .filter((p) => poolCobre(p.pool, procId))
    .filter((p) => p.restantes - (tally[p.chave] || 0) > 0)
    .sort((a, b) => {
      const wA = largura(a), wB = largura(b);
      if (wA !== wB) return wA - wB;
      return (a.plano.compradoEm || 0) - (b.plano.compradoEm || 0);
    });
  return candidatos[0] || null;
}

function restantesParaProc(cli, procId) {
  return poolsDoCliente(cli)
    .filter((p) => poolCobre(p.pool, procId))
    .reduce((s, p) => s + p.restantes, 0);
}

/** Procedimentos que aparecem para a cliente: só os cobertos pelos planos
    dela; sem plano (ou saldo zerado), mostra todos para agendar avulso. */
function procsDisponiveis(cli) {
  const pools = poolsDoCliente(cli).filter((p) => p.restantes > 0);
  if (!pools.length) return PROCEDIMENTOS;
  const ids = new Set();
  for (const p of pools) {
    if (p.pool.procs === 'todos') return PROCEDIMENTOS;
    p.pool.procs.forEach((x) => ids.add(x));
  }
  return PROCEDIMENTOS.filter((pr) => ids.has(pr.id));
}

function restantesTotais(cli) {
  return poolsDoCliente(cli).reduce((s, p) => s + p.restantes, 0);
}

/** Sessões compradas e ainda não realizadas (inclui as já agendadas) —
    é a métrica certa para falar de renovação. */
function porRealizar(cli) {
  return poolsDoCliente(cli).reduce((s, p) => s + Math.max(0, p.total - p.usadas), 0);
}

/** Reaproveita crédito devolvido/novo: sessões futuras gravadas como avulsas
    passam a consumir o plano assim que houver saldo (cancelamento, falta sem
    desconto ou compra de pacote). */
function promoverAvulsas(cli) {
  if (!cli) return;
  const futuras = agsDoCliente(cli.id)
    .filter((a) => a.status === 'agendada' && !a.planoId && deISO(a.data, a.hora) > new Date())
    .sort((a, b) => deISO(a.data, a.hora) - deISO(b.data, b.hora));
  for (const a of futuras) {
    const cob = coberturaParaProc(cli, a.procId);
    if (!cob) continue;
    a.planoId = cob.plano.id;
    a.poolIx = cob.poolIx;
    salvarAgendamento(a);
  }
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
function horariosDoDia(dataStr) {
  const d = deISO(dataStr || hojeISO());
  if (d.getDay() === 6) {
    return CONFIG.HORARIOS.grade.filter((h) => h <= CONFIG.HORARIOS.ultimaSabado);
  }
  return CONFIG.HORARIOS.grade.slice();
}

/* duas sessões conflitam quando os horários se sobrepõem (a grade é de
   30 em 30 min, mas cada sessão dura CONFIG.HORARIOS.duracaoMin) */
function ocupacoes(dataStr, hora) {
  const inicio = deISO(dataStr, hora).getTime();
  const dur = CONFIG.HORARIOS.duracaoMin * 60000;
  return DB.agendamentos.filter(
    (a) => a.data === dataStr && (a.status === 'agendada' || a.status === 'concluida') &&
           Math.abs(deISO(a.data, a.hora).getTime() - inicio) < dur
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
  if (s && s.clienteId) registrarPerfilLocal(s.clienteId);
}
function clienteLogado() {
  if (!SESSAO || !SESSAO.clienteId) return null;
  const c = clientePorId(SESSAO.clienteId);
  return c && !c.removido ? c : null;
}

/* perfis que já logaram NESTE aparelho (não expõe as demais clientes) */
function registrarPerfilLocal(clienteId) {
  const ids = lerJSON(CHAVE_PERFIS, []);
  if (!ids.includes(clienteId)) {
    ids.unshift(clienteId);
    gravarJSON(CHAVE_PERFIS, ids.slice(0, 6));
  }
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
  if (SESSAO && SESSAO.clienteId && !clienteLogado()) { sair(); return; } // perfil arquivado noutro aparelho
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
  const conhecidos = lerJSON(CHAVE_PERFIS, [])
    .map((id) => clientePorId(id))
    .filter((c) => c && !c.removido)
    .slice(0, 6);
  area.innerHTML = '';
  for (const c of conhecidos) {
    const b = document.createElement('button');
    b.className = 'chip';
    b.textContent = primeiroNome(c.nome);
    b.addEventListener('click', () => { $('#login-whats').value = fmtWhats(c.whats); entrar(); });
    area.appendChild(b);
  }
}

async function entrar() {
  const whats = normWhats($('#login-whats').value);
  if (whats.length < 12) { toast('Digite seu WhatsApp com DDD.'); return; }

  // aparelho novo: procura este cadastro no servidor antes de criar outro
  if (!clientePorWhats(whats)) await buscarClienteRemoto(whats);

  const existente = clientePorWhats(whats);
  if (existente) {
    definirSessao({ clienteId: existente.id });
    if (existente.onboarded) abrirApp(); else abrirOnboarding(existente);
    return;
  }

  // perfil arquivado com este número → reativa em vez de duplicar
  const arquivada = DB.clientes.find((c) => c.whats === whats && c.removido);
  if (arquivada) {
    arquivada.removido = false;
    salvarCliente(arquivada);
    definirSessao({ clienteId: arquivada.id });
    toast('Que bom te ver de novo, ' + primeiroNome(arquivada.nome) + '!');
    if (arquivada.onboarded) abrirApp(); else abrirOnboarding(arquivada);
    return;
  }

  const campoNome = $('#login-novo');
  if (campoNome.hidden) {
    campoNome.hidden = false;
    $('#login-nome').focus();
    return;
  }
  const nome = $('#login-nome').value.trim();
  if (nome.length < 3) { toast('Digite seu nome completo.'); return; }
  const email = $('#login-email').value.trim();
  if (!/.+@.+\..+/.test(email)) { toast('Digite um e-mail válido.'); return; }
  const nascimento = $('#login-nascimento').value;
  if (!nascimento) { toast('Informe sua data de nascimento.'); return; }
  const nasc = deISO(nascimento);
  if (nasc >= new Date() || nasc.getFullYear() < 1920) { toast('Confira a data de nascimento.'); return; }

  const novo = {
    id: uid(), nome, whats, email, nascimento,
    criadoEm: agora(), planos: [], onboarded: false,
  };
  salvarCliente(novo);
  definirSessao({ clienteId: novo.id });
  abrirOnboarding(novo);
}

let onbEscolhas = new Set(); // pacoteIds e/ou 'nenhum' (pode ter mais de um pacote)

function abrirOnboarding(cli) {
  onbEscolhas = new Set();
  $('#onb-ola').textContent = 'Que bom ter você aqui, ' + primeiroNome(cli.nome) + '!';
  const area = $('#onb-pacotes');
  area.innerHTML = '';
  const opcoes = PACOTES.map((p) => ({ id: p.id, nome: p.nome, desc: p.desc }))
    .concat([{ id: 'nenhum', nome: 'Ainda não tenho plano', desc: 'Quero agendar sessões avulsas ou conhecer os pacotes' }]);
  for (const op of opcoes) {
    const b = document.createElement('button');
    b.className = 'opcao-plano';
    b.dataset.op = op.id;
    b.innerHTML = '<strong>' + esc(op.nome) + '</strong><small>' + esc(op.desc) + '</small>';
    b.addEventListener('click', () => {
      if (op.id === 'nenhum') {
        onbEscolhas = onbEscolhas.has('nenhum') ? new Set() : new Set(['nenhum']);
      } else {
        onbEscolhas.delete('nenhum');
        if (onbEscolhas.has(op.id)) onbEscolhas.delete(op.id); else onbEscolhas.add(op.id);
      }
      $$('#onb-pacotes .opcao-plano').forEach((x) => x.classList.toggle('sel', onbEscolhas.has(x.dataset.op)));
      $('#btn-onb-ok').disabled = onbEscolhas.size === 0;
    });
    area.appendChild(b);
  }
  $('#btn-onb-ok').disabled = true;
  mostrarTela('tela-onboarding');
}

function concluirOnboarding() {
  const cli = clienteLogado();
  if (!cli || !onbEscolhas.size) return;
  const pacotes = Array.from(onbEscolhas).filter((id) => id !== 'nenhum');
  cli.planos = cli.planos || [];
  for (const id of pacotes) cli.planos.push(criarPlano(id, 'cliente'));
  cli.onboarded = true;
  salvarCliente(cli);
  toast(pacotes.length
    ? (pacotes.length > 1 ? 'Planos registrados. Agora é só agendar.' : 'Plano registrado. Agora é só agendar.')
    : 'Perfil criado. Conheça nossos planos quando quiser.');
  abrirApp();
}

function pedirNotificacao() {
  if (!('Notification' in window)) { toast('Este navegador não aceita notificações — os lembretes aparecerão aqui no app.'); return; }
  Notification.requestPermission().then((p) => {
    toast(p === 'granted' ? 'Lembretes ativados.' : 'Tudo bem — os lembretes aparecerão aqui no app.');
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
  $('#login-email').value = '';
  $('#login-nascimento').value = '';
  $('#login-novo').hidden = true;
  renderPerfisConhecidos();
  mostrarTela('tela-login');
}

/* --- acesso da equipe: PIN conferido por hash + trava de tentativas --- */
const CHAVE_TENTATIVAS = 'vl_pin_tentativas_v1';

async function verificarPin() {
  const trava = lerJSON(CHAVE_TENTATIVAS, { n: 0, ate: 0 });
  if (trava.ate > agora()) {
    const min = Math.ceil((trava.ate - agora()) / 60000);
    toast('Muitas tentativas — aguarde ' + min + ' min e tente de novo.');
    return;
  }
  const digitado = $('#pin-campo').value.trim();
  if (!digitado) { toast('Digite o código de acesso.'); return; }
  let hash = '';
  try { hash = await sha256Hex(digitado); }
  catch (e) { toast('Abra o app pelo endereço https para entrar como equipe.'); return; }
  if (hash === CONFIG.PIN_EQUIPE_HASH) {
    localStorage.removeItem(CHAVE_TENTATIVAS);
    fecharModal('modal-pin');
    // a senha também é a chave que libera os dados das clientes na
    // sincronização (conferida pelo Apps Script, fora deste código público)
    definirSessao({ admin: true, chave: digitado });
    abrirAdmin();
  } else {
    trava.n = (trava.n || 0) + 1;
    if (trava.n >= 5) { trava.ate = agora() + 5 * 60000; trava.n = 0; }
    gravarJSON(CHAVE_TENTATIVAS, trava);
    toast(trava.ate > agora() ? 'Código incorreto — acesso bloqueado por 5 minutos.' : 'Código incorreto.');
  }
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
  $('#inicio-ola').textContent = saudacao() + ', ' + primeiroNome(cli.nome) + '.';

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
      '<div class="vazio">Nenhuma sessão marcada.<br>Reserve seu próximo momento de cuidado.</div>';
  }

  const pools = poolsDoCliente(cli).filter((p) => p.total > 0);
  const areaCred = $('#inicio-creditos');
  if (!pools.length) {
    areaCred.innerHTML =
      '<div class="vazio">Você ainda não tem um plano ativo.<br>Conheça nossos protocolos na aba <b>Planos</b>.</div>';
  } else {
    areaCred.innerHTML = '<div class="cartao">' + pools.map((p) => barraPool(p)).join('') + '</div>';
  }
}

function barraPool(p, soLabel) {
  const disponiveis = p.restantes + p.reservadas; // ainda não concluídas
  const pct = Math.min(100, Math.max(0, p.total ? Math.round((disponiveis / p.total) * 100) : 0));
  const titulo = soLabel
    ? esc(p.label)
    : esc(p.nomePacote) + (p.label !== 'Sessões' ? ' · ' + esc(p.label) : '');
  return (
    '<div class="pool">' +
      '<div class="pool-topo"><strong>' + titulo + '</strong>' +
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
  // chips: apenas os procedimentos dos planos da cliente
  const disponiveis = procsDisponiveis(cli);
  if (agSel.procId && !disponiveis.some((p) => p.id === agSel.procId)) agSel.procId = null;
  const area = $('#ag-procs');
  area.innerHTML = '';
  for (const p of disponiveis) {
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
      ? 'Coberto pelo seu plano — <b>' + rest + '</b> ' + (rest === 1 ? 'sessão restante' : 'sessões restantes') + ' para este procedimento.'
      : 'Este procedimento será <b>avulso</b> — combine o valor com a recepção pelo WhatsApp.';
  } else if (disponiveis.length < PROCEDIMENTOS.length) {
    cob.innerHTML = 'Estes são os procedimentos do seu plano. Quer outro? Fale com a recepção.';
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
    area.innerHTML = '<p class="texto-suave" style="grid-column:1/-1">Escolha um dia no calendário.</p>';
    return;
  }
  const agoraD = new Date();
  for (const h of horariosDoDia(agSel.data)) {
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
    partes.push('<b>' + todoDia(deISO(agSel.data).getDay()) + '</b> às <b>' + agSel.hora + '</b>.');
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
  if (!agSel.procId) { toast('Escolha o procedimento.'); return; }
  if (!agSel.data) { toast('Escolha o dia no calendário.'); return; }
  if (!agSel.hora) { toast('Escolha o horário.'); return; }
  // o app pode ter ficado aberto: o horário escolhido já passou ou foi ocupado?
  if (deISO(agSel.data, agSel.hora) <= new Date() || !horarioLivre(agSel.data, agSel.hora)) {
    toast('Esse horário não está mais disponível — escolha outro.');
    agSel.hora = null;
    renderAgendar(cli);
    return;
  }

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
        ? todoDia(d0.getDay()) + ' às ' + agSel.hora + ' · ' + itens.length + ' sessões'
        : fmtDataLonga(datas[0]) + ' · ' + agSel.hora) +
      '</small></div>' +
    (puladas.length
      ? '<p class="texto-suave mt-8" style="font-size:.84rem">Pulamos ' + puladas.length + ' semana' + (puladas.length > 1 ? 's' : '') +
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

  // revalida: entre a revisão e o confirmar, um horário pode ter passado
  // ou sido ocupado (app aberto há tempo, sincronização com outro aparelho)
  const agoraD = new Date();
  const invalida = seriePendente.itens.some(
    (it) => deISO(it.data, it.hora) <= agoraD || !horarioLivre(it.data, it.hora)
  );
  if (invalida) {
    fecharModal('modal-serie');
    seriePendente = null;
    toast('Um dos horários ficou indisponível — revise o agendamento.');
    renderAgendar(cli);
    return;
  }

  // recomputa a cobertura com o estado mais recente dos créditos
  const tally = {};
  for (const it of seriePendente.itens) {
    it.cobertura = coberturaParaProc(cli, seriePendente.procId, tally);
    if (it.cobertura) tally[it.cobertura.chave] = (tally[it.cobertura.chave] || 0) + 1;
  }

  const n = seriePendente.itens.length;
  const serieId = n > 1 ? uid() : null;
  const criadas = [];
  for (const it of seriePendente.itens) {
    const ag = {
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
    };
    criadas.push(ag);
    salvarAgendamento(ag);
  }
  fecharModal('modal-serie');
  seriePendente = null;
  agSel.data = null; agSel.hora = null;
  $('#ag-rec').checked = false;
  const campo = $('#ag-rec-qtd'); campo.value = ''; campo._auto = false;
  toast(n > 1 ? 'Sessões agendadas.' : 'Sessão agendada.');
  mostrarAbaSessoes('proximas');
  irPara('sessoes');

  // avisos com o app fechado: os alarmes da agenda do celular tocam sozinhos
  confirmar('Avisos no celular',
    'Os lembretes do app (1 dia e 2 horas antes) aparecem com o app aberto. ' +
    'Para ser avisada <b>mesmo com o app fechado</b>, adicione ' +
    (n > 1 ? 'suas sessões' : 'sua sessão') + ' à agenda do celular — os alarmes tocam sozinhos.',
    [
      { rotulo: 'Adicionar à agenda do celular', classe: 'btn-zap', acao: () => baixarICS(criadas, cli) },
      { rotulo: 'Agora não', classe: 'btn-suave', acao: null },
    ]);
}

/* ------------------------------------------------------------
   Vista: Minhas sessões
   ------------------------------------------------------------ */
function mostrarAbaSessoes(qual) {
  $('#aba-proximas').classList.toggle('ativa', qual === 'proximas');
  $('#aba-historico').classList.toggle('ativa', qual === 'historico');
  $('#lista-proximas').hidden = qual !== 'proximas';
  $('#lista-historico').hidden = qual !== 'historico';
}

function renderProximas(cli) {
  const lista = $('#lista-proximas');
  const prox = proximasDoCliente(cli);
  if (!prox.length) {
    lista.innerHTML = '<div class="vazio">Nenhuma sessão marcada.<br>Toque em <b>Agendar</b> para reservar seu horário.</div>';
    return;
  }
  let html = '';
  if (prox.length > 1) {
    html += '<button class="btn-zap mb-14" id="btn-ics-todas">Adicionar todas à agenda do celular</button>';
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
          '<button class="btn-mini dourado" data-ics="' + a.id + '" title="Adicionar à agenda"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><rect x="3" y="5" width="18" height="16" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="3" x2="8" y2="7"/><line x1="16" y1="3" x2="16" y2="7"/></svg></button>' +
          '<a class="btn-mini verde" target="_blank" rel="noopener" href="' + esc(zapRemarcar(cli, a)) + '" title="Remarcar pelo WhatsApp"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></a>' +
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
    'Olá! Sou ' + cli.nome + '. Preciso remarcar minha sessão de ' + nomeProc(a.procId) +
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
    esc(nomeProc(a.procId)) + ' · ' + fmtDataLonga(a.data) + ' às ' + esc(a.hora) +
    '.<br>' + (a.planoId ? 'A sessão volta para o seu saldo. ' : '') + 'Deseja cancelar?', botoes);
}

function cancelarAgs(lista) {
  for (const a of lista) { a.status = 'cancelada'; salvarAgendamento(a); }
  if (lista.length) promoverAvulsas(clientePorId(lista[0].clienteId));
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
    lista.innerHTML = '<div class="vazio">Seu histórico aparecerá aqui após a primeira sessão.</div>';
    return;
  }
  let html = '<div class="cartao texto-centro mb-14" style="padding:16px">' +
    '<span style="font-family:var(--fonte-serif);font-size:2rem;color:var(--ouro-2)">' + feitas + '</span><br>' +
    '<small class="texto-suave">' + (feitas === 1 ? 'sessão realizada' : 'sessões realizadas') + '</small></div>';

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
    area.innerHTML = '<div class="vazio">Você ainda não tem um plano.<br>Escolha um protocolo abaixo e fale com nosso atendimento.</div>';
  } else {
    area.innerHTML = planosAtivos.map((plano) => {
      const doPlano = pools.filter((p) => p.plano.id === plano.id);
      const dc = new Date(plano.compradoEm);
      return '<div class="cartao mb-14">' +
        '<div class="linha-flex" style="justify-content:space-between;margin-bottom:10px">' +
          '<strong style="font-weight:500;flex:1">' + esc(plano.nome) + '</strong>' +
          '<small class="texto-suave" style="flex:none">desde ' + String(dc.getDate()).padStart(2, '0') + '/' + String(dc.getMonth() + 1).padStart(2, '0') + '/' + dc.getFullYear() + '</small>' +
        '</div>' +
        doPlano.map((p) => barraPool(p, true)).join('') +
        '<a class="btn-zap mt-8" target="_blank" rel="noopener" href="' +
          esc(linkZap(CONFIG.WHATS_COMERCIAL, 'Olá! Sou ' + cli.nome + '. Gostaria de renovar meu plano *' + plano.nome + '*.')) +
        '">' + ICONE_ZAP + ' Renovar pelo WhatsApp</a>' +
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
          'Olá! Vim pelo app do Spa Vanessa Lima. Tenho interesse no pacote *' + p.nome + '* (' + p.desc + ') — ' + moeda(p.preco) + '. Pode me ajudar?')) +
      '">' + ICONE_ZAP + ' Comprar · Renovar</a>' +
    '</div>'
  ).join('');

  // procedimentos
  $('#lista-procedimentos').innerHTML = PROCEDIMENTOS.map((p) =>
    '<div style="padding:8px 2px;border-bottom:1px solid var(--linha)"><span style="color:var(--ouro)">✦</span>&nbsp; ' + esc(p.nome) + '</div>'
  ).join('');
  $('#zap-avulsa').href = linkZap(CONFIG.WHATS_COMERCIAL,
    'Olá! Vim pelo app do Spa Vanessa Lima. Gostaria de saber os valores das sessões avulsas.');
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
      const texto = 'É hoje: sua sessão de <b>' + esc(nomeProc(a.procId)) + '</b> é às <b>' + esc(a.hora) + '</b>.';
      banners.push({ id: uid(), clienteId: cli.id, agId: a.id, texto });
      notificar('Spa Vanessa Lima', 'Sua sessão de ' + nomeProc(a.procId) + ' é hoje às ' + a.hora + '.');
    } else if (mins <= 1440 && !f.d1) {
      f.d1 = true; mudou = true;
      const quando = a.data === hojeISO() ? 'hoje' : 'amanhã';
      const texto = 'Lembrete: sua sessão de <b>' + esc(nomeProc(a.procId)) + '</b> é <b>' + quando + '</b> às <b>' + esc(a.hora) + '</b>.';
      banners.push({ id: uid(), clienteId: cli.id, agId: a.id, texto });
      notificar('Spa Vanessa Lima', 'Sessão de ' + nomeProc(a.procId) + ' ' + quando + ' às ' + a.hora + '.');
    }
  }

  if (mudou) {
    gravarJSON(CHAVE_LEMBRETES, flags);
    gravarJSON(CHAVE_BANNERS, banners);
    renderBanners();
    return;
  }

  // mesmo sem lembrete novo, expira banners de sessões que já começaram
  const pendentes = lerJSON(CHAVE_BANNERS, []);
  const haExpirado = pendentes.some((b) => {
    const a = b.agId && DB.agendamentos.find((x) => x.id === b.agId);
    return !(a && a.status === 'agendada' && deISO(a.data, a.hora).getTime() > agora());
  });
  if (haExpirado) renderBanners();
}

function notificar(titulo, corpo) {
  if ('Notification' in window && Notification.permission === 'granted') {
    try { new Notification(titulo, { body: corpo, icon: 'data:,' }); } catch (e) { /* alguns Androids exigem service worker */ }
  }
}

function renderBanners() {
  const cli = clienteLogado();
  const area = $('#area-banners');
  if (!area) return;
  // descarta banners de sessões que já começaram, foram canceladas ou concluídas
  const todos = lerJSON(CHAVE_BANNERS, []);
  const validos = todos.filter((b) => {
    const a = b.agId && DB.agendamentos.find((x) => x.id === b.agId);
    return a && a.status === 'agendada' && deISO(a.data, a.hora).getTime() > agora();
  });
  if (validos.length !== todos.length) gravarJSON(CHAVE_BANNERS, validos);
  if (!cli) { area.innerHTML = ''; return; }
  const banners = validos.filter((b) => b.clienteId === cli.id);
  area.innerHTML = '';
  for (const b of banners) {
    const div = document.createElement('div');
    div.className = 'banner';
    div.innerHTML = '<span class="banner-icone"><svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg></span><p>' + b.texto + '</p>';
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
    // DTSTAMP precisa ser UTC (RFC 5545); DTSTART/DTEND ficam em hora local
    const dtstampUTC = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
    linhas.push(
      'BEGIN:VEVENT',
      'UID:' + a.id + '@spa-vanessa-lima',
      'DTSTAMP:' + dtstampUTC,
      'DTSTART:' + carimbo(ini),
      'DTEND:' + carimbo(fim),
      'SUMMARY:' + nomeProc(a.procId) + ' — Spa Vanessa Lima',
      'DESCRIPTION:Sessão agendada pelo app do Spa Vanessa Lima',
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
  toast('Abra o arquivo baixado para salvar na agenda do celular.');
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
    areaLem.innerHTML = '<div class="vazio">Nenhuma sessão de hoje ou amanhã pendente de lembrete.</div>';
  } else {
    areaLem.innerHTML = paraLembrar.map((a) => {
      const c = clientePorId(a.clienteId);
      if (!c) return '';
      const quando = a.data === hoje ? 'hoje' : 'amanhã';
      const msg = 'Olá, ' + primeiroNome(c.nome) + '! Passando para lembrar da sua sessão de *' +
        nomeProc(a.procId) + '* ' + quando + ' às *' + a.hora + '* no Spa Vanessa Lima. Até logo!';
      return '<div class="sessao-item">' +
        '<div class="sessao-info"><strong>' + esc(c.nome) + '</strong>' +
        '<small>' + esc(nomeProc(a.procId)) + ' · <b>' + quando + '</b> às <b>' + a.hora + '</b></small></div>' +
        '<a class="btn-mini verde" target="_blank" rel="noopener" href="' + esc(linkZap(c.whats, msg)) + '">Lembrar</a>' +
      '</div>';
    }).join('');
  }

  // renovações — conta sessões ainda não realizadas (agendada não é gasta)
  const renovar = DB.clientes
    .filter((c) => !c.removido && (c.planos || []).some((p) => !p.removido))
    .map((c) => ({ c, rest: porRealizar(c) }))
    .filter((x) => x.rest <= 2)
    .sort((a, b) => a.rest - b.rest);

  const areaRen = $('#adm-renovacoes');
  if (!renovar.length) {
    areaRen.innerHTML = '<div class="vazio">Nenhuma cliente perto de terminar o plano.</div>';
  } else {
    areaRen.innerHTML = renovar.map(({ c, rest }) => {
      const msg = 'Olá, ' + primeiroNome(c.nome) + '! Seu plano no Spa Vanessa Lima está ' +
        (rest === 0 ? 'finalizado' : 'quase no fim (' + rest + ' ' + (rest === 1 ? 'sessão restante' : 'sessões restantes') + ')') +
        '. Podemos garantir a sua renovação?';
      return '<div class="sessao-item">' +
        '<div class="avatar">' + esc(iniciais(c.nome)) + '</div>' +
        '<div class="sessao-info"><strong>' + esc(c.nome) + '</strong>' +
        '<small>' + (rest === 0 ? 'plano finalizado' : rest + ' ' + (rest === 1 ? 'sessão restante' : 'sessões restantes')) + '</small></div>' +
        '<a class="btn-mini verde" target="_blank" rel="noopener" href="' + esc(linkZap(c.whats, msg)) + '">Oferecer</a>' +
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
    area.innerHTML = '<div class="vazio">Nenhum atendimento neste dia.</div>';
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
        esc((c ? c.nome : '') + ' · ' + nomeProc(a.procId)) + ' · ' + esc(a.hora) +
        (a.planoId ? '<br>A sessão volta para o saldo da cliente.' : '<br>Sessão avulsa — não há saldo a devolver.'),
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
  const cli = clientePorId(a.clienteId);
  // sessão avulsa concluída: se agora houver crédito livre, consome o plano
  if (status === 'concluida' && !a.planoId && cli) {
    const cob = coberturaParaProc(cli, a.procId);
    if (cob) { a.planoId = cob.plano.id; a.poolIx = cob.poolIx; }
  }
  salvarAgendamento(a);
  // crédito devolvido pode cobrir sessões futuras gravadas como avulsas
  if (cli && (status === 'cancelada' || (status === 'falta' && !CONFIG.FALTA_CONSOME))) {
    promoverAvulsas(cli);
  }
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
  $('#enc-data').min = hojeISO();
  $('#enc-data').value = admDia >= hojeISO() ? admDia : hojeISO();
  atualizarHorasEncaixe();
  abrirModal('modal-encaixe');
}

function atualizarHorasEncaixe() {
  const data = $('#enc-data').value;
  const agoraD = new Date();
  const fechado = data && !diaAberto(deISO(data));
  $('#enc-hora').innerHTML = horariosDoDia(data).map((h) => {
    const passado = !data || deISO(data, h) <= agoraD;
    const ocupado = data && !horarioLivre(data, h);
    const ok = data && !fechado && !passado && !ocupado;
    const sufixo = fechado ? ' — fechado' : ocupado ? ' — ocupado' : (data && passado) ? ' — já passou' : '';
    return '<option value="' + h + '"' + (ok ? '' : ' disabled') + '>' + h + sufixo + '</option>';
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
  if (!diaAberto(deISO(data))) { toast('O spa não abre neste dia (' + DIAS_LONGO[deISO(data).getDay()] + ').'); return; }
  if (deISO(data, hora) <= new Date()) { toast('Esse horário já passou — escolha outro.'); return; }
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
  const dig = termo.replace(/\D/g, '');
  const lista = DB.clientes
    .filter((c) => !c.removido)
    .filter((c) => !termo || c.nome.toLowerCase().includes(termo) || (dig && c.whats.includes(dig)))
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
    '<label class="rotulo" for="nc-email">E-mail (opcional)</label>' +
    '<input class="campo" id="nc-email" type="email" placeholder="cliente@email.com">' +
    '<label class="rotulo" for="nc-nasc">Data de nascimento (opcional)</label>' +
    '<input class="campo" id="nc-nasc" type="date">' +
    '<label class="rotulo">Planos (opcional — pode marcar mais de um)</label>' +
    '<div id="nc-pacotes">' +
      PACOTES.map((p) =>
        '<label class="linha-flex" style="justify-content:space-between;padding:9px 2px;border-bottom:1px solid var(--linha);cursor:pointer">' +
          '<span style="flex:1">' + esc(p.nome) + ' — ' + moeda(p.preco) + '</span>' +
          '<input type="checkbox" value="' + p.id + '" style="width:20px;height:20px;accent-color:var(--ouro);flex:none">' +
        '</label>').join('') +
    '</div>' +
    '<button class="btn mt-20" id="btn-nc-salvar">Cadastrar</button>';
  ligarFechamento(corpo);
  $('#btn-nc-salvar').addEventListener('click', () => {
    const nome = $('#nc-nome').value.trim();
    const whats = normWhats($('#nc-whats').value);
    if (nome.length < 3) { toast('Digite o nome completo.'); return; }
    if (whats.length < 12) { toast('Digite o WhatsApp com DDD.'); return; }
    if (clientePorWhats(whats)) { toast('Já existe cliente com este WhatsApp.'); return; }
    const pacotes = Array.from(corpo.querySelectorAll('#nc-pacotes input:checked')).map((x) => x.value);
    // cadastro com número de cliente arquivada → reativa o perfil antigo
    const arquivada = DB.clientes.find((c) => c.whats === whats && c.removido);
    if (arquivada) {
      arquivada.removido = false;
      arquivada.planos = arquivada.planos || [];
      for (const pac of pacotes) arquivada.planos.push(criarPlano(pac, 'admin'));
      salvarCliente(arquivada);
      fecharModal('modal-cliente');
      toast('Cliente reativada ✓ (o histórico dela foi mantido)');
      renderAdmClientes();
      return;
    }
    const nova = {
      id: uid(), nome, whats,
      email: $('#nc-email').value.trim(),
      nascimento: $('#nc-nasc').value || '',
      criadoEm: agora(), planos: [], onboarded: true,
    };
    for (const pac of pacotes) nova.planos.push(criarPlano(pac, 'admin'));
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

    '<div class="linha-flex mb-8">' +
      '<a class="btn-mini verde" style="flex:none" target="_blank" rel="noopener" href="' +
        esc(linkZap(c.whats, 'Olá, ' + primeiroNome(c.nome) + '! Aqui é do Spa Vanessa Lima.')) + '">WhatsApp · ' + fmtWhats(c.whats) + '</a>' +
    '</div>' +
    ((c.email || c.nascimento)
      ? '<p class="texto-suave mb-14" style="font-size:.85rem">' +
          (c.email ? esc(c.email) : '') +
          (c.nascimento ? (c.email ? ' · ' : '') + 'aniversário: ' + fmtNascimento(c.nascimento) : '') +
        '</p>'
      : '<div class="mb-8"></div>') +

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
            '<div class="pool-barra"><i style="width:' + Math.min(100, Math.max(0, p.total ? Math.round(((p.restantes + p.reservadas) / p.total) * 100) : 0)) + '%"></i></div>' +
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
    '<div class="linha-flex" style="justify-content:space-between">' +
      '<button class="link-discreto" id="btn-ficha-arquivar" style="flex:none">Arquivar cliente</button>' +
      '<button class="link-discreto" id="btn-ficha-excluir" style="flex:none;color:var(--alerta)">Excluir e apagar dados</button>' +
    '</div>';

  ligarFechamento(corpo);

  corpo.querySelectorAll('[data-ajuste]').forEach((b) =>
    b.addEventListener('click', () => {
      const [planoId, ixStr] = b.dataset.ajuste.split(':');
      const plano = (c.planos || []).find((p) => p.id === planoId);
      if (!plano) return;
      const pool = plano.pools[Number(ixStr)];
      const delta = Number(b.dataset.delta);
      // não deixa o total ficar abaixo do que já foi concluído + agendado
      const info = poolsDoCliente(c).find((p) => p.chave === b.dataset.ajuste);
      if (delta < 0 && info && info.total + delta < info.usadas + info.reservadas) {
        toast('Há ' + (info.usadas + info.reservadas) + ' sessões concluídas ou agendadas neste pacote — cancele ou conclua antes de reduzir o saldo.');
        return;
      }
      pool.ajuste = (pool.ajuste || 0) + delta;
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
            promoverAvulsas(c); // sessões futuras avulsas passam a usar o plano novo
            toast('Pacote adicionado ✓');
            abrirFichaCliente(id);
            renderAdmClientes();
          } },
        { rotulo: 'Voltar', classe: 'btn-suave', acao: null },
      ]);
  });

  $('#btn-ficha-excluir').addEventListener('click', () => {
    confirmar('Excluir cliente',
      '<b>' + esc(c.nome) + '</b> será excluída definitivamente: cadastro, WhatsApp, planos, histórico e acesso serão apagados de todos os aparelhos na próxima sincronização. <b>Esta ação não tem volta.</b>',
      [
        { rotulo: 'Excluir definitivamente', classe: 'btn', acao: () => {
            for (const a of agsDoCliente(c.id)) {
              if (a.status !== 'cancelada') { a.status = 'cancelada'; salvarAgendamento(a); }
            }
            c.nome = ''; c.whats = ''; c.email = ''; c.nascimento = ''; c.planos = [];
            c.onboarded = false; c.removido = true; c.excluido = true;
            salvarCliente(c);
            fecharModal('modal-cliente');
            toast('Cliente excluída — dados apagados.');
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
   Logotipo 3D interativo (tela de entrada)
   ------------------------------------------------------------ */
function iniciarLogo3D() {
  const cena = $('#logo3d');
  const placa = $('#logo3d-placa');
  if (!cena || !placa) return;

  let ang = -22, tomb = 10, auto = true, retomar;
  const reduzMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function aplicar() {
    placa.style.transform = 'rotateX(' + (-tomb) + 'deg) rotateY(' + ang + 'deg)';
  }
  aplicar();

  if (!reduzMovimento) {
    (function passo() {
      if (auto) { ang += 0.35; aplicar(); }
      requestAnimationFrame(passo);
    })();
  }

  let arrastando = false, x0 = 0, y0 = 0, ang0 = 0, tomb0 = 0;
  cena.addEventListener('pointerdown', (e) => {
    arrastando = true; auto = false; clearTimeout(retomar);
    x0 = e.clientX; y0 = e.clientY; ang0 = ang; tomb0 = tomb;
    cena.setPointerCapture(e.pointerId);
  });
  cena.addEventListener('pointermove', (e) => {
    if (!arrastando) return;
    ang = ang0 + (e.clientX - x0) * 0.55;
    tomb = Math.max(-28, Math.min(28, tomb0 + (e.clientY - y0) * 0.25));
    aplicar();
  });
  const soltar = () => {
    if (!arrastando) return;
    arrastando = false;
    retomar = setTimeout(() => { auto = true; }, 2400);
  };
  cena.addEventListener('pointerup', soltar);
  cena.addEventListener('pointercancel', soltar);
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
  ['#login-whats', '#login-nome', '#login-email', '#login-nascimento'].forEach((sel) =>
    $(sel).addEventListener('keydown', (e) => { if (e.key === 'Enter') entrar(); }));
  $('#btn-abrir-equipe').addEventListener('click', () => { $('#pin-campo').value = ''; abrirModal('modal-pin'); });
  $('#btn-pin-ok').addEventListener('click', verificarPin);
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

  $('#aba-proximas').addEventListener('click', () => mostrarAbaSessoes('proximas'));
  $('#aba-historico').addEventListener('click', () => mostrarAbaSessoes('historico'));

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
  iniciarLogo3D();
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
