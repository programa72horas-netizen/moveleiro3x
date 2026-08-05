/*
 * Estúdio 72h · Aplicativo
 * ------------------------------------------------------------------
 * Fluxo: login do designer → escolha do modelo → planejamento →
 * geração dos textos (IA ou manual) → edição ao vivo → PNG.
 *
 * A IA NUNCA desenha: ela só preenche os campos de texto dos modelos
 * definidos em templates.js. O layout é sempre idêntico ao modelo.
 */

'use strict';

/* ================== CONFIGURAÇÃO ==================
 * A equipe de verdade é gerida pela tela "Equipe" (admin) e vive no
 * servidor. A lista abaixo é só o RESERVA para quando o app roda sem
 * servidor (demonstração/estático) — mantenha-a mínima.
 */
const CONFIG = {
  DESIGNERS_RESERVA: [
    { nome: 'Deborah', pin: '7272', admin: true },
    { nome: 'Designer 1', pin: '1111', admin: false },
    { nome: 'Designer 2', pin: '2222', admin: false },
    { nome: 'Designer 3', pin: '3333', admin: false },
  ],
  // false = versão final limpa: só os modelos criados pela equipe aparecem
  MODELOS_EXEMPLO: typeof window !== 'undefined' && !!window.E72_MOSTRAR_EXEMPLOS,
  MARCA_PADRAO: {
    id: 'padrao',
    nome: 'Sua Loja de Móveis',
    corPrimaria: '#E3242B',
    corSecundaria: '#FFC400',
    logo: null,
    whatsapp: '(48) 99999-9999',
    endereco: 'Av. Central, 1200 · Centro',
  },
  LIMITE_HISTORICO: 20,
};

/* ================== ESTADO ================== */

const Estado = {
  designer: null,          // { nome }
  pin: null,
  admin: false,
  marcas: [],
  arte: null,              // arte em edição (veja novaArte)
  telaAtual: 'login',
};

function novaArte(modeloId) {
  return {
    id: 'arte-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    modeloId,
    marcaId: Estado.marcas[0] ? Estado.marcas[0].id : 'padrao',
    plano: { objetivo: 'vender', publico: '', oferta: '', preco: '', prazo: '', texto: '', quantidade: '3' },
    imagens: {},           // slotKey → dataURL
    variacoes: [],         // [{ slotKey: texto }]
    variacaoAtiva: 0,
    ajustes: {},           // ajustes visuais por variação: { indice: { eid: {...} } }
    registrada: false,     // já contou na produtividade?
    criadaEm: Date.now(),
  };
}

// aviso de produtividade: dispara e esquece — nunca atrapalha o fluxo
function contarEvento(tipo, quantidade = 1, segundos = 0) {
  if (!Estado.designer) return;
  try {
    fetch('api/eventos', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ designer: Estado.designer.nome, pin: Estado.pin, tipo, quantidade, segundos }),
    }).catch(() => {});
  } catch (_) { /* sem servidor, sem contagem */ }
}

// tempo da arte (criação → primeira exportação), enviado uma única vez
function segundosDaArte() {
  if (!Estado.arte || Estado.arte.tempoRegistrado) return 0;
  Estado.arte.tempoRegistrado = true;
  return Math.max(1, Math.min(4 * 3600, Math.round((Date.now() - Estado.arte.criadaEm) / 1000)));
}

/* ================== PERSISTÊNCIA ================== */

const Guardar = {
  ler(chave, padrao) {
    try {
      const bruto = localStorage.getItem(chave);
      return bruto ? JSON.parse(bruto) : padrao;
    } catch (_) { return padrao; }
  },
  gravar(chave, valor) {
    try {
      localStorage.setItem(chave, JSON.stringify(valor));
      return true;
    } catch (_) { return false; }
  },
  // a sessão vale só para a aba atual: em computador compartilhado, um
  // designer não entra por engano na conta do anterior
  lerSessao() {
    try { return JSON.parse(sessionStorage.getItem('e72.sessao')); } catch (_) { return null; }
  },
  gravarSessao(valor) {
    try {
      if (valor === null) sessionStorage.removeItem('e72.sessao');
      else sessionStorage.setItem('e72.sessao', JSON.stringify(valor));
    } catch (_) { /* sessão não lembrada; login continua funcionando */ }
  },
  chaveHistorico() {
    return 'e72.historico.' + (Estado.designer ? Estado.designer.nome : 'anonimo');
  },
};

/* ================== ATALHOS DE DOM ================== */

const $ = (seletor) => document.querySelector(seletor);
const el = (tag, cls, html) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html !== undefined) n.innerHTML = html;
  return n;
};

let avisoTimer = null;
function avisar(mensagem, erro = false) {
  const caixa = $('#aviso');
  caixa.textContent = mensagem;
  caixa.className = 'aviso' + (erro ? ' erro' : '');
  caixa.hidden = false;
  clearTimeout(avisoTimer);
  avisoTimer = setTimeout(() => { caixa.hidden = true; }, 4200);
}

/* ================== NAVEGAÇÃO ================== */

const TELAS = ['login', 'modelos', 'plano', 'estudio', 'historico', 'editor', 'equipe'];

function mostrarTela(nome) {
  Estado.telaAtual = nome;
  for (const t of TELAS) $('#tela-' + t).hidden = t !== nome;
  $('#topo').hidden = nome === 'login';
  for (const botao of document.querySelectorAll('.passo')) {
    botao.classList.toggle('ativo', botao.dataset.tela === nome);
  }
  // passos liberados conforme o progresso da arte atual
  const temArte = !!Estado.arte;
  document.querySelector('[data-tela="plano"]').disabled = !temArte;
  document.querySelector('[data-tela="estudio"]').disabled = !temArte || !Estado.arte.variacoes.length;
  if (nome === 'modelos') montarGradeModelos();
  if (nome === 'historico') montarHistorico();
  if (nome === 'equipe') montarTelaEquipe();
  window.scrollTo(0, 0);
}

/* ================== MARCAS ================== */

function carregarMarcas() {
  Estado.marcas = Guardar.ler('e72.marcas', []);
  if (!Estado.marcas.length) Estado.marcas = [{ ...CONFIG.MARCA_PADRAO }];
}

function marcaAtual() {
  return Estado.marcas.find((m) => m.id === (Estado.arte && Estado.arte.marcaId)) || Estado.marcas[0];
}

function montarSelecaoMarcas() {
  const select = $('#marca-selecao');
  select.innerHTML = '';
  for (const marca of Estado.marcas) {
    const opcao = document.createElement('option');
    opcao.value = marca.id;
    opcao.textContent = marca.nome;
    select.appendChild(opcao);
  }
  if (Estado.arte) select.value = Estado.arte.marcaId;
}

function iniciarMarcas() {
  $('#marca-selecao').addEventListener('change', (e) => {
    if (Estado.arte) Estado.arte.marcaId = e.target.value;
    carregarBanco(); // o banco de imagens é por cliente
  });

  $('#botao-nova-marca').addEventListener('click', () => {
    $('#marca-form').hidden = false;
    $('#marca-nome').value = '';
    $('#marca-whats').value = '';
    $('#marca-endereco').value = '';
    $('#marca-logo').value = '';
    $('#marca-logo-previa').hidden = true;
    $('#marca-logo-previa').dataset.logo = '';
  });

  $('#botao-cancelar-marca').addEventListener('click', () => { $('#marca-form').hidden = true; });

  let logoProcessando = null;
  $('#marca-logo').addEventListener('change', (e) => {
    const arquivo = e.target.files && e.target.files[0];
    if (!arquivo) return;
    logoProcessando = redimensionarImagem(arquivo, 900)
      .then((dataUrl) => {
        const previa = $('#marca-logo-previa');
        previa.src = dataUrl;
        previa.hidden = false;
        previa.dataset.logo = dataUrl;
      })
      .catch(() => avisar('Não consegui ler esse logo. Tente outro arquivo.', true))
      .finally(() => { logoProcessando = null; });
  });

  $('#botao-salvar-marca').addEventListener('click', async () => {
    const nome = $('#marca-nome').value.trim();
    if (!nome) { avisar('Dê um nome para a marca.', true); return; }
    if (logoProcessando) {
      const botao = $('#botao-salvar-marca');
      botao.disabled = true;
      await logoProcessando; // espera o logo terminar para não salvar a marca sem ele
      botao.disabled = false;
    }
    const marca = {
      id: 'marca-' + Date.now().toString(36),
      nome,
      corPrimaria: $('#marca-cor1').value,
      corSecundaria: $('#marca-cor2').value,
      logo: $('#marca-logo-previa').dataset.logo || null,
      whatsapp: $('#marca-whats').value.trim(),
      endereco: $('#marca-endereco').value.trim(),
    };
    Estado.marcas.push(marca);
    if (!Guardar.gravar('e72.marcas', Estado.marcas)) {
      avisar('Não foi possível salvar a marca (armazenamento cheio?).', true);
    }
    if (Estado.arte) Estado.arte.marcaId = marca.id;
    montarSelecaoMarcas();
    $('#marca-form').hidden = true;
    avisar('Marca "' + nome + '" salva.');
  });
}

/* ================== IMAGENS ================== */

// reduz a imagem enviada para caber no armazenamento local sem perder
// qualidade visível na arte (PNG mantém transparência para recortes)
function redimensionarImagem(arquivo, ladoMax = 1600) {
  return new Promise((resolver, rejeitar) => {
    const url = URL.createObjectURL(arquivo);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const escala = Math.min(1, ladoMax / Math.max(img.width, img.height));
      const tela = document.createElement('canvas');
      tela.width = Math.round(img.width * escala);
      tela.height = Math.round(img.height * escala);
      tela.getContext('2d').drawImage(img, 0, 0, tela.width, tela.height);
      const ehPng = /png$/i.test(arquivo.type);
      resolver(tela.toDataURL(ehPng ? 'image/png' : 'image/jpeg', 0.86));
    };
    img.onerror = () => { URL.revokeObjectURL(url); rejeitar(new Error('Imagem inválida')); };
    img.src = url;
  });
}

