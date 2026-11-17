// O celular, modelado em código: moldura de metal com cantos arredondados, vidro frontal, tela acesa com as
// capturas reais do app, câmera frontal, botões laterais e a traseira com o módulo das câmeras.
// Medidas em metros, origem no centro do aparelho, tela virada para +z.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { LARG, ALT } from './telas.js';

export const CEL = (() => {
  const telaL = 0.0708, telaA = telaL * (ALT / LARG);   // a tela tem a proporção exata das capturas
  const borda = 0.0011, chanfro = 0.0013;
  const L = telaL + 2 * (borda + chanfro), A = telaA + 2 * (borda + chanfro);
  return { L, A, E: 0.0083, raio: 0.0122, chanfro, borda, telaL, telaA, raioTela: 0.0098 };
})();

function retangulo(l, a, r) {
  const s = new THREE.Shape(), x = -l / 2, y = -a / 2;
  s.moveTo(x + r, y); s.lineTo(x + l - r, y); s.absarc(x + l - r, y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x + l, y + a - r); s.absarc(x + l - r, y + a - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + a); s.absarc(x + r, y + a - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + r); s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}
const chapa = (l, a, r) => new THREE.ShapeGeometry(retangulo(l, a, r), 28);

const VERT_TELA = /* glsl */`
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`;

// A tela: duas capturas e a passagem entre elas (troca de aba, entrar e voltar), a onda do toque e o acender.
const FRAG_TELA = /* glsl */`
uniform sampler2D uA, uB;
uniform float uT, uModo, uLiga, uBrilho, uProporcao, uPulso, uTempo;
uniform vec3 uToque;
varying vec2 vUv;
void main(){
  vec2 uv = vUv; vec3 c;
  if (uModo < .5) {
    c = mix(texture2D(uA, uv).rgb, texture2D(uB, uv).rgb, uT);
  } else if (uModo < 1.5) {                       // entrar: a nova vem da direita por cima da atual
    float corte = 1. - uT;
    vec3 a = texture2D(uA, vec2(uv.x + uT * .26, uv.y)).rgb * (1. - uT * .45);
    vec3 b = texture2D(uB, vec2(uv.x - corte, uv.y)).rgb;
    float sombra = (1. - smoothstep(0., .07, corte - uv.x)) * step(uv.x, corte) * (1. - uT) * .55;
    c = uv.x >= corte ? b : a * (1. - sombra);
  } else {                                        // voltar: a atual sai para a direita e mostra a de baixo
    float corte = uT;
    vec3 a = texture2D(uA, vec2(uv.x - corte, uv.y)).rgb;
    vec3 b = texture2D(uB, vec2(uv.x + (1. - uT) * .26, uv.y)).rgb * (.55 + .45 * uT);
    float sombra = (1. - smoothstep(0., .07, corte - uv.x)) * step(uv.x, corte) * (1. - uT) * .55;
    c = uv.x >= corte ? a : b * (1. - sombra);
  }
  // onda do toque
  float d = length((uv - uToque.xy) * vec2(1., uProporcao));
  float raio = .03 + uToque.z * .55;
  float onda = (1. - smoothstep(raio - .05, raio, d)) * (1. - smoothstep(.05, .5, uToque.z));
  c = mix(c, vec3(.30, .52, .72), onda * .26);
  // convite: um anel âmbar se abre em volta do botão Novo orçamento
  vec2 pb = abs((uv - vec2(.683, .1495)) * vec2(1., uProporcao)) - vec2(.262, .068) + .06;
  float sb = length(max(pb, 0.)) + min(max(pb.x, pb.y), 0.) - .06;
  float fase = fract(uTempo * .5);
  float anel = (1. - smoothstep(0., .011, abs(sb - .004 - fase * .06))) * (1. - fase) * (1. - fase);
  c = mix(c, vec3(1., .62, .12), anel * .85 * uPulso);
  // acender: sobe do preto com um clarão curto
  float l = smoothstep(0., 1., uLiga);
  c = c * l + vec3(.55, .7, .9) * l * (1. - l) * 1.6;
  gl_FragColor = vec4(c * uBrilho, 1.);
  #include <colorspace_fragment>
}`;

