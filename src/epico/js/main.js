// Cena 1 (herói): bancada em tela cheia, celular 3D que gira com o mouse, título dentro da cena (o celular
// passa na frente das letras), telas reais do app que respondem ao toque e o painel de vidro das funções.
import * as THREE from 'three';
import { EffectComposer, RenderPass, EffectPass, BloomEffect, VignetteEffect, NoiseEffect, BlendFunction } from 'postprocessing';
import { limita, mistura, suave, rad, saiExpo, passaEVolta, entraESai, trecho, Mola } from './util.js';
import { LARG, ALT, BARRA, desenhar, areaEm, preCarregar } from './telas.js';
import { CEL, criaCelular, criaAmbiente } from './celular.js';
import { criaCenario, FOTOS } from './cenario.js';
import { criaHistoria, TELAS_DA_HISTORIA } from './historia.js';

const $ = (s) => document.querySelector(s);
const consulta = new URLSearchParams(location.search);
const semMovimento = matchMedia('(prefers-reduced-motion: reduce)').matches;
const toque = matchMedia('(pointer: coarse)').matches;
const leve = consulta.has('leve') || (toque && Math.min(screen.width, screen.height) < 820) || (navigator.hardwareConcurrency ?? 8) <= 4;

const palco = $('#palco'), corpo = document.body, elTitulo = $('#titulo'), elPreso = $('#preso'), elHistoria = $('#historia'), elInterface = $('#interface');
const dados = { nome: 'Elétrica Rocha' };

// ---------- render ----------
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas: palco, antialias: leve, powerPreference: 'high-performance' }); }
catch { elTitulo.classList.add('sem-3d'); corpo.classList.add('pronto'); throw new Error('sem WebGL'); }
renderer.setPixelRatio(Math.min(devicePixelRatio, leve ? 1.5 : 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(0x03090c);

const cena = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(27, 1, 0.05, 20);
cena.environment = criaAmbiente(renderer);

// ---------- telas do app em duas texturas (a que está na tela e a que vai entrar) ----------
const fazTela = () => {
  const c = document.createElement('canvas'); c.width = LARG; c.height = ALT;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.anisotropy = 8;
  return { c, t };
};
let telaA = fazTela(), telaB = fazTela();

const cel = criaCelular(telaA.t, telaB.t);
const cenario = criaCenario(telaA.t, telaB.t);
cena.add(cenario.grupo, cel.grupo);
const uTela = cel.matTela.uniforms, uCen = cenario.uniforms;

// a lâmpada de trabalho também acende o metal do aparelho
const lampada = new THREE.DirectionalLight(0xffb469, 0);
lampada.position.copy(uCen.uDirLuz.value).multiplyScalar(2); cena.add(lampada);
const fria = new THREE.DirectionalLight(0x9cc6ff, 0); fria.position.set(2, 0.6, 1.2); cena.add(fria);

// ---------- título dentro da cena ----------
const tit = { c: document.createElement('canvas'), itens: [], fonte: 80, esc: 1, caixa: null, pronto: false, ultimoT: -1 };
tit.tex = new THREE.CanvasTexture(tit.c); tit.tex.colorSpace = THREE.SRGBColorSpace; tit.tex.anisotropy = 4;
tit.malha = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tit.tex, transparent: true, depthWrite: false, toneMapped: false }));
tit.malha.renderOrder = 1; cena.add(tit.malha);
const palavras = [...elTitulo.querySelectorAll('.p')];

// ---------- poeira no ar ----------
const poeira = (() => {
  const n = leve ? 110 : 240, pos = new Float32Array(n * 3), sem = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    pos.set([(Math.random() - 0.5) * 1.3, 0.02 + Math.random() * 0.42, -0.2 - Math.random() * 1.0], i * 3);
    sem.set([Math.random() * 6.283, 0.4 + Math.random() * 1.6], i * 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aSem', new THREE.BufferAttribute(sem, 2));
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTempo: { value: 0 }, uLuz: { value: 0 }, uEsc: { value: 1 }, uFoco: { value: 0.5 } },
    vertexShader: /* glsl */`
      attribute vec2 aSem; uniform float uTempo, uEsc, uFoco; varying float vB; varying float vFora;
      void main(){
        vec3 p = position; float t = uTempo * .11 * aSem.y;
        p.x += sin(t + aSem.x) * .05 + sin(t * .37 + aSem.x * 3.) * .02;
        p.y += sin(t * .8 + aSem.x * 2.) * .03 + uTempo * .0016 * aSem.y; p.y = mod(p.y, .46);
        p.z += cos(t * .6 + aSem.x) * .04;
        vec4 mv = modelViewMatrix * vec4(p, 1.);
        // mais forte perto do facho da lâmpada (alto, à esquerda) e à frente da tela
        float fx = (p.x + .04 + p.y * 1.05) * 3.4; float facho = exp(-fx * fx);
        vFora = clamp(abs(-mv.z - uFoco) * 5., 0., 1.);
        vB = (.25 + facho) * mix(1., .4, vFora);
        gl_PointSize = uEsc * aSem.y * mix(1.5, 3.6, vFora) / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform float uLuz; varying float vB; varying float vFora;
      void main(){
        float r = length(gl_PointCoord - .5) * 2.;
        float a = pow(clamp(1. - r, 0., 1.) * clamp(1. - r, 0., 1.) * (3. - 2. * clamp(1. - r, 0., 1.)), mix(1.6, 1.1, vFora)) * mix(1., .5, vFora);
        gl_FragColor = vec4(vec3(1., .78, .5) * a * vB * uLuz * .34, 1.);
        #include <colorspace_fragment>
      }`,
  });
  const p = new THREE.Points(g, m); p.frustumCulled = false; p.renderOrder = 3; cena.add(p);
  return m.uniforms;
})();

