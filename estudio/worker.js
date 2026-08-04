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
 *   MODELOS            (opcional: KV namespace para os modelos criados
 *                       pela equipe valerem para todos os aparelhos;
 *                       sem ele, cada navegador guarda os seus)
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
  0: `MODELO PRÓPRIO DA AGÊNCIA: siga o tom pedido no planejamento. Textos curtos
de varejo, diretos e de alta conversão, coerentes com os exemplos de cada campo.`,
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

/* ---------- modelos personalizados (Cloudflare KV) ---------- */

function validarModeloPersonalizado(modelo) {
  if (!modelo || typeof modelo !== 'object') return 'Modelo inválido.';
  if (typeof modelo.id !== 'string' || !/^meu-[a-z0-9-]{3,60}$/.test(modelo.id)) return 'Identificador inválido.';
  if (typeof modelo.nome !== 'string' || !modelo.nome.trim()) return 'Dê um nome ao modelo.';
  if (typeof modelo.html !== 'string' || !modelo.html.trim()) return 'O modelo está sem HTML.';
  if (modelo.html.length > 300000) return 'HTML grande demais (máx. 300 KB).';
  if (!Array.isArray(modelo.slots) || modelo.slots.length > 24) return 'Campos do modelo inválidos.';
  for (const s of modelo.slots) {
    if (!s || typeof s.key !== 'string' || !/^[a-zA-Z][a-zA-Z0-9]*$/.test(s.key)) return 'Campo com nome inválido.';
  }
  return null;
}

async function modelosSalvos(env) {
  const bruto = await env.MODELOS.get('modelos');
  try { return bruto ? JSON.parse(bruto) : []; } catch (_) { return []; }
}

async function tratarModelos(pedido, env) {
  if (pedido.method === 'GET') {
    if (!env.MODELOS) return resposta({ modelos: [], semKV: true });
    return resposta({ modelos: await modelosSalvos(env) });
  }
  if (pedido.method !== 'POST' && pedido.method !== 'DELETE') {
    return resposta({ erro: 'Método não suportado.' }, 405);
  }
  let corpo;
  try { corpo = await pedido.json(); } catch (_) { return resposta({ erro: 'Corpo inválido.' }, 400); }
  if (!acessoValido(env, corpo.designer, corpo.pin)) {
    return resposta({ erro: 'Acesso não autorizado.' }, 401);
  }
  if (!env.MODELOS) {
    return resposta({ erro: 'O armazenamento central de modelos (KV) não está configurado — veja o README.', semKV: true }, 501);
  }

  const lista = await modelosSalvos(env);
  if (pedido.method === 'DELETE') {
    const restantes = lista.filter((m) => m.id !== corpo.id);
    await env.MODELOS.put('modelos', JSON.stringify(restantes));
    return resposta({ ok: true, modelos: restantes });
  }

  const problema = validarModeloPersonalizado(corpo.modelo);
  if (problema) return resposta({ erro: problema }, 400);
  const modelo = {
    id: corpo.modelo.id,
    fase: [0, 1, 2, 3].includes(corpo.modelo.fase) ? corpo.modelo.fase : 0,
    nome: String(corpo.modelo.nome).slice(0, 60),
    resumo: String(corpo.modelo.resumo || '').slice(0, 160),
    html: corpo.modelo.html,
    slots: corpo.modelo.slots.map((s) => ({
      key: s.key,
      rotulo: String(s.rotulo || s.key).slice(0, 80),
      max: Math.min(Math.max(Number(s.max) || 60, 2), 300),
      tipo: s.tipo === 'imagem' ? 'imagem' : 'texto',
      multilinha: !!s.multilinha,
      opcional: !!s.opcional,
      exemplo: String(s.exemplo || '').slice(0, 400),
    })),
    atualizadoEm: Date.now(),
    atualizadoPor: String(corpo.designer).slice(0, 40),
  };
  const semEle = lista.filter((m) => m.id !== modelo.id);
  if (semEle.length >= 60) return resposta({ erro: 'Limite de 60 modelos atingido — exclua algum antes.' }, 400);
  semEle.unshift(modelo);
  await env.MODELOS.put('modelos', JSON.stringify(semEle));
  return resposta({ ok: true, modelos: semEle });
}

/* ---------- replicar um layout a partir de uma imagem ---------- */

