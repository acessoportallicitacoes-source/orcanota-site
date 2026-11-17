// Os dois personagens: corpo rigado (Quaternius, CC0), roupa em "casca" sobre o corpo, acessórios feitos em
// geometria (capacete, cinto de ferramentas, botas, chinelos) e a pose: postura em pé com respiração, um braço
// segurando o celular e o outro em descanso, tudo resolvido por cinemática inversa a cada quadro.
import * as THREE from 'three';
import { glslCor } from './util.js';

const AZUL = '#0E5A8A';
const AMBAR = '#F5A30A';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const Q = () => new THREE.Quaternion();
const CIMA = V(0, 1, 0);

// Mapa de normais de tecido (trama fina), gerado uma vez e repetido sobre o UV do corpo.
let tramaCache = null;
function texturaTrama() {
  if (tramaCache) return tramaCache;
  const n = 64;
  const alt = (x, y) => {
    const fx = Math.sin((x / n) * Math.PI * 2 * 8), fy = Math.sin((y / n) * Math.PI * 2 * 8);
    return 0.5 + 0.25 * fx * (((y >> 2) & 1) ? 1 : -1) + 0.25 * fy * (((x >> 2) & 1) ? 1 : -1);
  };
  const dados = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const dx = alt((x + 1) % n, y) - alt((x + n - 1) % n, y);
    const dy = alt(x, (y + 1) % n) - alt(x, (y + n - 1) % n);
    const v = V(-dx * 1.6, -dy * 1.6, 1).normalize();
    const i = (y * n + x) * 4;
    dados[i] = (v.x * 0.5 + 0.5) * 255; dados[i + 1] = (v.y * 0.5 + 0.5) * 255; dados[i + 2] = (v.z * 0.5 + 0.5) * 255; dados[i + 3] = 255;
  }
  const t = new THREE.DataTexture(dados, n, n);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(110, 110);
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
  t.needsUpdate = true;
  tramaCache = t;
  return t;
}

// ---------------------------------------------------------------------------------------------------------------
// Roupas. Cada peça é uma cópia dos triângulos do corpo, afastada pela normal (a "folga" do tecido), que acompanha
// o esqueleto. O desenho da peça (barra, gola, manga, faixas) é decidido por fragmento na posição de repouso
// (pose T): x para os lados, y para cima, z para a frente. A normal é alisada para o tecido não copiar a anatomia.
// ---------------------------------------------------------------------------------------------------------------
const GLSL_COMUM = /* glsl */ `
float tBraco(vec3 r) { return (abs(r.x) - OMBRO_X) / BRACO; }      // 0 no ombro, 1 no pulso
float linhaGola(vec3 r) { return GOLA - max(0.0, r.z) * DECOTE * (1.0 - smoothstep(0.0, 0.085, abs(r.x))); }
// afina um pouco os braços do corpo-base (que é de super-herói)
float magro(vec3 r) { float t = tBraco(r); return AFINA * smoothstep(-0.06, 0.1, t) * (1.0 - smoothstep(0.8, 0.96, t)); }
vec3 radialPerna(vec3 r) { return normalize(vec3(r.x - sign(r.x) * abs(COXA_X), 0.0, r.z + 0.01)); }
vec3 radialTronco(vec3 r) { return normalize(vec3(r.x * 0.72, 0.0, r.z - TRONCO_Z)); }
`;

const calcaVert = (justa, solta) => /* glsl */ `
  vec3 lisa(vec3 r, vec3 n) { float k = smoothstep(CINTURA - 0.1, CINTURA - 0.26, r.y) * 0.62; return normalize(mix(n, radialPerna(r), k)); }
  vec3 veste(vec3 r, vec3 n) { return r + lisa(r, n) * mix(${solta}, ${justa}, smoothstep(TORNOZELO + 0.02, JOELHO + 0.18, r.y)); }`;

