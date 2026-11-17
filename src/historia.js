// A história em seis cenas, guiada pela rolagem.
// Publica no .palco: data-cena (1 a 6), --p (avanço da seção inteira) e --sp (avanço dentro da cena atual).
// Tudo o que é visual fica no CSS e no .cenario: a animação premium pode trocar o .cenario lendo os mesmos valores.

const CENAS = 6;

export function iniciarHistoria({ aoChegarNaCena } = {}) {
  const secao = document.getElementById('historia');
  const palco = secao?.querySelector('.palco');
  if (!palco) return;

  const porCena = [...palco.querySelectorAll('[data-cenas]')].map((el) => ({
    el,
    cenas: el.dataset.cenas.split(/\s+/).map(Number),
  }));
  const fio = palco.querySelector('.fio-sinal');
  const ponto = palco.querySelector('.fio-ponto');
  const fioTamanho = fio?.getTotalLength() ?? 0;
  const semMovimento = matchMedia('(prefers-reduced-motion: reduce)');
  const vistas = new Set();
  let cenaAtual = 0;
  let pedido = 0;

  function atualizar() {
    pedido = 0;
    const percurso = secao.offsetHeight - innerHeight;
    const p = Math.min(1, Math.max(0, -secao.getBoundingClientRect().top / percurso));
    const cena = Math.min(CENAS, Math.floor(p * CENAS) + 1);
    const sp = semMovimento.matches ? 1 : Math.min(1, p * CENAS - (cena - 1));

    palco.style.setProperty('--p', p.toFixed(4));
    palco.style.setProperty('--sp', sp.toFixed(4));
    if (fio && ponto) {
      // O sinal corre na primeira metade da cena 4 e fica aceso até o fim dela.
      const avanco = cena === 4 ? Math.min(1, sp * 1.8) : cena > 4 ? 1 : 0;
      palco.style.setProperty('--sp', avanco.toFixed(4));
      const { x, y } = fio.getPointAtLength(avanco * fioTamanho);
      ponto.setAttribute('cx', x);
      ponto.setAttribute('cy', y);
    }

    if (cena !== cenaAtual) {
      cenaAtual = cena;
      palco.dataset.cena = String(cena);
      for (const { el, cenas } of porCena) el.classList.toggle('ativa', cenas.includes(cena));
      if (!vistas.has(cena)) {
        vistas.add(cena);
        aoChegarNaCena?.(cena);
      }
    }
  }

  const agendar = () => { pedido ||= requestAnimationFrame(atualizar); };
  addEventListener('scroll', agendar, { passive: true });
  addEventListener('resize', agendar);
  atualizar();
}
