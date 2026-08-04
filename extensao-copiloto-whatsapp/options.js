// Página de opções: treinamento estruturado (Básico) ou texto livre (Avançado).
//
// O background/worker continuam lendo um único campo "playbook" — no modo
// Básico ele é MONTADO automaticamente a partir das seções do formulário no
// momento de salvar. Os campos estruturados ficam guardados em "treino" para
// o usuário poder voltar e editar seção por seção.
// (storage.local, não sync: chave de API não deve sincronizar entre máquinas.)

const EXEMPLO = {
  identidade: "Loja de móveis planejados (cozinhas, dormitórios, home office). Atendemos [cidade e região], showroom em [endereço]. Diferenciais: projeto 3D gratuito, MDF naval, entrega e montagem próprias, garantia de 5 anos.",
  produtos: "Cozinha planejada: a partir de R$ 12.000 (varia por tamanho e acabamento). Entrada de 30% + saldo em até 10x sem juros no cartão. NUNCA passar preço fechado por mensagem sem medição — dar faixa e puxar para a medição gratuita.",
  processo: "1) Primeiro contato: entender o ambiente (qual cômodo, tamanho aproximado, prazo do cliente). 2) Convidar para visita ao showroom OU agendar medição gratuita em casa. 3) Apresentar projeto 3D + orçamento em até 48h após a medição. 4) Fechamento: condição especial válida na semana da apresentação.",
  objecoes: "\"Tá caro\" → mostrar o custo por ano de uso (móvel dura 15+ anos), comparar com modulado de loja que empena, oferecer ajustar o projeto (não o preço). \"Vou pensar\" → perguntar o que falta para decidir; oferecer segurar a condição por 48h. \"Vi mais barato\" → perguntar o que está incluso no outro orçamento (projeto? montagem? garantia?); nunca falar mal do concorrente.",
  regras: "Sempre puxar para o próximo passo concreto: medição agendada > visita > orçamento. Responder áudio com texto é permitido. Ser sempre cordial e chamar o cliente pelo nome.",
  tom: "próximo e consultivo, sem gíria, chama o cliente pelo nome"
};

const SECOES = [
  { campo: "identidade", id: "tIdentidade", titulo: "IDENTIDADE E POSICIONAMENTO" },
  { campo: "produtos", id: "tProdutos", titulo: "PRODUTOS, PREÇOS E CONDIÇÕES" },
  { campo: "processo", id: "tProcesso", titulo: "PROCESSO DE VENDA" },
  { campo: "objecoes", id: "tObjecoes", titulo: "OBJEÇÕES E COMO RESPONDER" },
  { campo: "regras", id: "tRegras", titulo: "REGRAS DO ATENDIMENTO" }
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
  // Ao ir para o Avançado, leva o que foi montado no Básico (se o texto livre
  // estiver vazio) para o usuário não perder nada.
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
    "playbook", "nomeVendedor", "tom", "treino", "modoTreino"
  ]);

  const modo = cfg.modo || "direto";
  document.querySelector(`input[name="modo"][value="${modo}"]`).checked = true;
  $("apiKey").value = cfg.apiKey || "";
  $("backendUrl").value = cfg.backendUrl || "";
  $("licenseKey").value = cfg.licenseKey || "";
  $("modelo").value = cfg.modelo || "claude-opus-5";
  $("nomeVendedor").value = cfg.nomeVendedor || "";
  $("tom").value = cfg.tom || "";

  const treino = cfg.treino || {};
  for (const s of SECOES) {
    $(s.id).value = treino[s.campo] || "";
  }
  $("playbookLivre").value = cfg.playbook || "";

  // Quem já tinha playbook salvo antes desta versão continua no Avançado.
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
    nomeVendedor: $("nomeVendedor").value.trim(),
    tom: $("tom").value.trim(),
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
    if (temConteudo && !confirm("Substituir o treinamento atual pelo exemplo de móveis planejados?")) return;
    for (const s of SECOES) $(s.id).value = EXEMPLO[s.campo];
    if (!$("tom").value.trim()) $("tom").value = EXEMPLO.tom;
    $("tIdentidade").focus();
  } else {
    if ($("playbookLivre").value.trim() && !confirm("Substituir o treinamento atual pelo exemplo de móveis planejados?")) return;
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