// ---------- pós-processamento: brilho das luzes, vinheta e grão de filme ----------
let composer = null, efeitos = null;
if (!leve) {
  composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType, multisampling: 4 });
  composer.addPass(new RenderPass(cena, camera));
  const brilho = new BloomEffect({ mipmapBlur: true, luminanceThreshold: 0.9, luminanceSmoothing: 0.16, intensity: 0.55, radius: 0.78, levels: 7 });
  const vinheta = new VignetteEffect({ offset: 0.26, darkness: 0.62 });
  const grao = new NoiseEffect({ blendFunction: BlendFunction.OVERLAY, premultiply: false });
  grao.blendMode.opacity.value = 0.12;
  composer.addPass(new EffectPass(camera, brilho, vinheta, grao));
  efeitos = { brilho, vinheta, grao };
}

// ---------- enquadramento ----------
const rep = { x: 0, y: 0.09, z: -0.5, d: 0.5, tanV: 0.24, a: 1.78, alt: 0.114, guinada: -0.2, alvo: new THREE.Vector3(), deitado: true, colX: 0 };
const camRep = new THREE.PerspectiveCamera();
const v3 = new THREE.Vector3(), v3b = new THREE.Vector3();
let L = 1, Hh = 1;

function arrumar() {
  if (!innerWidth || !innerHeight) return;        // janela ainda sem tamanho (aba escondida): espera o próximo ajuste
  L = innerWidth; Hh = elPreso.clientHeight || innerHeight;
  renderer.setSize(L, Hh, false); composer?.setSize(L, Hh);
  const a = L / Hh, deitado = a >= 1;
  const f = FOTOS[deitado ? 'paisagem' : 'retrato'];
  cenario.usar(deitado ? 'paisagem' : 'retrato');
  // abertura: a foto tem que cobrir a tela; em janelas muito largas o celular cresce um pouco
  const tanRefH = Math.tan(rad(f.abertura / 2)) * f.aspecto;
  const tanV = deitado ? Math.max(Math.min(0.24, (tanRefH * 0.97) / a), 0.205) : Math.min(0.24, (tanRefH * 0.97) / a);
  const fracao = deitado ? (Hh < 620 ? 0.62 : 0.68) : 0.53;      // altura do celular na tela
  const d = CEL.A / (2 * fracao * tanV);
  const yc = CEL.A / 2 + 0.011;                                    // flutua um centímetro acima do tampo
  const alvoY = deitado ? 0 : -0.04, alvoX = a >= 1.5 ? 0.17 : deitado ? 0.34 : 0;
  const inclina = Math.atan((f.altura - yc) / d) - Math.atan(-alvoY * tanV);
  Object.assign(rep, { x: alvoX * tanV * a * d, y: yc, z: -d, d, tanV, a, alt: f.altura, deitado, guinada: deitado ? -0.2 : -0.1 });
  camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(tanV)); camera.aspect = a; camera.updateProjectionMatrix();
  camRep.fov = camera.fov; camRep.aspect = a; camRep.near = 0.05; camRep.far = 20; camRep.updateProjectionMatrix();
  camRep.position.set(0, f.altura, 0); camRep.rotation.set(-inclina, 0, 0); camRep.updateMatrixWorld(true);
  rep.alvo.set(0, 0, -1).applyQuaternion(camRep.quaternion).multiplyScalar(d).add(camRep.position);
  uCen.uFoco.value = d; poeira.uFoco.value = d; poeira.uEsc.value = Hh * renderer.getPixelRatio() * 0.0011;
  uCen.uDesfoque.value = leve ? 0.0008 : 0.001;
  // a coluna das funções: logo à direita do celular em repouso
  const dir = new THREE.Vector3(CEL.L / 2, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), rep.guinada).add(new THREE.Vector3(rep.x, rep.y, rep.z));
  rep.colX = naTela(dir, camRep).x + Math.max(34, L * 0.028);
  medirTitulo();
  hist?.arrumar();
  lerRolagem();
}

