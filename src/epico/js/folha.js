// A folha de papel: primeiro flexível (sai do celular, cai, balança), depois dobrada de verdade em avião.
// A dobra é feita como no papel: a folha é cortada nos vincos em facetas rígidas e cada faceta gira em torno
// dos vincos que a atingem, na ordem em que as dobras acontecem. A tinta do documento acompanha cada faceta.
// Medidas em metros. Folha no plano z = 0, frente (com a tinta) virada para +z, topo em +y.
import * as THREE from 'three';
import { limita } from './util.js';

export const FOLHA = { L: 0.066, A: 0.066 * (1123 / 794), PAG: [794, 1123] };
const ESP = 0.00016;                      // espessura visual de cada camada de papel dobrado

const VERT = /* glsl */`
varying vec2 vUv; varying vec3 vN; varying vec3 vMundo;
void main(){
  vUv = uv; vN = normalize(mat3(modelMatrix) * normal);
  vec4 m = modelMatrix * vec4(position, 1.); vMundo = m.xyz;
  gl_Position = projectionMatrix * viewMatrix * m;
}`;

const FRAG = /* glsl */`
uniform sampler2D uDoc, uSelo;
uniform float uRevela, uTela, uOpaco, uTempo, uCarimbo;
uniform vec2 uSeloEm, uSeloTam, uFolhaTam;
uniform vec3 uLuzDir, uLuzCor, uAmb, uTelaCor, uContra;
varying vec2 vUv; varying vec3 vN; varying vec3 vMundo;
float ruido(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main(){
  vec3 n = vN / max(length(vN), 1e-5); bool frente = gl_FrontFacing; if (!frente) n = -n;
  vec3 tinta = texture2D(uDoc, vUv).rgb;
  // a impressão desce do topo da folha: acima da frente a tinta já está no papel
  float y = 1. - vUv.y, f = uRevela * 1.12 - .06;
  float impresso = 1. - smoothstep(f - .05, f, y), df = (y - f) / .009;
  float fio = exp(-df * df) * smoothstep(0., .03, uRevela) * (1. - smoothstep(.97, 1., uRevela));
  vec3 papel = vec3(.955, .95, .935) * (1. - .035 * ruido(floor(vUv * vec2(520., 735.))));
  vec3 base = papel * mix(vec3(1.), tinta, impresso * (frente ? 1. : .06));
  // carimbo: vem grande, bate e assenta
  if (uCarimbo > 0. && frente) {
    float esc = mix(2.6, 1., smoothstep(0., .55, uCarimbo)) * (1. + .06 * sin(min(uCarimbo, 1.) * 9.) * (1. - uCarimbo));
    vec2 d = (vUv - uSeloEm) * uFolhaTam; float a = .2;
    d = mat2(cos(a), -sin(a), sin(a), cos(a)) * d / (uSeloTam * esc);
    if (abs(d.x) < 1. && abs(d.y) < 1.) { vec4 selo = texture2D(uSelo, d * .5 + .5); base = mix(base, base * selo.rgb, selo.a * smoothstep(0., .3, uCarimbo) * .92); }
  }
  // luz: a lâmpada (ou o ambiente da cena), um pouco da que atravessa o papel e a da tela do celular
  vec3 L = normalize(uLuzDir);
  float dif = max(dot(n, L), 0.), atras = max(dot(-n, L), 0.);
  vec3 olho = normalize(cameraPosition - vMundo);
  vec3 luz = uAmb + uLuzCor * (dif * .9 + atras * .32) + uContra * pow(clamp(1. - dot(n, olho), 0., 1.), 3.);
  luz += uTelaCor * uTela * exp(-vUv.y * 3.2) * 1.5;
  vec3 cor = base * luz;
  cor += vec3(.55, .78, 1.) * fio * .55 * (frente ? 1. : .25);          // o fio de luz da impressão
  cor = min(cor, vec3(.93));
  gl_FragColor = vec4(cor, uOpaco);
  #include <colorspace_fragment>
}`;