const ROUPAS = {
  eletricista: {
    medidas: { MANGA: 0.44, DECOTE: 0.25, BARRA: -0.03, AFINA: 0.008 },
    coberto: /* glsl */ `
      bool coberto(vec3 r) {
        float t = tBraco(r);
        if (t >= 0.0) return t < MANGA - 0.07;
        return r.y < linhaGola(r) - 0.03;
      }`,
    pecas: [
      {
        nome: 'calca', rug: 0.9,
        dentro: (r, m) => r.y < m.CINTURA + 0.08 && r.y > m.TORNOZELO - 0.05,
        vert: calcaVert('0.02', '0.04'),
        glsl: /* glsl */ `
          void roupa(vec3 r, inout vec3 cor, inout float rug, inout vec3 emis) {
            if (r.y > CINTURA + 0.03 || r.y < TORNOZELO + 0.035 || tBraco(r) > 0.3) discard;
            cor = ${glslCor('#1D2B3C')}; rug = 0.9;
            float joelho = smoothstep(0.12, 0.09, abs(r.y - JOELHO)) * step(0.0, r.z);
            cor *= mix(1.0, 0.82, joelho);
            float bolso = step(abs(r.y - (JOELHO + 0.2)), 0.07) * step(0.035, abs(r.x) - abs(COXA_X));
            cor *= mix(1.0, 0.84, bolso);
          }`,
      },
      {
        nome: 'camisa', rug: 0.82,
        dentro: (r, m) => r.y > m.CINTURA - 0.12 && r.y < m.GOLA + 0.06 && r.t < m.MANGA + 0.1,
        vert: /* glsl */ `
          vec3 lisa(vec3 r, vec3 n) {
            float k = 0.42 * (1.0 - smoothstep(PEITO + 0.02, PEITO + 0.14, r.y)) * (1.0 - smoothstep(-0.2, 0.0, tBraco(r)));
            return normalize(mix(n, radialTronco(r), k));
          }
          vec3 veste(vec3 r, vec3 n) {
            float y = r.y - CINTURA;
            float f = 0.016 + 0.011 * smoothstep(0.0, 0.1, y) * (1.0 - smoothstep(0.16, PEITO - CINTURA + 0.04, y));
            f = mix(f, 0.02, smoothstep(-0.05, 0.02, tBraco(r)));
            return r + lisa(r, n) * (f - magro(r));
          }`,
        glsl: /* glsl */ `
          void roupa(vec3 r, inout vec3 cor, inout float rug, inout vec3 emis) {
            float ax = abs(r.x), t = tBraco(r);
            if (t > MANGA) discard;
            float gola = linhaGola(r);
            if (t < 0.0 && (r.y < CINTURA + BARRA || r.y > gola)) discard;
            cor = ${glslCor(AZUL)}; rug = 0.82;
            vec3 prata = ${glslCor('#C9D3DD')}; vec3 ambar = ${glslCor(AMBAR)};
            // punho da manga e gola em azul mais fechado
            cor *= mix(1.0, 0.66, smoothstep(MANGA - 0.055, MANGA - 0.05, t));
            if (t < 0.0) {
              cor *= mix(1.0, 0.66, smoothstep(gola - 0.034, gola - 0.03, r.y));
              // carcela dos botões e bolso do peito
              if (r.z > 0.0 && ax < 0.013 && r.y > gola - 0.2) cor *= 0.8;
              vec2 b = vec2(r.x - 0.085, r.y - (PEITO - 0.005));
              float db = max(abs(b.x) - 0.045, abs(b.y) - 0.05);
              if (r.z > 0.0 && db < 0.0 && (db > -0.005 || abs(b.y - 0.025) < 0.003)) cor *= 0.72;
              // faixa refletiva com vivo âmbar, no tronco
              float fy = abs(r.y - (CINTURA + 0.2));
              float prataM = smoothstep(0.021, 0.019, fy), vivo = smoothstep(0.03, 0.028, fy);
              cor = mix(cor, ambar, vivo); cor = mix(cor, prata, prataM);
              rug = mix(rug, 0.38, prataM);
            } else {
              float ft = abs(t - (MANGA - 0.13));
              float prataM = smoothstep(0.03, 0.027, ft), vivo = smoothstep(0.044, 0.041, ft);
              cor = mix(cor, ambar, vivo); cor = mix(cor, prata, prataM);
              rug = mix(rug, 0.38, prataM);
            }
          }`,
      },
    ],
  },
  cliente: {
    medidas: { MANGA: 0.36, DECOTE: 0.95, BARRA: -0.075, AFINA: 0.005 },
    coberto: /* glsl */ `
      bool coberto(vec3 r) {
        float t = tBraco(r);
        if (t >= 0.0) return t < MANGA - 0.07;
        return r.y < linhaGola(r) - 0.03 && r.y > TORNOZELO + 0.08;
      }`,
    pecas: [
      {
        nome: 'calca', rug: 0.85,
        dentro: (r, m) => r.y < m.CINTURA + 0.08 && r.y > m.TORNOZELO - 0.02,
        vert: calcaVert('0.008', '0.024'),
        glsl: /* glsl */ `
          void roupa(vec3 r, inout vec3 cor, inout float rug, inout vec3 emis) {
            if (r.y > CINTURA + 0.03 || r.y < TORNOZELO + 0.05 || tBraco(r) > 0.3) discard;
            cor = ${glslCor('#62748A')}; rug = 0.86;
            cor *= mix(1.0, 0.8, smoothstep(TORNOZELO + 0.085, TORNOZELO + 0.075, r.y));
          }`,
      },
      {
        nome: 'blusa', rug: 0.9,
        dentro: (r, m) => r.y > m.CINTURA - 0.18 && r.y < m.GOLA + 0.06 && r.t < m.MANGA + 0.1,
        vert: /* glsl */ `
          vec3 lisa(vec3 r, vec3 n) {
            float k = 0.7 * (1.0 - smoothstep(PEITO - 0.05, PEITO + 0.08, r.y)) * (1.0 - smoothstep(-0.2, 0.0, tBraco(r)));
            return normalize(mix(n, radialTronco(r), k));
          }
          vec3 veste(vec3 r, vec3 n) {
            vec3 p = r + n * (0.018 - magro(r));
            // do busto para baixo o tecido cai reto: raio mínimo de um tubo elíptico em volta do tronco
            float k = smoothstep(PEITO + 0.02, PEITO - 0.1, r.y) * (1.0 - smoothstep(-0.12, 0.0, tBraco(r)));
            vec2 c = vec2(0.0, TUBO_CZ), d = p.xz - c; float len = max(length(d), 0.0001); vec2 u = d / len;
            float raio = (TUBO_X * TUBO_Z) / sqrt(TUBO_Z * TUBO_Z * u.x * u.x + TUBO_X * TUBO_X * u.y * u.y);
            raio *= mix(0.9, 1.0, abs(u.x)) * (1.0 + 0.04 * smoothstep(PEITO - 0.1, CINTURA - 0.08, r.y));
            p.xz = c + u * mix(len, max(len, raio), k);
            return p;
          }`,
        glsl: /* glsl */ `
          void roupa(vec3 r, inout vec3 cor, inout float rug, inout vec3 emis) {
            float t = tBraco(r);
            if (t > MANGA) discard;
            float gola = linhaGola(r);
            if (t < 0.0 && (r.y < CINTURA + BARRA || r.y > gola)) discard;
            cor = ${glslCor('#E2DBCD')}; rug = 0.9;
            cor *= mix(1.0, 0.86, smoothstep(MANGA - 0.03, MANGA - 0.026, t));
            if (t < 0.0) {
              cor *= mix(1.0, 0.86, smoothstep(gola - 0.016, gola - 0.013, r.y));
              cor *= mix(0.86, 1.0, smoothstep(CINTURA + BARRA + 0.012, CINTURA + BARRA + 0.016, r.y));
            }
          }`,
      },
    ],
  },
};