// ---------- a rolagem conduz a história ----------
let hist = null;
const rolagem = { alvo: 0, s: 0, curso: 1, fixa: consulta.has('s') ? parseFloat(consulta.get('s')) : null };
function lerRolagem(medir = true) {
  if (medir) rolagem.curso = Math.max(1, elHistoria.offsetHeight - elPreso.offsetHeight);
  rolagem.alvo = rolagem.fixa ?? limita(scrollY / rolagem.curso, 0, 1) * TELAS_DA_HISTORIA;
}
addEventListener('scroll', () => lerRolagem(false), { passive: true });

function naTela(p, cam = camera) { v3b.copy(p).project(cam); return { x: (v3b.x * 0.5 + 0.5) * L, y: (0.5 - v3b.y * 0.5) * Hh }; }

// ---------- título: mede no HTML, desenha na textura e põe o plano atrás do celular ----------
function medirTitulo() {
  const r = elTitulo.getBoundingClientRect();
  if (!r.width) return;
  const fonte = parseFloat(getComputedStyle(elTitulo).fontSize), m = fonte * 0.3;
  const caixa = { x: r.left - m, y: r.top - m, w: r.width + 2 * m, h: r.height + 2 * m };
  const esc = Math.min(renderer.getPixelRatio() * 1.25, 2600 / caixa.w);
  tit.c.width = Math.round(caixa.w * esc); tit.c.height = Math.round(caixa.h * esc);
  tit.itens = palavras.map((el) => {
    const b = el.getBoundingClientRect(), l = el.parentElement.getBoundingClientRect();
    return { t: el.textContent, x: b.left - caixa.x, topo: l.top - caixa.y, alt: l.height, ambar: el.classList.contains('ambar') };
  });
  Object.assign(tit, { fonte, esc, caixa, ultimoT: -1 });
  tit.tex.dispose();
  // plano na profundidade logo atrás do aparelho, alinhado ao enquadramento de repouso
  const D = rep.d + 0.06, cx = (caixa.x + caixa.w / 2) / L * 2 - 1, cy = 1 - (caixa.y + caixa.h / 2) / Hh * 2;
  const meiaL = rep.tanV * rep.a * D, meiaA = rep.tanV * D;
  tit.malha.quaternion.copy(camRep.quaternion);
  tit.malha.position.set(cx * meiaL, cy * meiaA, -D).applyQuaternion(camRep.quaternion).add(camRep.position);
  tit.malha.scale.set(caixa.w / L * 2 * meiaL, caixa.h / Hh * 2 * meiaA, 1);
}

function desenharTitulo(T) {
  if (!tit.caixa) return;
  const fim = 0.95 + tit.itens.length * 0.075 + 1.15;
  const t = Math.min(T, fim);
  if (t === tit.ultimoT) return;
  tit.ultimoT = t;
  const c = tit.c.getContext('2d'), f = tit.fonte;
  c.setTransform(tit.esc, 0, 0, tit.esc, 0, 0);
  c.clearRect(0, 0, tit.caixa.w, tit.caixa.h);
  c.font = `700 ${f}px "Urbanist Variable", Urbanist, system-ui, sans-serif`;
  c.letterSpacing = `${-0.035 * f}px`; c.textBaseline = 'alphabetic';
  const med = c.measureText('H'), sobe = med.fontBoundingBoxAscent, desce = med.fontBoundingBoxDescent;
  tit.itens.forEach((it, i) => {
    const p = saiExpo(trecho(t, 0.95 + i * 0.075, 1.15));
    if (p <= 0) return;
    const base = it.topo + (it.alt - (sobe + desce)) / 2 + sobe;
    c.save();
    c.beginPath(); c.rect(0, it.topo - f * 0.12, tit.caixa.w, it.alt + f * 0.3); c.clip();
    c.globalAlpha = Math.min(1, p * 1.6);
    c.fillStyle = it.ambar ? '#F7B23B' : '#E4EAF0';
    c.fillText(it.t, it.x, base + (1 - p) * it.alt * 1.15);
    c.restore();
  });
  tit.tex.needsUpdate = true;
}

// ---------- navegação nas telas do app ----------
const nav = { atual: 'inicio', pilha: ['inicio'], trans: null, ocupado: false };
const FUNCOES = ['recibo', 'relatorios', 'empresa', 'pro'];