export function criaCelular(texA, texB) {
  const g = new THREE.Group();
  const { L, A, E, raio, chanfro, borda, telaL, telaA, raioTela } = CEL;
  const zf = E / 2;

  // Corpo: perfil arredondado na frente e atrás, como uma moldura de metal usinado
  const corpoGeo = new THREE.ExtrudeGeometry(retangulo(L - 2 * chanfro, A - 2 * chanfro, raio - chanfro), {
    depth: E - 2 * chanfro, bevelEnabled: true, bevelThickness: chanfro, bevelSize: chanfro, bevelSegments: 7, curveSegments: 28,
  });
  corpoGeo.translate(0, 0, -(E - 2 * chanfro) / 2);
  const metal = new THREE.MeshStandardMaterial({ color: 0x565b63, metalness: 1, roughness: 0.3, envMapIntensity: 1.5 });
  const corpo = new THREE.Mesh(corpoGeo, metal);
  g.add(corpo);

  // Vidro frontal (a borda preta em volta da tela)
  const vidroPreto = new THREE.MeshPhysicalMaterial({ color: 0x020304, metalness: 0, roughness: 0.07, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1 });
  const frente = new THREE.Mesh(chapa(L - 2 * chanfro, A - 2 * chanfro, raio - chanfro), vidroPreto);
  frente.position.z = zf + 0.00004; g.add(frente);

  // Tela
  const telaGeo = chapa(telaL, telaA, raioTela);
  { // uv de 0 a 1 na tela inteira
    const p = telaGeo.attributes.position, uv = telaGeo.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / telaL + 0.5, p.getY(i) / telaA + 0.5);
  }
  const matTela = new THREE.ShaderMaterial({
    vertexShader: VERT_TELA, fragmentShader: FRAG_TELA,
    uniforms: {
      uA: { value: texA }, uB: { value: texB }, uT: { value: 0 }, uModo: { value: 0 }, uLiga: { value: 0 }, uBrilho: { value: 1.0 },
      uProporcao: { value: ALT / LARG }, uPulso: { value: 0 }, uTempo: { value: 0 }, uToque: { value: new THREE.Vector3(0.5, 0.5, 9) },
    },
  });
  const tela = new THREE.Mesh(telaGeo, matTela);
  tela.position.z = zf + 0.00010; g.add(tela);

  // Reflexo do vidro por cima da tela: só soma o que o ambiente reflete, e corre conforme o aparelho gira
  const reflexo = new THREE.Mesh(telaGeo, new THREE.MeshPhysicalMaterial({
    color: 0x000000, metalness: 0, roughness: 0.03, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, envMapIntensity: 1.45,
  }));
  reflexo.position.z = zf + 0.00016; g.add(reflexo);

  // Câmera frontal: furo na tela com um brilho de lente
  const furoY = telaA / 2 - 0.0029;
  const furo = new THREE.Mesh(new THREE.CircleGeometry(0.00172, 28), new THREE.MeshBasicMaterial({ color: 0x010203 }));
  furo.position.set(0, furoY, zf + 0.0002); g.add(furo);
  const lente = new THREE.Mesh(new THREE.CircleGeometry(0.00078, 20), new THREE.MeshPhysicalMaterial({ color: 0x0a1626, roughness: 0.1, clearcoat: 1, envMapIntensity: 2.2 }));
  lente.position.set(0, furoY, zf + 0.00024); g.add(lente);

  // Botões na lateral direita
  const botao = (alt, y) => {
    const m = new THREE.Mesh(new RoundedBoxGeometry(0.0013, alt, 0.0026, 3, 0.0006), metal);
    m.position.set(L / 2 + 0.00018, y, 0); g.add(m);
  };
  botao(0.0125, 0.018); botao(0.024, 0.047);

  // Entrada USB e saídas de som embaixo
  const escuro = new THREE.MeshBasicMaterial({ color: 0x030405 });
  const usb = new THREE.Mesh(new RoundedBoxGeometry(0.0088, 0.0006, 0.0028, 3, 0.0003), escuro);
  usb.position.set(0, -A / 2 + 0.0001, 0); g.add(usb);
  for (let i = 0; i < 5; i++) {
    const f = new THREE.Mesh(new THREE.CylinderGeometry(0.00055, 0.00055, 0.0006, 10), escuro);
    f.position.set(0.0125 + i * 0.0024, -A / 2 + 0.0001, 0); g.add(f);
  }

  // Traseira: vidro fosco azul-petróleo e o módulo das câmeras
  const costas = new THREE.Mesh(chapa(L - 2 * chanfro, A - 2 * chanfro, raio - chanfro), new THREE.MeshPhysicalMaterial({
    color: 0x0c1c24, metalness: 0.15, roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.35, envMapIntensity: 0.9,
  }));
  costas.rotation.y = Math.PI; costas.position.z = -zf - 0.00004; g.add(costas);
  const modulo = new THREE.Mesh(new RoundedBoxGeometry(0.031, 0.031, 0.0022, 5, 0.0011), new THREE.MeshPhysicalMaterial({
    color: 0x101418, metalness: 0.6, roughness: 0.28, clearcoat: 0.6, envMapIntensity: 1.1,
  }));
  modulo.position.set(L / 2 - 0.024, A / 2 - 0.025, -zf - 0.0009); g.add(modulo);
  const aro = new THREE.MeshStandardMaterial({ color: 0x3a3f46, metalness: 1, roughness: 0.25 });
  const cristal = new THREE.MeshPhysicalMaterial({ color: 0x02050a, roughness: 0.05, clearcoat: 1, envMapIntensity: 2.4 });
  for (const [dx, dy, r] of [[-0.0065, 0.0062, 0.0056], [0.0062, -0.0062, 0.0056], [0.0068, 0.0072, 0.0024]]) {
    const a = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.0012, 36), aro);
    a.rotation.x = Math.PI / 2; a.position.set(modulo.position.x + dx, modulo.position.y + dy, -zf - 0.0021); g.add(a);
    const v = new THREE.Mesh(new THREE.CircleGeometry(r * 0.78, 32), cristal);
    v.rotation.y = Math.PI; v.position.set(a.position.x, a.position.y, -zf - 0.00272); g.add(v);
  }

  return { grupo: g, tela, matTela, metal };
}

