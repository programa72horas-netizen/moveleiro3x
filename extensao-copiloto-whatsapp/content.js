// Content script: roda dentro do WhatsApp Web.
// 1. Extrai as mensagens da conversa aberta (somente leitura do DOM — nada é
//    enviado automaticamente, nenhum clique é simulado).
// 2. Injeta a sidebar do copiloto e conversa com o background.js.
//
// ⚠️ O WhatsApp Web muda o layout com frequência. TODOS os seletores ficam
// concentrados no objeto SELETORES abaixo — quando algo quebrar, é aqui que
// se ajusta, em um lugar só.

(() => {
  "use strict";

  const SELETORES = {
    principal: "#main",
    nomeContato: "#main header span[title]",
    linhasMensagem: "#main .message-in, #main .message-out",
    textoMensagem: "span.selectable-text",
    prePlain: "[data-pre-plain-text]",
    caixaDeTexto: "#main footer div[contenteditable='true']"
  };

  const MAX_MENSAGENS = 40;

  const ACOES = [
    { id: "analise", rotulo: "🔍 Analisar conversa" },
    { id: "resposta", rotulo: "💬 Sugerir resposta" },
    { id: "objecao", rotulo: "🛡️ Quebrar objeção" },
    { id: "fechamento", rotulo: "🤝 Puxar fechamento" },
    { id: "retomada", rotulo: "⏰ Retomar sumido" }
  ];

  const ROTULO_TEMPERATURA = {
    frio: { texto: "Lead frio", classe: "cw-temp-frio" },
    morno: { texto: "Lead morno", classe: "cw-temp-morno" },
    quente: { texto: "Lead quente", classe: "cw-temp-quente" }
  };

  // ---------------------------------------------------------------------------
  // Extração da conversa
  // ---------------------------------------------------------------------------

  function nomeDoContato() {
    const el = document.querySelector(SELETORES.nomeContato);
    return el ? (el.getAttribute("title") || el.textContent || "").trim() : "";
  }

  function extrairConversa() {
    const linhas = Array.from(document.querySelectorAll(SELETORES.linhasMensagem));
    const mensagens = [];

    for (const linha of linhas) {
      const autor = linha.classList.contains("message-out") ? "Vendedor" : "Cliente";
      let texto = "";

      const spans = linha.querySelectorAll(SELETORES.textoMensagem);
      if (spans.length) {
        texto = Array.from(spans).map((s) => s.innerText).join("\n").trim();
      }

      if (!texto) {
        // Mensagem sem texto (áudio, imagem, figurinha...): registra que existiu,
        // porque "cliente mandou áudio e ninguém respondeu" é sinal de venda.
        if (linha.querySelector("audio, [data-icon='audio-play'], [data-icon='ptt-status']")) {
          texto = "[áudio]";
        } else if (linha.querySelector("img[src^='blob:'], img[src^='data:']")) {
          texto = "[imagem]";
        } else {
          continue;
        }
      }

      mensagens.push(`${autor}: ${texto}`);
    }

    return mensagens.slice(-MAX_MENSAGENS).join("\n");
  }

  // ---------------------------------------------------------------------------
  // Sidebar
  // ---------------------------------------------------------------------------

  let painel = null;
  let areaResultado = null;
  let ocupado = false;

  function garantirUi() {
    if (document.getElementById("cw-botao-flutuante")) return;

    const botao = document.createElement("button");
    botao.id = "cw-botao-flutuante";
    botao.type = "button";
    botao.title = "Copiloto de Vendas";
    botao.textContent = "🧠";
    botao.addEventListener("click", alternarPainel);
    document.body.appendChild(botao);

    painel = document.createElement("div");
    painel.id = "cw-painel";
    painel.classList.add("cw-oculto");

    const cabecalho = document.createElement("div");
    cabecalho.className = "cw-cabecalho";

    const titulo = document.createElement("span");
    titulo.className = "cw-titulo";
    titulo.textContent = "Copiloto de Vendas";
    cabecalho.appendChild(titulo);

    const botaoConfig = document.createElement("button");
    botaoConfig.type = "button";
    botaoConfig.className = "cw-botao-icone";
    botaoConfig.title = "Configurações";
    botaoConfig.textContent = "⚙️";
    botaoConfig.addEventListener("click", () => chrome.runtime.sendMessage({ tipo: "ABRIR_OPCOES" }));
    cabecalho.appendChild(botaoConfig);

    const botaoFechar = document.createElement("button");
    botaoFechar.type = "button";
    botaoFechar.className = "cw-botao-icone";
    botaoFechar.title = "Fechar";
    botaoFechar.textContent = "✕";
    botaoFechar.addEventListener("click", alternarPainel);
    cabecalho.appendChild(botaoFechar);

    painel.appendChild(cabecalho);

    const barraAcoes = document.createElement("div");
    barraAcoes.className = "cw-acoes";
    for (const acao of ACOES) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "cw-botao-acao";
      b.textContent = acao.rotulo;
      b.addEventListener("click", () => executarAcao(acao.id));
      barraAcoes.appendChild(b);
    }
    painel.appendChild(barraAcoes);

    areaResultado = document.createElement("div");
    areaResultado.className = "cw-resultado";
    mostrarDica();
    painel.appendChild(areaResultado);

    document.body.appendChild(painel);
  }

  function alternarPainel() {
    if (!painel) return;
    painel.classList.toggle("cw-oculto");
  }

  function mostrarDica() {
    limpar(areaResultado);
    const p = document.createElement("p");
    p.className = "cw-dica";
    p.textContent = "Abra uma conversa e escolha uma ação acima. A IA lê a conversa e devolve o direcionamento — nada é enviado ao cliente automaticamente.";
    areaResultado.appendChild(p);
  }

  function limpar(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
  }

  // ---------------------------------------------------------------------------
  // Execução da ação
  // ---------------------------------------------------------------------------

  async function executarAcao(acao) {
    if (ocupado) return;
    ocupado = true;

    limpar(areaResultado);
    const carregando = document.createElement("p");
    carregando.className = "cw-carregando";
    carregando.textContent = "Analisando a conversa…";
    areaResultado.appendChild(carregando);

    const conversa = extrairConversa();
    const contato = nomeDoContato();

    let resposta;
    try {
      resposta = await chrome.runtime.sendMessage({ tipo: "ANALISAR", acao, contato, conversa });
    } catch (e) {
      resposta = { ok: false, erro: "A extensão foi atualizada ou recarregada. Recarregue a página do WhatsApp Web (F5) e tente de novo." };
    }

    ocupado = false;

    if (!resposta || !resposta.ok) {
      mostrarErro((resposta && resposta.erro) || "Erro inesperado.");
      return;
    }
    renderizarResultado(resposta.dados);
  }

  function mostrarErro(mensagem) {
    limpar(areaResultado);
    const p = document.createElement("p");
    p.className = "cw-erro";
    p.textContent = mensagem;
    areaResultado.appendChild(p);
  }

  // ---------------------------------------------------------------------------
  // Renderização do resultado
  // ---------------------------------------------------------------------------

  function renderizarResultado(dados) {
    limpar(areaResultado);

    const topo = document.createElement("div");
    topo.className = "cw-linha-topo";

    const temp = ROTULO_TEMPERATURA[dados.temperatura] || ROTULO_TEMPERATURA.morno;
    const selo = document.createElement("span");
    selo.className = `cw-selo ${temp.classe}`;
    selo.textContent = temp.texto;
    topo.appendChild(selo);

    if (dados.estagio) {
      const estagio = document.createElement("span");
      estagio.className = "cw-estagio";
      estagio.textContent = dados.estagio;
      topo.appendChild(estagio);
    }
    areaResultado.appendChild(topo);

    if (dados.resumo) {
      areaResultado.appendChild(secaoTexto("Resumo", dados.resumo));
    }

    if (Array.isArray(dados.sugestoes) && dados.sugestoes.length) {
      const t = document.createElement("h4");
      t.className = "cw-secao-titulo";
      t.textContent = "Mensagens sugeridas";
      areaResultado.appendChild(t);
      for (const s of dados.sugestoes) {
        areaResultado.appendChild(cartaoSugestao(s));
      }
    }

    if (Array.isArray(dados.objecoes) && dados.objecoes.length) {
      const t = document.createElement("h4");
      t.className = "cw-secao-titulo";
      t.textContent = "Objeções no radar";
      areaResultado.appendChild(t);
      for (const o of dados.objecoes) {
        const bloco = document.createElement("div");
        bloco.className = "cw-objecao";
        const q = document.createElement("p");
        q.className = "cw-objecao-titulo";
        q.textContent = o.objecao;
        const r = document.createElement("p");
        r.className = "cw-objecao-resposta";
        r.textContent = o.como_responder;
        bloco.appendChild(q);
        bloco.appendChild(r);
        areaResultado.appendChild(bloco);
      }
    }

    if (dados.proximo_passo) {
      areaResultado.appendChild(secaoTexto("👉 Próximo passo", dados.proximo_passo));
    }
  }

  function secaoTexto(titulo, texto) {
    const wrap = document.createElement("div");
    wrap.className = "cw-secao";
    const t = document.createElement("h4");
    t.className = "cw-secao-titulo";
    t.textContent = titulo;
    const p = document.createElement("p");
    p.className = "cw-secao-texto";
    p.textContent = texto;
    wrap.appendChild(t);
    wrap.appendChild(p);
    return wrap;
  }

  function cartaoSugestao(sugestao) {
    const cartao = document.createElement("div");
    cartao.className = "cw-sugestao";

    const titulo = document.createElement("p");
    titulo.className = "cw-sugestao-titulo";
    titulo.textContent = sugestao.titulo || "Sugestão";
    cartao.appendChild(titulo);

    const msg = document.createElement("p");
    msg.className = "cw-sugestao-msg";
    msg.textContent = sugestao.mensagem;
    cartao.appendChild(msg);

    const acoes = document.createElement("div");
    acoes.className = "cw-sugestao-acoes";

    const btCopiar = document.createElement("button");
    btCopiar.type = "button";
    btCopiar.className = "cw-botao-mini";
    btCopiar.textContent = "Copiar";
    btCopiar.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(sugestao.mensagem);
        feedbackBotao(btCopiar, "Copiado ✓");
      } catch (e) {
        feedbackBotao(btCopiar, "Falhou");
      }
    });
    acoes.appendChild(btCopiar);

    const btInserir = document.createElement("button");
    btInserir.type = "button";
    btInserir.className = "cw-botao-mini cw-botao-mini-primario";
    btInserir.textContent = "Inserir no campo";
    btInserir.addEventListener("click", () => {
      const ok = inserirNaCaixa(sugestao.mensagem);
      feedbackBotao(btInserir, ok ? "Inserido ✓" : "Use Copiar");
    });
    acoes.appendChild(btInserir);

    cartao.appendChild(acoes);
    return cartao;
  }

  function feedbackBotao(botao, texto) {
    const original = botao.textContent;
    botao.textContent = texto;
    setTimeout(() => { botao.textContent = original; }, 1500);
  }

  // Melhor esforço: insere o texto na caixa de mensagem do WhatsApp para o
  // vendedor revisar e enviar ele mesmo. Se o editor mudar e quebrar, o botão
  // "Copiar" continua funcionando sempre.
  function inserirNaCaixa(texto) {
    const caixa = document.querySelector(SELETORES.caixaDeTexto);
    if (!caixa) return false;
    try {
      caixa.focus();
      const ok = document.execCommand("insertText", false, texto);
      return ok !== false;
    } catch (e) {
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Inicialização — o WhatsApp Web é um SPA que demora a montar o DOM.
  // ---------------------------------------------------------------------------

  const iniciar = setInterval(() => {
    if (document.body) {
      garantirUi();
      clearInterval(iniciar);
    }
  }, 1000);
})();