async function replicar(pedido, env) {
  if (!env.ANTHROPIC_API_KEY) {
    return resposta({ erro: 'O worker está sem a chave da IA (ANTHROPIC_API_KEY).' }, 500);
  }
  let corpo;
  try { corpo = await pedido.json(); } catch (_) { return resposta({ erro: 'Corpo inválido.' }, 400); }
  if (!acessoValido(env, corpo.designer, corpo.pin)) {
    return resposta({ erro: 'Acesso não autorizado.' }, 401);
  }
  const m = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(corpo.imagem || '');
  if (!m) return resposta({ erro: 'Envie a imagem do modelo (PNG, JPG ou WebP).' }, 400);
  if (m[2].length > 7000000) return resposta({ erro: 'Imagem grande demais (máx. ~5 MB).' }, 400);

  const sistema = `Você é um especialista em recriar layouts de artes de Instagram como
HTML/CSS pixel a pixel. Você recebe a imagem de uma arte de referência e a recria
como um modelo REUTILIZÁVEL de 1080×1350 pixels.

REGRAS OBRIGATÓRIAS:
1. Um único bloco HTML, começando por <div class="a72" style="..."> (o app já
   define .a72 como position:relative, 1080×1350, overflow:hidden). Todo o
   estilo restante deve ser inline (style="...").
2. Reproduza fielmente: cores exatas, gradientes, posições, proporções, pesos
   de fonte, caixa alta, sombras, selos, faixas e formas da referência.
3. Fontes disponíveis: 'Montserrat' (pesos 100-900, normal e itálico) e
   'Poppins' (600, 800, 900, 900 itálico). Escolha a mais parecida.
4. PROIBIDO: URLs externas, <script>, <link>, <iframe>, imagens http(s).
5. Cada texto editável da arte vira um marcador {{chaveCamelCase}} no lugar do
   texto (ex.: {{titulo}}, {{preco}}, {{cta}}). Use o texto real da referência
   como "exemplo" do campo.
6. Fotos/imagens da referência viram <img src="{{imgFoto}}" style="..."/> com
   object-fit adequado (chaves de imagem começam com "img"). Formas, ícones e
   fundos desenháveis devem ser recriados em CSS/SVG inline, não como imagem.
7. Onde houver logotipo ou contato da loja, use os marcadores da marca:
   {{marcaNome}}, {{marcaLogo}} (dataURL de imagem), {{marcaWhatsapp}},
   {{marcaEndereco}}, e as cores {{marcaCor1}}/{{marcaCor2}} quando a arte usar
   as cores da marca.
8. Entregue também a lista de campos (slots) com rótulo em português, limite de
   caracteres realista (comprimento do texto da referência + ~40%), tipo
   (texto/imagem), multilinha e o texto de exemplo vindo da referência.`;

  const conteudo = [
    { type: 'image', source: { type: 'base64', media_type: 'image/' + m[1], data: m[2] } },
    {
      type: 'text',
      text: 'Recrie esta arte como modelo reutilizável seguindo as regras.' +
        (corpo.observacoes ? '\nObservações da equipe: ' + String(corpo.observacoes).slice(0, 500) : ''),
    },
  ];

  const chamada = {
    model: env.MODEL || MODELO_PADRAO,
    max_tokens: 8192,
    system: sistema,
    messages: [{ role: 'user', content: conteudo }],
    tools: [{
      name: 'entregar_modelo',
      description: 'Entrega o modelo HTML recriado e seus campos editáveis.',
      input_schema: {
        type: 'object',
        properties: {
          html: { type: 'string', description: 'O bloco <div class="a72">…</div> completo' },
          slots: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                key: { type: 'string' },
                rotulo: { type: 'string' },
                max: { type: 'number' },
                tipo: { type: 'string', enum: ['texto', 'imagem'] },
                multilinha: { type: 'boolean' },
                exemplo: { type: 'string' },
              },
              required: ['key', 'rotulo', 'max', 'tipo'],
            },
          },
        },
        required: ['html', 'slots'],
      },
    }],
    tool_choice: { type: 'tool', name: 'entregar_modelo' },
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
    console.log('Erro da API (replicar):', respostaApi.status, detalhe.slice(0, 500));
    return resposta({ erro: 'A IA não conseguiu replicar agora (HTTP ' + respostaApi.status + '). Tente de novo.' }, 502);
  }
  const dados = await respostaApi.json();
  const bloco = (dados.content || []).find((b) => b.type === 'tool_use');
  const saida = bloco && bloco.input;
  if (!saida || typeof saida.html !== 'string' || !Array.isArray(saida.slots)) {
    return resposta({ erro: 'A IA respondeu em um formato inesperado. Tente de novo.' }, 502);
  }
  // remove qualquer coisa executável ou externa que tenha escapado
  const html = saida.html
    .replace(/<\s*(script|link|iframe|object|embed)[^>]*>[\s\S]*?<\/\s*\1\s*>/gi, '')
    .replace(/<\s*(script|link|iframe|object|embed)[^>]*\/?\s*>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*')/gi, '')
    .replace(/url\(\s*['"]?https?:[^)]*\)/gi, 'none');
  return resposta({ html, slots: saida.slots.slice(0, 24) });
}

export default {
  async fetch(pedido, env) {
    const url = new URL(pedido.url);
    const rotas = {
      '/api/gerar': () => (pedido.method === 'POST' ? gerar(pedido, env) : resposta({ erro: 'Use POST.' }, 405)),
      '/api/modelos': () => tratarModelos(pedido, env),
      '/api/replicar': () => (pedido.method === 'POST' ? replicar(pedido, env) : resposta({ erro: 'Use POST.' }, 405)),
    };
    const rota = rotas[url.pathname];
    if (rota) {
      try {
        return await rota();
      } catch (erro) {
        console.log('Erro em ' + url.pathname + ':', erro && erro.message);
        return resposta({ erro: 'Erro interno.' }, 500);
      }
    }
    return env.ASSETS.fetch(pedido);
  },
};