function trocarTexturas() {
  [telaA, telaB] = [telaB, telaA];
  uTela.uA.value = telaA.t; uTela.uB.value = telaB.t; uCen.uTelaA.value = telaA.t; uCen.uTelaB.value = telaB.t;
  uTela.uT.value = 0; uCen.uTelaMix.value = 0;
}

async function irPara(id, tipo = 'entra') {
  if (nav.ocupado) return false;
  if (tipo === 'volta') { if (nav.pilha.length < 2) return false; id = nav.pilha[nav.pilha.length - 2]; }
  if (id === nav.atual) return false;
  nav.ocupado = true;
  try { await desenhar(id, telaB.c, dados); } catch { nav.ocupado = false; return false; }
  telaB.t.needsUpdate = true;
  if (tipo === 'aba') nav.pilha = id === 'inicio' ? ['inicio'] : [id];
  else if (tipo === 'volta') nav.pilha.pop();
  else nav.pilha.push(id);
  uTela.uModo.value = tipo === 'aba' ? 0 : tipo === 'volta' ? 2 : 1;
  nav.trans = { para: id, t: 0, dur: tipo === 'aba' ? 0.3 : 0.44 };
  return true;
}

async function redesenharAtual() {
  if (nav.ocupado) return;
  await desenhar(nav.atual, telaA.c, dados); telaA.t.needsUpdate = true;
}

// ---------- holograma das funções ----------
const HOLO = {
  recibo: { nome: 'Recibo', titulo: 'Recibo em um toque', texto: 'O orçamento aprovado vira recibo, com o valor por extenso e pronto para enviar.', recorte: [32, 1045, 656, 333] },
  relatorios: { nome: 'Relatórios', selo: true, titulo: 'Quanto entrou no mês', texto: 'Recebido, aprovado e taxa de aprovação, por mês e por cliente. Em PDF ou planilha.', recorte: [32, 808, 656, 408] },
  empresa: { nome: 'Sua empresa', selo: true, titulo: 'Sua marca no documento', texto: 'A sua logo e a sua cor no orçamento e no recibo que o cliente recebe.', recorte: [32, 110, 656, 312] },
  pro: { nome: 'Seja Pro', titulo: 'Pague uma vez', texto: 'Pro vitalício, sem mensalidade e sem renovação. De R$ 99,90 por R$ 69,90 no lançamento.', recorte: [48, 470, 624, 270] },
};
const holo = { aberto: null, el: $('#holo'), vidro: $('.holo-vidro'), tela: $('#holo-tela'), rascunho: document.createElement('canvas') };
holo.rascunho.width = LARG; holo.rascunho.height = ALT;

async function preencherHolo(f) {
  const h = HOLO[f];
  $('#holo-nome').textContent = h.nome; $('#holo-selo').hidden = !h.selo;
  $('#holo-titulo').textContent = h.titulo; $('#holo-texto').textContent = h.texto;
  document.querySelectorAll('.holo-abas button').forEach((b) => b.classList.toggle('ativa', b.dataset.f === f));
  await desenhar(f, holo.rascunho, dados);
  if (holo.aberto !== f) return;
  const [x, y, w, a] = h.recorte;
  holo.tela.width = w; holo.tela.height = a;
  holo.tela.getContext('2d').drawImage(holo.rascunho, x, y + BARRA, w, a, 0, 0, w, a);
  holo.vidro.classList.remove('troca'); void holo.vidro.offsetWidth; holo.vidro.classList.add('troca');
}

function abrirHolo(f, navegar = true) {
  mexeu();
  pararVez();
  holo.aberto = f;
  corpo.classList.add('com-holo'); holo.el.setAttribute('aria-hidden', 'false');
  preencherHolo(f);
  if (navegar && nav.atual !== f) { nav.pilha = ['inicio']; irPara(f, nav.atual === 'inicio' ? 'entra' : 'aba').then((ok) => { if (ok) nav.pilha = ['inicio', f]; }); }
}
function fecharHolo() {
  if (!holo.aberto) return;
  holo.aberto = null; corpo.classList.remove('com-holo'); holo.el.setAttribute('aria-hidden', 'true'); mexeu();
}