function instalaRoupa(mat, defs, peca) {
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vRepouso;\n${defs}\n${GLSL_COMUM}\n${peca.vert}`)
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nobjectNormal = lisa(position, objectNormal);')
      .replace('#include <begin_vertex>', 'vec3 transformed = veste(position, normalize(normal));\nvRepouso = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vRepouso;\n${defs}\n${GLSL_COMUM}\n${peca.glsl}`)
      .replace('#include <color_fragment>', '#include <color_fragment>\nvec3 rCor = diffuseColor.rgb; float rRug = 1.0; vec3 rEmis = vec3(0.0);\nroupa(vRepouso, rCor, rRug, rEmis);\ndiffuseColor.rgb = rCor;')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = rRug;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += rEmis;');
  };
  mat.customProgramCacheKey = () => 'roupa:' + peca.nome + ':' + defs;
}

function instalaPele(mat, defs, glslCoberto) {
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vRepouso;\n${defs}\n${GLSL_COMUM}`)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRepouso = position;\ntransformed -= normalize(normal) * magro(position);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vRepouso;\n${defs}\n${GLSL_COMUM}\n${glslCoberto}`)
      .replace('#include <color_fragment>', '#include <color_fragment>\nif (coberto(vRepouso)) discard;');
  };
  mat.customProgramCacheKey = () => 'pele:' + defs;
}

// ---------------------------------------------------------------------------------------------------------------
// Acessórios em geometria
// ---------------------------------------------------------------------------------------------------------------
function sombras(g) { g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); return g; }

function criaCapacete(cab) {
  const g = new THREE.Group();
  const mat = new THREE.MeshPhysicalMaterial({ color: 0xe0900a, roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.3, envMapIntensity: 0.7 });
  const rx = cab.largura / 2 + 0.019, rz = cab.fundo / 2 + 0.018, h = 0.108;
  const perfil = [];
  for (let i = 0; i <= 18; i++) { const a = (i / 18) * Math.PI / 2; perfil.push(new THREE.Vector2(Math.cos(a) ** 0.9, Math.sin(a) ** 0.82)); }
  const casco = new THREE.Mesh(new THREE.LatheGeometry(perfil, 44), mat);
  casco.scale.set(rx, h, rz);
  // aba fina em volta e pala na frente
  const aba = new THREE.Mesh(new THREE.TorusGeometry(1, 0.035, 8, 44), mat);
  aba.rotation.x = Math.PI / 2; aba.scale.set(rx * 1.01, rz * 1.01, 0.16);
  const forma = new THREE.Shape();
  forma.absellipse(0, 0, rx * 0.96, 0.058, 0, Math.PI, false);
  const pala = new THREE.Mesh(new THREE.ExtrudeGeometry(forma, { depth: 0.005, bevelEnabled: true, bevelSize: 0.003, bevelThickness: 0.002, bevelSegments: 2, curveSegments: 20 }), mat);
  pala.rotation.x = Math.PI / 2 + 0.2; pala.position.set(0, 0.004, rz * 0.88);
  // nervuras no alto do casco
  for (const dx of [-0.026, 0, 0.026]) {
    const k = Math.sqrt(1 - (dx / rx) ** 2);
    const n = new THREE.Mesh(new THREE.TorusGeometry(1, 0.045, 6, 28, Math.PI), mat);
    n.rotation.y = Math.PI / 2; n.scale.set(rz * 0.985 * k, h * k, 0.11); n.position.set(dx, 0.002, 0);
    g.add(n);
  }
  // carneira escura por dentro, para não ver "através" do casco
  const dentro = new THREE.Mesh(new THREE.LatheGeometry(perfil, 24), new THREE.MeshStandardMaterial({ color: 0x15120e, roughness: 0.9, side: THREE.BackSide }));
  dentro.scale.set(rx * 0.97, h * 0.97, rz * 0.97);
  g.add(casco, aba, pala, dentro);
  g.position.set(cab.cx, cab.topo - h + 0.012, cab.cz - 0.004);
  g.rotation.x = -0.07;
  return sombras(g);
}

