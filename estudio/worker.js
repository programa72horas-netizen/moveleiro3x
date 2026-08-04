/*
 * Estúdio 72h · Worker (Cloudflare)
 * ------------------------------------------------------------------
 * Serve o app estático (pasta public/) e expõe POST /api/gerar, que
 * pede ao Claude os TEXTOS das artes. A IA nunca desenha: ela devolve
 * apenas os campos de cada modelo, em JSON validado por schema.
 *
 * Segredos/variáveis (veja o README):
 *   ANTHROPIC_API_KEY  (obrigatório, via `wrangler secret put`)
 *   ACCESS_CODES       (obrigatório: "Nome:pin,Nome 2:pin2" — deve
 *                       bater com CONFIG.DESIGNERS do app.js)
 *   MODEL              (opcional; padrão claude-sonnet-5)
 */

'use strict';

const MODELO_PADRAO = 'claude-sonnet-5';

// Resumo dos guias de estilo das fases do método 72 Horas.
// O desenho já é garantido pelo layout — aqui a IA aprende o TOM de cada fase.
const GUIA_FASES = {
  1: `FASE 1 — CURIOSIDADE/ANTECIPAÇÃO: tom direto, urgente e misterioso, como um
comunicado importante ou vazamento de informação. Frases curtas em CAIXA ALTA.
Nunca revele a oferta nem cite preços: o objetivo é deixar o público curioso.
Exemplos de tom: "O silêncio está acabando", "Acesso restrito", "Amanhã, às 12h".`,
  2: `FASE 2 — VENDA EXPLOSIVA/VAREJO: foco total em conversão. A oferta é a estrela:
produto, preço e condições de pagamento em destaque, verbos de ação, energia de
liquidação. Use os números EXATOS do planejamento (preço, parcelas, percentuais).`,
  3: `FASE 3 — URGÊNCIA/ESCASSEZ (fase decisiva do método 72 Horas): gere medo de
perder a oportunidade. Comandos curtos e enfáticos ("É HOJE", "ÚLTIMO DIA"),
prazos e quantidades explícitos. Tudo gira em torno de tempo acabando e estoque
no fim. Use apenas prazos e números que estejam no planejamento.`,
};