function montarCamposDeImagem() {
  const modelo = Modelos.porId(Estado.arte.modeloId);
  const slotsImagem = modelo.slots.filter((s) => s.tipo === 'imagem');
  $('#cartao-imagens').hidden = !slotsImagem.length;
  const caixa = $('#plano-imagens');
  caixa.innerHTML = '';
  for (const slot of slotsImagem) {
    const linha = el('div', 'imagem-slot');
    const campo = el('label', 'campo');
    campo.innerHTML = `<span>${slot.rotulo}${slot.opcional ? ' (opcional)' : ''}</span>`;
    const entrada = document.createElement('input');
    entrada.type = 'file';
    entrada.accept = 'image/*';
    const aplicar = (dataUrl) => {
      Estado.arte.imagens[slot.key] = dataUrl;
      previa.src = dataUrl;
      previa.hidden = false;
      if (Estado.telaAtual === 'estudio') pintarArte();
    };
    entrada.addEventListener('change', async () => {
      const arquivo = entrada.files && entrada.files[0];
      if (!arquivo) return;
      try {
        aplicar(await redimensionarImagem(arquivo));
      } catch (_) {
        avisar('Não consegui ler essa imagem. Tente outro arquivo.', true);
      }
    });
    campo.appendChild(entrada);
    const doBanco = el('button', 'botao botao-fantasma botao-mini', '📁 Do banco');
    doBanco.type = 'button';
    doBanco.title = 'Escolher uma imagem do banco deste cliente';
    doBanco.addEventListener('click', () => escolherDoBanco(aplicar));
    const previa = el('img', 'imagem-previa');
    previa.alt = '';
    const existente = Estado.arte.imagens[slot.key];
    if (existente) { previa.src = existente; } else { previa.hidden = true; }
    linha.appendChild(campo);
    linha.appendChild(doBanco);
    linha.appendChild(previa);
    caixa.appendChild(linha);
  }
}

/* ================== BANCO DE IMAGENS DO CLIENTE ================== */
/* Fotos e elementos de cada marca ficam no servidor (KV) e podem ser
 * usados em qualquer campo de imagem de qualquer arte. */

const Banco = { porMarca: {}, disponivel: true };

function marcaIdAtual() {
  const marca = marcaAtual();
  return marca ? marca.id : 'padrao';
}

async function carregarBanco(forcar = false) {
  const marcaId = marcaIdAtual();
  if (!forcar && Banco.porMarca[marcaId]) { montarBanco(); return; }
  try {
    const dados = await pedirAoServidor('api/imagens', { acao: 'listar', marcaId });
    Banco.porMarca[marcaId] = dados.imagens || [];
    Banco.disponivel = true;
  } catch (erro) {
    Banco.porMarca[marcaId] = Banco.porMarca[marcaId] || [];
    if (erro.semKV) Banco.disponivel = false;
  }
  montarBanco();
}

function montarBanco() {
  const lista = $('#banco-lista');
  const aviso = $('#banco-aviso');
  lista.innerHTML = '';
  aviso.hidden = Banco.disponivel;
  if (!Banco.disponivel) {
    aviso.textContent = 'O banco de imagens funciona na versão publicada (KV configurado).';
  }
  const imagens = Banco.porMarca[marcaIdAtual()] || [];
  for (const item of imagens) {
    const caixa = el('span', 'ref-item');
    const img = el('img', 'ref-miniatura');
    img.src = item.thumb;
    img.alt = item.nome;
    img.title = item.nome;
    const remover = el('button', 'ref-remover', '×');
    remover.type = 'button';
    remover.title = 'Excluir do banco';
    remover.addEventListener('click', async () => {
      if (!window.confirm('Excluir "' + item.nome + '" do banco do cliente?')) return;
      try {
        const dados = await pedirAoServidor('api/imagens',
          { acao: 'excluir', marcaId: marcaIdAtual(), id: item.id });
        Banco.porMarca[marcaIdAtual()] = dados.imagens || [];
        montarBanco();
      } catch (erro) { avisar('Não excluiu: ' + erro.message, true); }
    });
    caixa.appendChild(img);
    caixa.appendChild(remover);
    lista.appendChild(caixa);
  }
  if (!imagens.length && Banco.disponivel) {
    lista.appendChild(el('p', 'historico-vazio', 'Nenhuma imagem deste cliente ainda.'));
  }
}

async function enviarParaBanco(arquivos) {
  const status = $('#banco-status');
  let enviadas = 0;
  for (const arquivo of arquivos) {
    status.textContent = `Enviando ${enviadas + 1} de ${arquivos.length}…`;
    try {
      const imagem = await redimensionarImagem(arquivo, 1600);
      const thumb = await redimensionarImagem(arquivo, 220);
      const dados = await pedirAoServidor('api/imagens', {
        acao: 'enviar',
        marcaId: marcaIdAtual(),
        nome: (arquivo.name || 'imagem').replace(/\.[^.]+$/, '').slice(0, 60),
        imagem,
        thumb,
      });
      Banco.porMarca[marcaIdAtual()] = dados.imagens || [];
      enviadas++;
    } catch (erro) {
      avisar('Falhou o envio de "' + arquivo.name + '": ' + erro.message, true);
      if (erro.semKV) { Banco.disponivel = false; break; }
    }
  }
  status.textContent = enviadas ? enviadas + ' imagem(ns) no banco ✓' : '';
  setTimeout(() => { status.textContent = ''; }, 4000);
  montarBanco();
}

// abre o seletor para escolher uma imagem do banco e devolve o dataURL
function escolherDoBanco(aoEscolher) {
  const fundo = $('#banco-seletor');
  const lista = $('#banco-seletor-lista');
  lista.innerHTML = '';
  const imagens = Banco.porMarca[marcaIdAtual()] || [];
  if (!imagens.length) {
    avisar(Banco.disponivel
      ? 'O banco deste cliente está vazio — envie imagens no cartão "Banco de imagens".'
      : 'O banco de imagens precisa da versão publicada (KV).', true);
    return;
  }
  for (const item of imagens) {
    const img = el('img', 'ref-miniatura ref-clicavel');
    img.src = item.thumb;
    img.alt = img.title = item.nome;
    img.addEventListener('click', async () => {
      fundo.hidden = true;
      try {
        const dados = await pedirAoServidor('api/imagens',
          { acao: 'obter', marcaId: marcaIdAtual(), id: item.id });
        if (dados.imagem) aoEscolher(dados.imagem);
        else avisar('Imagem não encontrada no banco.', true);
      } catch (erro) { avisar('Não carregou a imagem: ' + erro.message, true); }
    });
    lista.appendChild(img);
  }
  fundo.hidden = false;
}

/* ================== LOGIN ================== */

let designerEscolhido = null;

function montarChipsLogin(nomes) {
  const caixa = $('#login-designers');
  caixa.innerHTML = '';
  for (const nome of nomes) {
    const chip = el('button', 'chip-designer', esc(nome));
    chip.type = 'button';
    chip.addEventListener('click', () => {
      designerEscolhido = nome;
      for (const c of caixa.children) c.classList.toggle('ativo', c === chip);
      $('#login-pin').focus();
    });
    caixa.appendChild(chip);
  }
}

// o servidor é a fonte da verdade; a lista reserva só vale sem servidor
async function carregarNomesEquipe() {
  try {
    const resposta = await fetch('api/equipe');
    if (resposta.ok) {
      const dados = await resposta.json();
      if (Array.isArray(dados.nomes) && dados.nomes.length) {
        montarChipsLogin(dados.nomes);
        return;
      }
    }
  } catch (_) { /* segue com a reserva */ }
  montarChipsLogin(CONFIG.DESIGNERS_RESERVA.map((d) => d.nome));
}

async function validarEntrada(nome, pin) {
  try {
    const resposta = await fetch('api/entrar', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ nome, pin }),
    });
    if (resposta.ok) {
      const dados = await resposta.json();
      return { ok: true, admin: !!dados.admin };
    }
    if (resposta.status === 401) return { ok: false };
  } catch (_) { /* sem servidor: cai na reserva */ }
  const registro = CONFIG.DESIGNERS_RESERVA.find((d) => d.nome === nome && d.pin === pin);
  return registro ? { ok: true, admin: !!registro.admin } : { ok: false };
}

function entrarNoEstudio(nome, pin, admin) {
  Estado.designer = { nome };
  Estado.pin = pin;
  Estado.admin = admin;
  Guardar.gravarSessao({ nome, pin, admin });
  $('#usuario-nome').textContent = nome;
  document.querySelector('[data-tela="equipe"]').hidden = !admin;
  mostrarTela('modelos');
  carregarModelosPersonalizados();
}

function iniciarLogin() {
  carregarNomesEquipe();

  $('#form-login').addEventListener('submit', async (evento) => {
    evento.preventDefault();
    $('#login-erro').hidden = true;
    const pin = $('#login-pin').value.trim();
    if (!designerEscolhido) { $('#login-erro').hidden = false; return; }
    const botao = $('.login-entrar');
    botao.disabled = true;
    const resultado = await validarEntrada(designerEscolhido, pin);
    botao.disabled = false;
    if (!resultado.ok) { $('#login-erro').hidden = false; return; }
    entrarNoEstudio(designerEscolhido, pin, resultado.admin);
  });

  $('#botao-sair').addEventListener('click', () => {
    Guardar.gravarSessao(null);
    Estado.designer = null;
    Estado.pin = null;
    Estado.admin = false;
    Estado.arte = null;
    document.querySelector('[data-tela="equipe"]').hidden = true;
    $('#login-pin').value = '';
    mostrarTela('login');
  });

  // sessão lembrada (apenas nesta aba); revalida em segundo plano
  const sessao = Guardar.lerSessao();
  if (sessao && sessao.nome && sessao.pin) {
    entrarNoEstudio(sessao.nome, sessao.pin, !!sessao.admin);
    validarEntrada(sessao.nome, sessao.pin).then((resultado) => {
      if (!resultado.ok) { $('#botao-sair').click(); return; }
      if (resultado.admin !== Estado.admin) {
        Estado.admin = resultado.admin;
        Guardar.gravarSessao({ nome: sessao.nome, pin: sessao.pin, admin: resultado.admin });
        document.querySelector('[data-tela="equipe"]').hidden = !resultado.admin;
      }
    });
    return;
  }
  registrarTodosPersonalizados([]); // modelos locais aparecem mesmo sem login prévio
  carregarModelosPersonalizados();
  mostrarTela('login');
}