function criaCinto(cin) {
  const g = new THREE.Group();
  const couro = new THREE.MeshStandardMaterial({ color: 0x4a2f1a, roughness: 0.7 });
  const couroEscuro = new THREE.MeshStandardMaterial({ color: 0x2f1d10, roughness: 0.75 });
  const metal = new THREE.MeshStandardMaterial({ color: 0xb9c2cb, roughness: 0.3, metalness: 1 });
  const rx = cin.rx + 0.03, rz = cin.rz + 0.03;
  const faixa = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.05, 48, 1, true), new THREE.MeshStandardMaterial({ color: 0x4a2f1a, roughness: 0.7, side: THREE.DoubleSide }));
  faixa.scale.set(rx, 1, rz);
  const fivela = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.042, 0.008), metal);
  fivela.position.set(0, 0, rz + 0.002);
  g.add(faixa, fivela);

  // Bolsa de couro com ferramentas, uma de cada lado.
  const bolsa = (lado) => {
    const b = new THREE.Group();
    const corpo = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.17, 0.055), couro);
    corpo.position.y = -0.1;
    const frente = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.03), couroEscuro);
    frente.position.set(0, -0.125, 0.04);
    const aba = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.03, 0.012), couroEscuro);
    aba.position.set(0, -0.012, 0.022);
    for (const x of [-0.06, 0.06]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.014, 10), metal); r.rotation.x = Math.PI / 2; r.position.set(x, -0.03, 0.03); b.add(r); }
    b.add(corpo, frente, aba);
    const cabo = (x, z, cor, alt, raio = 0.011) => {
      const c = new THREE.Mesh(new THREE.CapsuleGeometry(raio, alt, 4, 10), new THREE.MeshStandardMaterial({ color: cor, roughness: 0.45 }));
      c.position.set(x, -0.015 + alt / 2, z); c.rotation.z = (x * 1.6);
      const haste = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.05, 6), metal);
      haste.position.set(x, -0.04, z);
      b.add(c, haste);
    };
    if (lado > 0) { cabo(-0.045, 0.048, 0xe0900a, 0.07); cabo(-0.012, 0.05, 0xb0332a, 0.06); cabo(0.03, 0.05, 0x0e5a8a, 0.075, 0.008); cabo(0.048, 0.05, 0x0e5a8a, 0.075, 0.008); }
    else {
      cabo(0.04, 0.048, 0x1f1f1f, 0.085, 0.012); cabo(0.0, 0.05, 0xe0900a, 0.06);
      const trena = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.03), new THREE.MeshStandardMaterial({ color: 0xe0900a, roughness: 0.4 }));
      trena.position.set(-0.04, -0.03, 0.062); b.add(trena);
    }
    const ang = lado * 1.25;
    b.position.set(Math.sin(ang) * (rx + 0.022), -0.005, Math.cos(ang) * (rz + 0.022));
    b.rotation.y = ang;
    return b;
  };
  g.add(bolsa(1), bolsa(-1));
  g.position.set(cin.cx, cin.y, cin.cz);
  return sombras(g);
}

// Bota de trabalho simples: sola, gáspea e cano. Origem no tornozelo, bico para +z.
function criaBota(comp, altTornozelo) {
  const g = new THREE.Group();
  const couro = new THREE.MeshStandardMaterial({ color: 0x2b2018, roughness: 0.55 });
  const borracha = new THREE.MeshStandardMaterial({ color: 0x0d0c0b, roughness: 0.9 });
  const sola = new THREE.Mesh(new THREE.CapsuleGeometry(0.052, comp - 0.1, 4, 14), borracha);
  sola.rotation.x = Math.PI / 2; sola.scale.set(1, 1, 0.3); sola.position.set(0, -altTornozelo + 0.016, comp * 0.5 - 0.085);
  const gaspea = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), couro);
  gaspea.scale.set(0.052, 0.046, comp * 0.36); gaspea.position.set(0, -altTornozelo + 0.058, comp * 0.5 - 0.02);
  const calcanhar = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), couro);
  calcanhar.scale.set(0.05, 0.062, 0.062); calcanhar.position.set(0, -altTornozelo + 0.07, -0.02);
  const cano = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.05, 0.13, 16), couro);
  cano.position.set(0, 0.0, -0.012);
  g.add(sola, gaspea, calcanhar, cano);
  return sombras(g);
}

function criaChinelo() {
  const g = new THREE.Group();
  const sola = new THREE.Mesh(new THREE.CapsuleGeometry(0.048, 0.15, 4, 12), new THREE.MeshStandardMaterial({ color: 0xc8744a, roughness: 0.8 }));
  sola.rotation.x = Math.PI / 2; sola.scale.set(1, 1, 0.16);
  const tira = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.006, 6, 14, Math.PI), new THREE.MeshStandardMaterial({ color: 0xefe9dd, roughness: 0.7 }));
  tira.position.set(0, 0.006, 0.05); tira.scale.set(1, 0.75, 1);
  g.add(sola, tira);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// ---------------------------------------------------------------------------------------------------------------
