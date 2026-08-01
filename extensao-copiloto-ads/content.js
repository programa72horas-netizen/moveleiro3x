// Content script: roda dentro do Gerenciador de Anúncios do Meta.
// 1. Extrai a tabela de métricas visível (somente leitura do DOM — nada é
//    alterado nas campanhas; a extensão não clica em nada).
// 2. Injeta a sidebar do copiloto e conversa com o background.js.
//
// ⚠️ O Gerenciador muda o layout com frequência. A extração é feita de forma
// GENÉRICA (roles ARIA de tabela: table/row/columnheader/gridcell), sem
// depender de nomes de colunas — a IA interpreta as colunas que vierem.
// Seletores concentrados no objeto SELETORES abaixo.

(() => {
  "use strict";

  const SELETORES = {
    tabelaAria: "[role='table'], [role='grid'], [role='treegrid']",
    cabecalhoAria: "[role='columnheader']",
    linhaAria: "[role='row']",
    celulaAria: "[role='gridcell'], [role='cell']"
  };

  const MAX_LINHAS = 60;
  const MAX_CHARS = 24000;

  const ACOES = [
    { id: "diagnostico", rotulo: "📊 Diagnóstico geral" },
    { id: "otimizar", rotulo: "✂️ Otimizações agora" },
    { id: "novas", rotulo: "🧪 Novas campanhas" },
    { id: "explicar", rotulo: "🎓 Explicar os números" }
  ];

  const ROTULO_SAUDE = {
    bem: { texto: "Conta saudável", classe: "cw-saude-bem" },
    atencao: { texto: "Atenção", classe: "cw-saude-atencao" },
    critico: { texto: "Crítico", classe: "cw-saude-critico" }
  };

  const ROTULO_ACAO_OTIM = {
    pausar: "⏸️ Pausar",
    escalar: "📈 Escalar",
    reduzir_orcamento: "📉 Reduzir orçamento",
    ajustar_criativo: "🎨 Ajustar criativo",
    ajustar_publico: "🎯 Ajustar público",
    aguardar: "⏳ Aguardar",
    investigar: "🔎 Investigar"
  };

  // ---------------------------------------------------------------------------
  // Extração da tabela de métricas
  // ---------------------------------------------------------------------------

  function textoLimpo(el) {
    return (el.innerText || "").replace(/\s+/g, " ").trim();
  }

  // Estratégia 1: tabelas por roles ARIA (o grid principal do Gerenciador).
  function extrairPorAria() {
    const tabelas = Array.from(document.querySelectorAll(SELETORES.tabelaAria));
    if (!tabelas.length) return "";

    // pega a maior tabela visível (a de campanhas), não menus laterais
    let tabela = tabelas[0];
    for (const t of tabelas) {
      if (t.querySelectorAll(SELETORES.linhaAria).length > tabela.querySelectorAll(SELETORES.linhaAria).length) {
        tabela = t;
      }
    }

    const saida = [];
    const cabecalhos = Array.from(tabela.querySelectorAll(SELETORES.cabecalhoAria))
      .map(textoLimpo)
      .filter(Boolean);
    if (cabecalhos.length) saida.push(cabecalhos.join(" | "));

    const linhas = Array.from(tabela.querySelectorAll(SELETORES.linhaAria));
    for (const linha of linhas) {
      const celulas = Array.from(linha.querySelectorAll(SELETORES.celulaAria))
        .map(textoLimpo);
      if (celulas.length && celulas.some(Boolean)) {
        saida.push(celulas.join(" | "));
      }
      if (saida.length > MAX_LINHAS) break;
    }

    return saida.length > 1 ? saida.join("\n") : "";
  }

  // Estratégia 2 (reserva): tabelas HTML clássicas <table>.
  function extrairPorTabelaHtml() {
    const tabelas = Array.from(document.querySelectorAll("table"));
    if (!tabelas.length) return "";
    let tabela = tabelas[0];
    for (const t of tabelas) {
      if (t.rows.length > tabela.rows.length) tabela = t;
    }
    const saida = [];
    for (const linha of Array.from(tabela.rows).slice(0, MAX_LINHAS)) {
      const celulas = Array.from(linha.cells).map(textoLimpo);
      if (celulas.some(Boolean)) saida.push(celulas.join(" | "));
    }
    return saida.length > 1 ? saida.join("\n") : "";
  }

  function extrairDados() {
    let dados = extrairPorAria();
    if (!dados) dados = extrairPorTabelaHtml();
    return dados.slice(0, MAX_CHARS);
  }

  function tituloDaTela() {
    return (document.title || "").slice(0, 200);
  }

  // ---------------------------------------------------------------------------
  // Sidebar
  // ---------------------------------------------------------------------------

  let painel = null;
  let areaResultado = null;
  let ocupado = false;
  let ultimoResultado = null;

  function garantirUi() {
    if (document.getElementById("cw-botao-flutuante")) return;

    const botao = document.createElement("button");
    botao.id = "cw-botao-flutuante";
    botao.type = "button";
    botao.title = "Copiloto de Tráfego ARS";
    const logoBotao = document.createElement("img");
    logoBotao.className = "cw-logo-botao";
    logoBotao.alt = "ARS";
    logoBotao.src = chrome.runtime.getURL("icones/icone-128.png");
    botao.appendChild(logoBotao);
    botao.addEventListener("click", alternarPainel);
    document.body.appendChild(botao);

    painel = document.createElement("div");
    painel.id = "cw-painel";
    painel.classList.add("cw-oculto");

    const cabecalho = document.createElement("div");
    cabecalho.className = "cw-cabecalho";

    const logoTitulo = document.createElement("img");
    logoTitulo.className = "cw-logo-titulo";
    logoTitulo.alt = "";
    logoTitulo.src = chrome.runtime.getURL("icones/icone-48.png");
    cabecalho.appendChild(logoTitulo);

    const titulo = document.createElement("span");
    titulo.className = "cw-titulo";
    titulo.textContent = "Copiloto de Tráfego ARS";
    cabecalho.appendChild(titulo);

    const botaoCopiar = document.createElement("button");
    botaoCopiar.type = "button";
    botaoCopiar.className = "cw-botao-icone";
    botaoCopiar.title = "Copiar análise (para relatório/cliente)";
    botaoCopiar.textContent = "📋";
    botaoCopiar.addEventListener("click", copiarAnalise);
    cabecalho.appendChild(botaoCopiar);

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
    p.textContent = "Abra a visão de Campanhas, Conjuntos ou Anúncios com as colunas que quer analisar e escolha uma ação acima. A IA lê a tabela visível e compara com as suas metas — nada é alterado nas campanhas.";
    areaResultado.appendChild(p);
  }

  function limpar(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
  }

  async function executarAcao(acao) {
    if (ocupado) return;
    ocupado = true;

    limpar(areaResultado);
    const carregando = document.createElement("p");
    carregando.className = "cw-carregando";
    carregando.textContent = "Analisando as métricas…";
    areaResultado.appendChild(carregando);

    const dados = extrairDados();
    const titulo = tituloDaTela();

    if (!dados) {
      ocupado = false;
      mostrarErro("Não encontrei a tabela de métricas nesta tela. Abra a visão de Campanhas / Conjuntos / Anúncios (com a tabela visível) e tente de novo. Se a tabela está na tela e o erro persistir, o Meta pode ter mudado o layout.");
      return;
    }

    let resposta;
    try {
      resposta = await chrome.runtime.sendMessage({ tipo: "ANALISAR", acao, titulo, dados });
    } catch (e) {
      resposta = { ok: false, erro: "A extensão foi atualizada ou recarregada. Recarregue a página (F5) e tente de novo." };
    }

    ocupado = false;

    if (!resposta || !resposta.ok) {
      mostrarErro((resposta && resposta.erro) || "Erro inesperado.");
      return;
    }
    ultimoResultado = resposta.dados;
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
  // Renderização (sempre textContent — nunca innerHTML)
  // ---------------------------------------------------------------------------

  function renderizarResultado(dados) {
    if (!dados || typeof dados !== "object") {
      mostrarErro("A análise voltou em formato inesperado. Tente de novo.");
      return;
    }

    limpar(areaResultado);

    const topo = document.createElement("div");
    topo.className = "cw-linha-topo";
    const saude = ROTULO_SAUDE[dados.saude_geral] || ROTULO_SAUDE.atencao;
    const selo = document.createElement("span");
    selo.className = `cw-selo ${saude.classe}`;
    selo.textContent = saude.texto;
    topo.appendChild(selo);
    areaResultado.appendChild(topo);

    if (dados.diagnostico) {
      areaResultado.appendChild(secaoTexto("Diagnóstico", String(dados.diagnostico)));
    }

    if (Array.isArray(dados.alertas) && dados.alertas.length) {
      const t = document.createElement("h4");
      t.className = "cw-secao-titulo";
      t.textContent = "🚨 Alertas";
      areaResultado.appendChild(t);
      for (const a of dados.alertas) {
        if (!a || typeof a !== "object") continue;
        const bloco = document.createElement("div");
        bloco.className = "cw-objecao";
        const q = document.createElement("p");
        q.className = "cw-objecao-titulo";
        q.textContent = String(a.item || "");
        const r = document.createElement("p");
        r.className = "cw-objecao-resposta";
        r.textContent = String(a.problema || "");
        bloco.appendChild(q);
        bloco.appendChild(r);
        areaResultado.appendChild(bloco);
      }
    }

    if (Array.isArray(dados.otimizacoes) && dados.otimizacoes.length) {
      const t = document.createElement("h4");
      t.className = "cw-secao-titulo";
      t.textContent = "Otimizações recomendadas";
      areaResultado.appendChild(t);
      for (const o of dados.otimizacoes) {
        if (!o || typeof o !== "object") continue;
        const cartao = document.createElement("div");
        cartao.className = "cw-sugestao";
        const titulo = document.createElement("p");
        titulo.className = "cw-sugestao-titulo";
        titulo.textContent = `${ROTULO_ACAO_OTIM[o.acao] || o.acao || ""} — ${o.alvo || ""}`;
        const msg = document.createElement("p");
        msg.className = "cw-sugestao-msg";
        msg.textContent = String(o.motivo || "");
        cartao.appendChild(titulo);
        cartao.appendChild(msg);
        areaResultado.appendChild(cartao);
      }
    }

    if (Array.isArray(dados.novas_campanhas) && dados.novas_campanhas.length) {
      const t = document.createElement("h4");
      t.className = "cw-secao-titulo";
      t.textContent = "🧪 Novas campanhas / testes";
      areaResultado.appendChild(t);
      for (const n of dados.novas_campanhas) {
        if (!n || typeof n !== "object") continue;
        const cartao = document.createElement("div");
        cartao.className = "cw-sugestao";
        const titulo = document.createElement("p");
        titulo.className = "cw-sugestao-titulo";
        titulo.textContent = `${n.ideia || "Teste"} · ${n.objetivo || ""}`;
        const msg = document.createElement("p");
        msg.className = "cw-sugestao-msg";
        msg.textContent = String(n.detalhe || "");
        cartao.appendChild(titulo);
        cartao.appendChild(msg);
        areaResultado.appendChild(cartao);
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

  // Copia a última análise como texto simples — pronto para colar em
  // relatório, WhatsApp do cliente ou nota interna.
  async function copiarAnalise() {
    if (!ultimoResultado) return;
    const d = ultimoResultado;
    const linhas = [];
    const saude = ROTULO_SAUDE[d.saude_geral];
    if (saude) linhas.push(`Situação: ${saude.texto}`);
    if (d.diagnostico) linhas.push(`\nDiagnóstico:\n${d.diagnostico}`);
    if (Array.isArray(d.alertas) && d.alertas.length) {
      linhas.push("\nAlertas:");
      for (const a of d.alertas) linhas.push(`- ${a.item}: ${a.problema}`);
    }
    if (Array.isArray(d.otimizacoes) && d.otimizacoes.length) {
      linhas.push("\nOtimizações:");
      for (const o of d.otimizacoes) linhas.push(`- ${(ROTULO_ACAO_OTIM[o.acao] || o.acao || "").replace(/^\S+\s/, "")} ${o.alvo}: ${o.motivo}`);
    }
    if (Array.isArray(d.novas_campanhas) && d.novas_campanhas.length) {
      linhas.push("\nNovas campanhas/testes:");
      for (const n of d.novas_campanhas) linhas.push(`- ${n.ideia} (${n.objetivo}): ${n.detalhe}`);
    }
    if (d.proximo_passo) linhas.push(`\nPróximo passo: ${d.proximo_passo}`);
    try {
      await navigator.clipboard.writeText(linhas.join("\n"));
    } catch (e) { /* clipboard bloqueado */ }
  }

  // ---------------------------------------------------------------------------
  // Inicialização — o Gerenciador é um SPA pesado.
  // ---------------------------------------------------------------------------

  const iniciar = setInterval(() => {
    if (document.body) {
      clearInterval(iniciar);
      garantirUi();
    }
  }, 1000);
})();