/* ================== MODELOS DA EQUIPE ================== */
/* Os modelos criados no app moram no servidor (KV) para valerem para toda a
 * equipe; sem KV configurado, ficam guardados neste navegador. */

let modelosNaNuvem = false;

function registrarTodosPersonalizados(daNuvem) {
  const locais = Guardar.ler('e72.modelosLocais', []);
  const idsNuvem = new Set((daNuvem || []).map((m) => m.id));
  Modelos.registrarPersonalizados([
    ...(daNuvem || []).map((m) => ({ ...m, origem: 'nuvem' })),
    ...locais.filter((m) => !idsNuvem.has(m.id)).map((m) => ({ ...m, origem: 'local' })),
  ]);
}

async function carregarModelosPersonalizados() {
  let daNuvem = [];
  try {
    const resposta = await fetch('api/modelos');
    if (resposta.ok) {
      const dados = await resposta.json();
      daNuvem = Array.isArray(dados.modelos) ? dados.modelos : [];
      modelosNaNuvem = !dados.semKV;
    }
  } catch (_) { modelosNaNuvem = false; }
  registrarTodosPersonalizados(daNuvem);
  if (Estado.telaAtual === 'modelos') montarGradeModelos();
}

/* ================== PASSO 1 · MODELOS ================== */

function miniaturaDeModelo(modelo, marca, valores, ajustes) {
  const caixa = el('div', 'miniatura');
  const escala = el('div', 'mini-escala');
  const html = htmlComAjustes(modelo.render(valores, marca), ajustes);
  escala.innerHTML = `<style>${Modelos.css}</style>` + html;
  caixa.appendChild(escala);
  // a escala real é aplicada depois que o cartão entra no DOM
  requestAnimationFrame(() => {
    const fator = caixa.clientWidth / 1080;
    escala.style.transform = `scale(${fator})`;
  });
  return caixa;
}

function esc(texto) {
  return String(texto ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function montarGradeModelos() {
  const grade = $('#grade-modelos');
  grade.innerHTML = '';
  const marca = marcaAtual() || CONFIG.MARCA_PADRAO;
  for (const numero of ['1', '2', '3', '0']) {
    const fase = Modelos.fases[numero];
    const modelosDaFase = Modelos.lista.filter((m) => String(m.fase) === numero);
    if (!modelosDaFase.length && numero !== '0') continue;

    const bloco = el('section', 'fase-bloco');
    bloco.appendChild(el('h3', null, fase.nome));
    bloco.appendChild(el('p', null, fase.resumo));
    const linha = el('div', 'fase-grade');

    for (const modelo of modelosDaFase) {
      const cartao = el('div', 'cartao-modelo');
      cartao.style.cursor = 'pointer';
      cartao.appendChild(miniaturaDeModelo(modelo, marca, Modelos.exemplos(modelo)));
      const info = el('div', 'cartao-modelo-info');
      const acoes = el('div', 'cartao-modelo-acoes',
        `<strong>${esc(modelo.nome)}</strong>`);
      if (modelo.personalizado) {
        const editar = el('button', 'botao botao-fantasma botao-mini', '✎ Editar');
        editar.type = 'button';
        editar.addEventListener('click', (evento) => {
          evento.stopPropagation();
          abrirEditor(modelo);
        });
        acoes.appendChild(editar);
      }
      info.appendChild(acoes);
      info.appendChild(el('span', null, esc(modelo.resumo)));
      cartao.appendChild(info);
      cartao.addEventListener('click', () => escolherModelo(modelo.id));
      linha.appendChild(cartao);
    }

    if (numero === '0') {
      const adicionar = el('button', 'cartao-adicionar');
      adicionar.type = 'button';
      adicionar.innerHTML = '<span class="mais">+</span><span>Adicionar um modelo meu</span>' +
        '<span style="font-size:12.5px">envie a imagem de um layout que você já usa</span>';
      adicionar.addEventListener('click', () => abrirEditor(null));
      linha.appendChild(adicionar);
    }

    bloco.appendChild(linha);
    grade.appendChild(bloco);
  }
}

function escolherModelo(modeloId) {
  const anterior = Estado.arte;
  // troca de modelo mantém o planejamento já digitado
  Estado.arte = novaArte(modeloId);
  if (anterior) {
    Estado.arte.plano = anterior.plano;
    Estado.arte.marcaId = anterior.marcaId;
  }
  $('#plano-modelo-nome').textContent = Modelos.porId(modeloId).nome;
  montarSelecaoMarcas();
  montarCamposDeImagem();
  preencherFormularioPlano();
  carregarBanco();
  mostrarTela('plano');
}

/* ================== PASSO 2 · PLANEJAMENTO ================== */

function preencherFormularioPlano() {
  const plano = Estado.arte.plano;
  $('#plano-objetivo').value = plano.objetivo || 'vender';
  $('#plano-publico').value = plano.publico || '';
  $('#plano-oferta').value = plano.oferta || '';
  $('#plano-preco').value = plano.preco || '';
  $('#plano-prazo').value = plano.prazo || '';
  $('#plano-texto').value = plano.texto || '';
  $('#plano-quantidade').value = plano.quantidade || '3';
}

function lerFormularioPlano() {
  Estado.arte.plano = {
    objetivo: $('#plano-objetivo').value,
    publico: $('#plano-publico').value.trim(),
    oferta: $('#plano-oferta').value.trim(),
    preco: $('#plano-preco').value.trim(),
    prazo: $('#plano-prazo').value.trim(),
    texto: $('#plano-texto').value.trim(),
    quantidade: $('#plano-quantidade').value,
  };
}

// corta no limite do campo sem quebrar palavra no meio
function ajustarLimite(texto, max) {
  const valor = String(texto || '').trim();
  if (valor.length <= max) return valor;
  const corte = valor.slice(0, max + 1);
  const ultimoEspaco = corte.lastIndexOf(' ');
  return (ultimoEspaco > max * 0.6 ? corte.slice(0, ultimoEspaco) : valor.slice(0, max)).trim();
}

function aplicarVariacoes(variacoes) {
  const modelo = Modelos.porId(Estado.arte.modeloId);
  const slots = Modelos.slotsDeTexto(modelo);
  Estado.arte.variacoes = variacoes.slice(0, 24).map((variacao) => {
    const valores = {};
    for (const slot of slots) {
      const valor = variacao && typeof variacao[slot.key] === 'string'
        ? variacao[slot.key]
        : (slot.exemplo || '');
      valores[slot.key] = ajustarLimite(valor, slot.max + Math.ceil(slot.max * 0.2));
    }
    return valores;
  });
  if (!Estado.arte.variacoes.length) {
    Estado.arte.variacoes = [Modelos.exemplos(modelo)];
  }
  Estado.arte.variacaoAtiva = 0;
  Estado.arte.ajustes = {}; // textos novos zeram os ajustes visuais
}

// extrai um valor monetário ("1.899,90") de um texto livre de condições
function extrairValor(texto) {
  const m = String(texto || '').match(/\d{1,3}(?:\.\d{3})*(?:,\d{2})?/g);
  if (!m) return '';
  // pega o maior valor citado — em "10x de R$ 189,99" o preço não é o 10
  return m.reduce((a, b) => (b.length > a.length ? b : a), '');
}

// preenchimento sem IA: exemplos do modelo + o que der para aproveitar do plano
function preencherManual() {
  const modelo = Modelos.porId(Estado.arte.modeloId);
  const valores = Modelos.exemplos(modelo);
  const plano = Estado.arte.plano;
  const encaixes = {
    // o campo "Preço / condições" é texto livre: no slot de preço entra só o
    // número; o texto completo vai para o slot de condições
    preco: extrairValor(plano.preco) || extrairValor(plano.oferta),
    condicoes: plano.preco,
    dataHora: plano.prazo,
    prazo: plano.prazo,
    produtoNome: plano.oferta,
  };
  for (const [chave, valor] of Object.entries(encaixes)) {
    if (valor && chave in valores) {
      const slot = modelo.slots.find((s) => s.key === chave);
      valores[chave] = ajustarLimite(valor, slot ? slot.max : 60);
    }
  }
  aplicarVariacoes([valores, valores, valores]);
}

async function gerarComIA() {
  lerFormularioPlano();
  const plano = Estado.arte.plano;
  if (!plano.texto && !plano.oferta) {
    avisar('Preencha ao menos a oferta ou o planejamento para a IA trabalhar.', true);
    return;
  }
  const modelo = Modelos.porId(Estado.arte.modeloId);
  if (!Modelos.slotsDeTexto(modelo).length) {
    // modelo só com imagens/marca: não há texto para a IA escrever
    preencherManual();
    abrirEstudio();
    return;
  }
  // se o designer desistir da espera (manual, trocar modelo, sair), a
  // resposta atrasada da IA é descartada em vez de atropelar o trabalho
  const arteDoPedido = Estado.arte;
  const botao = $('#botao-gerar');
  const status = $('#plano-status');
  botao.disabled = true;
  status.hidden = false;
  status.textContent = plano.quantidade === 'auto'
    ? 'A IA está escrevendo uma arte para cada criativo do planejamento ("' + modelo.nome + '")…'
    : 'A IA está escrevendo as ' + plano.quantidade + ' artes seguindo o modelo "' + modelo.nome + '"…';

  try {
    const marca = marcaAtual();
    const resposta = await fetch('api/gerar', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        designer: Estado.designer.nome,
        pin: Estado.pin,
        modelo: {
          id: modelo.id,
          nome: modelo.nome,
          fase: modelo.fase,
          slots: Modelos.slotsDeTexto(modelo).map((s) => ({
            key: s.key, rotulo: s.rotulo, max: s.max,
            multilinha: !!s.multilinha, exemplo: s.exemplo || '',
          })),
        },
        plano,
        quantidade: plano.quantidade === 'auto' ? 'auto' : Number(plano.quantidade) || 3,
        marca: { nome: marca.nome, whatsapp: marca.whatsapp, endereco: marca.endereco },
      }),
    });
    if (!resposta.ok) {
      const detalhe = await resposta.json().catch(() => ({}));
      throw new Error(detalhe.erro || ('Falha na IA (HTTP ' + resposta.status + ')'));
    }
    const dados = await resposta.json();
    if (Estado.arte !== arteDoPedido || Estado.telaAtual !== 'plano') {
      return; // o designer seguiu por outro caminho — não atropela nada
    }
    if (!Array.isArray(dados.variacoes) || !dados.variacoes.length) {
      throw new Error('A IA respondeu em um formato inesperado.');
    }
    aplicarVariacoes(dados.variacoes);
    contarEvento('geracao');
    abrirEstudio();
  } catch (erro) {
    if (Estado.arte !== arteDoPedido || Estado.telaAtual !== 'plano') return;
    status.hidden = true;
    avisar((erro && erro.message ? erro.message : 'Erro ao falar com a IA.') +
      ' Você pode preencher manualmente enquanto isso.', true);
    return;
  } finally {
    botao.disabled = false;
    status.hidden = true;
  }
}

