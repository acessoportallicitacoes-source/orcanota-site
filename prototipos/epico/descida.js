// Protótipo da descida: trecho preso (herói, CRIE, dobra do avião), saída da bancada em 3D pelo mapa de
// profundidade e o voo do avião em curva, com rastro, até a conversa. Tudo comandado pela rolagem.

const url = (p) => new URL(p, import.meta.url).href;
const TELAS = ['01-inicio-vazia', '02-novo-orcamento', '09-folha-enviar', '10-detalhe-orcamento']
  .map((n) => url(`../../src/assets/telas/${n}.webp`));

// Fases do trecho preso, em fração da rolagem do trilho
const F = { heroi: 0.06, v1: 0.46, espera: 0.52, v2: 0.845, saida: 1 };
const DUR_V1 = 5.96, DUR_V2 = 5.35;
// Tela do celular no quadro 9:16 (x, y, largura, altura)
const RET = [0.3516, 0.3248, 0.2988, 0.3725];
const FUNDO = [5 / 255, 15 / 255, 18 / 255];

const $ = (id) => document.getElementById(id);
const trilho = $('trilho'), cena = $('cena'), palavra = $('palavra'), legenda = $('legenda');
const aviao = $('aviao'), rastro = $('rastro'), ctx = rastro.getContext('2d');
const limita = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const suave = (a, b, v) => { const t = limita((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const mistura = (a, b, t) => a + (b - a) * t;

// ---------- WebGL ----------
const gl = cena.getContext('webgl', { antialias: false, alpha: false, premultipliedAlpha: false });
const VERT = `attribute vec2 p; varying vec2 vUv; void main(){ vUv = vec2(p.x*.5+.5, .5-p.y*.5); gl_Position = vec4(p,0.,1.); }`;
const FRAG = `precision highp float;
varying vec2 vUv;
uniform sampler2D uFoto, uProf, uTelaA, uTelaB;
uniform vec4 uRet; uniform vec2 uPar; uniform vec3 uFundo;
uniform float uMix, uSaida;
float prof(vec2 uv){ return texture2D(uProf, vec2(uv.x, .0038 + uv.y*.9924)).r; }
void main(){
  vec2 uv = vUv;
  // Herói: paralaxe pelo mapa de profundidade (o que está perto anda mais que o fundo). Some na saída.
  float d = prof(uv); vec2 des = vec2(0.);
  for(int i=0;i<3;i++){ des = uPar*(d-.45); d = prof(clamp(uv+des, 0., 1.)); }
  // Saída: a página sobe na velocidade da rolagem (T) e a câmera desce até o nível do tampo (a).
  // O fundo só sobe; o tampo se comprime em direção ao horizonte, como chão visto cada vez mais de lado;
  // o celular, que está de pé, acompanha o ponto onde se apoia e mantém a altura.
  const float vH = .5756, vB = .7066;
  float T = uSaida*.84, a = .64*smoothstep(0.,1.,uSaida);
  float D = -a*(vB - vH) - T;
  vec2 pf = vec2(uv.x, uv.y - D) + des;
  vec2 cf = (pf - vec2(.5012,.5135))*vec2(.5625,1.);
  float sf = length(max(abs(cf) - vec2(.0884,.1940) + .014, 0.)) - .014;
  float fone = (1. - smoothstep(-.0015,.0015,sf)) * step(.0005, uSaida);
  vec2 chao = uv.y < vH - T ? vec2(uv.x, uv.y + T) : vec2(uv.x, (uv.y + T - a*vH)/(1. - a));
  vec2 q = mix(chao + des, pf, fone);
  vec3 cor = uFundo;
  if(q.x>0. && q.x<1. && q.y>0. && q.y<1.){
    cor = texture2D(uFoto, q).rgb;
    vec2 t = (q - uRet.xy)/uRet.zw;                // a tela real do app, só onde a filmagem mostra a tela acesa
    if(t.x>0. && t.x<1. && t.y>0. && t.y<1.){
      float lum = dot(cor, vec3(.299,.587,.114));
      float chave = smoothstep(.74,.82,lum) * smoothstep(.02,.055,cor.b-cor.r);
      vec2 a = abs(t-.5)*vec2(.451,1.); float r = .040;
      float sd = length(max(a - vec2(.2255,.5) + r, 0.)) - r;
      float canto = 1. - smoothstep(-.003,.003,sd);
      vec3 tela = mix(texture2D(uTelaA,t).rgb, texture2D(uTelaB,t).rgb, uMix);
      tela *= cor / vec3(.86,.895,.925);            // herda a luz da filmagem
      float furo = 1. - smoothstep(.0105,.0135, length((t-vec2(.5,.0185))*vec2(.451,1.)));
      tela = mix(tela, vec3(.02), furo);
      cor = mix(cor, tela, chave*canto);
    }
    cor = mix(uFundo, cor, smoothstep(0.,.06,q.y) * (1. - smoothstep(.93,1.,q.y)*.6));
    cor *= 1. - .35*a*(1. - fone)*step(vH - T, uv.y);   // o tampo escurece ao ficar rasante
  }
  gl_FragColor = vec4(cor,1.);
}`;
function compila(tipo, fonte) {
  const s = gl.createShader(tipo); gl.shaderSource(s, fonte); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}
const prog = gl.createProgram();
gl.attachShader(prog, compila(gl.VERTEX_SHADER, VERT)); gl.attachShader(prog, compila(gl.FRAGMENT_SHADER, FRAG));
gl.linkProgram(prog); gl.useProgram(prog);
gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
const U = Object.fromEntries(['uFoto', 'uProf', 'uTelaA', 'uTelaB', 'uRet', 'uPar', 'uFundo', 'uMix', 'uSaida']
  .map((n) => [n, gl.getUniformLocation(prog, n)]));

function textura(unidade) {
  const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unidade); gl.bindTexture(gl.TEXTURE_2D, t);
  for (const [k, v] of [[gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE], [gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([5, 15, 18, 255]));
  return t;
}
function envia(unidade, fonte) {
  gl.activeTexture(gl.TEXTURE0 + unidade);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, fonte);
}
// unidades: 0 foto/quadro do vídeo, 1 profundidade, 2 e 3 telas (A e B)
for (let i = 0; i < 4; i++) textura(i);
gl.uniform1i(U.uFoto, 0); gl.uniform1i(U.uProf, 1); gl.uniform1i(U.uTelaA, 2); gl.uniform1i(U.uTelaB, 3);
gl.uniform4fv(U.uRet, RET); gl.uniform3fv(U.uFundo, FUNDO);

const imagem = (src) => new Promise((ok, erro) => { const i = new Image(); i.onload = () => ok(i); i.onerror = erro; i.src = src; });
const fotoA = await imagem(url('./imagens/a-bancada-1080.jpg'));
envia(1, await imagem(url('./imagens/a-profundidade.jpg')));
const telas = await Promise.all(TELAS.map(imagem));

function video(src) {
  const v = document.createElement('video');
  Object.assign(v, { src: url(src), muted: true, playsInline: true, preload: 'auto' });
  v.suja = false;
  for (const ev of ['seeked', 'loadeddata']) v.addEventListener(ev, () => { v.suja = true; });
  v.load();
  return v;
}
const v1 = video('./videos/v1-folha-nasce.mp4'), v2 = video('./videos/v2-aviao.mp4');

// ---------- Estado ----------
let q = 0, yLiso = scrollY, fonteAtual = null, telaA = -1, telaB = -1;
const ponteiro = { x: 0, y: 0, lx: 0, ly: 0, usou: 0 };
addEventListener('pointermove', (e) => { ponteiro.x = e.clientX / innerWidth * 2 - 1; ponteiro.y = e.clientY / innerHeight * 2 - 1; ponteiro.usou = performance.now(); });
addEventListener('deviceorientation', (e) => {
  if (e.gamma == null) return;
  ponteiro.x = limita(e.gamma / 25, -1, 1); ponteiro.y = limita((e.beta - 55) / 25, -1, 1); ponteiro.usou = performance.now();
});

function ajusta() {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const w = Math.round(cena.clientWidth * dpr), h = Math.round(cena.clientHeight * dpr);
  if (cena.width !== w || cena.height !== h) { cena.width = w; cena.height = h; gl.viewport(0, 0, w, h); }
  rastro.width = Math.round(innerWidth * dpr); rastro.height = Math.round(innerHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
addEventListener('resize', ajusta); ajusta();

function buscaVideo(v, t) {
  if (v.readyState < 1) return;
  if (!v.seeking && Math.abs(v.currentTime - t) > 0.018) v.currentTime = t;
}

// Textos do trecho preso
const TEXTOS = [
  { de: -1, ate: 0.065, olho: 'Orçanota', titulo: 'O orçamento chega antes de você guardar a escada.', apoio: 'Role para ver.' },
  { de: 0.10, ate: 0.47, olho: 'Crie', titulo: 'Cliente, serviço e valor. O resto o Orçanota preenche.', apoio: 'Número, data e validade entram sozinhos.' },
  { de: 0.55, ate: 0.85, olho: 'Envie', titulo: 'A folha vira mensagem.', apoio: 'Em PDF ou em texto, pelo WhatsApp.' },
];
let textoAtual = -1;

// ---------- O voo ----------
const conversaBalao = $('balao-pdf');
function medidas() {
  const topoTrilho = trilho.offsetTop, alturaTrilho = trilho.offsetHeight - innerHeight;
  const r = $('chat').getBoundingClientRect();
  const alvo = { x: r.left + r.width * 0.62, y: r.top + scrollY + 150 };     // onde o balão do PDF aparece (na página)
  return { topoTrilho, alturaTrilho, f0: topoTrilho + F.v2 * alturaTrilho, f1: alvo.y - innerHeight * 0.52, alvo };
}
// posição do avião na página para um ponto f do voo
function ponto(f, m) {
  const vw = innerWidth, vh = innerHeight;
  const entra = 1 - Math.pow(1 - limita(f / 0.24), 3);
  const x = vw * (0.5 + 0.30 * Math.sin(f * Math.PI * 2 * 1.15 + 0.7) * (1 - 0.5 * f));
  const yTela = vh * (1.18 - 0.66 * entra + 0.05 * Math.sin(f * Math.PI * 2 * 0.8));
  const y = yTela + m.f0 + f * (m.f1 - m.f0);
  const g = suave(0.80, 1, f);
  return { x: mistura(x, m.alvo.x, g), y: mistura(y, m.alvo.y, g) };
}

function quadro(agora) {
  const m = medidas();
  yLiso += (scrollY - yLiso) * 0.16;
  if (Math.abs(scrollY - yLiso) < 0.2) yLiso = scrollY;
  q = limita((yLiso - m.topoTrilho) / m.alturaTrilho);

  // 1. De onde vem a imagem
  let fonte = fotoA;
  if (q >= F.heroi && q < F.espera) { fonte = v1; buscaVideo(v1, limita((q - F.heroi) / (F.v1 - F.heroi)) * DUR_V1); }
  else if (q >= F.espera && q < F.v2) { fonte = v2; buscaVideo(v2, limita((q - F.espera) / (F.v2 - F.espera)) * DUR_V2); }
  if (fonte === fotoA) { if (fonteAtual !== fotoA) { envia(0, fotoA); fonteAtual = fotoA; } }
  else if (fonte.readyState >= 2 && (fonte.suja || fonteAtual !== fonte)) { envia(0, fonte); fonte.suja = false; fonteAtual = fonte; }

  // 2. Qual tela do app aparece no celular
  const cortes = [0.07, F.v1 + 0.005, F.v2 + 0.01];
  let i = 0; while (i < cortes.length && q > cortes[i]) i++;
  const prox = Math.min(i + 1, telas.length - 1);
  const mix = i < cortes.length ? suave(cortes[i] - 0.012, cortes[i], q) : 0;
  if (telaA !== i) { envia(2, telas[i]); telaA = i; }
  if (telaB !== prox) { envia(3, telas[prox]); telaB = prox; }

  // 3. Paralaxe do ponteiro (forte no herói, leve no resto) e saída da bancada em 3D
  const parado = agora - ponteiro.usou > 2500;
  const alvoX = parado ? Math.sin(agora / 2300) * 0.5 : ponteiro.x, alvoY = parado ? Math.cos(agora / 3100) * 0.3 : ponteiro.y;
  ponteiro.lx += (alvoX - ponteiro.lx) * 0.06; ponteiro.ly += (alvoY - ponteiro.ly) * 0.06;
  const forca = mistura(0.026, 0.007, suave(0.03, 0.10, q)) * (1 - suave(F.v2, F.v2 + 0.05, q));
  const saida = limita((q - F.v2) / (F.saida - F.v2));   // linear: a cena sobe junto com a rolagem
  gl.uniform2f(U.uPar, -ponteiro.lx * forca, -ponteiro.ly * forca * 0.7);
  gl.uniform1f(U.uMix, mix); gl.uniform1f(U.uSaida, saida);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  // 4. Palavra gigante e textos
  const txt = q < 0.50 ? 'crie' : 'envie';
  if (palavra.textContent !== txt) palavra.textContent = txt;
  const aPalavra = suave(0.07, 0.13, q) * (1 - suave(0.46, 0.50, q) * (1 - suave(0.50, 0.54, q))) * (1 - saida);
  palavra.style.opacity = aPalavra.toFixed(3);
  palavra.style.transform = `translate3d(${(-ponteiro.lx * 10).toFixed(1)}px, ${((0.4 - q) * 8 - saida * 46).toFixed(2)}vh, 0)`;
  const k = TEXTOS.findIndex((t) => q >= t.de && q < t.ate);
  if (k !== textoAtual && k >= 0) {
    $('olho').textContent = TEXTOS[k].olho; $('titulo').textContent = TEXTOS[k].titulo; $('apoio').textContent = TEXTOS[k].apoio; textoAtual = k;
  }
  const t = TEXTOS[textoAtual];
  const aTexto = k < 0 || !t ? 0 : suave(t.de, t.de + 0.025, q) * (1 - suave(t.ate - 0.025, t.ate, q));
  legenda.style.opacity = (textoAtual === 0 && q < 0.04 ? 1 : aTexto).toFixed(3);
  legenda.style.transform = `translate3d(0, ${((1 - aTexto) * 14).toFixed(1)}px, 0)`;

  // 5. O avião em curva e o rastro
  const f = limita((yLiso - m.f0) / (m.f1 - m.f0));
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  const depois = limita((scrollY - m.f1) / innerHeight);
  if (f > 0 && depois < 1) {
    const p = ponto(f, m), p2 = ponto(Math.min(1, f + 0.004), m), p0 = ponto(Math.max(0, f - 0.004), m);
    const dx = p2.x - p0.x, dy = p2.y - p0.y;
    const rumo = Math.atan2(dy, dx) * 180 / Math.PI + 90;
    const inclina = limita(dx / innerWidth * 900, -58, 58);
    const escala = mistura(1.3, 0.55, suave(0, 0.8, f)) * (1 - 0.8 * suave(0.93, 1, f));
    aviao.style.opacity = (suave(0, 0.035, f) * (1 - suave(0.965, 1, f))).toFixed(3);
    aviao.style.transform = `translate3d(${p.x.toFixed(1)}px, ${(p.y - scrollY).toFixed(1)}px, 0) perspective(700px) rotate(${rumo.toFixed(1)}deg) rotateY(${inclina.toFixed(1)}deg) scale(${escala.toFixed(3)})`;

    // rastro: o trecho recente do caminho, preso à página
    const N = 64, cauda = 0.34, some = 1 - depois;
    ctx.lineCap = 'round'; ctx.globalCompositeOperation = 'lighter';
    let ant = null;
    for (let n = 0; n <= N; n++) {
      const ff = f - cauda + cauda * n / N;
      if (ff < 0) continue;
      const a = ponto(ff, m), pt = { x: a.x, y: a.y - scrollY };
      if (ant) {
        const forcaT = Math.pow(n / N, 2.2) * some;
        ctx.strokeStyle = `rgba(247,178,59,${(0.85 * forcaT).toFixed(3)})`;
        ctx.lineWidth = 0.6 + 4.4 * forcaT; ctx.shadowColor = 'rgba(247,160,40,.9)'; ctx.shadowBlur = 16 * forcaT;
        ctx.beginPath(); ctx.moveTo(ant.x, ant.y); ctx.lineTo(pt.x, pt.y); ctx.stroke();
      }
      ant = pt;
    }
    ctx.globalCompositeOperation = 'source-over'; ctx.shadowBlur = 0;
  } else aviao.style.opacity = 0;

  // 6. A conversa
  conversaBalao.classList.toggle('visivel', f >= 0.985);
  $('tiques').classList.toggle('lido', scrollY > m.f1 + innerHeight * 0.10);
  $('balao-resposta').classList.toggle('visivel', scrollY > m.f1 + innerHeight * 0.22);

}
function laco(agora) { quadro(agora); requestAnimationFrame(laco); }
requestAnimationFrame(laco);
// para conferência: avança a animação sem depender do relógio do navegador
window.__passo = (n = 1) => { for (let i = 0; i < n; i++) quadro(performance.now()); return { q: +q.toFixed(4), y: scrollY }; };

// ?y=1234 abre já rolado (para conferir um ponto específico)
const y0 = new URLSearchParams(location.search).get('y');
if (y0) { const alvo = Number(y0) * innerHeight; scrollTo(0, alvo); yLiso = alvo; }