export class Personagem {
  /**
   * @param {object} o
   * @param {'eletricista'|'cliente'} o.tipo
   * @param {object} o.gltf corpo rigado
   * @param {object[]} o.cabelos glTFs de cabelo/barba, rigados no mesmo esqueleto
   * @param {'r'|'l'} o.mao mão que segura o celular
   */
  constructor({ tipo, gltf, cabelos = [], mao = 'r', pele = 0xffffff, cabelo = 0x241a14, fase = 0, celular }) {
    this.tipo = tipo;
    this.mao = mao;
    this.outra = mao === 'r' ? 'l' : 'r';
    this.grupo = new THREE.Group();
    this.raiz = gltf.scene;
    this.grupo.add(this.raiz);
    this.celular = celular;                       // Object3D do celular (filho do grupo)
    this.celLocal = V(0, 1.3, 0.3);               // centro do celular no espaço do personagem
    this.inclina = 0.0;                           // inclinação extra da tela (para cima)
    this.giro = 0.35;                             // ângulo dos dedos em relação à largura do aparelho
    this.dedos = { base: 0.38, meio: 1.0, ponta: 0.6, polegarAbre: 1.0, polegarFecha: 0.45 };
    this.dobra = { index: 1, middle: 1, ring: -0.15, pinky: -0.3 };   // quanto cada dedo dobra em volta da borda
    this.fundo = 0.045;                           // quanto o pulso fica atrás do plano da tela
    this.pega = 0.82;                             // distância do pulso ao centro do aparelho, em palmos
    this.toque = 0;                               // 0..1, o polegar desce para tocar
    this.olhar = 0.5;                             // quanto a cabeça baixa para a tela
    this.vivo = 1;                                // 0 desliga a respiração (prefers-reduced-motion)
    if (celular) { this.grupo.add(celular); celular.scale.setScalar(1.1); }

    const malhas = [];
    this.raiz.traverse((o) => { if (o.isSkinnedMesh) malhas.push(o); });
    malhas.sort((a, b) => b.geometry.attributes.position.count - a.geometry.attributes.position.count);
    const corpo = this.corpo = malhas[0];
    this.esqueleto = corpo.skeleton;
    this.osso = Object.fromEntries(this.esqueleto.bones.map((b) => [b.name, b]));

    for (const m of malhas) {
      m.frustumCulled = false; m.castShadow = true; m.receiveShadow = true;
      const mat = m.material;
      mat.metalness = 0; mat.metalnessMap = null; mat.envMapIntensity = 0.7;
      if (m === corpo) { mat.color.set(pele); mat.roughness = 0.92; mat.normalScale?.set(0.8, 0.8); }
      else if (/eye/i.test(mat.name)) { mat.roughness = 0.12; mat.roughnessMap = null; mat.envMapIntensity = 1.6; m.castShadow = false; }
      else { mat.color.set(cabelo).lerp(new THREE.Color(0x6b4a36), 0.35); mat.roughness = 0.75; }
    }
    for (const c of cabelos) {
      c.scene.traverse((o) => {
        if (!o.isSkinnedMesh) return;
        const m = new THREE.SkinnedMesh(o.geometry, o.material);
        m.material.metalness = 0; m.material.metalnessMap = null; m.material.color.set(cabelo); m.material.roughness = 0.62;
        m.material.envMapIntensity = 0.7;
        m.frustumCulled = false; m.castShadow = true; m.receiveShadow = true;
        corpo.parent.add(m);
        m.bind(this.esqueleto, corpo.bindMatrix);
      });
    }

    // Medidas na pose de repouso.
    this.grupo.updateMatrixWorld(true);
    const P = (n) => this.osso[n].getWorldPosition(V());
    this.repouso = {};
    for (const b of this.esqueleto.bones) this.repouso[b.name] = { q: b.quaternion.clone(), qm: b.getWorldQuaternion(Q()), p: b.getWorldPosition(V()), pos: b.position.clone() };
    const m = this.medidas = {
      OMBRO_X: Math.abs(P('upperarm_r').x),
      BRACO: Math.abs(P('hand_r').x) - Math.abs(P('upperarm_r').x),
      CINTURA: P('pelvis').y + 0.07,
      GOLA: P('neck_01').y + 0.015,
      PEITO: P('spine_03').y + 0.03,
      JOELHO: P('calf_r').y,
      TORNOZELO: P('foot_r').y,
      COXA_X: P('thigh_r').x,
      TRONCO_Z: P('spine_02').z,
      ...ROUPAS[tipo].medidas,
    };
    {
      const cxb = new THREE.Box3(), pv = V(), pa = corpo.geometry.attributes.position;
      for (let i = 0; i < pa.count; i++) { pv.fromBufferAttribute(pa, i); if (Math.abs(pv.y - (m.PEITO - 0.04)) < 0.035 && Math.abs(pv.x) < m.OMBRO_X - 0.035) cxb.expandByPoint(pv); }
      m.TUBO_X = (cxb.max.x - cxb.min.x) / 2 + 0.02; m.TUBO_Z = (cxb.max.z - cxb.min.z) / 2 + 0.02; m.TUBO_CZ = (cxb.max.z + cxb.min.z) / 2;
    }
    const defs = Object.entries(m).map(([k, v]) => `#define ${k} ${Number(v).toFixed(4)}`).join('\n');

    instalaPele(corpo.material, defs, ROUPAS[tipo].coberto);
    this.pecas = [];
    const pos = corpo.geometry.attributes.position, idx = corpo.geometry.index;
    for (const peca of ROUPAS[tipo].pecas) {
      const dentro = new Uint8Array(pos.count);
      const r = { x: 0, y: 0, z: 0, t: 0 };
      for (let i = 0; i < pos.count; i++) {
        r.x = pos.getX(i); r.y = pos.getY(i); r.z = pos.getZ(i); r.t = (Math.abs(r.x) - m.OMBRO_X) / m.BRACO;
        dentro[i] = peca.dentro(r, m) ? 1 : 0;
      }
      const indices = [];
      for (let i = 0; i < idx.count; i += 3) {
        const a = idx.getX(i), b = idx.getX(i + 1), c = idx.getX(i + 2);
        if (dentro[a] || dentro[b] || dentro[c]) indices.push(a, b, c);
      }
      const geo = new THREE.BufferGeometry();
      for (const nome of ['position', 'normal', 'uv', 'skinIndex', 'skinWeight']) geo.setAttribute(nome, corpo.geometry.attributes[nome]);
      geo.setIndex(indices);
      const mat = new THREE.MeshStandardMaterial({ roughness: peca.rug, side: THREE.DoubleSide, normalMap: texturaTrama(), normalScale: new THREE.Vector2(0.32, 0.32), envMapIntensity: 0.6 });
      instalaRoupa(mat, defs, peca);
      const malha = new THREE.SkinnedMesh(geo, mat);
      malha.name = peca.nome; malha.frustumCulled = false; malha.receiveShadow = true; malha.castShadow = false;
      corpo.parent.add(malha);
      malha.bind(this.esqueleto, corpo.bindMatrix);
      this.pecas.push(malha);
    }

    // Cabeça e cintura medidas na malha, para encaixar capacete e cinto.
    const si = corpo.geometry.attributes.skinIndex, sw = corpo.geometry.attributes.skinWeight;
    const iCab = this.esqueleto.bones.indexOf(this.osso.Head);
    const cx = new THREE.Box3(), cin = new THREE.Box3(), p = V();
    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos, i);
      let w = 0;
      for (let k = 0; k < 4; k++) if (si.getComponent(i, k) === iCab) w += sw.getComponent(i, k);
      if (w > 0.85) cx.expandByPoint(p);
      if (Math.abs(p.y - (m.CINTURA - 0.02)) < 0.025 && Math.abs(p.x) < m.OMBRO_X) cin.expandByPoint(p);
    }
    this.cabeca = { topo: cx.max.y, cx: (cx.min.x + cx.max.x) / 2, cz: (cx.min.z + cx.max.z) / 2, largura: cx.max.x - cx.min.x, fundo: cx.max.z - cx.min.z };
    this.cintura = { y: m.CINTURA - 0.02, cx: 0, cz: (cin.min.z + cin.max.z) / 2, rx: (cin.max.x - cin.min.x) / 2, rz: (cin.max.z - cin.min.z) / 2 };

    if (tipo === 'eletricista') {
      const cap = criaCapacete(this.cabeca); this.raiz.add(cap); this.osso.Head.attach(cap); this.capacete = cap;
      const cinto = criaCinto(this.cintura); this.raiz.add(cinto); this.osso.pelvis.attach(cinto); this.cinto = cinto;
      for (const s of ['l', 'r']) {
        const pe = P('foot_' + s), bico = P('ball_' + s);
        const bota = criaBota(pe.distanceTo(bico) + 0.14, pe.y);
        bota.position.copy(pe); bota.rotation.y = Math.atan2(bico.x - pe.x, bico.z - pe.z);
        this.raiz.add(bota); this.osso['foot_' + s].attach(bota);
      }
    } else {
      for (const s of ['l', 'r']) {
        const ch = criaChinelo(); const pp = P('foot_' + s), pb = P('ball_' + s);
        ch.position.set((pp.x + pb.x) / 2, 0.008, (pp.z + pb.z) / 2 - 0.01);
        this.raiz.add(ch); this.osso['foot_' + s].attach(ch);
      }
    }

    // Eixos das mãos e dos dedos no repouso (para as poses).
    const inv = (nome) => this.repouso[nome].qm.clone().invert();
    this.maos = {};
    for (const s of ['l', 'r']) {
      const pMao = P('hand_' + s);
      const a = P('middle_01_' + s).sub(pMao).normalize();                                       // direção dos dedos
      const pol = P('thumb_02_' + s).sub(pMao); pol.addScaledVector(a, -pol.dot(a)).normalize();   // lado do polegar
      const n = V().crossVectors(a, pol).multiplyScalar(s === 'l' ? 1 : -1).normalize();          // normal da palma
      const dedos = [];
      for (const dedo of ['index', 'middle', 'ring', 'pinky']) for (const j of ['01', '02', '03']) {
        const nome = `${dedo}_${j}_${s}`;
        const filho = this.osso[nome].children.find((c) => c.isBone);
        const dir = filho.getWorldPosition(V()).sub(P(nome)).normalize();
        dedos.push({ osso: this.osso[nome], q0: this.repouso[nome].q, eixo: V().crossVectors(dir, n).normalize().applyQuaternion(inv(nome)), junta: j, dedo });
      }
      const n1 = `thumb_01_${s}`, n2 = `thumb_02_${s}`, n3 = `thumb_03_${s}`;
      const d1 = P(n2).sub(P(n1)).normalize(), d2 = P(n3).sub(P(n2)).normalize();
      this.maos[s] = {
        a: a.clone().applyQuaternion(inv('hand_' + s)), n: n.clone().applyQuaternion(inv('hand_' + s)),
        palmo: P('middle_01_' + s).distanceTo(pMao), dedos,
        polegar: {
          b1: this.osso[n1], b2: this.osso[n2], b3: this.osso[n3],
          q1: this.repouso[n1].q, q2: this.repouso[n2].q, q3: this.repouso[n3].q,
          abre: V().crossVectors(d1, n).normalize().applyQuaternion(inv(n1)),      // leva o polegar para a frente da palma
          fecha1: V().crossVectors(d1, a).normalize().applyQuaternion(inv(n1)),
          fecha2: V().crossVectors(d2, a).normalize().applyQuaternion(inv(n2)),
          fecha3: V().crossVectors(d2, a).normalize().applyQuaternion(inv(n3)),
        },
        comp1: P('lowerarm_' + s).distanceTo(P('upperarm_' + s)), comp2: P('hand_' + s).distanceTo(P('lowerarm_' + s)),
      };
    }

    this.tempo = fase;
    this.atualiza(0);
  }

  // Gira um osso em torno de um eixo do mundo.
  _gira(osso, eixo, ang) {
    const pai = osso.parent.getWorldQuaternion(Q());
    const mundo = pai.clone().multiply(osso.quaternion);
    mundo.premultiply(Q().setFromAxisAngle(eixo, ang));
    osso.quaternion.copy(pai.invert().multiply(mundo));
  }

  _aponta(osso, de, para) {
    const pai = osso.parent.getWorldQuaternion(Q());
    const mundo = pai.clone().multiply(osso.quaternion);
    mundo.premultiply(Q().setFromUnitVectors(de, para));
    osso.quaternion.copy(pai.invert().multiply(mundo));
  }

  // Braço por cinemática inversa de dois ossos: leva o pulso até `pulso`, cotovelo para o lado de `polo`, e a mão
  // com os dedos na direção `aDes` e a palma virada para `nDes` (tudo no mundo).
  _braco(s, pulso, polo, aDes, nDes) {
    const o = this.osso, mao = this.maos[s];
    const up = o['upperarm_' + s], lo = o['lowerarm_' + s], hd = o['hand_' + s];
    const S = up.getWorldPosition(V());
    const paraAlvo = pulso.clone().sub(S);
    const d = Math.min(paraAlvo.length(), (mao.comp1 + mao.comp2) * 0.985);
    const dir = paraAlvo.normalize();
    const pl = polo.clone().addScaledVector(dir, -polo.dot(dir)).normalize();
    const aa = (mao.comp1 ** 2 - mao.comp2 ** 2 + d * d) / (2 * d);
    const hh = Math.sqrt(Math.max(0, mao.comp1 ** 2 - aa * aa));
    const E = S.clone().addScaledVector(dir, aa).addScaledVector(pl, hh);
    const T = S.clone().addScaledVector(dir, d);
    this._aponta(up, lo.getWorldPosition(V()).sub(S).normalize(), E.clone().sub(S).normalize());
    const E2 = lo.getWorldPosition(V());
    this._aponta(lo, hd.getWorldPosition(V()).sub(E2).normalize(), T.clone().sub(E2).normalize());
    const a = aDes.clone().normalize();
    const n = nDes.clone().addScaledVector(a, -nDes.dot(a)).normalize();
    const mLocal = new THREE.Matrix4().makeBasis(mao.a, mao.n, V().crossVectors(mao.a, mao.n));
    const mMundo = new THREE.Matrix4().makeBasis(a, n, V().crossVectors(a, n));
    const qMundo = Q().setFromRotationMatrix(mMundo).multiply(Q().setFromRotationMatrix(mLocal).invert());
    hd.quaternion.copy(hd.parent.getWorldQuaternion(Q()).invert().multiply(qMundo));
  }

  _dedos(s, base, meio, ponta, polAbre, polFecha, toque = 0, aperto = true) {
    const mao = this.maos[s], q = Q();
    for (const f of mao.dedos) {
      let ang = f.junta === '01' ? base : f.junta === '02' ? meio : ponta;
      if (aperto) {
        // na mão do celular, só os dedos que alcançam a borda do aparelho dobram em volta dela; os outros apoiam por trás
        const k = this.dobra[f.dedo];
        ang = f.junta === '01' ? base * (0.55 + 0.45 * k) : ang * k;
      } else ang += f.dedo === 'pinky' ? 0.12 : f.dedo === 'index' ? -0.1 : 0;
      f.osso.quaternion.copy(f.q0).multiply(q.setFromAxisAngle(f.eixo, ang));
    }
    const pl = mao.polegar;
    pl.b1.quaternion.copy(pl.q1).multiply(q.setFromAxisAngle(pl.abre, polAbre + toque * 0.1)).multiply(Q().setFromAxisAngle(pl.fecha1, polFecha * 0.5 + toque * 0.12));
    pl.b2.quaternion.copy(pl.q2).multiply(q.setFromAxisAngle(pl.fecha2, polFecha + toque * 0.22));
    pl.b3.quaternion.copy(pl.q3).multiply(q.setFromAxisAngle(pl.fecha3, polFecha * 0.8 + toque * 0.3));
  }

  /** Refaz a pose inteira: postura, respiração, braço do celular e braço em descanso. */
  atualiza(dt) {
    this.tempo += dt * this.vivo;
    const t = this.tempo, g = this.grupo, s = this.mao, o = this.osso, rp = this.repouso;
    for (const b of this.esqueleto.bones) { b.quaternion.copy(rp[b.name].q); }
    o.pelvis.position.copy(rp.pelvis.pos);
    g.updateMatrixWorld(true);
    const qg = g.getWorldQuaternion(Q());
    const X = V(1, 0, 0).applyQuaternion(qg), Z = V(0, 0, 1).applyQuaternion(qg);   // esquerda e frente do personagem
    const ladoMao = s === 'r' ? 1 : -1;                // +1: celular na mão direita
    const vetor = (x, y, z) => V().addScaledVector(X, x).addScaledVector(CIMA, y).addScaledVector(Z, z);
    const ponto = (x, y, z) => g.localToWorld(V(x, y, z));

    // 1) Postura: peso numa perna, a outra relaxada; pés um pouco abertos; balanço e respiração.
    const resp = Math.sin(t * 1.25), bal = Math.sin(t * 0.43), bal2 = Math.sin(t * 0.31 + 1.1);
    const solta = ladoMao > 0 ? 'l' : 'r', firme = ladoMao > 0 ? 'r' : 'l';     // a perna relaxada é a do lado oposto ao celular
    const sinal = solta === 'l' ? 1 : -1;
    o.pelvis.position.y -= 0.004;
    this._gira(o.pelvis, CIMA, 0.012 * bal);
    this._gira(o.pelvis, Z, -0.03 * sinal + 0.004 * bal2);                         // quadril cai para o lado da perna solta
    this._gira(o.spine_01, Z, 0.035 * sinal - 0.004 * bal2);
    this._gira(o.spine_02, X, 0.02 - 0.007 * resp);
    this._gira(o.spine_03, X, 0.035 - 0.011 * resp);
    this._gira(o['thigh_' + firme], Z, 0.03 * sinal);
    this._gira(o['thigh_' + firme], CIMA, -0.1 * sinal);
    this._gira(o['thigh_' + solta], CIMA, 0.22 * sinal);
    this._gira(o['thigh_' + solta], X, -0.17);
    this._gira(o['thigh_' + solta], Z, 0.06 * sinal);
    this._gira(o['calf_' + solta], X, 0.3);
    this._gira(o['foot_' + solta], X, -0.13);
    this._gira(o['foot_' + solta], Z, -0.03 * sinal);
    for (const k of ['l', 'r']) this._gira(o['clavicle_' + k], Z, (k === 'l' ? -1 : 1) * (0.07 - 0.012 * resp));

    // 2) A cabeça baixa para a tela (pescoço e cabeça dividem o ângulo), com um movimento mínimo.
    this._gira(o.neck_01, X, this.olhar * 0.45 + 0.008 * Math.sin(t * 0.7 + 2));
    this._gira(o.Head, X, this.olhar * 0.55);
    this._gira(o.Head, CIMA, -0.16 * ladoMao + 0.015 * Math.sin(t * 0.23));

    // 3) Onde o celular fica e para onde a tela olha (para os olhos de quem segura).
    const centro = g.localToWorld(this.celLocal.clone().add(V(0, 0.0025 * resp, 0)));
    const olhos = o.Head.getWorldPosition(V()).addScaledVector(CIMA, 0.09).addScaledVector(Z, 0.08);
    const nTela = olhos.sub(centro).normalize();
    nTela.addScaledVector(CIMA, this.inclina).normalize();
    const cimaTela = CIMA.clone().addScaledVector(nTela, -CIMA.dot(nTela)).normalize();
    const dirTela = V().crossVectors(cimaTela, nTela).normalize();
    if (this.celular) {
      const qCel = Q().setFromRotationMatrix(new THREE.Matrix4().makeBasis(dirTela, cimaTela, nTela));
      this.celular.quaternion.copy(qg.clone().invert().multiply(qCel));
      this.celular.position.copy(g.worldToLocal(centro.clone()));
    }

    // 4) Braço do celular: os dedos atravessam as costas do aparelho, palma virada para a tela.
    const mao = this.maos[s];
    const aDes = dirTela.clone().multiplyScalar(-ladoMao * Math.cos(this.giro)).addScaledVector(cimaTela, Math.sin(this.giro)).normalize();
    // o aparelho apoia nos dedos: o centro dele fica um pouco além dos nós, e a mão segura a metade de baixo
    const pulso = centro.clone().addScaledVector(nTela, -this.fundo).addScaledVector(aDes, -mao.palmo * this.pega).addScaledVector(cimaTela, -0.05);
    this._braco(s, pulso, vetor(-ladoMao * 0.75, -1, -0.25), aDes, nTela);
    const dd = this.dedos;
    this._dedos(s, dd.base, dd.meio, dd.ponta, dd.polegarAbre, dd.polegarFecha, this.toque, true);

    // 5) O outro braço em descanso: ele com a mão no cinto de ferramentas, ela com o braço solto ao lado do corpo.
    const u = this.outra, lu = -ladoMao;             // lu: +1 se o braço livre é o direito
    if (this.tipo === 'eletricista') {
      const c = this.cintura;
      this._braco(u, ponto(-lu * (c.rx + 0.075), c.y + 0.055, c.cz + 0.05), vetor(-lu * 0.9, -0.15, -0.6), vetor(lu * 0.12, -0.8, 0.55), vetor(lu, 0.05, -0.1));
      this._dedos(u, 0.55, 0.75, 0.45, 0.25, 0.2, 0, false);
    } else {
      const m = this.medidas;
      this._braco(u, ponto(-lu * (m.OMBRO_X + 0.035), m.CINTURA - 0.075 + 0.002 * resp, 0.045), vetor(-lu * 0.25, 0, -1), vetor(-lu * 0.04, -1, 0.14), vetor(lu, 0, 0.2));
      this._dedos(u, 0.3, 0.42, 0.3, 0.15, 0.15, 0, false);
    }
    g.updateMatrixWorld(true);
  }

  /** Posição do centro do celular no mundo. */
  posCelular(alvo = V()) { return this.celular.getWorldPosition(alvo); }
}