/* ================== PASSO 3 · ESTÚDIO ================== */

function valoresAtuais() {
  return Estado.arte.variacoes[Estado.arte.variacaoAtiva] || {};
}

/* ---------- ajustes visuais (tudo na arte é editável) ----------
 * Cada elemento da arte recebe um índice estável (ordem no documento).
 * Os ajustes do designer — mover, escalar, fonte, cor, ocultar — ficam
 * em arte.ajustes[variação][índice] e valem para o preview E para o PNG.
 */

function ajustesDaVariacao(indice) {
  const arte = Estado.arte;
  if (!arte.ajustes) arte.ajustes = {};
  if (!arte.ajustes[indice]) arte.ajustes[indice] = {};
  return arte.ajustes[indice];
}

// aplica um ajuste a um elemento; base = transform original do modelo
function aplicarAjusteNoElemento(elemento, ajuste, transformBase) {
  if (ajuste.oculto) { elemento.style.display = 'none'; return; }
  elemento.style.display = '';
  const partes = [];
  if (ajuste.dx || ajuste.dy) partes.push(`translate(${ajuste.dx || 0}px, ${ajuste.dy || 0}px)`);
  if (transformBase) partes.push(transformBase);
  if (ajuste.rot) partes.push(`rotate(${ajuste.rot}deg)`);
  if (ajuste.escala && ajuste.escala !== 1) partes.push(`scale(${ajuste.escala})`);
  elemento.style.transform = partes.join(' ');
  if (ajuste.fonte) elemento.style.fontSize = ajuste.fonte + 'px';
  if (ajuste.cor) elemento.style.color = ajuste.cor;
  if (ajuste.opac !== undefined && ajuste.opac !== 1) elemento.style.opacity = ajuste.opac;
  if (ajuste.z) {
    elemento.style.zIndex = ajuste.z;
    if (!elemento.style.position) elemento.style.position = 'relative';
  }
  if (ajuste.alin) elemento.style.textAlign = ajuste.alin;
  if (ajuste.peso) elemento.style.fontWeight = ajuste.peso;
  if (ajuste.ital !== undefined) elemento.style.fontStyle = ajuste.ital ? 'italic' : 'normal';
}

// versão para exportação: aplica os ajustes num render recém-criado
function htmlComAjustes(html, mapa) {
  if (!mapa || !Object.keys(mapa).length) return html;
  const caixa = document.createElement('div');
  caixa.innerHTML = html;
  const raiz = caixa.firstElementChild;
  if (raiz) {
    const elementos = [raiz, ...raiz.querySelectorAll('*')];
    for (const [eid, ajuste] of Object.entries(mapa)) {
      const elemento = elementos[Number(eid)];
      if (elemento) aplicarAjusteNoElemento(elemento, ajuste, elemento.style.transform || '');
    }
  }
  return caixa.innerHTML;
}

function htmlDaVariacao(indice) {
  const modelo = Modelos.porId(Estado.arte.modeloId);
  const valores = { ...(Estado.arte.variacoes[indice] || {}), ...Estado.arte.imagens };
  const html = modelo.render(valores, marcaAtual());
  return htmlComAjustes(html, (Estado.arte.ajustes || {})[indice]);
}

function htmlDaArte() {
  return htmlDaVariacao(Estado.arte.variacaoAtiva);
}

/* ---------- interação de ajuste no palco ---------- */

const Ajuste = {
  eid: null,          // elemento selecionado (índice)
  arrasto: null,      // { x0, y0, dx0, dy0, moveu }
};

function elementoSelecionado() {
  if (Ajuste.eid === null) return null;
  return $('#palco') && $('#palco').querySelector(`[data-eid="${Ajuste.eid}"]`);
}

function ajusteAtual(criar = false) {
  const mapa = ajustesDaVariacao(Estado.arte.variacaoAtiva);
  if (!mapa[Ajuste.eid] && criar) mapa[Ajuste.eid] = {};
  return mapa[Ajuste.eid] || null;
}

// valores neutros não contam como ajuste — o registro some quando volta ao padrão
const AJUSTE_NEUTRO = { dx: 0, dy: 0, escala: 1, rot: 0, opac: 1, z: 0, ital: false, oculto: false };

function limparAjusteVazio() {
  const mapa = ajustesDaVariacao(Estado.arte.variacaoAtiva);
  const ajuste = mapa[Ajuste.eid];
  if (!ajuste) return;
  for (const [chave, valor] of Object.entries(ajuste)) {
    if (valor === undefined || valor === null || valor === '' || AJUSTE_NEUTRO[chave] === valor) {
      delete ajuste[chave];
    }
  }
  if (!Object.keys(ajuste).length) delete mapa[Ajuste.eid];
}

function rotuloDoElemento(elemento) {
  const texto = (elemento.textContent || '').trim().replace(/\s+/g, ' ');
  if (texto) return texto.length > 28 ? texto.slice(0, 28) + '…' : texto;
  if (elemento.tagName === 'IMG') return 'imagem';
  return 'bloco';
}

function selecionarElemento(eid) {
  const anterior = elementoSelecionado();
  if (anterior) anterior.classList.remove('e72-selecionado');
  Ajuste.eid = eid;
  const barra = $('#ajuste-barra');
  if (eid === null) { barra.hidden = true; return; }
  const elemento = elementoSelecionado();
  if (!elemento) { Ajuste.eid = null; barra.hidden = true; return; }
  elemento.classList.add('e72-selecionado');
  $('#ajuste-alvo').textContent = rotuloDoElemento(elemento);
  const ajuste = ajusteAtual() || {};
  $('#aj-cor').value = ajuste.cor || corComputada(elemento);
  $('#aj-ocultar').textContent = ajuste.oculto ? 'Mostrar' : 'Ocultar';
  barra.hidden = false;
}

function corComputada(elemento) {
  const m = getComputedStyle(elemento).color.match(/\d+/g);
  if (!m) return '#ffffff';
  return '#' + m.slice(0, 3).map((c) => Number(c).toString(16).padStart(2, '0')).join('');
}

function repintarElementoSelecionado() {
  const elemento = elementoSelecionado();
  if (!elemento) return;
  const ajuste = ajusteAtual() || {};
  aplicarAjusteNoElemento(elemento, ajuste, elemento.dataset.e72Base || '');
}

const CICLO_ALINHAR = [undefined, 'left', 'center', 'right'];
const CICLO_PESO = [undefined, '900', '700', '400'];

function mudarAjuste(mudanca) {
  if (Ajuste.eid === null) return;
  const elemento = elementoSelecionado();
  const ajuste = ajusteAtual(true);
  if (mudanca.fonteDelta) {
    const base = ajuste.fonte || Math.round(parseFloat(getComputedStyle(elemento).fontSize)) || 32;
    ajuste.fonte = Math.max(8, base + mudanca.fonteDelta);
  }
  if (mudanca.escalaFator) {
    ajuste.escala = Math.max(0.2, Math.min(4, +( (ajuste.escala || 1) * mudanca.escalaFator ).toFixed(3)));
  }
  if (mudanca.rotDelta) {
    ajuste.rot = Math.max(-180, Math.min(180, (ajuste.rot || 0) + mudanca.rotDelta));
  }
  if (mudanca.opacDelta) {
    ajuste.opac = Math.max(0.1, Math.min(1, +((ajuste.opac ?? 1) + mudanca.opacDelta).toFixed(2)));
  }
  if (mudanca.zDelta) {
    ajuste.z = Math.max(-50, Math.min(50, (ajuste.z || 0) + mudanca.zDelta));
  }
  if (mudanca.cicloAlinhar) {
    ajuste.alin = CICLO_ALINHAR[(CICLO_ALINHAR.indexOf(ajuste.alin) + 1) % CICLO_ALINHAR.length];
    if (!ajuste.alin) elemento.style.textAlign = '';
  }
  if (mudanca.cicloPeso) {
    ajuste.peso = CICLO_PESO[(CICLO_PESO.indexOf(ajuste.peso) + 1) % CICLO_PESO.length];
    if (!ajuste.peso) elemento.style.fontWeight = '';
  }
  if (mudanca.alternarItalico) {
    ajuste.ital = !ajuste.ital;
    if (!ajuste.ital) elemento.style.fontStyle = '';
  }
  if ('cor' in mudanca) ajuste.cor = mudanca.cor;
  if (mudanca.alternarOculto) ajuste.oculto = !ajuste.oculto;
  if (mudanca.zerar) {
    delete ajustesDaVariacao(Estado.arte.variacaoAtiva)[Ajuste.eid];
    pintarArte(); // limpa estilos aplicados diretamente no elemento
    selecionarElemento(Ajuste.eid);
    salvarNoHistorico();
    return;
  }
  repintarElementoSelecionado();
  limparAjusteVazio();
  $('#aj-ocultar').textContent = (ajusteAtual() || {}).oculto ? 'Mostrar' : 'Ocultar';
  salvarNoHistorico();
}

