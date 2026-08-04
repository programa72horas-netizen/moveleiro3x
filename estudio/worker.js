/*
 * Estúdio 72h · Worker (Cloudflare)
 * ------------------------------------------------------------------
 * Serve o app estático (pasta public/) e expõe POST /api/gerar, que
 * pede ao Claude os TEXTOS das artes. A IA nunca desenha: ela devolve
 * apenas os campos de cada modelo, em JSON validado por schema.
 *
 * Segredos/variáveis (veja o README):
 *   ANTHROPIC_API_KEY  (obrigatório, via `wrangler secret put`)
 *   ACCESS_CODES       (bootstrap da equipe: "Nome:pin,Nome 2:pin2" —
 *                       vale até a equipe ser salva pela tela de admin)
 *   ADMINS             (nomes com papel de administrador no bootstrap,
 *                       ex.: "Deborah")
 *   MODEL              (opcional; padrão claude-sonnet-5)
 *   MODELOS            (opcional: KV namespace usado para modelos da
 *                       equipe, acessos e produtividade; sem ele, cada
 *                       navegador guarda os próprios modelos e a tela
 *                       de equipe fica indisponível)
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

/* ---------- equipe e acesso ----------
 * A equipe mora no KV (gerida pela tela de administração). Sem KV — ou
 * enquanto ninguém salvou a equipe por lá — vale o ACCESS_CODES do env,
 * com os nomes listados em ADMINS como administradores. */

function equipeDoEnv(env) {
  const admins = String(env.ADMINS || '').split(',').map((n) => n.trim()).filter(Boolean);
  return String(env.ACCESS_CODES || '').split(',').map((par) => {
    const separador = par.lastIndexOf(':');
    if (separador < 1) return null;
    const nome = par.slice(0, separador).trim();
    const pin = par.slice(separador + 1).trim();
    return nome && pin ? { nome, pin, admin: admins.includes(nome) } : null;
  }).filter(Boolean);
}

async function equipeAtual(env) {
  if (env.MODELOS) {
    try {
      const bruto = await env.MODELOS.get('equipe');
      if (bruto) {
        const lista = JSON.parse(bruto);
        if (Array.isArray(lista) && lista.length) return lista;
      }
    } catch (_) { /* cai para o env */ }
  }
  return equipeDoEnv(env);
}

