// O cenário: a foto da bancada projetada sobre um tampo e uma parede de verdade, a partir da posição em que
// a foto foi tirada. Assim a câmera pode se mexer e a perspectiva do tampo acompanha, sem rasgar a imagem.
// O mesmo material põe na bancada o que o celular faria nela: sombra, luz da tela e o reflexo da tela.
import * as THREE from 'three';
import { rad } from './util.js';
import { CEL } from './celular.js';

const img = (n) => new URL(`../imagens/${n}`, import.meta.url).href;

// Câmera de cada foto, estimada pelo tamanho das ferramentas: altura da lente, inclinação, abertura e a
// distância até a borda do fundo do tampo.
export const FOTOS = {
  paisagem: { arq: img('cenario-bancada-paisagem.webp'), limpa: img('cenario-bancada-paisagem-limpa.webp'), relevo: img('relevo-paisagem.png'), aspecto: 2752 / 1536, altura: 0.114, inclina: 6.7, abertura: 27, fundo: 0.885 },
  retrato: { arq: img('cenario-bancada-retrato.webp'), limpa: img('cenario-bancada-retrato-limpa.webp'), relevo: img('relevo-retrato.png'), aspecto: 1536 / 2752, altura: 0.178, inclina: 4.8, abertura: 30, fundo: 1.43 },
};

// A mesa da cliente: sala clara, luz de janela. Câmera estimada pela xícara e pela borda da mesa.
export const FOTOS_CLIENTE = {
  paisagem: { arq: img('cenario-cliente-paisagem.webp'), aspecto: 2752 / 1536, altura: 0.11, inclina: 2.5, abertura: 27, fundo: 1.47 },
  retrato: { arq: img('cenario-cliente-retrato.webp'), aspecto: 1536 / 2752, altura: 0.15, inclina: 4.0, abertura: 30, fundo: 5.5 },
};

const QMAX = 0.8;           // escala do relevo gravado (ver ia/epico/relevo/relevo.mjs)

const VERT = /* glsl */`
uniform mat4 uRef;
varying vec4 vRef; varying vec3 vMundo;
void main(){
  vec4 m = modelMatrix * vec4(position, 1.);
  vMundo = m.xyz; vRef = uRef * m;
  gl_Position = projectionMatrix * viewMatrix * m;
}`;