let escalaPalcoAtual = 1;

function prepararEdicaoVisual() {
  const raiz = $('#palco').querySelector('.a72');
  if (!raiz) return;
  const elementos = [raiz, ...raiz.querySelectorAll('*')];
  elementos.forEach((elemento, indice) => {
    elemento.dataset.eid = indice;
    // guarda o transform do modelo para compor com os ajustes sem acumular
    elemento.dataset.e72Base = elemento.style.transform || '';
  });
  // reaplica a seleção (o palco acabou de ser re-renderizado)
  if (Ajuste.eid !== null) {
    const selecionado = raiz.querySelector(`[data-eid="${Ajuste.eid}"]`) || null;
    if (selecionado) selecionado.classList.add('e72-selecionado');
    else selecionarElemento(null);
  }
}

function iniciarEdicaoVisual() {
  const palco = $('#palco');

  palco.addEventListener('pointerdown', (evento) => {
    const alvo = evento.target.closest('[data-eid]');
    if (!alvo || !palco.contains(alvo)) return;
    const eid = Number(alvo.dataset.eid);
    if (eid === 0) { selecionarElemento(null); return; } // fundo = tirar seleção
    evento.preventDefault();
    selecionarElemento(eid);
    const ajuste = ajusteAtual() || {};
    Ajuste.arrasto = {
      x0: evento.clientX, y0: evento.clientY,
      dx0: ajuste.dx || 0, dy0: ajuste.dy || 0, moveu: false,
    };
    palco.setPointerCapture(evento.pointerId);
  });

  palco.addEventListener('pointermove', (evento) => {
    if (!Ajuste.arrasto || Ajuste.eid === null) return;
    const dx = (evento.clientX - Ajuste.arrasto.x0) / escalaPalcoAtual;
    const dy = (evento.clientY - Ajuste.arrasto.y0) / escalaPalcoAtual;
    if (!Ajuste.arrasto.moveu && Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
    Ajuste.arrasto.moveu = true;
    const ajuste = ajusteAtual(true);
    ajuste.dx = Math.round(Ajuste.arrasto.dx0 + dx);
    ajuste.dy = Math.round(Ajuste.arrasto.dy0 + dy);
    repintarElementoSelecionado();
  });

  const soltar = () => {
    if (Ajuste.arrasto && Ajuste.arrasto.moveu) {
      limparAjusteVazio();
      salvarNoHistorico();
    }
    Ajuste.arrasto = null;
  };
  palco.addEventListener('pointerup', soltar);
  palco.addEventListener('pointercancel', soltar);

  document.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape' && Estado.telaAtual === 'estudio') selecionarElemento(null);
  });

  $('#aj-fonte-menos').addEventListener('click', () => mudarAjuste({ fonteDelta: -4 }));
  $('#aj-fonte-mais').addEventListener('click', () => mudarAjuste({ fonteDelta: 4 }));
  $('#aj-escala-menos').addEventListener('click', () => mudarAjuste({ escalaFator: 1 / 1.1 }));
  $('#aj-escala-mais').addEventListener('click', () => mudarAjuste({ escalaFator: 1.1 }));
  $('#aj-rot-menos').addEventListener('click', () => mudarAjuste({ rotDelta: -5 }));
  $('#aj-rot-mais').addEventListener('click', () => mudarAjuste({ rotDelta: 5 }));
  $('#aj-opac-menos').addEventListener('click', () => mudarAjuste({ opacDelta: -0.15 }));
  $('#aj-opac-mais').addEventListener('click', () => mudarAjuste({ opacDelta: 0.15 }));
  $('#aj-tras').addEventListener('click', () => mudarAjuste({ zDelta: -10 }));
  $('#aj-frente').addEventListener('click', () => mudarAjuste({ zDelta: 10 }));
  $('#aj-alinhar').addEventListener('click', () => mudarAjuste({ cicloAlinhar: true }));
  $('#aj-negrito').addEventListener('click', () => mudarAjuste({ cicloPeso: true }));
  $('#aj-italico').addEventListener('click', () => mudarAjuste({ alternarItalico: true }));
  $('#aj-cor').addEventListener('input', (evento) => mudarAjuste({ cor: evento.target.value }));
  $('#aj-ocultar').addEventListener('click', () => mudarAjuste({ alternarOculto: true }));
  $('#aj-zerar').addEventListener('click', () => mudarAjuste({ zerar: true }));
  $('#aj-fechar').addEventListener('click', () => selecionarElemento(null));
  $('#aj-zerar-tudo').addEventListener('click', () => {
    Estado.arte.ajustes[Estado.arte.variacaoAtiva] = {};
    selecionarElemento(null);
    pintarArte();
    salvarNoHistorico();
  });
}

function ajustarEscalaPalco() {
  const moldura = $('#tela-estudio .palco-moldura');
  const caixa = $('#palco-caixa');
  const larguraUtil = moldura.clientWidth - 36; // desconta o padding
  const fator = Math.min(1, larguraUtil / 1080);
  escalaPalcoAtual = fator;
  caixa.style.width = Math.round(1080 * fator) + 'px';
  caixa.style.height = Math.round(1350 * fator) + 'px';
  $('#palco').style.transform = `scale(${fator})`;
}

function pintarArte() {
  // renderiza o modelo cru e aplica os ajustes no DOM vivo — assim cada
  // elemento sabe seu transform original e os ajustes nunca se acumulam
  const modelo = Modelos.porId(Estado.arte.modeloId);
  const valores = { ...valoresAtuais(), ...Estado.arte.imagens };
  $('#palco').innerHTML = `<style>${Modelos.css}</style>` + modelo.render(valores, marcaAtual());
  ajustarEscalaPalco();
  prepararEdicaoVisual();
  const mapa = ajustesDaVariacao(Estado.arte.variacaoAtiva);
  for (const [eid, ajuste] of Object.entries(mapa)) {
    const elemento = $('#palco').querySelector(`[data-eid="${eid}"]`);
    if (elemento) aplicarAjusteNoElemento(elemento, ajuste, elemento.dataset.e72Base || '');
  }
}

function montarAbasVariacoes() {
  const caixa = $('#variacoes');
  caixa.innerHTML = '';
  const compacto = Estado.arte.variacoes.length > 6;
  Estado.arte.variacoes.forEach((_, indice) => {
    const aba = el('button', 'aba-variacao' + (indice === Estado.arte.variacaoAtiva ? ' ativa' : ''),
      compacto ? String(indice + 1) : 'Arte ' + (indice + 1));
    aba.type = 'button';
    aba.addEventListener('click', () => {
      Estado.arte.variacaoAtiva = indice;
      selecionarElemento(null);
      montarAbasVariacoes();
      montarCamposSlots();
      pintarArte();
      salvarNoHistorico();
    });
    caixa.appendChild(aba);
  });
}

function montarCamposSlots() {
  const modelo = Modelos.porId(Estado.arte.modeloId);
  const caixa = $('#campos-slots');
  caixa.innerHTML = '';
  const valores = valoresAtuais();

  for (const slot of Modelos.slotsDeTexto(modelo)) {
    const campo = el('label', 'campo');
    campo.innerHTML = `<span>${slot.rotulo}</span>`;
    const entrada = document.createElement(slot.multilinha ? 'textarea' : 'input');
    if (slot.multilinha) entrada.rows = 2;
    entrada.value = valores[slot.key] || '';
    const contador = el('span', 'contador');
    const atualizarContador = () => {
      const tamanho = entrada.value.length;
      contador.textContent = tamanho + ' / ' + slot.max;
      contador.classList.toggle('estouro', tamanho > slot.max);
    };
    entrada.addEventListener('input', () => {
      valoresAtuais()[slot.key] = entrada.value;
      atualizarContador();
      pintarArte();
    });
    entrada.addEventListener('change', salvarNoHistorico);
    atualizarContador();
    campo.appendChild(entrada);
    campo.appendChild(contador);
    caixa.appendChild(campo);
  }
}

function abrirEstudio() {
  const modelo = Modelos.porId(Estado.arte.modeloId);
  $('#estudio-modelo-nome').textContent = modelo.personalizado
    ? modelo.nome
    : modelo.nome + ' · Fase ' + modelo.fase;
  selecionarElemento(null);
  montarAbasVariacoes();
  montarCamposSlots();
  mostrarTela('estudio');
  pintarArte();
  if (!Estado.arte.registrada) {
    Estado.arte.registrada = true;
    contarEvento('arte');
  }
  salvarNoHistorico();
}