// ---------- o celular mostra as funções sozinho quando ninguém mexe ----------
const vez = { i: -1, proxima: Infinity, dur: 3.4, ultimaAcao: 0, sobre: false };
const fichas = [...document.querySelectorAll('.funcao')];
fichas.forEach((b, i) => b.style.setProperty('--n', i));
let T = 0;
function mexeu() { vez.ultimaAcao = T; }
function pararVez() { if (vez.i >= 0) fichas.forEach((b) => b.classList.remove('vez')); vez.i = -1; vez.proxima = Infinity; }
function passoVez() {
  if (holo.aberto || vez.sobre || semMovimento || consulta.has('semvez') || rolagem.alvo > 0.03) { if (vez.i >= 0) pararVez(); return; }
  if (vez.proxima === Infinity) { if (T - vez.ultimaAcao > 5.5 && T > 8.5) vez.proxima = T; else return; }
  if (T < vez.proxima || nav.ocupado) return;
  vez.i = (vez.i + 1) % (FUNCOES.length + 1);
  fichas.forEach((b) => b.classList.remove('vez'));
  const f = FUNCOES[vez.i];
  if (f) {
    const b = fichas[vez.i]; b.style.setProperty('--vez', `${vez.dur}s`); void b.offsetWidth; b.classList.add('vez');
    irPara(f, 'aba').then(() => { nav.pilha = ['inicio', f]; });
  } else irPara('inicio', 'aba');
  vez.proxima = T + vez.dur;
}

// ---------- ponteiro: giro com mola, toque nas telas ----------
const pont = { x: 0, y: 0, ativo: false, cx: 0, cy: 0, baixou: null, arrasto: 0 };
const mola = { gui: new Mola(-1.2, 30, 6.6), inc: new Mola(0, 30, 6.6), rol: new Mola(0, 26, 7), camX: new Mola(0, 16, 7.5), camY: new Mola(0, 16, 7.5), desl: new Mola(0, 26, 8.5) };
const raio = new THREE.Raycaster(), ndc = new THREE.Vector2();

function pontoNaTela(cx, cy) {
  const r = palco.getBoundingClientRect();
  ndc.set(((cx - r.left) / r.width) * 2 - 1, 1 - ((cy - r.top) / r.height) * 2);
  raio.setFromCamera(ndc, camera);
  const h = raio.intersectObject(cel.tela, false)[0];
  return h ? { u: h.uv.x, v: 1 - h.uv.y } : null;
}

addEventListener('pointermove', (e) => {
  pont.cx = e.clientX; pont.cy = e.clientY;
  if (e.pointerType === 'mouse') { pont.x = (e.clientX / L) * 2 - 1; pont.y = (e.clientY / Hh) * 2 - 1; pont.ativo = true; }
  else if (pont.baixou) pont.arrasto = limita((e.clientX - pont.baixou.x) / (L * 0.5), -1, 1);
}, { passive: true });
document.documentElement.addEventListener('mouseleave', () => { pont.ativo = false; });
// no celular, inclinar o aparelho faz o papel do mouse; o "zero" acompanha devagar o jeito de segurar
const giro = { x: 0, y: 0, zx: null, zy: null };
if (toque && !semMovimento) addEventListener('deviceorientation', (e) => {
  if (e.gamma == null || e.beta == null) return;
  giro.zx ??= e.gamma; giro.zy ??= e.beta;
  if (Math.abs(e.gamma - giro.zx) > 60 || Math.abs(e.beta - giro.zy) > 60) { giro.zx = e.gamma; giro.zy = e.beta; }
  giro.zx += (e.gamma - giro.zx) * 0.008; giro.zy += (e.beta - giro.zy) * 0.008;
  giro.x = limita((e.gamma - giro.zx) / 14, -1, 1); giro.y = limita((e.beta - giro.zy) / 14, -1, 1);
}, { passive: true });
palco.addEventListener('pointerdown', (e) => { pont.baixou = { x: e.clientX, y: e.clientY, t: performance.now() }; });
addEventListener('pointerup', (e) => {
  const b = pont.baixou; pont.baixou = null; pont.arrasto = 0;
  if (!b || e.target !== palco || rolagem.s > 0.1) return;
  if (Math.hypot(e.clientX - b.x, e.clientY - b.y) > 9 || performance.now() - b.t > 600) return;
  const p = pontoNaTela(e.clientX, e.clientY);
  if (!p) { if (holo.aberto) fecharHolo(); return; }
  mexeu(); pararVez();
  if (uTela.uLiga.value < 0.9) return;
  uTela.uToque.value.set(p.u, 1 - p.v, 0);
  const alvo = areaEm(nav.atual, p.u, p.v);
  if (!alvo) return;
  setTimeout(async () => {
    const ok = await irPara(alvo.para, alvo.tipo);
    if (!ok) return;
    const destino = nav.pilha[nav.pilha.length - 1];
    if (HOLO[destino]) abrirHolo(destino, false); else if (holo.aberto) fecharHolo();
  }, 110);
});
addEventListener('pointercancel', () => { pont.baixou = null; pont.arrasto = 0; });

