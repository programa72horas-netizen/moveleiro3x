// Página de opções: carrega e salva a configuração em chrome.storage.local.
// (local, não sync: a chave de API não deve ser sincronizada entre máquinas,
// e o playbook pode passar do limite de tamanho do storage.sync.)

const PLAYBOOK_EXEMPLO = `SOBRE O NEGÓCIO
- Loja de móveis planejados (cozinhas, dormitórios, home office).
- Atendemos [cidade e região]. Showroom em [endereço].
- Diferenciais: projeto 3D gratuito, madeira 100% MDF naval, entrega e montagem próprias, garantia de 5 anos.

COMO VENDEMOS
1. Primeiro contato: entender o ambiente (qual cômodo, tamanho aproximado, prazo do cliente).
2. Convidar para visita ao showroom OU agendar medição gratuita em casa.
3. Apresentar projeto 3D + orçamento em até 48h após a medição.
4. Fechamento: condição especial válida na semana da apresentação.

PREÇOS E CONDIÇÕES
- Cozinha planejada: a partir de R$ 12.000 (varia por tamanho e acabamento).
- Entrada de 30% + saldo em até 10x sem juros no cartão.
- NUNCA passar preço fechado por mensagem sem medição — dar faixa e puxar para a medição.

OBJEÇÕES COMUNS
- "Tá caro" → mostrar o custo por ano de uso (móvel dura 15+ anos), comparar com modulado de loja que empena, oferecer ajustar o projeto (não o preço).
- "Vou pensar" → perguntar o que falta para decidir; oferecer segurar a condição por 48h.
- "Vi mais barato" → perguntar o que está incluso no outro orçamento (projeto? montagem? garantia?); nunca falar mal do concorrente.

REGRAS
- Sempre puxar para o próximo passo concreto: medição agendada > visita > orçamento.
- Responder áudio com texto é permitido; ser sempre cordial e chamar o cliente pelo nome.`;

const $ = (id) => document.getElementById(id);

function atualizarVisibilidade() {
  const modo = document.querySelector('input[name="modo"]:checked').value;
  $("campos-direto").classList.toggle("oculto", modo !== "direto");
  $("campos-backend").classList.toggle("oculto", modo !== "backend");
}

async function carregar() {
  const cfg = await chrome.storage.local.get([
    "modo", "apiKey", "backendUrl", "licenseKey", "modelo", "playbook", "nomeVendedor", "tom"
  ]);

  const modo = cfg.modo || "direto";
  document.querySelector(`input[name="modo"][value="${modo}"]`).checked = true;
  $("apiKey").value = cfg.apiKey || "";
  $("backendUrl").value = cfg.backendUrl || "";
  $("licenseKey").value = cfg.licenseKey || "";
  $("modelo").value = cfg.modelo || "claude-opus-5";
  $("nomeVendedor").value = cfg.nomeVendedor || "";
  $("tom").value = cfg.tom || "";
  $("playbook").value = cfg.playbook !== undefined ? cfg.playbook : PLAYBOOK_EXEMPLO;

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
    nomeVendedor: $("nomeVendedor").value.trim(),
    tom: $("tom").value.trim(),
    playbook: $("playbook").value
  });

  const status = $("status");
  status.textContent = "Salvo ✓";
  setTimeout(() => { status.textContent = ""; }, 2500);
}

document.querySelectorAll('input[name="modo"]').forEach((r) => r.addEventListener("change", atualizarVisibilidade));
$("salvar").addEventListener("click", salvar);
carregar();