// ---------- o documento como textura: a matriz fotografada + o que é escrito na hora ----------
export function criaDocumento(url, medidas, leve) {
  const esc = leve ? 1 : 2, c = document.createElement('canvas');
  c.width = FOLHA.PAG[0] * esc; c.height = FOLHA.PAG[1] * esc;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.anisotropy = 8;
  const cx = c.getContext('2d');
  cx.fillStyle = '#fff'; cx.fillRect(0, 0, c.width, c.height);
  let img = null;
  const estado = { nome: 'Elétrica Rocha', total: null };
  const pronto = new Promise((ok) => { const im = new Image(); im.onload = () => { img = im; ok(); }; im.onerror = ok; im.src = url; });

  // escreve um dos textos vivos por cima da matriz (limpa o retângulo dele antes)
  function vivo(chave, texto, cor, fundo) {
    const m = medidas.vivo[chave]; if (!m) return;
    const [x, y, w, h] = m.r;
    cx.save(); cx.setTransform(esc, 0, 0, esc, 0, 0);
    if (img) cx.drawImage(img, x * 2, y * 2, w * 2, h * 2, x, y, w, h); else { cx.fillStyle = fundo; cx.fillRect(x, y, w, h); }
    cx.font = `${m.fonte} "Inter Variable", Inter, system-ui, sans-serif`;
    cx.letterSpacing = m.espaco === 'normal' ? '0px' : m.espaco;
    cx.fillStyle = cor; cx.textBaseline = 'middle'; cx.textAlign = m.alinha === 'right' ? 'right' : 'left';
    let s = texto; while (s.length > 3 && cx.measureText(s).width > w) s = s.slice(0, -2).trimEnd() + '…';
    cx.fillText(s, m.alinha === 'right' ? x + w : x, y + h / 2 + 1);
    cx.restore();
  }
  function redesenhar() {
    if (img) cx.drawImage(img, 0, 0, c.width, c.height);
    vivo('nome', estado.nome, '#ffffff', '#0E5A8A');
    vivo('assina', estado.nome, '#0F1B2D', '#ffffff');
    if (estado.total !== null) { vivo('total', estado.total, '#0E5A8A', '#ffffff'); vivo('final', estado.total, '#0E5A8A', '#E7EFF3'); }
    tex.needsUpdate = true;
  }
  pronto.then(redesenhar);
  return {
    tex, pronto, medidas,
    nome(n) { if (n !== estado.nome) { estado.nome = n; redesenhar(); } },
    total(t) { if (t !== estado.total) { estado.total = t; if (img) { vivo('total', t, '#0E5A8A', '#ffffff'); vivo('final', t, '#0E5A8A', '#E7EFF3'); tex.needsUpdate = true; } } },
    // ponto da página (px de 794 x 1123) -> posição na folha solta, em metros
    ponto(px, py) { return new THREE.Vector3((px / FOLHA.PAG[0] - 0.5) * FOLHA.L, (0.5 - py / FOLHA.PAG[1]) * FOLHA.A, 0); },
  };
}

