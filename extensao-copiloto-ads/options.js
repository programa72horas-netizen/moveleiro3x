// Página de opções: treinamento estruturado (Básico) ou texto livre (Avançado).
//
// O background/worker continuam lendo um único campo "playbook" — no modo
// Básico ele é MONTADO automaticamente a partir das seções do formulário no
// momento de salvar. Os campos estruturados ficam guardados em "treino" para
// o usuário poder voltar e editar seção por seção.

const EXEMPLO = {
  negocio: "Clínica de estética em [cidade]. Ticket médio: R$ 350, margem ~40%. Funil: anúncio → formulário de cadastro → atendimento no WhatsApp → agendamento/venda.",
  metas: "CPL alvo: até R$ 12 (lead de formulário); acima de R$ 18 é problema. CPA máximo (venda): R$ 90 — acima disso a campanha dá prejuízo. ROAS mínimo aceitável: 3.0; ideal acima de 4.0. CTR de referência: acima de 1,2% está bom; abaixo de 0,8% o criativo está fraco. Orçamento total: R$ 3.000/mês — nunca sugerir escala que passe disso.",
  regras: "Só pausar conjunto/anúncio com pelo menos R$ 50 gastos OU 1.000 impressões (antes disso, aguardar). Escalar no máximo 20% de orçamento por vez, a cada 2-3 dias. Sempre manter pelo menos 2 criativos ativos por conjunto em teste. Público quente (remarketing) tem CPL alvo diferente: até R$ 6.",
  contexto: "Campanha principal: captação de leads para [oferta]. Sazonalidade: [ex.: vendas caem em janeiro; Dia das Mães é pico]. Histórico: [ex.: vídeo com depoimento sempre performou melhor que arte estática]."
};

const SECOES = [
  { campo: "negocio", id: "tNegocio", titulo: "SOBRE O NEGÓCIO" },
  { campo: "metas", id: "tMetas", titulo: "METAS DA CONTA (o que é bom / ruim aqui)" },
  { campo: "regras", id: "tRegras", titulo: "REGRAS DE DECISÃO" },
  { campo: "contexto", id: "tContexto", titulo: "CONTEXTO ATUAL" }
];

const $ = (id) => document.getElementById(id);
let modoTreino = "basico";

function montarPlaybook() {
  const partes = [];
  for (const s of SECOES) {
    const valor = $(s.id).value.trim();
    if (valor) partes.push(`## ${s.titulo}\n${valor}`);
  }
  return partes.join("\n\n");
}

function definirModoTreino(novo, { transferir = true } = {}) {
  if (novo === "avancado" && transferir && !$("playbookLivre").value.trim()) {
    $("playbookLivre").value = montarPlaybook();
  }
  modoTreino = novo;
  $("cartao-basico").classList.toggle("ativo", novo === "basico");
  $("cartao-avancado").classList.toggle("ativo", novo === "avancado");
  $("treino-basico").classList.toggle("oculto", novo !== "basico");
  $("treino-avancado").classList.toggle("oculto", novo !== "avancado");
}

function atualizarVisibilidade() {
  const modo = document.querySelector('input[name="modo"]:checked').value;
  $("campos-direto").classList.toggle("oculto", modo !== "direto");
  $("campos-backend").classList.toggle("oculto", modo !== "backend");
}

async function carregar() {
  const cfg = await chrome.storage.local.get([
    "modo", "apiKey", "backendUrl", "licenseKey", "modelo",
    "playbook", "treino", "modoTreino"
  ]);

  const modo = cfg.modo || "direto";
  document.querySelector(`input[name="modo"][value="${modo}"]`).checked = true;
  $("apiKey").value = cfg.apiKey || "";
  $("backendUrl").value = cfg.backendUrl || "";
  $("licenseKey").value = cfg.licenseKey || "";
  $("modelo").value = cfg.modelo || "claude-opus-5";

  const treino = cfg.treino || {};
  for (const s of SECOES) {
    $(s.id).value = treino[s.campo] || "";
  }
  $("playbookLivre").value = cfg.playbook || "";

  const inicial = cfg.modoTreino || (cfg.playbook && !cfg.treino ? "avancado" : "basico");
  definirModoTreino(inicial, { transferir: false });

  atualizarVisibilidade();
}

async function salvar() {
  const modo = document.querySelector('input[name="modo"]:checked').value;

  const treino = {};
  for (const s of SECOES) treino[s.campo] = $(s.id).value;

  const playbook = modoTreino === "basico" ? montarPlaybook() : $("playbookLivre").value;

  await chrome.storage.local.set({
    modo,
    apiKey: $("apiKey").value.trim(),
    backendUrl: $("backendUrl").value.trim(),
    licenseKey: $("licenseKey").value.trim(),
    modelo: $("modelo").value,
    treino,
    modoTreino,
    playbook
  });

  const status = $("status");
  status.textContent = "Salvo ✓ (treinamento atualizado)";
  setTimeout(() => { status.textContent = ""; }, 2500);
}

function preencherExemplo() {
  if (modoTreino === "basico") {
    const temConteudo = SECOES.some((s) => $(s.id).value.trim());
    if (temConteudo && !confirm("Substituir o treinamento atual pelo exemplo?")) return;
    for (const s of SECOES) $(s.id).value = EXEMPLO[s.campo];
    $("tNegocio").focus();
  } else {
    if ($("playbookLivre").value.trim() && !confirm("Substituir o treinamento atual pelo exemplo?")) return;
    const partes = SECOES.map((s) => `## ${s.titulo}\n${EXEMPLO[s.campo]}`);
    $("playbookLivre").value = partes.join("\n\n");
    $("playbookLivre").focus();
  }
}

document.querySelectorAll('input[name="modo"]').forEach((r) => r.addEventListener("change", atualizarVisibilidade));
$("cartao-basico").addEventListener("click", () => definirModoTreino("basico"));
$("cartao-avancado").addEventListener("click", () => definirModoTreino("avancado"));
$("usarExemplo").addEventListener("click", preencherExemplo);
$("salvar").addEventListener("click", salvar);
carregar();
