// Só para gerar as capturas do protótipo (carregado com ?captura). Desenha o quadro atual, soma a legenda (que na
// página é HTML) e envia o PNG/JPG para um receptor local em http://localhost:5199.
export function instalaCaptura({ renderer, vaiPara, quadro, legenda }) {
  window.__captura = async (nome, { onde = 'rascunho', p = null, comLegenda = true, quadros = 3 } = {}) => {
    if (p !== null) vaiPara(p);
    for (let i = 0; i < quadros; i++) quadro();
    const gl = renderer.domElement;
    const c = document.createElement('canvas'); c.width = gl.width; c.height = gl.height;
    const x = c.getContext('2d');
    x.drawImage(gl, 0, 0);
    if (comLegenda) {
      const k = gl.width / gl.clientWidth;
      const g = x.createLinearGradient(0, 0, 0, c.height * 0.34);
      g.addColorStop(0, 'rgba(3,8,14,.62)'); g.addColorStop(1, 'rgba(3,8,14,0)');
      x.fillStyle = g; x.fillRect(0, 0, c.width, c.height * 0.34);
      const cs = getComputedStyle(legenda), caixa = legenda.getBoundingClientRect(), base = gl.getBoundingClientRect();
      const tam = parseFloat(cs.fontSize) * k;
      x.font = `800 ${tam}px ${cs.fontFamily}`; x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'top';
      x.letterSpacing = `${-0.025 * tam}px`;
      x.shadowColor = 'rgba(2,8,14,.75)'; x.shadowBlur = 24 * k; x.shadowOffsetY = 2 * k;
      // quebra de linha igual à da página: mede as palavras na largura da caixa
      const palavras = legenda.textContent.trim().split(/\s+/), larg = caixa.width * k, linhas = [];
      let atual = '';
      for (const w of palavras) { const t = atual ? atual + ' ' + w : w; if (x.measureText(t).width > larg && atual) { linhas.push(atual); atual = w; } else atual = t; }
      linhas.push(atual);
      if (linhas.length === 2) {            // text-wrap: balance
        let melhor = linhas, dif = Infinity;
        for (let i = 1; i < palavras.length; i++) { const a = palavras.slice(0, i).join(' '), b = palavras.slice(i).join(' '); const d = Math.abs(x.measureText(a).width - x.measureText(b).width); if (d < dif && x.measureText(a).width <= larg && x.measureText(b).width <= larg) { dif = d; melhor = [a, b]; } }
        linhas.splice(0, 2, ...melhor);
      }
      const alt = parseFloat(cs.lineHeight) * k;
      linhas.forEach((l, i) => x.fillText(l, (caixa.left - base.left + caixa.width / 2) * k, (caixa.top - base.top) * k + i * alt + (alt - tam) / 2));
    }
    const tipo = nome.endsWith('.jpg') ? 'image/jpeg' : 'image/png';
    const blob = await new Promise((ok) => c.toBlob(ok, tipo, 0.93));
    const r = await fetch(`http://localhost:5199/?nome=${encodeURIComponent(nome)}&onde=${onde}`, { method: 'POST', body: blob });
    return `${nome} ${c.width}x${c.height} ${r.status}`;
  };
}