// ---------- vincos do avião (dardo clássico) e o corte da folha em facetas ----------
function montaFacetas() {
  const { L, A } = FOLHA, T = [0, A / 2];
  const y1 = A / 2 - L / 2, y2 = A / 2 - (L / 2) / Math.tan(Math.PI / 8), k = L * 0.14;
  // cada dobra: vinco de a até b, um ponto do lado que se mexe, para onde ele vai (z) e o grupo de animação
  const OPS = [
    { a: T, b: [-L / 2, y1], lado: [-L / 2, A / 2], z: -1, g: 0, plana: true },
    { a: T, b: [L / 2, y1], lado: [L / 2, A / 2], z: -1, g: 0, plana: true },
    { a: T, b: [-L / 2, y2], lado: [-L / 2, 0], z: -1, g: 1, plana: true },
    { a: T, b: [L / 2, y2], lado: [L / 2, 0], z: -1, g: 1, plana: true },
    { a: [-k, -A / 2], b: [-k, A / 2], lado: [-L / 2, 0], z: -1, g: 2 },
    { a: [k, -A / 2], b: [k, A / 2], lado: [L / 2, 0], z: -1, g: 2 },
    { a: [0, -A / 2], b: [0, A / 2], lado: [-L / 2, 0], z: 1, g: 3 },
    { a: [0, -A / 2], b: [0, A / 2], lado: [L / 2, 0], z: 1, g: 3 },
  ];
  // v: [x, y] na dobradura já feita (plana) e [sx, sy] na folha aberta
  let facetas = [{ v: [[-L / 2, -A / 2], [L / 2, -A / 2], [L / 2, A / 2], [-L / 2, A / 2]].map(([x, y]) => ({ x, y, sx: x, sy: y })), dobras: [], camada: 0, camadas: [] }];
  const EPS = 1e-9;
  let grupoAtual = -1, minGrupo = 0;
  OPS.forEach((op, io) => {
    const ux0 = op.b[0] - op.a[0], uy0 = op.b[1] - op.a[1], comp = Math.hypot(ux0, uy0), ux = ux0 / comp, uy = uy0 / comp;
    const lado = (x, y) => ux * (y - op.a[1]) - uy * (x - op.a[0]);
    const sinalLado = Math.sign(lado(op.lado[0], op.lado[1]));
    op.u = [ux, uy]; op.sinal = op.z * sinalLado;
    if (op.g !== grupoAtual) { grupoAtual = op.g; minGrupo = Math.min(...facetas.map((f) => f.camada)); }
    const novas = [], movidas = [];
    for (const f of facetas) {
      const d = f.v.map((p) => lado(p.x, p.y) * sinalLado);
      if (d.every((x) => x <= EPS)) { novas.push(f); continue; }
      const mov = [], fica = [];
      for (let i = 0; i < f.v.length; i++) {
        const p = f.v[i], q = f.v[(i + 1) % f.v.length], dp = d[i], dq = d[(i + 1) % f.v.length];
        if (dp >= -EPS) mov.push(p); if (dp <= EPS) fica.push(p);
        if ((dp > EPS && dq < -EPS) || (dp < -EPS && dq > EPS)) {
          const t = dp / (dp - dq), m = { x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t, sx: p.sx + (q.sx - p.sx) * t, sy: p.sy + (q.sy - p.sy) * t };
          mov.push(m); fica.push({ ...m });
        }
      }
      const area = (pl) => Math.abs(pl.reduce((s, p, i) => { const q = pl[(i + 1) % pl.length]; return s + p.x * q.y - q.x * p.y; }, 0)) / 2;
      if (fica.length >= 3 && area(fica) > 1e-10) novas.push({ ...f, v: fica, dobras: [...f.dobras], camadas: [...f.camadas] });
      if (mov.length >= 3 && area(mov) > 1e-10) { const nf = { ...f, v: mov.map((p) => ({ ...p })), dobras: [...f.dobras, io], camadas: [...f.camadas] }; novas.push(nf); movidas.push(nf); }
    }
    if (op.plana && movidas.length) {
      const minMov = Math.min(...movidas.map((f) => f.camada));
      for (const f of movidas) {
        const para = (minGrupo - 1) - (f.camada - minMov);
        f.camadas.push({ g: op.g, de: f.camada, para }); f.camada = para;
        for (const p of f.v) { const rx = p.x - op.a[0], ry = p.y - op.a[1], e = rx * ux + ry * uy; p.x = op.a[0] + 2 * e * ux - rx; p.y = op.a[1] + 2 * e * uy - ry; }
      }
    }
    facetas = novas;
  });
  return { OPS, facetas, k };
}

// gira p (Vector3) em torno do vinco da dobra `op`, de `ang` radianos
function gira(p, op, ang) {
  const [ux, uy] = op.u, rx = p.x - op.a[0], ry = p.y - op.a[1], rz = p.z;
  const c = Math.cos(ang), s = Math.sin(ang), e = (rx * ux + ry * uy) * (1 - c);
  // u x r, com u no plano
  const cx = uy * rz, cy = -ux * rz, cz = ux * ry - uy * rx;
  p.set(op.a[0] + rx * c + cx * s + ux * e, op.a[1] + ry * c + cy * s + uy * e, rz * c + cz * s);
}

