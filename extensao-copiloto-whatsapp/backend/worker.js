// Servidor de licenciamento + proxy da API (Cloudflare Worker).
//
// É esta peça que transforma a extensão em produto de assinatura:
//  - O assinante recebe só uma CHAVE DE LICENÇA (nunca a chave da API).
//  - Cada chamada valida a licença no KV antes de repassar para a Anthropic.
//  - Cancelou a assinatura? Você desativa a licença no KV e o acesso morre.
//  - O modelo e o limite de tokens são TRAVADOS aqui — o cliente não consegue
//    usar sua chave para outra coisa.
//
// Configuração (wrangler.toml + painel da Cloudflare):
//  - Secret ANTHROPIC_API_KEY: sua chave da API (wrangler secret put ANTHROPIC_API_KEY)
//  - KV namespace LICENCAS: chave = código da licença, valor = JSON:
//      {"ativa": true, "cliente": "Loja X", "plano": "mensal", "expira": "2026-09-01"}
//  - (opcional) KV namespace USO: contadores de uso por licença/dia.
//
// Emissão de licenças: ao receber o webhook de pagamento aprovado da sua
// plataforma (Stripe, Hotmart, Kiwify...), grave uma licença no KV e envie o
// código por e-mail. Ao receber cancelamento/estorno, marque {"ativa": false}.

const API_URL = "https://api.anthropic.com/v1/messages";
const VERSAO_API = "2023-06-01";

// Travas do produto — o cliente não controla isso.
const MODELO_PERMITIDO_PADRAO = "claude-opus-5";
const MAX_TOKENS_TETO = 4096;
const LIMITE_DIARIO_PADRAO = 200; // análises por licença por dia

const CABECALHOS_CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type"
};

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CABECALHOS_CORS });
    }

    const url = new URL(request.url);
    if (request.method !== "POST" || url.pathname !== "/analisar") {
      return json({ erro: "Rota não encontrada." }, 404);
    }

    let corpo;
    try {
      corpo = await request.json();
    } catch (e) {
      return json({ erro: "Corpo inválido." }, 400);
    }

    const { licenca, requisicao } = corpo || {};
    if (!licenca || !requisicao) {
      return json({ erro: "Envie 'licenca' e 'requisicao'." }, 400);
    }

    // 1. Valida a licença
    const dadosLicenca = await env.LICENCAS.get(licenca, "json");
    if (!dadosLicenca || dadosLicenca.ativa !== true) {
      return json({ erro: "Licença inválida ou desativada. Verifique sua assinatura." }, 403);
    }
    if (dadosLicenca.expira && Date.parse(dadosLicenca.expira) < Date.now()) {
      return json({ erro: "Licença expirada. Renove sua assinatura para continuar." }, 403);
    }

    // 2. Limite de uso diário (proteção de custo por assinante)
    if (env.USO) {
      const hoje = new Date().toISOString().slice(0, 10);
      const chaveUso = `${licenca}:${hoje}`;
      const usoAtual = parseInt((await env.USO.get(chaveUso)) || "0", 10);
      const limite = dadosLicenca.limiteDiario || LIMITE_DIARIO_PADRAO;
      if (usoAtual >= limite) {
        return json({ erro: `Limite diário de ${limite} análises atingido. Volte amanhã ou fale com o suporte.` }, 429);
      }
      // KV não é transacional — para um limite de proteção de custo, está ok.
      await env.USO.put(chaveUso, String(usoAtual + 1), { expirationTtl: 60 * 60 * 48 });
    }

    // 3. Trava modelo e limites antes de repassar
    const corpoApi = {
      ...requisicao,
      model: env.MODELO_PERMITIDO || MODELO_PERMITIDO_PADRAO,
      max_tokens: Math.min(Number(requisicao.max_tokens) || 3000, MAX_TOKENS_TETO),
      stream: false
    };

    // 4. Repassa para a Anthropic
    let respostaApi;
    try {
      respostaApi = await fetch(API_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": env.ANTHROPIC_API_KEY,
          "anthropic-version": VERSAO_API
        },
        body: JSON.stringify(corpoApi)
      });
    } catch (e) {
      return json({ erro: "Falha ao contatar o serviço de IA." }, 502);
    }

    const textoResposta = await respostaApi.text();
    return new Response(textoResposta, {
      status: respostaApi.status,
      headers: { "content-type": "application/json", ...CABECALHOS_CORS }
    });
  }
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json", ...CABECALHOS_CORS }
  });
}