fichas.forEach((b) => b.addEventListener('click', () => abrirHolo(b.dataset.f)));
document.querySelectorAll('.holo-abas button').forEach((b) => b.addEventListener('click', () => abrirHolo(b.dataset.f)));
$('#holo-fechar').addEventListener('click', fecharHolo);
addEventListener('keydown', (e) => { if (e.key === 'Escape') fecharHolo(); });

// ---------- o nome do negócio do visitante entra no celular ----------
const campo = $('#negocio'), eco = $('#eco');
let esperaNome = 0;
campo.addEventListener('input', () => {
  clearTimeout(esperaNome);
  esperaNome = setTimeout(async () => {
    const nome = campo.value.trim().replace(/\s+/g, ' ');
    dados.nome = nome || 'Elétrica Rocha'; hist?.nome(dados.nome);
    eco.replaceChildren(...(nome ? ['No app: ', Object.assign(document.createElement('b'), { textContent: `Olá, ${nome}` }), '. A sua marca também vai no orçamento.'] : ['Digite e veja o celular te receber pelo nome.']));
    mexeu(); pararVez();
    if (nav.atual === 'inicio' || nav.atual === 'empresa') await redesenharAtual();
    else { nav.pilha = ['inicio']; await irPara('inicio', 'aba'); }
    if (holo.aberto) preencherHolo(holo.aberto);
  }, 140);
});

// ---------- quadro a quadro ----------
const feixe = $('#feixe-forma');
let naHistoria = false, chaveDesenhada = '', ultimoSome = -1, cenaClara = false, claridade = 0;
const eixoY = new THREE.Vector3(0, 1, 0);
let tempo = 0, pronto = false;
const congela = consulta.has('congela') ? parseFloat(consulta.get('congela')) : null;   // conferência: para o tempo da entrada