export function criaFolha(doc) {
  const { L, A } = FOLHA;
  const uniforms = {
    uDoc: { value: doc.tex }, uRevela: { value: 0 }, uTela: { value: 0 }, uOpaco: { value: 1 }, uTempo: { value: 0 }, uCarimbo: { value: 0 },
    uLuzDir: { value: new THREE.Vector3(-0.72, 0.6, 0.5).normalize() }, uLuzCor: { value: new THREE.Color(1.0, 0.86, 0.68) },
    uSelo: { value: null }, uSeloEm: { value: new THREE.Vector2(0.7, 0.54) }, uSeloTam: { value: new THREE.Vector2(0.0165, 0.0072) }, uFolhaTam: { value: new THREE.Vector2(L, A) },
    uAmb: { value: new THREE.Color(0.2, 0.24, 0.3) }, uTelaCor: { value: new THREE.Color(0.75, 0.86, 1) }, uContra: { value: new THREE.Color(0, 0, 0) },
  };
  const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms, side: THREE.DoubleSide });
  const grupo = new THREE.Group();

  // --- folha flexível ---
  const NX = 18, NY = 26;
  const geoS = new THREE.PlaneGeometry(L, A, NX, NY);
  const baseS = geoS.attributes.position.array.slice();
  const solta = new THREE.Mesh(geoS, mat); solta.frustumCulled = false; grupo.add(solta);

  // p: curva (1/m) ao longo da altura, a partir de `pe` (0 = base, .5 = meio); torce (rad de ponta a ponta);
  // onda (m) e fase; canto (m): o quanto os cantos de cima se levantam
  function soltar({ curva = 0, pe = 0.5, torce = 0, onda = 0, fase = 0, canto = 0, curvaX = 0, retoAbaixo = false } = {}) {
    const pos = geoS.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x0 = baseS[i * 3], y0 = baseS[i * 3 + 1];
      const u = limita(x0 / L + 0.5), v = limita(y0 / A + 0.5);   // sem o limite, um -0,0000001 na borda vira NaN na potência
      const t = (v - pe) * A;                               // distância ao longo da folha a partir do pé da curva
      let y, z;
      if (Math.abs(curva) > 1e-4 && !(retoAbaixo && t < 0)) { y = Math.sin(curva * t) / curva; z = (1 - Math.cos(curva * t)) / curva; } else { y = t; z = 0; }
      y += (pe - 0.5) * A;
      let x = x0;
      if (Math.abs(curvaX) > 1e-4) { const tx = x0; x = Math.sin(curvaX * tx) / curvaX; z += (1 - Math.cos(curvaX * tx)) / curvaX; }
      const tw = torce * (v - 0.5), ct = Math.cos(tw), st = Math.sin(tw);
      const xr = x * ct + z * st, zr = -x * st + z * ct;
      const w = Math.sin(u * 3.1 + v * 4.3 + fase) * 0.6 + Math.sin(u * 5.7 - v * 2.2 + fase * 1.31 + 1.7) * 0.4;
      const cantos = canto * Math.pow(v, 2.2) * Math.pow(Math.abs(u - 0.5) * 2, 2);
      const livre = retoAbaixo ? limita(t / 0.01) : 1;      // o que ainda está atrás do celular não ondula
      pos.setXYZ(i, xr, y, zr + (onda * w * (0.35 + 0.65 * Math.abs(u - 0.5) * 2) + cantos) * livre);
    }
    pos.needsUpdate = true; geoS.computeVertexNormals();
  }

  // --- folha em facetas (dobras) ---
  const { OPS, facetas } = montaFacetas();
  let nTri = 0; for (const f of facetas) nTri += f.v.length - 2;
  const geoD = new THREE.BufferGeometry();
  const posD = new Float32Array(nTri * 9), norD = new Float32Array(nTri * 9), uvD = new Float32Array(nTri * 6);
  { let k = 0; for (const f of facetas) for (let i = 1; i < f.v.length - 1; i++) for (const p of [f.v[0], f.v[i], f.v[i + 1]]) { uvD[k++] = p.sx / L + 0.5; uvD[k++] = p.sy / A + 0.5; } }
  geoD.setAttribute('position', new THREE.BufferAttribute(posD, 3)); geoD.setAttribute('normal', new THREE.BufferAttribute(norD, 3)); geoD.setAttribute('uv', new THREE.BufferAttribute(uvD, 2));
  const dobrada = new THREE.Mesh(geoD, mat); dobrada.frustumCulled = false; dobrada.visible = false; grupo.add(dobrada);
  const e1 = new THREE.Vector3(), e2 = new THREE.Vector3();

  // t = [cantos, segunda dobra, asas, quilha], cada um de 0 a 1
  const pts = [];
  function dobrar(t) {
    const ang = [Math.PI * limita(t[0]), Math.PI * limita(t[1]), 1.36 * limita(t[2]), 1.48 * limita(t[3])];
    let k = 0;
    for (const f of facetas) {
      // espessura: cada faceta vai para a sua camada conforme as dobras planas se completam;
      // entra depois das dobras planas e antes das asas e da quilha, que giram o conjunto todo
      let z = 0; for (const c of f.camadas) z += (c.para - c.de) * limita(t[c.g]);
      for (let i = 0; i < f.v.length; i++) {
        const p = f.v[i], o = (pts[i] ??= new THREE.Vector3()).set(p.sx, p.sy, 0);
        let pos = false;
        for (const io of f.dobras) { const op = OPS[io]; if (!op.plana && !pos) { o.z += z * ESP; pos = true; } gira(o, op, ang[op.g] * op.sinal); }
        if (!pos) o.z += z * ESP;
      }
      for (let i = 1; i < f.v.length - 1; i++) {
        const a = pts[0], b = pts[i], c = pts[i + 1];
        e1.subVectors(b, a); e2.subVectors(c, a); e1.cross(e2).normalize();
        for (const p of [a, b, c]) { posD[k] = p.x; posD[k + 1] = p.y; posD[k + 2] = p.z; norD[k] = e1.x; norD[k + 1] = e1.y; norD[k + 2] = e1.z; k += 3; }
      }
    }
    geoD.attributes.position.needsUpdate = true; geoD.attributes.normal.needsUpdate = true;
  }
  dobrar([0, 0, 0, 0]);

  // --- rastro âmbar atrás do avião: uma fita que ondula e some ---
  const geoR = new THREE.PlaneGeometry(1, 1, 1, 40);
  const matR = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uForca: { value: 0 }, uTempo: { value: 0 }, uComp: { value: 0.42 } },
    vertexShader: /* glsl */`
      uniform float uTempo, uComp; varying vec2 vUv;
      void main(){
        vUv = uv; float t = 1. - uv.y;                         // 0 na cauda do avião, 1 no fim do rastro
        vec3 p = vec3((uv.x - .5) * mix(.006, .03, t), ${(-A / 2).toFixed(5)} - t * uComp, .004);
        p.z += sin(t * 9. - uTempo * 5.) * .012 * t; p.x += sin(t * 6. - uTempo * 3.7 + 1.) * .014 * t;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.);
      }`,
    fragmentShader: /* glsl */`
      uniform float uForca; varying vec2 vUv;
      void main(){
        float t = clamp(1. - vUv.y, 0., 1.), bx = abs(vUv.x - .5) * 2., borda = max(1. - bx * bx, 0.);
        vec3 cor = mix(vec3(1., .66, .2), vec3(1., .4, .04), t);
        gl_FragColor = vec4(max(cor * borda * pow(1. - t, 1.6) * smoothstep(0., .04, t) * uForca * 1.25, vec3(0.)), 1.);
        #include <colorspace_fragment>
      }`,
  });
  const rastro = new THREE.Mesh(geoR, matR); rastro.frustumCulled = false; rastro.visible = false; rastro.renderOrder = 2; grupo.add(rastro);

  return {
    grupo, uniforms, solta, dobrada, soltar, dobrar, facetas: facetas.length,
    rastro(forca, tempo) { rastro.visible = forca > 0.003; matR.uniforms.uForca.value = forca; matR.uniforms.uTempo.value = tempo; },
    modo(dobrando) { solta.visible = !dobrando; dobrada.visible = dobrando; },
  };
}

// O carimbo "PAGO", desenhado em código com falhas de tinta
export function criaSelo() {
  const c = document.createElement('canvas'); c.width = 560; c.height = 244;
  const x = c.getContext('2d');
  x.strokeStyle = x.fillStyle = '#16764a'; x.lineWidth = 13;
  x.beginPath(); x.roundRect(12, 12, 536, 220, 26); x.stroke();
  x.lineWidth = 4; x.beginPath(); x.roundRect(30, 30, 500, 184, 14); x.stroke();
  x.font = '800 142px "Inter Variable", Inter, system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.letterSpacing = '10px';
  x.fillText('PAGO', 286, 128);
  // falhas: a tinta não pega por igual
  x.globalCompositeOperation = 'destination-out';
  let sem = 99; const al = () => ((sem = (sem * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 520; i++) { x.globalAlpha = 0.25 + al() * 0.6; x.beginPath(); x.arc(al() * 560, al() * 244, 0.6 + al() * al() * 4.5, 0, 6.3); x.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}