function nomeDoArquivo(indice) {
  const modelo = Modelos.porId(Estado.arte.modeloId);
  const marca = marcaAtual();
  const limpar = (t) => String(t || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const data = new Date().toISOString().slice(0, 10);
  return [limpar(marca.nome), modelo.id, 'v' + (indice + 1), data].filter(Boolean).join('_');
}

async function baixarAtual() {
  const status = $('#exportar-status');
  const botao = $('#botao-baixar');
  const botaoTodas = $('#botao-baixar-todas');
  const html = htmlDaArte(); // fotografa antes das esperas
  const arquivo = nomeDoArquivo(Estado.arte.variacaoAtiva);
  botao.disabled = true;
  botaoTodas.disabled = true;
  status.textContent = 'Gerando PNG…';
  try {
    await Exportador.baixarPNG(html, Modelos.css, arquivo);
    status.textContent = 'PNG baixado ✓';
    contarEvento('exportacao', 1, segundosDaArte());
    salvarNoHistorico();
  } catch (erro) {
    status.textContent = '';
    avisar('Erro ao exportar: ' + erro.message, true);
  } finally {
    botao.disabled = false;
    botaoTodas.disabled = false;
    setTimeout(() => { status.textContent = ''; }, 4000);
  }
}

async function baixarTodas() {
  const status = $('#exportar-status');
  const botaoTodas = $('#botao-baixar-todas');
  const botaoUm = $('#botao-baixar');
  // fotografa as variações antes de qualquer espera: editar ou trocar de
  // aba durante a exportação não muda mais o que sai nos arquivos
  const trabalhos = Estado.arte.variacoes.map((_, i) => ({
    html: htmlDaVariacao(i),
    arquivo: nomeDoArquivo(i),
  }));
  botaoTodas.disabled = true;
  botaoUm.disabled = true;
  let baixadas = 0;
  try {
    for (let i = 0; i < trabalhos.length; i++) {
      status.textContent = `Gerando PNG ${i + 1} de ${trabalhos.length}…`;
      await Exportador.baixarPNG(trabalhos[i].html, Modelos.css, trabalhos[i].arquivo);
      baixadas++;
      // navegadores pedem permissão para múltiplos downloads; o intervalo
      // dá tempo de cada arquivo ser aceito antes do próximo
      await new Promise((r) => setTimeout(r, 350));
    }
    status.textContent = baixadas + ' PNGs gerados ✓ — se o navegador pedir, permita múltiplos downloads';
    contarEvento('exportacao', baixadas, segundosDaArte());
    salvarNoHistorico();
  } catch (erro) {
    avisar('Erro ao exportar (baixei ' + baixadas + ' de ' + trabalhos.length + '): ' + erro.message, true);
    status.textContent = '';
  } finally {
    botaoTodas.disabled = false;
    botaoUm.disabled = false;
    setTimeout(() => { status.textContent = ''; }, 7000);
  }
}

/* ================== HISTÓRICO ================== */

let avisouHistoricoCheio = false;

function salvarNoHistorico() {
  if (!Estado.arte || !Estado.arte.variacoes.length) return;
  const chave = Guardar.chaveHistorico();
  const lista = Guardar.ler(chave, []).filter((item) => item.id !== Estado.arte.id);
  lista.unshift(JSON.parse(JSON.stringify(Estado.arte)));
  let recorte = lista.slice(0, CONFIG.LIMITE_HISTORICO);
  if (Guardar.gravar(chave, recorte)) return;

  // cota do navegador cheia: as fotos são o peso — mantém os textos de
  // todas as artes e descarta as imagens das mais antigas
  for (let manterFotos = recorte.length - 1; manterFotos >= 0; manterFotos--) {
    const leve = recorte.map((item, i) => (i < manterFotos ? item : { ...item, imagens: {} }));
    if (Guardar.gravar(chave, leve)) {
      if (!avisouHistoricoCheio) {
        avisouHistoricoCheio = true;
        avisar('O histórico encheu: artes antigas foram salvas sem as fotos. Baixe os PNGs importantes.', true);
      }
      return;
    }
  }
  // nem sem fotos coube: reduz a quantidade de itens
  let menor = recorte.map((item) => ({ ...item, imagens: {} }));
  while (menor.length && !Guardar.gravar(chave, menor)) menor = menor.slice(0, -1);
  if (!avisouHistoricoCheio) {
    avisouHistoricoCheio = true;
    avisar('O armazenamento deste navegador está cheio — o histórico pode estar incompleto.', true);
  }
}

function montarHistorico() {
  const caixa = $('#lista-historico');
  caixa.innerHTML = '';
  const lista = Guardar.ler(Guardar.chaveHistorico(), []);
  if (!lista.length) {
    caixa.appendChild(el('p', 'historico-vazio',
      'Nenhuma arte por aqui ainda. Crie a primeira no passo “Modelo”.'));
    return;
  }
  for (const item of lista) {
    const modelo = Modelos.porId(item.modeloId);
    if (!modelo) continue;
    const cartao = el('div', 'cartao');
    const marca = Estado.marcas.find((m) => m.id === item.marcaId) || CONFIG.MARCA_PADRAO;
    const valores = { ...(item.variacoes[item.variacaoAtiva] || item.variacoes[0] || {}), ...item.imagens };
    cartao.appendChild(miniaturaDeModelo(modelo, marca, valores,
      (item.ajustes || {})[item.variacaoAtiva]));
    const info = el('div', 'cartao-historico-info');
    const data = new Date(item.criadaEm);
    info.appendChild(el('div', null,
      `<strong>${modelo.nome}</strong><small>${marca.nome} · ` +
      data.toLocaleDateString('pt-BR') + '</small>'));
    const abrir = el('button', 'botao botao-secundario', 'Abrir');
    abrir.type = 'button';
    abrir.addEventListener('click', () => {
      Estado.arte = JSON.parse(JSON.stringify(item));
      montarSelecaoMarcas();
      montarCamposDeImagem();
      preencherFormularioPlano();
      abrirEstudio();
    });
    info.appendChild(abrir);
    cartao.appendChild(info);
    caixa.appendChild(cartao);
  }
}

/* ================== EDITOR DE MODELOS PRÓPRIOS ================== */

const Editor = {
  idEmEdicao: null,   // null = modelo novo
  slots: [],          // metadados dos campos detectados no HTML
  imagens: [],        // referências (dataURL) para a replicação por IA
};

function abrirEditor(modelo) {
  Editor.idEmEdicao = modelo ? modelo.id : null;
  Editor.slots = modelo ? modelo.slots.map((s) => ({ ...s })) : [];
  Editor.imagens = [];
  $('#editor-titulo').textContent = modelo ? 'Editar: ' + modelo.nome : 'Novo modelo';
  $('#editor-nome').value = modelo ? modelo.nome : '';
  $('#editor-fase').value = modelo ? String(modelo.fase) : '0';
  $('#editor-resumo').value = modelo ? modelo.resumo : '';
  $('#editor-html').value = modelo ? modelo.html : '';
  $('#editor-imagem').value = '';
  $('#editor-observacoes').value = '';
  $('#editor-status').textContent = '';
  $('#botao-editor-excluir').hidden = !modelo;
  montarMiniaturasReferencia();
  sincronizarSlotsEditor();
  mostrarTela('editor');
  pintarPreviaEditor();
}

function montarMiniaturasReferencia() {
  const caixa = $('#editor-imagens-previa');
  caixa.innerHTML = '';
  Editor.imagens.forEach((dataUrl, indice) => {
    const item = el('span', 'ref-item');
    const img = el('img', 'ref-miniatura');
    img.src = dataUrl;
    img.alt = 'Referência ' + (indice + 1);
    const remover = el('button', 'ref-remover', '×');
    remover.type = 'button';
    remover.title = 'Remover esta referência';
    remover.addEventListener('click', () => {
      Editor.imagens.splice(indice, 1);
      montarMiniaturasReferencia();
    });
    item.appendChild(img);
    item.appendChild(remover);
    caixa.appendChild(item);
  });
}

// mantém a lista de campos alinhada aos marcadores {{...}} do HTML,
// preservando os ajustes já feitos em campos que continuam existindo
function sincronizarSlotsEditor() {
  const chaves = Modelos.chavesDoHtml($('#editor-html').value);
  Editor.slots = chaves.map((chave) => {
    const existente = Editor.slots.find((s) => s.key === chave);
    if (existente) return existente;
    return {
      key: chave,
      rotulo: chave.replace(/^img/, '').replace(/([A-Z])/g, ' $1').trim() || chave,
      max: 60,
      tipo: chave.startsWith('img') ? 'imagem' : 'texto',
      multilinha: false,
      opcional: chave.startsWith('img'),
      exemplo: '',
    };
  });
  montarTabelaSlots();
}

function montarTabelaSlots() {
  const caixa = $('#editor-slots');
  caixa.innerHTML = '';
  if (!Editor.slots.length) {
    caixa.appendChild(el('p', 'editor-slots-vazio',
      'Nenhum marcador {{…}} no HTML ainda. Cada marcador vira um campo editável.'));
    return;
  }
  caixa.appendChild(el('div', 'linha-slot-cabecalho',
    '<span>marcador</span><span>rótulo</span><span>máx.</span><span>tipo</span><span>multi?</span><span>exemplo</span>'));
  for (const slot of Editor.slots) {
    const linha = el('div', 'linha-slot');
    linha.appendChild(el('span', 'slot-chave', esc(slot.key)));

    const rotulo = document.createElement('input');
    rotulo.value = slot.rotulo;
    rotulo.maxLength = 80;
    rotulo.addEventListener('input', () => { slot.rotulo = rotulo.value; });
    linha.appendChild(rotulo);

    const max = document.createElement('input');
    max.type = 'number';
    max.min = '2';
    max.max = '300';
    max.value = slot.max;
    max.addEventListener('input', () => { slot.max = Math.max(2, Math.min(300, Number(max.value) || 60)); });
    linha.appendChild(max);

    const tipo = document.createElement('select');
    tipo.innerHTML = '<option value="texto">texto</option><option value="imagem">imagem</option>';
    tipo.value = slot.tipo;
    tipo.addEventListener('change', () => { slot.tipo = tipo.value; pintarPreviaEditorDebounce(); });
    linha.appendChild(tipo);

    const multi = el('label', 'slot-multi');
    const caixaMulti = document.createElement('input');
    caixaMulti.type = 'checkbox';
    caixaMulti.checked = !!slot.multilinha;
    caixaMulti.addEventListener('change', () => { slot.multilinha = caixaMulti.checked; });
    multi.appendChild(caixaMulti);
    multi.appendChild(document.createTextNode('sim'));
    linha.appendChild(multi);

    const exemplo = document.createElement('input');
    exemplo.value = slot.exemplo || '';
    exemplo.maxLength = 400;
    exemplo.placeholder = 'texto de exemplo';
    exemplo.addEventListener('input', () => { slot.exemplo = exemplo.value; pintarPreviaEditorDebounce(); });
    linha.appendChild(exemplo);

    caixa.appendChild(linha);
  }
}

function defDoEditor() {
  return {
    id: Editor.idEmEdicao || ('meu-' + ($('#editor-nome').value.trim().toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'modelo') + '-' + Date.now().toString(36).slice(-4)),
    fase: Number($('#editor-fase').value) || 0,
    nome: $('#editor-nome').value.trim(),
    resumo: $('#editor-resumo').value.trim(),
    html: $('#editor-html').value,
    slots: Editor.slots.map((s) => ({ ...s })),
  };
}

function pintarPreviaEditor() {
  const caixa = $('#editor-palco-caixa');
  const palco = $('#editor-palco');
  const def = defDoEditor();
  if (!def.html.trim()) {
    palco.innerHTML = '';
    caixa.style.width = '0px';
    caixa.style.height = '0px';
    return;
  }
  const compilado = Modelos.compilarPersonalizado(def);
  const marca = marcaAtual() || CONFIG.MARCA_PADRAO;
  palco.innerHTML = `<style>${Modelos.css}</style>` + compilado.render(Modelos.exemplos(compilado), marca);
  const moldura = caixa.closest('.palco-moldura');
  const fator = Math.min(1, (moldura.clientWidth - 36) / 1080);
  caixa.style.width = Math.round(1080 * fator) + 'px';
  caixa.style.height = Math.round(1350 * fator) + 'px';
  palco.style.transform = `scale(${fator})`;
}

let previaTimer = null;
function pintarPreviaEditorDebounce() {
  clearTimeout(previaTimer);
  previaTimer = setTimeout(pintarPreviaEditor, 300);
}

async function replicarComIA(refinar = false) {
  if (!Editor.imagens.length) {
    avisar('Adicione ao menos uma imagem do modelo que você quer replicar.', true);
    return;
  }
  if (refinar && !$('#editor-html').value.trim()) {
    avisar('Para refinar, primeiro replique ou cole o HTML do modelo.', true);
    return;
  }
  const botao = refinar ? $('#botao-refinar') : $('#botao-replicar');
  const status = $('#editor-status');
  botao.disabled = true;
  status.textContent = refinar
    ? 'A IA está comparando com a referência e corrigindo… até 1 minuto.'
    : 'A IA está redesenhando seu modelo… isso leva até 1 minuto.';
  try {
    const resposta = await fetch('api/replicar', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        designer: Estado.designer.nome,
        pin: Estado.pin,
        imagens: Editor.imagens,
        htmlAtual: refinar ? $('#editor-html').value : undefined,
        observacoes: $('#editor-observacoes').value.trim(),
      }),
    });
    const dados = await resposta.json().catch(() => ({}));
    if (!resposta.ok) throw new Error(dados.erro || ('Falha na IA (HTTP ' + resposta.status + ')'));
    $('#editor-html').value = dados.html || '';
    if (dados.notas) avisar('Aviso da IA: ' + dados.notas);
    Editor.slots = (dados.slots || []).map((s) => ({
      key: s.key,
      rotulo: s.rotulo || s.key,
      max: Math.max(2, Math.min(300, Number(s.max) || 60)),
      tipo: s.tipo === 'imagem' ? 'imagem' : 'texto',
      multilinha: !!s.multilinha,
      opcional: s.tipo === 'imagem',
      exemplo: s.exemplo || '',
    }));
    sincronizarSlotsEditor();
    pintarPreviaEditor();
    status.textContent = refinar
      ? 'Refinado ✓ — compare a prévia com a referência; dá para refinar de novo'
      : 'Layout replicado ✓ — confira a prévia; se algo divergir, use o Refinar';
  } catch (erro) {
    status.textContent = '';
    avisar('Não consegui replicar: ' + erro.message, true);
  } finally {
    botao.disabled = false;
  }
}

