// O vídeo do plano aberto como sequência de quadros WebP em um arquivo só (ver o formato em dados.js / empacotamento):
// "QDRS", n, largura, altura (uint32), n+1 deslocamentos (uint32), dados.
// O arquivo é lido aos poucos: cada quadro fica disponível assim que os bytes dele chegam. Os quadros são decodificados
// sob demanda, em volta da posição atual, e viram texturas; só um punhado delas fica na placa de vídeo por vez.
// A cena pede a posição (fracionária) e recebe os dois quadros vizinhos e a mistura entre eles: a rolagem fica lisa
// mesmo entre um quadro e outro, para frente e para trás.

export function carregaQuadros(gl, url, { maxTexturas = 16, aoReceber = () => {}, aoDecodificar = () => {} } = {}) {
  const aborta = new AbortController();
  const blobs = [];                    // quadro comprimido, por índice (só os que já chegaram)
  const texturas = new Map();          // índice → { t, uso }
  const decodificando = new Set();
  let n = 0, largura = 0, altura = 0, relogio = 0, ativo = true, erro = null;
  let avisaPrimeiro, falhaPrimeiro;
  const primeiro = new Promise((ok, falha) => { avisaPrimeiro = ok; falhaPrimeiro = falha; });

  const tudo = (async () => {
    const resposta = await fetch(url, { signal: aborta.signal });
    if (!resposta.ok) throw new Error(`quadros ${url}: ${resposta.status}`);
    const total = Number(resposta.headers.get('content-length')) || 0;
    const leitor = resposta.body.getReader();
    let dados = new Uint8Array(total || 1 << 22), tam = 0, deslocs = null, inicio = 0;
    for (;;) {
      const { done, value } = await leitor.read();
      if (done) break;
      if (tam + value.length > dados.length) { const maior = new Uint8Array(Math.max(dados.length * 2, tam + value.length)); maior.set(dados.subarray(0, tam)); dados = maior; }
      dados.set(value, tam); tam += value.length;
      const vista = new DataView(dados.buffer);
      if (!n && tam >= 16) {
        if (String.fromCharCode(...dados.subarray(0, 4)) !== 'QDRS') throw new Error('arquivo de quadros inválido');
        n = vista.getUint32(4, true); largura = vista.getUint32(8, true); altura = vista.getUint32(12, true);
      }
      if (n && !deslocs && tam >= 16 + 4 * (n + 1)) { deslocs = Array.from({ length: n + 1 }, (_, i) => vista.getUint32(16 + 4 * i, true)); inicio = 16 + 4 * (n + 1); }
      if (deslocs) {
        while (blobs.length < n && inicio + deslocs[blobs.length + 1] <= tam) {
          const i = blobs.length;
          blobs.push(new Blob([dados.slice(inicio + deslocs[i], inicio + deslocs[i + 1])], { type: 'image/webp' }));
          if (i === 0) pede(0).then(avisaPrimeiro, falhaPrimeiro);
        }
      }
      aoReceber(total ? tam / total : 0);
    }
    aoReceber(1);
  })().catch((e) => { if (e.name !== 'AbortError') { erro = e; falhaPrimeiro(e); } });

  // decodifica um quadro e o sobe como textura (com mipmaps: o desfoque das passagens usa)
  function pede(i) {
    if (!ativo || !blobs[i] || texturas.has(i) || decodificando.has(i)) return Promise.resolve();
    decodificando.add(i);
    return createImageBitmap(blobs[i], { premultiplyAlpha: 'none', colorSpaceConversion: 'none' }).then((img) => {
      decodificando.delete(i);
      if (!ativo) { img.close?.(); return; }
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      img.close?.();
      texturas.set(i, { t, uso: ++relogio });
      aoDecodificar();
    }, () => { decodificando.delete(i); });
  }

  // libera as texturas mais antigas, nunca as que estão em volta da posição atual
  function enxuga(centro) {
    if (texturas.size <= maxTexturas) return;
    const velhas = [...texturas.entries()].filter(([i]) => Math.abs(i - centro) > 3).sort((a, b) => a[1].uso - b[1].uso);
    while (texturas.size > maxTexturas && velhas.length) { const [i, { t }] = velhas.shift(); gl.deleteTexture(t); texturas.delete(i); }
  }

  /**
   * Para a posição `pos` (0 a n-1, fracionária) devolve { a, b, mistura }: duas texturas e quanto de `b` entra.
   * Se os quadros exatos ainda não estão prontos, devolve o mais próximo que estiver (a imagem nunca some).
   * `direcao` (+1 ou -1) diz para que lado a rolagem vai, para adiantar a decodificação.
   */
  function em(pos, direcao = 1) {
    if (!n) return null;
    pos = Math.min(n - 1, Math.max(0, pos));
    const i0 = Math.floor(pos), i1 = Math.min(n - 1, i0 + 1);
    // pede os vizinhos imediatos e mais alguns à frente (no máximo 3 decodificações ao mesmo tempo)
    for (const i of [i0, i1, i0 + 2 * direcao, i0 + 3 * direcao, i0 - direcao, i0 + 4 * direcao, i0 + 5 * direcao]) {
      if (decodificando.size >= 3) break;
      if (i >= 0 && i < n) pede(i);
    }
    const A = texturas.get(i0), B = texturas.get(i1);
    if (A && B) { A.uso = B.uso = ++relogio; enxuga(i0); return { a: A.t, b: B.t, mistura: pos - i0, exato: true }; }
    let perto = null, dist = Infinity;
    for (const [i, tex] of texturas) { const d = Math.abs(i - pos); if (d < dist) { dist = d; perto = tex; } }
    if (!perto) return null;
    perto.uso = ++relogio;
    return { a: perto.t, b: perto.t, mistura: 0, exato: false };
  }

  function libera() {
    ativo = false; aborta.abort();
    for (const { t } of texturas.values()) gl.deleteTexture(t);
    texturas.clear(); blobs.length = 0;
  }

  return { primeiro, tudo, em, libera, get n() { return n; }, get largura() { return largura; }, get altura() { return altura; }, get recebidos() { return blobs.length; }, get erro() { return erro; } };
}