const FRAG = /* glsl */`
uniform sampler2D uFoto, uLimpa, uRelevo, uTelaA, uTelaB;
uniform float uTemRelevo, uOpaco, uBorda, uSombra, uFacho;
uniform vec2 uTam; uniform vec3 uFundo;
uniform float uLuz, uFoco, uDesfoque, uChao, uTelaMix, uTelaLuz, uTempo;
uniform vec3 uC, uU, uV, uN, uDirLuz;      // o celular: centro, eixos e a frente; e de onde vem a lâmpada
uniform vec2 uMeia, uMeiaTela;
varying vec4 vRef; varying vec3 vMundo;

float retArred(vec2 p, vec2 meia, float r){ vec2 q = abs(p) - meia + r; return length(max(q, 0.)) + min(max(q.x, q.y), 0.) - r; }

vec3 foto(sampler2D uFoto, vec2 uv, float r, float esc){
  // desfoque em disco: seis amostras, cada uma já suavizada pelo nível de detalhe da textura
  float nivel = max(0., log2(r * uTam.x * .9 * esc));
  vec2 e = vec2(r, r * uTam.x / uTam.y);
  vec3 c = textureLod(uFoto, uv, nivel).rgb * 2.;
  c += textureLod(uFoto, uv + e * vec2( .87,  .5), nivel).rgb;
  c += textureLod(uFoto, uv + e * vec2(-.87,  .5), nivel).rgb;
  c += textureLod(uFoto, uv + e * vec2( 0., -1.), nivel).rgb;
  c += textureLod(uFoto, uv + e * vec2( .87, -.5), nivel).rgb;
  c += textureLod(uFoto, uv + e * vec2(-.87, -.5), nivel).rgb;
  c += textureLod(uFoto, uv + e * vec2( 0.,  1.), nivel).rgb;
  return c / 8.;
}

void main(){
  vec2 uv = vRef.xy / vRef.w * .5 + .5;
  float dist = length(vMundo - cameraPosition);
  // foco no celular: o que está mais perto ou mais longe que ele perde nitidez aos poucos
  float r = uDesfoque * abs(1. / dist - 1. / uFoco);
  vec2 dentro = clamp(uv, vec2(.002), vec2(.998));
  vec3 cor = foto(uFoto, dentro, r, 1.);
  float alfa = 1.;
#ifdef RELEVO
  // as ferramentas em relevo: só o recorte de cada uma, com a foto original
  alfa = smoothstep(.38, .62, texture2D(uRelevo, uv).g);
  if (alfa < .004) discard;
#else
  // onde havia ferramenta, o tampo e a parede usam a versão limpa da foto (a ferramenta está no relevo)
  float limpo = texture2D(uRelevo, dentro).b * uTemRelevo;
  if (limpo > .002) cor = mix(cor, foto(uLimpa, dentro, r, .5), limpo);
  // o alto da foto é fundo escuro liso: perto da borda de cima passa a valer uma versão bem suavizada,
  // para não aparecerem riscos onde a câmera olha acima do que foi fotografado
  cor = mix(cor, textureLod(uFoto, vec2(dentro.x, .95), 6.5).rgb, smoothstep(.9, .995, uv.y));
  // fora da foto: os lados e a base somem no escuro (ou, no cenário que entra por cima da noite, ficam transparentes)
  float fora = max(max(-uv.x, uv.x - 1.), -uv.y);
  if (uBorda > .5) alfa *= 1. - smoothstep(0., .34, fora + .02); else cor = mix(cor, uFundo, smoothstep(0., .1, fora));
#endif

  vec3 base = cor;
  cor *= mix(.035, 1., uLuz);                                   // lâmpada apagada: quase tudo some

  if (uChao > .5) {
    vec3 P = vMundo;
    // sombra do aparelho, projetada da lâmpada, com a borda mais suave quanto mais longe do objeto
    float den = dot(uDirLuz, uN);
    float t = dot(uC - P, uN) / (abs(den) < 1e-4 ? 1e-4 : den);
    if (t > 0.) {
      vec3 h = P + uDirLuz * t - uC;
      float sd = retArred(vec2(dot(h, uU), dot(h, uV)), uMeia, .0115);
      float pen = .0025 + t * .11;
      float s = 1. - smoothstep(-pen, pen, sd);
      cor *= 1. - s * uSombra * uLuz / (1. + t * 1.6);
    }
#ifndef RELEVO
    // escurecimento de contato logo abaixo do aparelho
    vec3 pe = uC - uV * uMeia.y;
    vec3 ao = P - pe; float lado = clamp(dot(ao, uU), -uMeia.x, uMeia.x);
    float dc = length(ao - uU * lado);
    cor *= 1. - .62 * exp(-dc * dc / .00026);
#endif

    // a tela ilumina o tampo à frente dela
    vec3 paraTela = uC - P; float d2 = dot(paraTela, paraTela);
    vec3 dir = paraTela * inversesqrt(d2);
    float frente = max(dot(uN, -dir), 0.);
    vec3 media = mix(textureLod(uTelaA, vec2(.5), 9.).rgb, textureLod(uTelaB, vec2(.5), 9.).rgb, uTelaMix);
#ifdef RELEVO
    float banho = frente * .22 / (d2 + .0035) * .0034 * uTelaLuz;
#else
    float banho = frente * max(dir.y, 0.) / (d2 + .0035) * .0034 * uTelaLuz;
#endif
    cor += media * banho * (base * 5.5 + .028);
#ifndef RELEVO

    // reflexo da tela no tampo, mais borrado quanto mais longe do aparelho
    vec3 olho = normalize(P - cameraPosition);
    vec3 R = vec3(olho.x, -olho.y, olho.z);
    float dr = dot(R, uN);
    float s = dot(uC - P, uN) / (abs(dr) < 1e-4 ? 1e-4 : dr);
    if (s > 0.) {
      vec3 h = P + R * s - uC;
      vec2 q = vec2(dot(h, uU), dot(h, uV));
      float borr = .0012 + s * .16;
      float m = 1. - smoothstep(-borr, borr, retArred(q, uMeiaTela, .009));
      vec2 tuv = clamp(q / (2. * uMeiaTela) + .5, 0., 1.);
      float nivel = 2.2 + log2(1. + s * 520.);
      vec3 tela = mix(textureLod(uTelaA, tuv, nivel).rgb, textureLod(uTelaB, tuv, nivel).rgb, uTelaMix);
      float rasante = pow(clamp(1. - R.y, 0., 1.), 5.);
      cor += tela * m * uTelaLuz * (.06 + .6 * rasante) * exp(-s * 4.2) * 1.15;
    }
#endif
  }
  // facho da lâmpada no ar: vem do alto à esquerda, abre e some antes de chegar ao meio
  vec2 vf = uv - vec2(-.06, 1.12); vec2 df = normalize(vec2(.66, -.75));
  float ao_longo = dot(vf, df), atraves = vf.x * df.y - vf.y * df.x;
  float larg = .05 + ao_longo * .24;
  float facho = exp(-atraves * atraves / (larg * larg)) * exp(-ao_longo * 1.25) * smoothstep(0., .2, ao_longo);
  facho *= .88 + .12 * sin(uTempo * .6 + ao_longo * 7.);
  cor += vec3(1., .6, .26) * facho * .085 * uLuz * mix(1., .35, uChao) * uFacho;
  gl_FragColor = vec4(cor, alfa * uOpaco);
  #include <colorspace_fragment>
}`;

