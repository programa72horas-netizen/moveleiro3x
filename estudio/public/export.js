/*
 * Estúdio 72h · Exportação em PNG
 * ------------------------------------------------------------------
 * Converte o HTML da arte (1080×1350) em PNG no próprio navegador:
 * HTML → SVG <foreignObject> → <canvas> → arquivo .png.
 *
 * As fontes são embutidas em base64 dentro do SVG, para que o PNG
 * saia idêntico ao preview mesmo sem acesso à internet.
 */

'use strict';

const Exportador = (() => {
  const LARGURA = 1080;
  const ALTURA = 1350;

  const FONTES = [
    ["'Montserrat'", 'normal', '100 900', 'fonts/montserrat-var.woff2'],
    ["'Montserrat'", 'italic', '100 900', 'fonts/montserrat-italic-var.woff2'],
    ["'Poppins'", 'normal', '600', 'fonts/poppins-600.woff2'],
    ["'Poppins'", 'normal', '800', 'fonts/poppins-800.woff2'],
    ["'Poppins'", 'normal', '900', 'fonts/poppins-900.woff2'],
    ["'Poppins'", 'italic', '900', 'fonts/poppins-900-italic.woff2'],
  ];

  let cssFontesPromise = null;

  function paraBase64(blob) {
    return new Promise((resolver, rejeitar) => {
      const leitor = new FileReader();
      leitor.onload = () => resolver(String(leitor.result).split(',')[1]);
      leitor.onerror = () => rejeitar(new Error('Falha ao ler fonte'));
      leitor.readAsDataURL(blob);
    });
  }

  // baixa as fontes locais uma única vez e monta o CSS com data: URIs
  function cssFontesEmbutidas() {
    if (!cssFontesPromise) {
      cssFontesPromise = Promise.all(
        FONTES.map(async ([familia, estilo, peso, url]) => {
          const resposta = await fetch(url);
          if (!resposta.ok) throw new Error('Fonte não encontrada: ' + url);
          const b64 = await paraBase64(await resposta.blob());
          return `@font-face{font-family:${familia};font-style:${estilo};font-weight:${peso};` +
            `src:url(data:font/woff2;base64,${b64}) format('woff2');}`;
        }),
      ).then((regras) => regras.join('\n'));
      cssFontesPromise.catch(() => { cssFontesPromise = null; });
    }
    return cssFontesPromise;
  }

  // HTML da arte → data URL de SVG autocontido
  async function svgDaArte(htmlArte, cssArte) {
    const cssFontes = await cssFontesEmbutidas();
    const suporte = document.createElement('div');
    suporte.innerHTML = htmlArte.trim();
    const no = suporte.firstElementChild;
    if (!no) throw new Error('Arte vazia');
    // serializa o DOM já normalizado pelo navegador como XML válido
    const xml = new XMLSerializer().serializeToString(no);
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${LARGURA}" height="${ALTURA}">` +
      `<foreignObject width="100%" height="100%">` +
      `<div xmlns="http://www.w3.org/1999/xhtml" style="width:${LARGURA}px;height:${ALTURA}px">` +
      `<style>${cssFontes}\n${cssArte}</style>${xml}</div>` +
      `</foreignObject></svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  function carregarImagem(url) {
    return new Promise((resolver, rejeitar) => {
      const img = new Image();
      img.onload = () => resolver(img);
      img.onerror = () => rejeitar(new Error('Falha ao rasterizar a arte'));
      img.src = url;
    });
  }

  const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

  // impressão digital barata de uma faixa do canvas onde costuma haver texto
  function amostra(ctx, largura, altura) {
    const faixa = ctx.getImageData(0, Math.floor(altura * 0.35), largura, 12).data;
    let hash = 0;
    for (let i = 0; i < faixa.length; i += 89) hash = ((hash * 31) + faixa[i]) >>> 0;
    return hash;
  }

  /**
   * Gera o PNG da arte e devolve um Blob.
   * escala 1 → 1080×1350 (feed). escala 2 → 2160×2700 (alta resolução).
   */
  async function gerarPNG(htmlArte, cssArte, escala = 1) {
    if (document.fonts && document.fonts.ready) {
      try { await document.fonts.ready; } catch (_) { /* segue sem bloquear */ }
    }
    const url = await svgDaArte(htmlArte, cssArte);
    const img = await carregarImagem(url);
    if (img.decode) {
      try { await img.decode(); } catch (_) { /* alguns navegadores rejeitam para SVG */ }
    }

    const tela = document.createElement('canvas');
    tela.width = Math.round(LARGURA * escala);
    tela.height = Math.round(ALTURA * escala);
    const ctx = tela.getContext('2d', { willReadFrequently: true });

    // as fontes embutidas no SVG carregam de forma assíncrona no primeiro
    // paint em alguns navegadores; redesenha até duas rasterizações
    // consecutivas saírem idênticas (fonte assentada), com teto de tempo
    let anterior = -1;
    for (let tentativa = 0; tentativa < 8; tentativa++) {
      ctx.clearRect(0, 0, tela.width, tela.height);
      ctx.drawImage(img, 0, 0, tela.width, tela.height);
      const atual = amostra(ctx, tela.width, tela.height);
      if (atual === anterior) break;
      anterior = atual;
      await esperar(140);
    }

    return new Promise((resolver, rejeitar) => {
      tela.toBlob((blob) => {
        if (blob) resolver(blob);
        else rejeitar(new Error('Falha ao gerar o PNG'));
      }, 'image/png');
    });
  }

  async function baixarPNG(htmlArte, cssArte, nomeArquivo, escala = 1) {
    const blob = await gerarPNG(htmlArte, cssArte, escala);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = nomeArquivo.endsWith('.png') ? nomeArquivo : nomeArquivo + '.png';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  return { gerarPNG, baixarPNG, LARGURA, ALTURA };
})();