async function salvarModeloEditor() {
  const def = defDoEditor();
  if (!def.nome) { avisar('Dê um nome ao modelo.', true); return; }
  if (!def.html.trim()) { avisar('O modelo está sem HTML — replique de uma imagem ou cole o código.', true); return; }
  const botao = $('#botao-editor-salvar');
  botao.disabled = true;
  try {
    const resposta = await fetch('api/modelos', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ designer: Estado.designer.nome, pin: Estado.pin, modelo: def }),
    });
    const dados = await resposta.json().catch(() => ({}));
    if (resposta.ok) {
      // salvou no servidor: remove cópia local antiga, se existir
      Guardar.gravar('e72.modelosLocais',
        Guardar.ler('e72.modelosLocais', []).filter((m) => m.id !== def.id));
      registrarTodosPersonalizados(dados.modelos || []);
      avisar('Modelo "' + def.nome + '" salvo para toda a equipe.');
    } else if (resposta.status === 501 || dados.semKV) {
      salvarModeloLocal(def);
      avisar('Modelo salvo neste navegador. Configure o KV (README) para valer para toda a equipe.');
    } else {
      throw new Error(dados.erro || ('HTTP ' + resposta.status));
    }
  } catch (erro) {
    if (erro && /HTTP|autorizado|inválid|Limite|grande/.test(erro.message || '')) {
      avisar('Não salvou: ' + erro.message, true);
      botao.disabled = false;
      return;
    }
    // sem rede/API (ex.: hospedagem estática): guarda localmente
    salvarModeloLocal(def);
    avisar('Modelo salvo neste navegador (sem conexão com o servidor).');
  }
  botao.disabled = false;
  mostrarTela('modelos');
}

function salvarModeloLocal(def) {
  const locais = Guardar.ler('e72.modelosLocais', []).filter((m) => m.id !== def.id);
  locais.unshift(def);
  if (!Guardar.gravar('e72.modelosLocais', locais)) {
    avisar('Armazenamento cheio — não consegui salvar o modelo neste navegador.', true);
    return;
  }
  const nuvem = Modelos.personalizados.filter((m) => m.origem === 'nuvem');
  registrarTodosPersonalizados(nuvem);
}

async function excluirModeloEditor() {
  if (!Editor.idEmEdicao) return;
  if (!window.confirm('Excluir este modelo para toda a equipe? As artes já exportadas não são afetadas.')) return;
  const id = Editor.idEmEdicao;
  try {
    await fetch('api/modelos', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ designer: Estado.designer.nome, pin: Estado.pin, id }),
    });
  } catch (_) { /* pode ser um modelo apenas local */ }
  Guardar.gravar('e72.modelosLocais',
    Guardar.ler('e72.modelosLocais', []).filter((m) => m.id !== id));
  const nuvem = Modelos.personalizados.filter((m) => m.origem === 'nuvem' && m.id !== id);
  registrarTodosPersonalizados(nuvem);
  avisar('Modelo excluído.');
  mostrarTela('modelos');
}

/* ================== EQUIPE (ADMINISTRAÇÃO) ================== */

async function pedirAoServidor(rota, corpo) {
  const resposta = await fetch(rota, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ designer: Estado.designer.nome, pin: Estado.pin, ...corpo }),
  });
  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) {
    const erro = new Error(dados.erro || ('HTTP ' + resposta.status));
    erro.semKV = !!dados.semKV;
    throw erro;
  }
  return dados;
}

function montarTabelaAcessos(equipe) {
  const caixa = $('#equipe-lista');
  caixa.innerHTML = '';
  for (const membro of equipe) {
    const linha = el('div', 'linha-membro');
    linha.appendChild(el('strong', null, esc(membro.nome)));
    linha.appendChild(el('span', 'membro-pin', 'código: ' + esc(membro.pin)));
    linha.appendChild(el('span', 'membro-papel' + (membro.admin ? ' admin' : ''),
      membro.admin ? 'administrador' : 'designer'));
    const remover = el('button', 'botao botao-fantasma botao-mini', 'Remover');
    remover.type = 'button';
    remover.disabled = membro.nome === Estado.designer.nome;
    remover.title = remover.disabled ? 'Você não pode remover a si mesma' : '';
    remover.addEventListener('click', async () => {
      if (!window.confirm('Remover o acesso de ' + membro.nome + '?')) return;
      try {
        const dados = await pedirAoServidor('api/equipe', { acao: 'excluir', nome: membro.nome });
        montarTabelaAcessos(dados.equipe);
        avisar('Acesso de ' + membro.nome + ' removido.');
      } catch (erro) {
        avisar('Não removeu: ' + erro.message, true);
      }
    });
    linha.appendChild(remover);
    caixa.appendChild(linha);
  }
}

function fmtDuracao(segundos) {
  if (!segundos) return '—';
  const h = Math.floor(segundos / 3600);
  const m = Math.round((segundos % 3600) / 60);
  if (h) return h + 'h' + String(m).padStart(2, '0');
  if (m) return m + ' min';
  return Math.round(segundos) + ' s';
}

// cores das séries validadas para o fundo escuro (identidade + CVD)
const COR_SERIE_ARTES = '#E0439B';
const COR_SERIE_PNGS = '#AD8A19';

