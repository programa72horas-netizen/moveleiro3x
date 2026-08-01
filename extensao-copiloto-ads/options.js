// Página de opções: carrega e salva a configuração em chrome.storage.local.
// (local, não sync: a chave de API não deve ser sincronizada entre máquinas,
// e as metas podem passar do limite de tamanho do storage.sync.)

const PLAYBOOK_EXEMPLO = `SOBRE O NEGÓCIO
- [Descreva: o que vende, ticket médio, região, para quem]
- Ticket médio: R$ 350 | Margem: ~40%
- Funil: anúncio → formulário de cadastro → atendimento no WhatsApp → venda

METAS (o que é bom / ruim NESTA conta)
- CPL alvo: até R$ 12 (lead de formulário). Acima de R$ 18 = problema.
- CPA máximo (venda): R$ 90. Acima disso a campanha dá prejuízo.
- ROAS mínimo aceitável: 3.0. Ideal: acima de 4.0.
- CTR de referência: acima de 1,2% está bom; abaixo de 0,8% o criativo está fraco.
- Orçamento total: R$ 3.000/mês. Nunca sugerir escala que passe disso.

REGRAS DE DECISÃO
- Só pausar conjunto/anúncio com pelo menos R$ 50 gastos OU 1.000 impressões (antes disso, aguardar).
- Escalar no máximo 20% de orçamento por vez, a cada 2-3 dias.
- Sempre manter pelo menos 2 criativos ativos por conjunto em teste.
- Público quente (remarketing) tem CPL alvo diferente: até R$ 6.

CONTEXTO ATUAL (atualize quando mudar)
- Campanha principal: captação de leads para [oferta].
- Sazonalidade: [ex.: vendas caem em janeiro; Dia das Mães é pico].
- Histórico: [ex.: vídeo com depoimento sempre performou melhor que arte estática].`;

const $ = (id) => document.getElementById(id);

function atualizarVisibilidade() {
  const modo = document.querySelector('input[name="modo"]:checked').value;
  $("campos-direto").classList.toggle("oculto", modo !== "direto");
  $("campos-backend").classList.toggle("oculto", modo !== "backend");
}

async function carregar() {
  const cfg = await chrome.storage.local.get([
    "modo", "apiKey", "backendUrl", "licenseKey", "modelo", "playbook"
  ]);

  const modo = cfg.modo || "direto";
  document.querySelector(`input[name="modo"][value="${modo}"]`).checked = true;
  $("apiKey").value = cfg.apiKey || "";
  $("backendUrl").value = cfg.backendUrl || "";
  $("licenseKey").value = cfg.licenseKey || "";
  $("modelo").value = cfg.modelo || "claude-opus-5";
  // O exemplo NUNCA entra como valor automaticamente: se fosse salvo sem
  // edição, a IA julgaria a conta com metas fictícias. Placeholder + botão.
  $("playbook").value = cfg.playbook || "";
  $("playbook").placeholder = "Descreva as metas reais DESTA conta — ou clique em \"Preencher com exemplo\" abaixo e edite.\n\n" + PLAYBOOK_EXEMPLO;

  atualizarVisibilidade();
}

async function salvar() {
  const modo = document.querySelector('input[name="modo"]:checked').value;
  await chrome.storage.local.set({
    modo,
    apiKey: $("apiKey").value.trim(),
    backendUrl: $("backendUrl").value.trim(),
    licenseKey: $("licenseKey").value.trim(),
    modelo: $("modelo").value,
    playbook: $("playbook").value
  });

  const status = $("status");
  status.textContent = "Salvo ✓";
  setTimeout(() => { status.textContent = ""; }, 2500);
}

document.querySelectorAll('input[name="modo"]').forEach((r) => r.addEventListener("change", atualizarVisibilidade));
$("salvar").addEventListener("click", salvar);
$("usarExemplo").addEventListener("click", () => {
  if (!$("playbook").value.trim() || confirm("Substituir as metas atuais pelo exemplo?")) {
    $("playbook").value = PLAYBOOK_EXEMPLO;
    $("playbook").focus();
  }
});
carregar();
