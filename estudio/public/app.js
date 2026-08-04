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
 * Cadastre aqui a equipe. O mesmo nome + código deve estar
 * na variável ACCESS_CODES do worker (veja o README).
 */
const CONFIG = {
  DESIGNERS: [
    { nome: 'Deborah', pin: '7272' },
    { nome: 'Designer 1', pin: '1111' },
    { nome: 'Designer 2', pin: '2222' },
    { nome: 'Designer 3', pin: '3333' },
  ],
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
  marcas: [],
  arte: null,              // arte em edição (veja novaArte)
  telaAtual: 'login',
};

function novaArte(modeloId) {
  return {
    id: 'arte-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    modeloId,
    marcaId: Estado.marcas[0] ? Estado.marcas[0].id : 'padrao',
    plano: { objetivo: 'vender', publico: '', oferta: '', preco: '', prazo: '', texto: '' },
    imagens: {},           // slotKey → dataURL
    variacoes: [],         // [{ slotKey: texto }]
    variacaoAtiva: 0,
    criadaEm: Date.now(),
  };
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

const TELAS = ['login', 'modelos', 'plano', 'estudio', 'historico'];

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
    entrada.addEventListener('change', async () => {
      const arquivo = entrada.files && entrada.files[0];
      if (!arquivo) return;
      try {
        const dataUrl = await redimensionarImagem(arquivo);
        Estado.arte.imagens[slot.key] = dataUrl;
        previa.src = dataUrl;
        previa.hidden = false;
        if (Estado.telaAtual === 'estudio') pintarArte();
      } catch (_) {
        avisar('Não consegui ler essa imagem. Tente outro arquivo.', true);
      }
    });
    campo.appendChild(entrada);
    const previa = el('img', 'imagem-previa');
    previa.alt = '';
    const existente = Estado.arte.imagens[slot.key];
    if (existente) { previa.src = existente; } else { previa.hidden = true; }
    linha.appendChild(campo);
    linha.appendChild(previa);
    caixa.appendChild(linha);
  }
}

/* ================== LOGIN ================== */

let designerEscolhido = null;

function iniciarLogin() {
  const caixa = $('#login-designers');
  caixa.innerHTML = '';
  for (const designer of CONFIG.DESIGNERS) {
    const chip = el('button', 'chip-designer', designer.nome);
    chip.type = 'button';
    chip.addEventListener('click', () => {
      designerEscolhido = designer.nome;
      for (const c of caixa.children) c.classList.toggle('ativo', c === chip);
      $('#login-pin').focus();
    });
    caixa.appendChild(chip);
  }

  $('#form-login').addEventListener('submit', (evento) => {
    evento.preventDefault();
    $('#login-erro').hidden = true;
    const pin = $('#login-pin').value.trim();
    const registro = CONFIG.DESIGNERS.find((d) => d.nome === designerEscolhido);
    if (!registro || registro.pin !== pin) {
      $('#login-erro').hidden = false;
      return;
    }
    Estado.designer = { nome: registro.nome };
    Estado.pin = pin;
    Guardar.gravarSessao({ nome: registro.nome, pin });
    $('#usuario-nome').textContent = registro.nome;
    mostrarTela('modelos');
  });

  $('#botao-sair').addEventListener('click', () => {
    Guardar.gravarSessao(null);
    Estado.designer = null;
    Estado.pin = null;
    Estado.arte = null;
    $('#login-pin').value = '';
    mostrarTela('login');
  });

  // sessão lembrada (apenas nesta aba)
  const sessao = Guardar.lerSessao();
  if (sessao) {
    const registro = CONFIG.DESIGNERS.find((d) => d.nome === sessao.nome && d.pin === sessao.pin);
    if (registro) {
      Estado.designer = { nome: registro.nome };
      Estado.pin = registro.pin;
      $('#usuario-nome').textContent = registro.nome;
      mostrarTela('modelos');
      return;
    }
  }
  mostrarTela('login');
}

/* ================== PASSO 1 · MODELOS ================== */

function miniaturaDeModelo(modelo, marca, valores) {
  const caixa = el('div', 'miniatura');
  const escala = el('div', 'mini-escala');
  escala.innerHTML = `<style>${Modelos.css}</style>` + modelo.render(valores, marca);
  caixa.appendChild(escala);
  // a escala real é aplicada depois que o cartão entra no DOM
  requestAnimationFrame(() => {
    const fator = caixa.clientWidth / 1080;
    escala.style.transform = `scale(${fator})`;
  });
  return caixa;
}