// Ambiente de estúdio só para os reflexos: caixa de luz âmbar no alto à esquerda, faixa fria à direita e um
// teto suave. Não aparece na cena; é o que o vidro e o metal do aparelho refletem.
export function criaAmbiente(renderer) {
  const cena = new THREE.Scene();
  cena.background = new THREE.Color(0x030608);
  const luz = (cor, forca, l, a, pos) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(l, a), new THREE.MeshBasicMaterial({ color: new THREE.Color(cor).multiplyScalar(forca), side: THREE.DoubleSide }));
    m.position.set(...pos); m.lookAt(0, 0, 0); cena.add(m);
  };
  luz(0xffb060, 11, 2.4, 1.5, [-3.0, 2.6, -1.6]);    // a lâmpada de trabalho, atrás e à esquerda
  luz(0xffc078, 2.6, 0.7, 2.6, [-3.4, 0.5, 2.6]);    // rebatida âmbar na frente, à esquerda
  luz(0x9cc6ff, 2.4, 0.45, 3.2, [3.5, 0.9, 1.0]);    // faixa fria à direita
  luz(0xdbe8ff, 1.0, 3.2, 1.0, [0.6, 3.6, 2.6]);     // teto suave na frente
  luz(0x6f8aa6, 0.5, 6, 0.5, [0, -1.6, 3]);          // rebatida fraca da bancada
  luz(0xcfe0ff, 1.15, 2.4, 1.3, [-1.8, 1.9, 3.4]);    // janela suave à frente: é o que o vidro da tela reflete
  luz(0xffb060, 7, 0.22, 2.6, [-3.2, 0.2, 0.9]);     // fio de luz âmbar que desenha a lateral esquerda
  luz(0xa9d0ff, 6, 0.22, 2.6, [3.2, 0.3, 0.5]);      // fio de luz frio que desenha a lateral direita
  const pmrem = new THREE.PMREMGenerator(renderer);
  const mapa = pmrem.fromScene(cena, 0.025).texture;
  pmrem.dispose();
  return mapa;
}