export function criaCenario(texA, texB, fotos = FOTOS, op = {}) {
  const grupo = new THREE.Group();
  const carregador = new THREE.TextureLoader();
  const vazio = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1); vazio.needsUpdate = true;
  const uniforms = {
    uFoto: { value: null }, uLimpa: { value: null }, uRelevo: { value: vazio }, uTemRelevo: { value: 0 }, uOpaco: { value: 1 }, uBorda: { value: op.sobreposto ? 1 : 0 }, uSombra: { value: op.sombra ?? 0.82 }, uFacho: { value: op.sobreposto ? 0 : 1 }, uTelaA: { value: texA }, uTelaB: { value: texB }, uRef: { value: new THREE.Matrix4() },
    uTam: { value: new THREE.Vector2(2752, 1536) }, uFundo: { value: new THREE.Color(op.fundo ?? 0x03090c) },
    uLuz: { value: 0 }, uFoco: { value: 0.5 }, uDesfoque: { value: 0.006 }, uChao: { value: 1 }, uTelaMix: { value: 0 }, uTelaLuz: { value: 0 }, uTempo: { value: 0 },
    uC: { value: new THREE.Vector3() }, uU: { value: new THREE.Vector3(1, 0, 0) }, uV: { value: new THREE.Vector3(0, 1, 0) }, uN: { value: new THREE.Vector3(0, 0, 1) },
    uDirLuz: { value: new THREE.Vector3(-0.72, 0.6, -0.34).normalize() },
    uMeia: { value: new THREE.Vector2(CEL.L / 2, CEL.A / 2) }, uMeiaTela: { value: new THREE.Vector2(CEL.telaL / 2, CEL.telaA / 2) },
  };
  const extra = op.sobreposto ? { transparent: true } : {};
  const matChao = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms, ...extra });
  const matParede = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: { ...uniforms, uChao: { value: 0 } }, ...extra });
  const chao = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), matChao);
  chao.rotation.x = -Math.PI / 2;
  if (op.sobreposto) { chao.renderOrder = -5; }
  const parede = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), matParede);
  if (op.sobreposto) parede.renderOrder = -6;
  grupo.add(chao, parede);
  // as ferramentas: uma malha em relevo, montada a partir da profundidade de cada ponto da foto
  const matRelevo = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: { ...uniforms, uChao: { value: 1 } }, defines: { RELEVO: 1 }, transparent: true });
  const relevo = new THREE.Mesh(new THREE.BufferGeometry(), matRelevo);
  relevo.renderOrder = -1; relevo.frustumCulled = false; relevo.visible = false; grupo.add(relevo);
  const extras = {};

  function carregaImagem(url) { return new Promise((ok, erro) => { const im = new Image(); im.onload = () => ok(im); im.onerror = erro; im.src = url; }); }

  // lê o relevo gravado e levanta cada ponto das ferramentas ao longo do raio da câmera da foto
  async function carregaExtras(nome) {
    const f = fotos[nome];
    const [limpa, im] = await Promise.all([carregador.loadAsync(f.limpa), carregaImagem(f.relevo)]);
    limpa.colorSpace = THREE.SRGBColorSpace; limpa.generateMipmaps = true; limpa.minFilter = THREE.LinearMipmapLinearFilter; limpa.anisotropy = 8;
    const w = im.naturalWidth, h = im.naturalHeight;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const cx = c.getContext('2d', { willReadFrequently: true }); cx.drawImage(im, 0, 0);
    const px = cx.getImageData(0, 0, w, h).data;
    const tex = new THREE.Texture(im); tex.colorSpace = THREE.NoColorSpace; tex.generateMipmaps = false; tex.minFilter = tex.magFilter = THREE.LinearFilter; tex.needsUpdate = true;

    const P = 2, nx = Math.floor((w - 1) / P) + 1, ny = Math.floor((h - 1) / P) + 1;
    const th = rad(f.inclina), tanV = Math.tan(rad(f.abertura / 2)), tanH = tanV * f.aspecto;
    const pos = new Float32Array(nx * ny * 3), dentro = new Uint8Array(nx * ny);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const x = Math.min(w - 1, i * P), y = Math.min(h - 1, j * P), k = (y * w + x) * 4;
      const ax = ((x + 0.5) / w * 2 - 1) * tanH, ay = (1 - (y + 0.5) / h * 2) * tanV;
      const dy = ay * Math.cos(th) - Math.sin(th), dz = -ay * Math.sin(th) - Math.cos(th);
      let t = dy < 0 ? f.altura / -dy : Infinity;
      if (-dz * t > f.fundo) t = f.fundo / -dz;
      t *= 1 - (px[k] / 255) * QMAX;
      pos.set([ax * t, f.altura + dy * t, dz * t], (j * nx + i) * 3);
      dentro[j * nx + i] = px[k + 2] > 0 ? 1 : 0;
    }
    const ind = [];
    for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i, b = a + 1, d = a + nx, e = d + 1;
      if (dentro[a] | dentro[b] | dentro[d] | dentro[e]) ind.push(a, d, b, b, d, e);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setIndex(ind);
    return { limpa, tex, geo };
  }

  const texturas = {};
  const ref = new THREE.PerspectiveCamera();
  let atual = null;

  async function usar(nome) {
    if (atual === nome) return fotos[nome];
    atual = nome;
    const f = fotos[nome];
    texturas[nome] ??= carregador.loadAsync(f.arq).then((t) => {
      t.colorSpace = THREE.SRGBColorSpace; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.anisotropy = 8;
      return t;
    });
    const tex = await texturas[nome];
    if (atual !== nome) return f;
    uniforms.uFoto.value = tex; uniforms.uTam.value.set(tex.image.width, tex.image.height);
    // o relevo chega depois da foto: até lá a bancada aparece plana, como na foto
    relevo.visible = false; uniforms.uTemRelevo.value = 0;
    if (f.relevo) (extras[nome] ??= carregaExtras(nome)).then((x) => {
      if (atual !== nome) return;
      uniforms.uLimpa.value = x.limpa; uniforms.uRelevo.value = x.tex; uniforms.uTemRelevo.value = 1;
      relevo.geometry = x.geo; relevo.visible = true;
    }).catch(() => {});
    // a câmera de referência: de onde a foto foi tirada
    ref.fov = f.abertura; ref.aspect = f.aspecto; ref.near = 0.05; ref.far = 30;
    const o = op.origem ?? { x: 0, y: 0, z: 0 };       // onde este cenário fica no mundo
    ref.position.set(o.x, o.y + f.altura, o.z); ref.rotation.set(-rad(f.inclina), 0, 0);
    ref.updateProjectionMatrix(); ref.updateMatrixWorld(true);
    uniforms.uRef.value.multiplyMatrices(ref.projectionMatrix, ref.matrixWorldInverse);
    // tampo da frente da câmera até a borda do fundo; parede a partir dali
    const larg = 8, perto = 0.12;
    chao.scale.set(larg, f.fundo - perto, 1); chao.position.set(o.x, o.y, o.z - (f.fundo + perto) / 2);
    const altP = Math.max(4, f.fundo * 1.2);
    parede.scale.set(Math.max(larg, f.fundo * 2.2), altP, 1); parede.position.set(o.x, o.y + altP / 2 - 0.4, o.z - f.fundo);
    return f;
  }
  return { grupo, uniforms, usar, fotos };
}
