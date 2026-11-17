// Comparação de 3 modelos de vídeo: os clipes tocam em loop, sem som, e o sinal azul → âmbar é desenhado por código
// por cima de cada um, com o mesmo traço e o mesmo tempo. Como a câmera e os personagens se mexem de um jeito em cada
// modelo, a posição dos dois celulares foi medida em 5 instantes de cada clipe (x, y de 0 a 1 no quadro).
const TEMPOS = [0, 1.5, 3, 4.5, 6];
const CELULARES = {
  'veo-3.1-lite': { ele: [[0.520, 0.525], [0.520, 0.522], [0.523, 0.520], [0.517, 0.517], [0.515, 0.517]], ela: [[0.776, 0.501], [0.778, 0.501], [0.778, 0.501], [0.782, 0.493], [0.793, 0.482]] },
  'kling-v3.0-std': { ele: [[0.522, 0.525], [0.522, 0.517], [0.520, 0.512], [0.520, 0.509], [0.515, 0.501]], ela: [[0.774, 0.504], [0.783, 0.496], [0.792, 0.493], [0.806, 0.482], [0.819, 0.474]] },
  'veo-3.1-fast': { ele: [[0.521, 0.525], [0.519, 0.517], [0.496, 0.517], [0.469, 0.514], [0.449, 0.576]], ela: [[0.775, 0.504], [0.775, 0.501], [0.771, 0.500], [0.750, 0.496], [0.737, 0.490]] },
};
// o sinal sai em 0,8 s, chega em 3,6 s, fica aceso e some antes de o clipe recomeçar
const SAIDA = 0.8, CHEGADA = 3.6, APAGA = 5.2, FIM = 5.8;

const semMovimento = matchMedia('(prefers-reduced-motion: reduce)').matches;
const limita = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const suave = (t) => t * t * (3 - 2 * t);

function posicao(pontos, t) {
  const j = TEMPOS.findIndex((v) => v > t), i = j < 0 ? TEMPOS.length - 2 : Math.max(0, j - 1), k = limita((t - TEMPOS[i]) / (TEMPOS[i + 1] - TEMPOS[i]));
  return [pontos[i][0] + (pontos[i + 1][0] - pontos[i][0]) * k, pontos[i][1] + (pontos[i + 1][1] - pontos[i][1]) * k];
}

const cartoes = [...document.querySelectorAll('.cartao')].map((cartao) => {
  const video = cartao.querySelector('video'), canvas = cartao.querySelector('canvas'), ctx = canvas.getContext('2d');
  const pontos = CELULARES[cartao.dataset.modelo];
  let visivel = false;

  function desenha() {
    const dpr = Math.min(devicePixelRatio || 1, 2), L = Math.round(canvas.clientWidth * dpr), A = Math.round(canvas.clientHeight * dpr);
    if (canvas.width !== L || canvas.height !== A) { canvas.width = L; canvas.height = A; }
    ctx.clearRect(0, 0, L, A);
    const t = semMovimento && video.paused ? 4.2 : video.currentTime;
    if (t < SAIDA || t > FIM) return;
    const avanco = suave(limita((t - SAIDA) / (CHEGADA - SAIDA)));
    const forca = limita((t - SAIDA) / 0.25) * (1 - limita((t - APAGA) / (FIM - APAGA)));
    const [x0, y0] = posicao(pontos.ele, t), [x3, y3] = posicao(pontos.ela, t), dx = x3 - x0;
    const P = [[x0, y0], [x0 + dx * 0.21, y0 - 0.32], [x3 - dx * 0.24, y3 - 0.31], [x3, y3]].map(([x, y]) => [x * L, y * A]);
    const ponto = (u) => { const v = 1 - u; return [0, 1].map((i) => v * v * v * P[0][i] + 3 * v * v * u * P[1][i] + 3 * v * u * u * P[2][i] + u * u * u * P[3][i]); };
    const k = L / 960;

    const cor = ctx.createLinearGradient(P[0][0], 0, P[3][0], 0);
    cor.addColorStop(0, '#7EC0E6'); cor.addColorStop(0.5, '#2187DB'); cor.addColorStop(1, '#F5A30A');
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i <= 64; i++) { const [x, y] = ponto(avanco * i / 64); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
    // halo largo, traço médio e núcleo claro
    for (const [largura, alfa, borrao, tinta] of [[13, 0.20, 16, cor], [5.5, 0.55, 8, cor], [1.8, 0.9, 0, 'rgb(255 255 255 / .85)']]) {
      ctx.globalAlpha = alfa * forca; ctx.lineWidth = largura * k; ctx.strokeStyle = tinta;
      ctx.shadowColor = '#7EC0E6'; ctx.shadowBlur = borrao * k;
      ctx.stroke();
    }
    // a cabeça do sinal: um ponto de luz com um risco horizontal
    const [cx, cy] = ponto(avanco), mistura = avanco < 0.5 ? '126 192 230' : avanco < 0.8 ? '120 170 220' : '245 163 10';
    ctx.shadowBlur = 0; ctx.globalAlpha = forca;
    const brilho = ctx.createRadialGradient(cx, cy, 0, cx, cy, 26 * k);
    brilho.addColorStop(0, 'rgb(255 255 255 / .95)'); brilho.addColorStop(0.18, `rgb(${mistura} / .75)`); brilho.addColorStop(1, `rgb(${mistura} / 0)`);
    ctx.fillStyle = brilho; ctx.beginPath(); ctx.arc(cx, cy, 26 * k, 0, Math.PI * 2); ctx.fill();
    const risco = ctx.createLinearGradient(cx - 60 * k, 0, cx + 60 * k, 0);
    risco.addColorStop(0, `rgb(${mistura} / 0)`); risco.addColorStop(0.5, 'rgb(255 255 255 / .7)'); risco.addColorStop(1, `rgb(${mistura} / 0)`);
    ctx.fillStyle = risco; ctx.fillRect(cx - 60 * k, cy - 0.8 * k, 120 * k, 1.6 * k);
    ctx.restore();
  }

  function quadro() { desenha(); if (visivel && !video.paused) requestAnimationFrame(quadro); }
  video.addEventListener('play', () => requestAnimationFrame(quadro));
  video.addEventListener('seeked', desenha);
  video.addEventListener('loadeddata', desenha);
  // só toca o que está na tela; quem pede menos movimento vê o pôster com os controles do vídeo
  new IntersectionObserver(([e]) => {
    visivel = e.isIntersecting;
    if (semMovimento) return;
    if (visivel) video.play().catch(() => {}); else video.pause();
  }, { threshold: 0.2 }).observe(cartao);
  new ResizeObserver(desenha).observe(canvas);
  if (semMovimento) { video.controls = true; desenha(); }
  return { video, desenha };
});

document.getElementById('mostra-sinal').addEventListener('change', (e) => document.body.classList.toggle('sem-sinal', !e.target.checked));
document.getElementById('reinicia').addEventListener('click', () => {
  for (const { video } of cartoes) { video.currentTime = 0; video.play().catch(() => {}); }
});