function montarGradeModelos() {
  const grade = $('#grade-modelos');
  grade.innerHTML = '';
  const marca = marcaAtual() || CONFIG.MARCA_PADRAO;
  for (const [numero, fase] of Object.entries(Modelos.fases)) {
    const bloco = el('section', 'fase-bloco');
    bloco.appendChild(el('h3', null, fase.nome));
    bloco.appendChild(el('p', null, fase.resumo));
    const linha = el('div', 'fase-grade');
    for (const modelo of Modelos.lista.filter((m) => String(m.fase) === numero)) {
      const cartao = el('button', 'cartao-modelo');
      cartao.type = 'button';
      cartao.appendChild(miniaturaDeModelo(modelo, marca, Modelos.exemplos(modelo)));
      cartao.appendChild(el('div', 'cartao-modelo-info',
        `<strong>${modelo.nome}</strong><span>${modelo.resumo}</span>`));
      cartao.addEventListener('click', () => escolherModelo(modelo.id));
      linha.appendChild(cartao);
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
}

function lerFormularioPlano() {
  Estado.arte.plano = {
    objetivo: $('#plano-objetivo').value,
    publico: $('#plano-publico').value.trim(),
    oferta: $('#plano-oferta').value.trim(),
    preco: $('#plano-preco').value.trim(),
    prazo: $('#plano-prazo').value.trim(),
    texto: $('#plano-texto').value.trim(),
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
  Estado.arte.variacoes = variacoes.slice(0, 3).map((variacao) => {
    const valores = {};
    for (const slot of slots) {
      const valor = variacao && typeof variacao[slot.key] === 'string'
        ? variacao[slot.key]
        : (slot.exemplo || '');
      valores[slot.key] = ajustarLimite(valor, slot.max + Math.ceil(slot.max * 0.2));
    }
    return valores;
  });
  while (Estado.arte.variacoes.length < 3) {
    Estado.arte.variacoes.push({ ...Estado.arte.variacoes[0] });
  }
  Estado.arte.variacaoAtiva = 0;
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
  // se o designer desistir da espera (manual, trocar modelo, sair), a
  // resposta atrasada da IA é descartada em vez de atropelar o trabalho
  const arteDoPedido = Estado.arte;
  const botao = $('#botao-gerar');
  const status = $('#plano-status');
  botao.disabled = true;
  status.hidden = false;
  status.textContent = 'A IA está escrevendo as 3 variações seguindo o modelo "' + modelo.nome + '"…';

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

function htmlDaVariacao(indice) {
  const modelo = Modelos.porId(Estado.arte.modeloId);
  const valores = { ...(Estado.arte.variacoes[indice] || {}), ...Estado.arte.imagens };
  return modelo.render(valores, marcaAtual());
}

function htmlDaArte() {
  return htmlDaVariacao(Estado.arte.variacaoAtiva);
}

function ajustarEscalaPalco() {
  const moldura = $('.palco-moldura');
  const caixa = $('#palco-caixa');
  const larguraUtil = moldura.clientWidth - 36; // desconta o padding
  const fator = Math.min(1, larguraUtil / 1080);
  caixa.style.width = Math.round(1080 * fator) + 'px';
  caixa.style.height = Math.round(1350 * fator) + 'px';
  $('#palco').style.transform = `scale(${fator})`;
}

function pintarArte() {
  $('#palco').innerHTML = `<style>${Modelos.css}</style>` + htmlDaArte();
  ajustarEscalaPalco();
}

function montarAbasVariacoes() {
  const caixa = $('#variacoes');
  caixa.innerHTML = '';
  Estado.arte.variacoes.forEach((_, indice) => {
    const aba = el('button', 'aba-variacao' + (indice === Estado.arte.variacaoAtiva ? ' ativa' : ''),
      'Variação ' + (indice + 1));
    aba.type = 'button';
    aba.addEventListener('click', () => {
      Estado.arte.variacaoAtiva = indice;
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
  $('#estudio-modelo-nome').textContent = modelo.nome + ' · Fase ' + modelo.fase;
  montarAbasVariacoes();
  montarCamposSlots();
  mostrarTela('estudio');
  pintarArte();
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
    cartao.appendChild(miniaturaDeModelo(modelo, marca, valores));
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

/* ================== INICIALIZAÇÃO ================== */

function iniciar() {
  carregarMarcas();
  iniciarMarcas();
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
    mostrarTela('plano');
  });
  $('#botao-nova-arte').addEventListener('click', () => { Estado.arte = null; mostrarTela('modelos'); });
  $('#botao-baixar').addEventListener('click', baixarAtual);
  $('#botao-baixar-todas').addEventListener('click', baixarTodas);

  window.addEventListener('resize', () => {
    if (Estado.telaAtual === 'estudio') ajustarEscalaPalco();
  });
}

document.addEventListener('DOMContentLoaded', iniciar);