async function membroValido(env, nome, pin) {
  if (!nome || !pin) return null;
  const equipe = await equipeAtual(env);
  return equipe.find((m) => m.nome === nome && m.pin === pin) || null;
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

// o modelo às vezes entrega o array embrulhado como texto JSON —
// desembrulha o que vier até encontrar as variações de verdade
function normalizarVariacoes(entrada) {
  if (!entrada) return null;
  let valor = entrada.variacoes !== undefined ? entrada.variacoes : entrada;
  for (let nivel = 0; nivel < 2 && typeof valor === 'string'; nivel++) {
    try { valor = JSON.parse(valor); } catch (_) { return null; }
  }
  if (valor && !Array.isArray(valor) && Array.isArray(valor.variacoes)) valor = valor.variacoes;
  return Array.isArray(valor) ? valor.filter((v) => v && typeof v === 'object') : null;
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
  if (!(await membroValido(env, designer, pin))) {
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
  const variacoes = normalizarVariacoes(blocoFerramenta && blocoFerramenta.input);

  if (!Array.isArray(variacoes) || !variacoes.length) {
    console.log('Resposta sem variações:', JSON.stringify(dados).slice(0, 400));
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
  if (!(await membroValido(env, corpo.designer, corpo.pin))) {
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

/* ---------- login, equipe e produtividade ---------- */

async function entrar(pedido, env) {
  let corpo;
  try { corpo = await pedido.json(); } catch (_) { return resposta({ erro: 'Corpo inválido.' }, 400); }
  const membro = await membroValido(env, corpo.nome, corpo.pin);
  if (!membro) return resposta({ erro: 'Nome ou código incorretos.' }, 401);
  return resposta({ ok: true, nome: membro.nome, admin: !!membro.admin });
}

async function tratarEquipe(pedido, env) {
  if (pedido.method === 'GET') {
    // apenas os nomes, para montar a tela de login
    const equipe = await equipeAtual(env);
    return resposta({ nomes: equipe.map((m) => m.nome) });
  }
  if (pedido.method !== 'POST') return resposta({ erro: 'Método não suportado.' }, 405);
  let corpo;
  try { corpo = await pedido.json(); } catch (_) { return resposta({ erro: 'Corpo inválido.' }, 400); }
  const chamador = await membroValido(env, corpo.designer, corpo.pin);
  if (!chamador || !chamador.admin) {
    return resposta({ erro: 'Somente administradores gerenciam a equipe.' }, 403);
  }

  const equipe = await equipeAtual(env);
  if (corpo.acao === 'listar') return resposta({ equipe });

  if (!env.MODELOS) {
    return resposta({ erro: 'Para gerenciar a equipe pelo app, configure o KV (README).', semKV: true }, 501);
  }
  let nova = equipe;
  if (corpo.acao === 'salvar') {
    const membro = corpo.membro || {};
    const nome = String(membro.nome || '').trim().slice(0, 40);
    const pin = String(membro.pin || '').trim().slice(0, 12);
    if (!nome || !/^[0-9]{4,12}$/.test(pin)) {
      return resposta({ erro: 'Informe um nome e um código numérico de 4 a 12 dígitos.' }, 400);
    }
    nova = equipe.filter((m) => m.nome !== nome);
    if (nova.length >= 40) return resposta({ erro: 'Limite de 40 pessoas na equipe.' }, 400);
    nova.push({ nome, pin, admin: !!membro.admin });
  } else if (corpo.acao === 'excluir') {
    nova = equipe.filter((m) => m.nome !== corpo.nome);
    if (!nova.some((m) => m.admin)) {
      return resposta({ erro: 'A equipe precisa manter ao menos um administrador.' }, 400);
    }
  } else {
    return resposta({ erro: 'Ação desconhecida.' }, 400);
  }
  await env.MODELOS.put('equipe', JSON.stringify(nova));
  return resposta({ equipe: nova });
}

// contadores diários por designer: stats:<nome>:<AAAA-MM-DD>
async function registrarEvento(pedido, env) {
  let corpo;
  try { corpo = await pedido.json(); } catch (_) { return resposta({ erro: 'Corpo inválido.' }, 400); }
  const membro = await membroValido(env, corpo.designer, corpo.pin);
  if (!membro) return resposta({ erro: 'Acesso não autorizado.' }, 401);
  if (!env.MODELOS) return resposta({ ok: false, semKV: true });
  const tipo = ['geracao', 'exportacao', 'arte'].includes(corpo.tipo) ? corpo.tipo : null;
  if (!tipo) return resposta({ erro: 'Tipo de evento desconhecido.' }, 400);
  const quantidade = Math.max(1, Math.min(20, Number(corpo.quantidade) || 1));
  const dia = new Date().toISOString().slice(0, 10);
  const chave = `stats:${membro.nome}:${dia}`;
  let contadores = {};
  try { contadores = JSON.parse(await env.MODELOS.get(chave)) || {}; } catch (_) { contadores = {}; }
  contadores[tipo] = (contadores[tipo] || 0) + quantidade;
  // expira sozinho depois de ~90 dias para o KV não acumular para sempre
  await env.MODELOS.put(chave, JSON.stringify(contadores), { expirationTtl: 60 * 60 * 24 * 90 });
  return resposta({ ok: true });
}

async function estatisticas(pedido, env) {
  let corpo;
  try { corpo = await pedido.json(); } catch (_) { return resposta({ erro: 'Corpo inválido.' }, 400); }
  const chamador = await membroValido(env, corpo.designer, corpo.pin);
  if (!chamador || !chamador.admin) {
    return resposta({ erro: 'Somente administradores veem a produtividade.' }, 403);
  }
  if (!env.MODELOS) {
    return resposta({ erro: 'A produtividade precisa do KV configurado (README).', semKV: true }, 501);
  }
  const corte7 = Date.now() - 7 * 86400000;
  const corte30 = Date.now() - 30 * 86400000;
  const porDesigner = {};
  let cursor;
  do {
    const pagina = await env.MODELOS.list({ prefix: 'stats:', cursor });
    for (const chaveInfo of pagina.keys) {
      const partes = chaveInfo.name.split(':'); // stats:<nome>:<dia>
      if (partes.length < 3) continue;
      const dia = partes[partes.length - 1];
      const nome = partes.slice(1, -1).join(':');
      const quando = Date.parse(dia + 'T12:00:00Z');
      if (!(quando >= corte30)) continue;
      let contadores = {};
      try { contadores = JSON.parse(await env.MODELOS.get(chaveInfo.name)) || {}; } catch (_) { continue; }
      const alvo = porDesigner[nome] = porDesigner[nome] ||
        { nome, d7: { geracao: 0, exportacao: 0, arte: 0 }, d30: { geracao: 0, exportacao: 0, arte: 0 } };
      for (const tipo of ['geracao', 'exportacao', 'arte']) {
        const valor = contadores[tipo] || 0;
        alvo.d30[tipo] += valor;
        if (quando >= corte7) alvo.d7[tipo] += valor;
      }
    }
    cursor = pagina.list_complete ? null : pagina.cursor;
  } while (cursor);
  const equipe = await equipeAtual(env);
  // toda a equipe aparece, mesmo quem ainda não produziu nada
  for (const membro of equipe) {
    porDesigner[membro.nome] = porDesigner[membro.nome] ||
      { nome: membro.nome, d7: { geracao: 0, exportacao: 0, arte: 0 }, d30: { geracao: 0, exportacao: 0, arte: 0 } };
  }
  return resposta({ linhas: Object.values(porDesigner).sort((a, b) => b.d30.geracao - a.d30.geracao) });
}

/* ---------- replicar um layout a partir de imagens ---------- */

async function replicar(pedido, env) {
  if (!env.ANTHROPIC_API_KEY) {
    return resposta({ erro: 'O worker está sem a chave da IA (ANTHROPIC_API_KEY).' }, 500);
  }
  let corpo;
  try { corpo = await pedido.json(); } catch (_) { return resposta({ erro: 'Corpo inválido.' }, 400); }
  if (!(await membroValido(env, corpo.designer, corpo.pin))) {
    return resposta({ erro: 'Acesso não autorizado.' }, 401);
  }
  const brutas = Array.isArray(corpo.imagens) ? corpo.imagens : (corpo.imagem ? [corpo.imagem] : []);
  const imagens = [];
  for (const bruta of brutas.slice(0, 4)) {
    const m = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(bruta || '');
    if (!m) return resposta({ erro: 'Envie as imagens do modelo em PNG, JPG ou WebP.' }, 400);
    if (m[2].length > 7000000) return resposta({ erro: 'Uma das imagens é grande demais (máx. ~5 MB).' }, 400);
    imagens.push(m);
  }
  if (!imagens.length) return resposta({ erro: 'Envie ao menos uma imagem do modelo.' }, 400);

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
    ...imagens.map((m) => ({
      type: 'image', source: { type: 'base64', media_type: 'image/' + m[1], data: m[2] },
    })),
    {
      type: 'text',
      text: (imagens.length > 1
        ? 'Recrie a arte da PRIMEIRA imagem como modelo reutilizável; use as demais imagens ' +
          'como referência extra de detalhes, variações e elementos da mesma identidade.'
        : 'Recrie esta arte como modelo reutilizável seguindo as regras.') +
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
    const soPost = (tratador) => () =>
      (pedido.method === 'POST' ? tratador(pedido, env) : resposta({ erro: 'Use POST.' }, 405));
    const rotas = {
      '/api/gerar': soPost(gerar),
      '/api/modelos': () => tratarModelos(pedido, env),
      '/api/replicar': soPost(replicar),
      '/api/entrar': soPost(entrar),
      '/api/equipe': () => tratarEquipe(pedido, env),
      '/api/eventos': soPost(registrarEvento),
      '/api/estatisticas': soPost(estatisticas),
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