function resposta(json, status = 200) {
  return new Response(JSON.stringify(json), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

function acessoValido(env, designer, pin) {
  const codigos = String(env.ACCESS_CODES || '')
    .split(',')
    .map((par) => par.trim())
    .filter(Boolean);
  return codigos.includes(designer + ':' + pin);
}

// schema do JSON que o Claude é obrigado a devolver (3 variações,
// um campo de texto por slot do modelo escolhido)
function schemaDasVariacoes(slots) {
  const propriedades = {};
  const obrigatorios = [];
  for (const slot of slots) {
    propriedades[slot.key] = {
      type: 'string',
      description: `${slot.rotulo}. Máximo ${slot.max} caracteres.` +
        (slot.multilinha ? ' Pode usar \\n para quebrar linha (no máximo 3 linhas).' : ' Sem quebras de linha.'),
    };
    obrigatorios.push(slot.key);
  }
  return {
    type: 'object',
    properties: {
      variacoes: {
        type: 'array',
        minItems: 3,
        maxItems: 3,
        description: '3 variações completas dos textos da arte',
        items: { type: 'object', properties: propriedades, required: obrigatorios },
      },
    },
    required: ['variacoes'],
  };
}

function montarPrompt(corpo) {
  const { modelo, plano, marca } = corpo;
  const listaSlots = modelo.slots
    .map((s) => `- ${s.key} (${s.rotulo}): máx ${s.max} caracteres.` +
      (s.exemplo ? ` Exemplo de tamanho/tom: "${s.exemplo}"` : ''))
    .join('\n');

  const sistema = `Você é o redator sênior do método 72 Horas, especialista em varejo
de móveis no Brasil. Você escreve textos curtos de altíssima conversão para artes de
Instagram de lojas de móveis de médio e baixo padrão.

${GUIA_FASES[modelo.fase] || GUIA_FASES[2]}

REGRAS INEGOCIÁVEIS:
1. Siga o planejamento À RISCA. Não invente preços, datas, percentuais, condições
   ou promessas que não estejam escritos no planejamento.
2. Respeite o limite de caracteres de cada campo. Textos mais curtos que o limite
   são melhores que textos no limite.
3. Português do Brasil, correto e natural. Campos indicados em CAIXA ALTA nos
   exemplos devem vir em CAIXA ALTA.
4. As 3 variações precisam ser realmente diferentes entre si: mude o ângulo
   (ex.: direto ao ponto / urgência / benefício), não apenas sinônimos.
5. Nada de emojis, hashtags, asteriscos ou aspas decorativas.
6. Escreva SOMENTE os campos pedidos, usando a ferramenta entregar_variacoes.`;

  const usuario = `MODELO DE LAYOUT ESCOLHIDO: "${modelo.nome}" (Fase ${modelo.fase})
Campos que você deve escrever:
${listaSlots}

MARCA: ${marca && marca.nome ? marca.nome : 'não informada'}

PLANEJAMENTO DO DESIGNER:
- Objetivo: ${plano.objetivo || 'vender'}
- Público: ${plano.publico || 'não informado'}
- Produto/oferta: ${plano.oferta || 'não informado'}
- Preço/condições: ${plano.preco || 'não informado'}
- Data/prazo: ${plano.prazo || 'não informado'}
- Planejamento completo/observações:
${plano.texto || '(sem observações)'}

Escreva as 3 variações agora.`;

  return { sistema, usuario };
}

async function gerar(pedido, env) {
  if (!env.ANTHROPIC_API_KEY) {
    return resposta({ erro: 'O worker está sem a chave da IA (ANTHROPIC_API_KEY).' }, 500);
  }

  let corpo;
  try {
    corpo = await pedido.json();
  } catch (_) {
    return resposta({ erro: 'Corpo do pedido inválido.' }, 400);
  }

  const { designer, pin, modelo, plano } = corpo || {};
  if (!designer || !pin || !modelo || !Array.isArray(modelo.slots) || !modelo.slots.length || !plano) {
    return resposta({ erro: 'Pedido incompleto.' }, 400);
  }
  if (!acessoValido(env, designer, pin)) {
    return resposta({ erro: 'Acesso não autorizado. Confira seu código com a coordenação.' }, 401);
  }

  // limites de sanidade: nenhum modelo real chega perto disso
  if (modelo.slots.length > 24) return resposta({ erro: 'Modelo com campos demais.' }, 400);
  modelo.slots = modelo.slots
    .filter((s) => s && typeof s.key === 'string' && /^[a-zA-Z][a-zA-Z0-9]*$/.test(s.key))
    .map((s) => ({ ...s, rotulo: String(s.rotulo || s.key).slice(0, 80), max: Math.min(Number(s.max) || 60, 200) }));
  if (!modelo.slots.length) return resposta({ erro: 'Modelo sem campos de texto válidos.' }, 400);
  for (const chave of ['objetivo', 'publico', 'oferta', 'preco', 'prazo']) {
    plano[chave] = String(plano[chave] || '').slice(0, 300);
  }
  plano.texto = String(plano.texto || '').slice(0, 6000);

  const { sistema, usuario } = montarPrompt(corpo);

  const chamada = {
    model: env.MODEL || MODELO_PADRAO,
    max_tokens: 2048,
    system: sistema,
    messages: [{ role: 'user', content: usuario }],
    tools: [{
      name: 'entregar_variacoes',
      description: 'Entrega as 3 variações de texto da arte, uma por objeto.',
      input_schema: schemaDasVariacoes(modelo.slots),
    }],
    tool_choice: { type: 'tool', name: 'entregar_variacoes' },
  };

  const respostaApi = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(chamada),
  });

  if (!respostaApi.ok) {
    const detalhe = await respostaApi.text().catch(() => '');
    console.log('Erro da API Anthropic:', respostaApi.status, detalhe.slice(0, 500));
    const mensagem = respostaApi.status === 429
      ? 'A IA está com muitas solicitações agora. Tente de novo em instantes.'
      : 'A IA não conseguiu responder (HTTP ' + respostaApi.status + ').';
    return resposta({ erro: mensagem }, 502);
  }

  const dados = await respostaApi.json();
  const uso = dados.usage || {};
  const blocoFerramenta = (dados.content || []).find((b) => b.type === 'tool_use');
  const variacoes = blocoFerramenta && blocoFerramenta.input && blocoFerramenta.input.variacoes;

  if (!Array.isArray(variacoes) || !variacoes.length) {
    return resposta({ erro: 'A IA respondeu em um formato inesperado. Tente de novo.' }, 502);
  }

  return resposta({ variacoes, uso: { entrada: uso.input_tokens, saida: uso.output_tokens } });
}

export default {
  async fetch(pedido, env) {
    const url = new URL(pedido.url);
    if (url.pathname === '/api/gerar') {
      if (pedido.method !== 'POST') return resposta({ erro: 'Use POST.' }, 405);
      try {
        return await gerar(pedido, env);
      } catch (erro) {
        console.log('Erro no /api/gerar:', erro && erro.message);
        return resposta({ erro: 'Erro interno ao gerar os textos.' }, 500);
      }
    }
    return env.ASSETS.fetch(pedido);
  },
};