// barras agrupadas por dia: artes iniciadas × PNGs exportados (14 dias)
function graficoBarrasDias(serie) {
  const larg = 720, alt = 210, margEsq = 34, margBase = 26, margTopo = 10;
  const util = larg - margEsq - 8;
  const altura = alt - margBase - margTopo;
  const maximo = Math.max(1, ...serie.map((d) => Math.max(d.arte, d.exportacao)));
  const slot = util / serie.length;
  const larguraBarra = Math.min(16, (slot - 8) / 2);
  const y = (v) => margTopo + altura * (1 - v / maximo);

  let barras = '';
  serie.forEach((dia, i) => {
    const x0 = margEsq + i * slot + (slot - (larguraBarra * 2 + 2)) / 2;
    const rotulo = dia.dia.slice(8, 10) + '/' + dia.dia.slice(5, 7);
    for (const [serieNome, valor, cor, dx] of [
      ['Artes', dia.arte, COR_SERIE_ARTES, 0],
      ['PNGs', dia.exportacao, COR_SERIE_PNGS, larguraBarra + 2],
    ]) {
      const h = Math.max(valor ? 3 : 0, altura * (valor / maximo));
      barras += `<rect x="${(x0 + dx).toFixed(1)}" y="${(alt - margBase - h).toFixed(1)}"
        width="${larguraBarra.toFixed(1)}" height="${h.toFixed(1)}" rx="3" fill="${cor}">
        <title>${rotulo} · ${serieNome}: ${valor}</title></rect>`;
    }
    if (i % 2 === 0) {
      barras += `<text x="${(margEsq + i * slot + slot / 2).toFixed(1)}" y="${alt - 8}"
        text-anchor="middle" font-size="11" fill="#B3A3B0">${rotulo}</text>`;
    }
  });

  let grade = '';
  for (const fracao of [0.5, 1]) {
    const valor = Math.round(maximo * fracao);
    grade += `<line x1="${margEsq}" x2="${larg - 6}" y1="${y(valor).toFixed(1)}" y2="${y(valor).toFixed(1)}"
      stroke="#322232" stroke-width="1"/>
      <text x="${margEsq - 6}" y="${(y(valor) + 4).toFixed(1)}" text-anchor="end"
        font-size="11" fill="#B3A3B0">${valor}</text>`;
  }
  return `<div class="grafico-legenda">
      <span><i style="background:${COR_SERIE_ARTES}"></i>Artes iniciadas</span>
      <span><i style="background:${COR_SERIE_PNGS}"></i>PNGs exportados</span>
      <span class="grafico-titulo">últimos 14 dias</span>
    </div>
    <svg viewBox="0 0 ${larg} ${alt}" role="img" aria-label="Produção por dia nos últimos 14 dias"
      style="width:100%;height:auto">
      ${grade}
      <line x1="${margEsq}" x2="${larg - 6}" y1="${alt - margBase}" y2="${alt - margBase}"
        stroke="#3A2A3A" stroke-width="1"/>
      ${barras}
    </svg>`;
}

function montarPainelProdutividade(dados) {
  const linhas = dados.linhas || [];
  const serie = dados.serie || [];
  const total = linhas.reduce((acc, l) => {
    for (const chave of ['arte', 'exportacao', 'geracao', 'segundos', 'artesComTempo']) {
      acc[chave] += l.d30[chave] || 0;
    }
    return acc;
  }, { arte: 0, exportacao: 0, geracao: 0, segundos: 0, artesComTempo: 0 });
  const tempoMedio = total.artesComTempo ? total.segundos / total.artesComTempo : 0;

  $('#equipe-resumo').innerHTML = [
    ['Artes (30d)', total.arte],
    ['PNGs exportados (30d)', total.exportacao],
    ['Gerações de IA (30d)', total.geracao],
    ['Tempo médio por arte', fmtDuracao(tempoMedio)],
    ['Tempo total (30d)', fmtDuracao(total.segundos)],
  ].map(([rotulo, valor]) =>
    `<div class="tile"><span class="tile-valor">${valor}</span><span class="tile-rotulo">${rotulo}</span></div>`
  ).join('');

  $('#equipe-grafico').innerHTML = serie.some((d) => d.arte || d.exportacao)
    ? graficoBarrasDias(serie)
    : '<p class="historico-vazio">O gráfico aparece com os primeiros dias de produção.</p>';

  const caixa = $('#equipe-produtividade');
  caixa.innerHTML = '';
  if (!linhas.length) {
    caixa.appendChild(el('p', 'historico-vazio', 'Sem produção registrada ainda.'));
    return;
  }
  const tabela = el('div', 'tabela-produtividade');
  tabela.appendChild(el('div', 'linha-prod cabecalho',
    '<span>Designer</span><span>7d · Artes</span><span>7d · IA</span><span>7d · PNGs</span>' +
    '<span>30d · Artes</span><span>30d · IA</span><span>30d · PNGs</span>' +
    '<span>Tempo médio</span><span>Tempo total 30d</span>'));
  for (const linha of linhas) {
    const medio = linha.d30.artesComTempo ? linha.d30.segundos / linha.d30.artesComTempo : 0;
    tabela.appendChild(el('div', 'linha-prod',
      `<strong>${esc(linha.nome)}</strong>` +
      `<span>${linha.d7.arte}</span><span>${linha.d7.geracao}</span><span>${linha.d7.exportacao}</span>` +
      `<span>${linha.d30.arte}</span><span>${linha.d30.geracao}</span><span>${linha.d30.exportacao}</span>` +
      `<span>${fmtDuracao(medio)}</span><span>${fmtDuracao(linha.d30.segundos)}</span>`));
  }
  caixa.appendChild(tabela);
}

async function montarTelaEquipe() {
  if (!Estado.admin) { mostrarTela('modelos'); return; }
  $('#equipe-aviso').hidden = true;
  try {
    const dados = await pedirAoServidor('api/equipe', { acao: 'listar' });
    montarTabelaAcessos(dados.equipe || []);
  } catch (erro) {
    $('#equipe-lista').innerHTML = '';
    $('#equipe-aviso').hidden = false;
    $('#equipe-aviso').textContent = erro.semKV
      ? 'Para gerenciar acessos pelo app, configure o KV no deploy (README).'
      : 'A gestão de acessos funciona na versão publicada: ' + erro.message;
  }
  try {
    const dados = await pedirAoServidor('api/estatisticas', {});
    montarPainelProdutividade(dados);
  } catch (erro) {
    $('#equipe-resumo').innerHTML = '';
    $('#equipe-grafico').innerHTML = '';
    $('#equipe-produtividade').innerHTML =
      '<p class="historico-vazio">' + esc(erro.semKV
        ? 'A produtividade precisa do KV configurado no deploy (README).'
        : 'Produtividade disponível na versão publicada: ' + erro.message) + '</p>';
  }
}

function iniciarEquipe() {
  $('#botao-membro-salvar').addEventListener('click', async () => {
    const nome = $('#membro-nome').value.trim();
    const pin = $('#membro-pin').value.trim();
    if (!nome || !pin) { avisar('Preencha nome e código.', true); return; }
    try {
      const dados = await pedirAoServidor('api/equipe', {
        acao: 'salvar',
        membro: { nome, pin, admin: $('#membro-admin').checked },
      });
      montarTabelaAcessos(dados.equipe);
      $('#membro-nome').value = '';
      $('#membro-pin').value = '';
      $('#membro-admin').checked = false;
      avisar('Acesso de ' + nome + ' salvo.');
    } catch (erro) {
      avisar('Não salvou: ' + erro.message, true);
    }
  });
}

/* ================== INICIALIZAÇÃO ================== */

function iniciar() {
  Modelos.usarEmbutidos = CONFIG.MODELOS_EXEMPLO;
  carregarMarcas();
  iniciarMarcas();
  iniciarEdicaoVisual();
  iniciarEquipe();
  iniciarLogin();

  for (const botao of document.querySelectorAll('.passo')) {
    botao.addEventListener('click', () => {
      const tela = botao.dataset.tela;
      if (tela === Estado.telaAtual) return;
      // ao sair do planejamento, o que foi digitado é preservado
      if (Estado.telaAtual === 'plano' && Estado.arte) lerFormularioPlano();
      if (tela === 'plano' && Estado.arte) {
        montarSelecaoMarcas();
        montarCamposDeImagem();
        preencherFormularioPlano();
        carregarBanco();
      }
      if (tela === 'estudio' && Estado.arte && Estado.arte.variacoes.length) {
        abrirEstudio(); // repinta com marca/imagens atuais: preview = PNG
        return;
      }
      mostrarTela(tela);
    });
  }

  $('#botao-voltar-modelos').addEventListener('click', () => { lerFormularioPlano(); mostrarTela('modelos'); });
  $('#botao-gerar').addEventListener('click', gerarComIA);
  $('#botao-manual').addEventListener('click', () => { lerFormularioPlano(); preencherManual(); abrirEstudio(); });
  $('#botao-regerar').addEventListener('click', () => { mostrarTela('plano'); });
  $('#botao-voltar-plano').addEventListener('click', () => {
    montarSelecaoMarcas();
    montarCamposDeImagem();
    preencherFormularioPlano();
    carregarBanco();
    mostrarTela('plano');
  });
  $('#botao-nova-arte').addEventListener('click', () => { Estado.arte = null; mostrarTela('modelos'); });
  $('#botao-baixar').addEventListener('click', baixarAtual);
  $('#botao-baixar-todas').addEventListener('click', baixarTodas);

  // banco de imagens do cliente
  $('#banco-upload').addEventListener('change', async (evento) => {
    const arquivos = [...(evento.target.files || [])];
    evento.target.value = '';
    if (arquivos.length) await enviarParaBanco(arquivos);
  });
  $('#banco-seletor-fechar').addEventListener('click', () => { $('#banco-seletor').hidden = true; });
  $('#banco-seletor').addEventListener('click', (evento) => {
    if (evento.target === $('#banco-seletor')) $('#banco-seletor').hidden = true;
  });

  // editor de modelos próprios
  $('#editor-imagem').addEventListener('change', async (evento) => {
    const arquivos = [...(evento.target.files || [])].slice(0, 4 - Editor.imagens.length);
    for (const arquivo of arquivos) {
      try {
        Editor.imagens.push(await redimensionarImagem(arquivo, 1500));
      } catch (_) {
        avisar('Não consegui ler uma das imagens.', true);
      }
    }
    evento.target.value = '';
    montarMiniaturasReferencia();
  });
  $('#editor-html').addEventListener('input', () => { sincronizarSlotsEditor(); pintarPreviaEditorDebounce(); });
  $('#botao-replicar').addEventListener('click', () => replicarComIA(false));
  $('#botao-refinar').addEventListener('click', () => replicarComIA(true));
  $('#botao-editor-salvar').addEventListener('click', salvarModeloEditor);
  $('#botao-editor-cancelar').addEventListener('click', () => mostrarTela('modelos'));
  $('#botao-editor-excluir').addEventListener('click', excluirModeloEditor);

  window.addEventListener('resize', () => {
    if (Estado.telaAtual === 'estudio') ajustarEscalaPalco();
    if (Estado.telaAtual === 'editor') pintarPreviaEditor();
  });
}

document.addEventListener('DOMContentLoaded', iniciar);