function quadro(dt) {
  T = congela ?? T + dt; tempo += dt;
  lerRolagem(false);          // lê a posição a cada quadro: não depende do evento de rolagem chegar
  // a rolagem chega suavizada: a cena desliza até o ponto, sem trancos da roda do mouse
  rolagem.s = rolagem.fixa ?? (Math.abs(rolagem.alvo - rolagem.s) < 0.0004 ? rolagem.alvo : rolagem.s + (rolagem.alvo - rolagem.s) * (1 - Math.exp(-dt * 7.5)));
  const s = rolagem.s, fh = 1 - suave(0.02, 0.26, s);       // fh: o quanto ainda vale a primeira tela
  if (s > 0.04 && holo.aberto) fecharHolo();

  // lâmpada: pisca duas vezes e firma
  const luz = T < 0.25 ? 0 : T < 0.32 ? 0.6 : T < 0.4 ? 0.1 : T < 0.47 ? 0.85 : T < 0.56 ? 0.32 : mistura(0.72, 1, trecho(T, 0.56, 0.8));
  uCen.uLuz.value = luz; uCen.uTempo.value = tempo; poeira.uLuz.value = luz; poeira.uTempo.value = tempo;
  lampada.intensity = 2.6 * luz; fria.intensity = 0.5 * luz;

  // o celular sai deitado da bancada, levanta e acende
  const sobe = saiExpo(trecho(T, 0.55, 1.5)), gira = passaEVolta(trecho(T, 0.55, 1.7), 1.25);
  const liga = trecho(T, 1.3, 0.7);
  uTela.uLiga.value = liga; uCen.uTelaLuz.value = entraESai(liga);
  uTela.uToque.value.z += dt; uTela.uTempo.value = tempo;
  uTela.uPulso.value = mistura(uTela.uPulso.value, nav.atual === 'inicio' && !nav.trans && liga >= 1 ? 1 : 0, Math.min(1, dt * 6));

  // alvos do giro: mouse, um balanço lento que nunca para e, com o painel aberto, vira para ele
  const bx = Math.sin(tempo * 0.42) * (pont.ativo ? 0.035 : 0.11), by = Math.sin(tempo * 0.31 + 1.3) * (pont.ativo ? 0.02 : 0.045);
  const mx = pont.ativo ? pont.x : giro.x, my = pont.ativo ? pont.y : giro.y;
  const comHolo = holo.aberto && rep.deitado;
  mola.gui.alvo = rep.guinada * fh + (comHolo ? 0.52 : 0) + (mx * (comHolo ? 0.14 : 0.42) + bx + pont.arrasto * 0.9) * mistura(0.22, 1, fh);
  mola.inc.alvo = (-my * 0.17 + by) * mistura(0.3, 1, fh);
  mola.rol.alvo = mx * 0.03;
  // a câmera anda de lado: é o que faz as ferramentas em relevo passarem na frente do tampo
  mola.camX.alvo = mx * 0.045 + bx * 0.15 + pont.arrasto * 0.03; mola.camY.alvo = -my * 0.02 + by * 0.1;
  mola.desl.alvo = comHolo ? -0.004 : 0;
  for (const k in mola) mola[k].passo(dt);

  const flutua = Math.sin(tempo * 1.25) * 0.0016 * sobe * fh;
  cel.grupo.position.set(rep.x + mola.desl.v, mistura(CEL.E / 2 + 0.0006, rep.y + flutua, sobe), rep.z);
  cel.grupo.rotation.set(mistura(-Math.PI / 2, mola.inc.v, gira), mola.gui.v + (1 - gira) * -0.5, mola.rol.v * gira, 'YXZ');
  cel.grupo.updateMatrixWorld(true);

  // câmera: desloca um pouco e continua olhando para o mesmo ponto, o que dá a paralaxe da bancada;
  // com a rolagem, quem conduz a câmera é a história
  let est = null;
  if (hist) est = hist.aplica(s, dt, tempo, { desvioX: mola.camX.v, desvioY: mola.camY.v, gui: mola.gui.v, inc: mola.inc.v }, L, Hh);
  else { camera.position.set(mola.camX.v, rep.alt + mola.camY.v, 0); camera.lookAt(rep.alvo); camera.updateMatrixWorld(true); }
  if (est) {
    // a tela do celular na história: abre o Novo orçamento e vai preenchendo
    if (est.toque) uTela.uToque.value.set(est.toque[0], est.toque[1], 0);
    const quer = est.tela;
    if (quer !== nav.atual && !nav.ocupado && (quer !== 'inicio' || naHistoria)) {
      const tipo = quer === 'novo' && nav.atual === 'inicio' ? 'entra' : 'aba';
      naHistoria = quer !== 'inicio'; nav.pilha = ['inicio']; chaveDesenhada = est.chaveTela; irPara(quer, tipo);
    }
    if (naHistoria && nav.atual === quer && !nav.ocupado && est.chaveTela !== chaveDesenhada) { chaveDesenhada = est.chaveTela; redesenharAtual(); }
    if (est.clara !== cenaClara) { cenaClara = est.clara; corpo.classList.toggle('cena-clara', cenaClara); }
    // na sala clara o grão de filme vira sujeira: some quase todo, junto com o brilho e a vinheta
    if (efeitos && est.claridade !== claridade) {
      claridade = est.claridade;
      efeitos.grao.blendMode.opacity.value = mistura(0.12, 0.025, claridade); efeitos.brilho.intensity = mistura(0.55, 0.16, claridade); efeitos.vinheta.darkness = mistura(0.62, 0.3, claridade);
    }
    // a primeira tela sai de cena
    const some = suave(0.02, 0.09, s);
    if (some !== ultimoSome) {
      ultimoSome = some;
      elInterface.style.opacity = (1 - some).toFixed(3); tit.malha.material.opacity = 1 - some; tit.malha.visible = some < 1;
      corpo.classList.toggle('na-historia', some >= 1);
    }
  }

  // o que a bancada precisa saber do aparelho
  const e = cel.grupo.matrixWorld.elements;
  uCen.uC.value.setFromMatrixPosition(cel.grupo.matrixWorld);
  uCen.uU.value.set(e[0], e[1], e[2]).normalize(); uCen.uV.value.set(e[4], e[5], e[6]).normalize(); uCen.uN.value.set(e[8], e[9], e[10]).normalize();

  // passagem entre telas
  if (nav.trans) {
    nav.trans.t += dt / nav.trans.dur;
    const p = saiExpo(Math.min(nav.trans.t, 1));
    uTela.uT.value = p; uCen.uTelaMix.value = p;
    if (nav.trans.t >= 1) { nav.atual = nav.trans.para; nav.trans = null; trocarTexturas(); nav.ocupado = false; }
  }

  desenharTitulo(T);
  if (!pronto && T > 1.55) { pronto = true; corpo.classList.add('pronto'); }
  passoVez();
  posicionarInterface();

  if (composer) composer.render(dt); else renderer.render(cena, camera);
}

