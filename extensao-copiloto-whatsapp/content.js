// Content script: roda dentro do WhatsApp Web.
// 1. Extrai as mensagens da conversa aberta (somente leitura do DOM — nada é
//    enviado automaticamente, nenhum clique é simulado).
// 2. Injeta a sidebar do copiloto e conversa com o background.js.
//
// ⚠️ O WhatsApp Web muda o layout com frequência. TODOS os seletores ficam
// concentrados no objeto SELETORES abaixo — e, no modo assinatura, podem ser
// sobrescritos remotamente pelo worker (chave "_seletores" no KV), corrigindo
// todas as instalações em minutos, sem esperar revisão da Chrome Web Store.

(() => {
  "use strict";

  const SELETORES = {
    principal: "#main",
    nomeContato: "#main header span[title]",
    linhasMensagem: "#main .message-in, #main .message-out",
    classeSaida: "message-out",
    textoMensagem: "span.selectable-text",
    carimboTempo: "[data-pre-plain-text]",
    midiaAudio: "audio, [data-icon='audio-play'], [data-icon='ptt-status']",
    midiaImagem: "img[src^='blob:']",
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

  // O WhatsApp renderiza emojis como <img class="emoji" alt="👍">. innerText
  // descarta o alt — e um "👍" sozinho viraria mensagem vazia. Este helper
  // percorre os nós e recupera o texto COM os emojis.
  function textoComEmojis(el) {
    let saida = "";
    for (const no of el.childNodes) {
      if (no.nodeType === Node.TEXT_NODE) {
        saida += no.nodeValue;
      } else if (no.nodeType === Node.ELEMENT_NODE) {
        if (no.tagName === "IMG") {
          saida += no.getAttribute("alt") || "";
        } else if (no.tagName === "BR") {
          saida += "\n";
        } else {
          saida += textoComEmojis(no);
        }
      }
    }
    return saida;
  }

  // "[14:32, 01/08/2026] Fulano: " → "14:32, 01/08/2026"
  function carimboDaLinha(linha) {
    const el = linha.querySelector(SELETORES.carimboTempo);
    if (!el) return "";
    const bruto = el.getAttribute("data-pre-plain-text") || "";
    const m = bruto.match(/\[([^\]]+)\]/);
    return m ? m[1].trim() : "";
  }

  function extrairConversa() {
    const linhas = Array.from(document.querySelectorAll(SELETORES.linhasMensagem));
    const mensagens = [];

    for (const linha of linhas) {
      const autor = linha.classList.contains(SELETORES.classeSaida) ? "Vendedor" : "Cliente";

      let texto = "";
      const spans = linha.querySelectorAll(SELETORES.textoMensagem);
      if (spans.length) {
        texto = Array.from(spans).map((s) => textoComEmojis(s)).join("\n").trim();
      }

      if (!texto) {
        // Mensagem sem texto (áudio, imagem, figurinha...): registra que existiu,
        // porque "cliente mandou áudio e ninguém respondeu" é sinal de venda.
        if (linha.querySelector(SELETORES.midiaAudio)) {
          texto = "[áudio]";
        } else if (linha.querySelector(SELETORES.midiaImagem)) {
          texto = "[imagem]";
        } else {
          continue;
        }
      }

      const carimbo = carimboDaLinha(linha);
      mensagens.push(carimbo ? `${autor} (${carimbo}): ${texto}` : `${autor}: ${texto}`);
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
    botaoConfig.addEventListener("click", () => {
      try {
        chrome.runtime.sendMessage({ tipo: "ABRIR_OPCOES" }).catch(() => {});
      } catch (e) { /* extensão recarregada */ }
    });
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

    if (!conversa && document.querySelector(SELETORES.principal)) {
      ocupado = false;
      mostrarErro("Não consegui ler as mensagens desta conversa. Se ela não estiver vazia, o WhatsApp pode ter atualizado o layout — já estamos ajustando; tente novamente mais tarde.");
      return;
    }

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
  // (sempre via textContent — nunca innerHTML — para que nenhum conteúdo vindo
  // do modelo ou da conversa vire HTML executável. Manter assim.)
  // ---------------------------------------------------------------------------

  function renderizarResultado(dados) {
    if (!dados || typeof dados !== "object") {
      mostrarErro("A análise voltou em formato inesperado. Tente de novo.");
      return;
    }

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
      estagio.textContent = String(dados.estagio);
      topo.appendChild(estagio);
    }
    areaResultado.appendChild(topo);

    if (dados.resumo) {
      areaResultado.appendChild(secaoTexto("Resumo", String(dados.resumo)));
    }

    if (Array.isArray(dados.sugestoes) && dados.sugestoes.length) {
      const t = document.createElement("h4");
      t.className = "cw-secao-titulo";
      t.textContent = "Mensagens sugeridas";
      areaResultado.appendChild(t);
      for (const s of dados.sugestoes) {
        if (s && typeof s.mensagem === "string") areaResultado.appendChild(cartaoSugestao(s));
      }
    }

    if (Array.isArray(dados.objecoes) && dados.objecoes.length) {
      const t = document.createElement("h4");
      t.className = "cw-secao-titulo";
      t.textContent = "Objeções no radar";
      areaResultado.appendChild(t);
      for (const o of dados.objecoes) {
        if (!o || typeof o !== "object") continue;
        const bloco = document.createElement("div");
        bloco.className = "cw-objecao";
        const q = document.createElement("p");
        q.className = "cw-objecao-titulo";
        q.textContent = String(o.objecao || "");
        const r = document.createElement("p");
        r.className = "cw-objecao-resposta";
        r.textContent = String(o.como_responder || "");
        bloco.appendChild(q);
        bloco.appendChild(r);
        areaResultado.appendChild(bloco);
      }
    }

    if (dados.proximo_passo) {
      areaResultado.appendChild(secaoTexto("👉 Próximo passo", String(dados.proximo_passo)));
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
    if (!botao.dataset.rotuloOriginal) {
      botao.dataset.rotuloOriginal = botao.textContent;
    }
    botao.textContent = texto;
    clearTimeout(Number(botao.dataset.timerFeedback || 0));
    botao.dataset.timerFeedback = String(setTimeout(() => {
      botao.textContent = botao.dataset.rotuloOriginal;
    }, 1500));
  }

  // Melhor esforço: SUBSTITUI o conteúdo da caixa de mensagem pelo texto
  // sugerido (seleciona tudo antes de inserir — sem isso, a sugestão seria
  // emendada em rascunhos já digitados). O vendedor sempre revisa e envia
  // ele mesmo. Se o editor mudar e quebrar, o botão "Copiar" segue funcionando.
  function inserirNaCaixa(texto) {
    const caixa = document.querySelector(SELETORES.caixaDeTexto);
    if (!caixa) return false;
    try {
      caixa.focus();
      document.execCommand("selectAll", false, null);
      const ok = document.execCommand("insertText", false, texto);
      return ok !== false;
    } catch (e) {
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Inicialização — o WhatsApp Web é um SPA que demora a montar o DOM.
  // Também busca (via background) sobrescritas remotas de seletores.
  // ---------------------------------------------------------------------------

  function aplicarSeletoresRemotos() {
    try {
      chrome.runtime.sendMessage({ tipo: "OBTER_SELETORES" })
        .then((remotos) => {
          if (remotos && typeof remotos === "object") {
            for (const chave of Object.keys(SELETORES)) {
              if (typeof remotos[chave] === "string" && remotos[chave]) {
                SELETORES[chave] = remotos[chave];
              }
            }
          }
        })
        .catch(() => {});
    } catch (e) { /* extensão recarregada */ }
  }

  const iniciar = setInterval(() => {
    if (document.body) {
      clearInterval(iniciar);
      garantirUi();
      aplicarSeletoresRemotos();
    }
  }, 1000);
})();