// fichas das funções presas à lateral do aparelho, painel de vidro e o feixe que liga os dois
function posicionarInterface() {
  if (!rep.deitado) return;
  const m = cel.grupo.matrixWorld;
  fichas.forEach((b, i) => {
    const p = naTela(v3.set(CEL.L / 2 + 0.0008, CEL.A * (0.3 - i * 0.2), 0).applyMatrix4(m));
    b.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`;
    b.style.setProperty('--fio', `${Math.max(18, rep.colX - p.x).toFixed(1)}px`);
  });
  if (!holo.aberto) return;
  const a = naTela(v3.set(CEL.telaL / 2, CEL.telaA * 0.44, CEL.E / 2).applyMatrix4(m));
  const b = naTela(v3.set(CEL.telaL / 2, -CEL.telaA * 0.44, CEL.E / 2).applyMatrix4(m));
  const alt = holo.vidro.offsetHeight, larg = holo.el.offsetWidth;
  const x = Math.min(Math.max(a.x, b.x) + Math.max(30, L * 0.03), L - larg - 16), y = limita((a.y + b.y) / 2 - alt / 2, 70, Math.max(70, Hh - alt - 50));
  holo.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
  holo.vidro.style.setProperty('--giro', `${(-9 - mola.gui.v * 6 + (pont.ativo ? pont.x : 0) * 3).toFixed(2)}deg`);
  holo.vidro.style.setProperty('--tomba', `${((pont.ativo ? pont.y : 0) * -2.5).toFixed(2)}deg`);
  feixe.setAttribute('points', `${a.x.toFixed(1)},${a.y.toFixed(1)} ${x + 4},${y + 14} ${x + 4},${y + alt - 14} ${b.x.toFixed(1)},${b.y.toFixed(1)}`);
}

// cursor de mãozinha sobre o que responde ao toque
function conferirCursor() {
  if (!pont.ativo) { vez.sobre = false; return; }
  const p = pontoNaTela(pont.cx, pont.cy);
  vez.sobre = !!p;
  palco.style.cursor = p && areaEm(nav.atual, p.u, p.v) && !nav.ocupado ? 'pointer' : '';
}

// ---------- partida ----------
async function iniciar() {
  await Promise.all([
    document.fonts.load('700 80px "Urbanist Variable"'), document.fonts.load('600 32px "Inter Variable"'), document.fonts.load('400 32px "Inter Variable"'),
  ]).catch(() => {});
  arrumar();
  await Promise.all([desenhar('inicio', telaA.c, dados), cenario.usar(rep.deitado ? 'paisagem' : 'retrato')]);
  telaA.t.needsUpdate = true;
  desenhar('inicio', telaB.c, dados).then(() => { telaB.t.needsUpdate = true; });
  if (semMovimento || consulta.has('semintro')) { T = 12; corpo.classList.add('direto'); }
  if (consulta.has('mx')) Object.assign(pont, { x: parseFloat(consulta.get('mx')), y: parseFloat(consulta.get('my') ?? '0'), ativo: true });
  if (consulta.has('holo')) setTimeout(() => abrirHolo(consulta.get('holo')), 300);
  if (consulta.has('t')) T = parseFloat(consulta.get('t')) || 0;
  hist = await criaHistoria({
    cena, camera, cel, cenario, uTela, uCen, rep, dados, leve, renderer,
    dom: {
      raiz: $('#camada'), legendas: [...document.querySelectorAll('.legenda')], marca: $('.marca'), clarao: $('#clarao'), onda: $('#onda'), progresso: $('#progresso'), claro: $('#claro'), recebido: $('#recebido'), recebidoValor: $('#recebido strong'),
      aponta: { logo: $('#ap-logo'), pix: $('#ap-pix'), fotos: $('#ap-fotos') }, etapas: [...document.querySelectorAll('.etapas li')],
    },
  });
  hist.arrumar(); lerRolagem(); rolagem.s = rolagem.alvo;
  if (rolagem.alvo > 0.05 && !consulta.has('t')) { T = Math.max(T, 12); corpo.classList.add('direto'); }   // a página abriu no meio da história: sem a entrada
  for (const k of ['gui', 'inc', 'rol', 'camX', 'camY', 'desl']) mola[k].fixa(k === 'gui' ? rep.guinada : 0);

  addEventListener('resize', arrumar);
  preCarregar();

  let antes = performance.now(), nQuadro = 0;
  const laco = (agora) => {
    const dt = Math.min((agora - antes) / 1000, 0.1); antes = agora;
    // fora da tela (a página já passou da história) o 3D descansa
    if (!document.hidden && (rolagem.fixa !== null || scrollY < elHistoria.offsetHeight + 40)) { quadro(dt); if (++nQuadro % 4 === 0) conferirCursor(); }
    requestAnimationFrame(laco);
  };
  if (!consulta.has('pausa')) requestAnimationFrame(laco);

  // para conferência: avançar o tempo à mão e abrir funções
  window.__cena1 = { rolagem, hist, passo: (seg = 1 / 60, n = 1) => { for (let i = 0; i < n; i++) quadro(seg); return +T.toFixed(3); }, nav, irPara, abrirHolo, fecharHolo, pont, rep, camera, cel, tit, telas: () => [telaA.c, telaB.c] };
}
iniciar();
