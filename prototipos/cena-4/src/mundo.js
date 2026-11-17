// O cenário: uma rua de bairro à noite. À esquerda, a casa onde o eletricista acabou o serviço (escada encostada,
// caixa do medidor); à direita, a casa da cliente com a porta aberta e a luz quente. A luz da rua é fria do lado
// dele e quente do lado dela, como o degradê do sinal.
import * as THREE from 'three';
import { mergeVertices, mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { GLSL_RUIDO, sorteio } from './util.js';

export const ANCORAS = {
  ele: { pos: new THREE.Vector3(-6.0, 0, 1.35), frente: new THREE.Vector3(1, 0, 0.42).normalize() },
  ela: { pos: new THREE.Vector3(6.72, 0, 1.0), frente: new THREE.Vector3(-1, 0, 0.5).normalize() },
  porta: 7.05,
};

const FRIA = 0xcfe2ff, QUENTE = 0xffc48a, SODIO = 0xffa348;

export async function criaMundo({ textura, glb, leve, anisotropia, reflexo = true }) {
  const mundo = new THREE.Group();
  const rnd = sorteio(11);
  const caixa = (l, a, f, mat, x, y, z, pai = mundo) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(l, a, f), mat);
    m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; pai.add(m); return m;
  };

  // ---- texturas PBR (Poly Haven, CC0) ----
  const conjunto = async (nome) => {
    const [diff, nor, arm] = await Promise.all(['diff', 'nor', 'arm'].map((k) => textura(`texturas/${nome}-${k}.webp`)));
    diff.colorSpace = THREE.SRGBColorSpace;
    for (const t of [diff, nor, arm]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = anisotropia; }
    return { diff, nor, arm };
  };
  const [tAsfalto, tCalcada, tReboco, tPorta, tTelha] = await Promise.all(['asfalto', 'calcada', 'reboco', 'porta', 'telha'].map(conjunto));
  const pbr = (c, { rep = [1, 1], gira = 0, ...resto } = {}) => {
    const m = (t) => { const x = t.clone(); x.repeat.set(rep[0], rep[1]); x.rotation = gira; x.needsUpdate = true; return x; };
    return new THREE.MeshStandardMaterial({ map: m(c.diff), normalMap: m(c.nor), roughnessMap: m(c.arm), aoMap: m(c.arm), roughness: 1, metalness: 0, ...resto });
  };

  // ---------------------------------------------------------------------------------------------------------
  // Chão: calçada, meio-fio e asfalto molhado (poças com reflexo).
  // ---------------------------------------------------------------------------------------------------------
  const calcada = new THREE.Mesh(new THREE.PlaneGeometry(70, 2.5), pbr(tCalcada, { rep: [70 / 1.6, 2.5 / 1.6], color: 0xb9b4aa, envMapIntensity: 0.5 }));
  calcada.rotation.x = -Math.PI / 2; calcada.position.set(0, 0, 1.25); calcada.receiveShadow = true;
  const concreto = new THREE.MeshStandardMaterial({ color: 0x8d8a84, roughness: 0.85 });
  const meioFio = caixa(70, 0.2, 0.16, concreto, 0, -0.1, 2.58);
  meioFio.castShadow = false;

  const matAsfalto = pbr(tAsfalto, { rep: [90 / 4, 46 / 4], color: 0x8f949c, envMapIntensity: 0.9 });
  matAsfalto.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vMundo;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMundo = (modelMatrix * vec4(position, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vMundo;\n${GLSL_RUIDO}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float poca = smoothstep(0.5, 0.62, fbm2(vMundo.xz * 0.33 + 3.7));
        poca = max(poca, smoothstep(0.55, 0.2, vMundo.z - 2.66) * 0.9);         // sarjeta
        float umido = 0.55 + 0.45 * fbm2(vMundo.xz * 1.3);
        diffuseColor.rgb *= mix(0.62, 0.3, poca);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor * mix(0.42, 0.62, umido), 0.045, poca);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        normal = normalize(mix(normal, nonPerturbedNormal, poca * 0.97));`);
  };
  const asfalto = new THREE.Mesh(new THREE.PlaneGeometry(90, 46), matAsfalto);
  asfalto.rotation.x = -Math.PI / 2; asfalto.position.set(0, -0.16, 2.6 + 23); asfalto.receiveShadow = true;
  mundo.add(calcada, asfalto);

  // Reflexo no asfalto molhado (só no computador): a cena é desenhada espelhada numa textura de meia resolução e
  // somada por cima do asfalto, mais nítida nas poças e borrada no resto. É o que deixa o sinal refletir na rua.
  let espelho = null;
  if (!leve && reflexo) {
    espelho = new Reflector(new THREE.PlaneGeometry(90, 46), {
      textureWidth: 960, textureHeight: 540, multisample: 0,
      shader: {
        name: 'AsfaltoMolhado',
        uniforms: { color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null }, tNormal: { value: null }, uForca: { value: 1.5 } },
        vertexShader: /* glsl */ `
          uniform mat4 textureMatrix; varying vec4 vUv; varying vec3 vMundo;
          void main() { vUv = textureMatrix * vec4(position, 1.0); vMundo = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: /* glsl */ `
          uniform sampler2D tDiffuse; uniform sampler2D tNormal; uniform float uForca; varying vec4 vUv; varying vec3 vMundo;
          ${GLSL_RUIDO}
          void main() {
            float poca = smoothstep(0.5, 0.62, fbm2(vMundo.xz * 0.33 + 3.7));
            poca = max(poca, smoothstep(0.55, 0.2, vMundo.z - 2.66) * 0.9);
            vec3 n = texture2D(tNormal, vMundo.xz * 0.25).xyz * 2.0 - 1.0;
            vec3 paraOlho = normalize(cameraPosition - vMundo);
            float rasante = 1.0 - max(paraOlho.y, 0.0);
            float fresnel = 0.03 + 0.97 * pow(rasante, 4.0);
            float asper = mix(1.0, 0.07, poca);
            vec4 uv = vUv; uv.xy += n.xy * vec2(0.012, 0.055) * asper * uv.w;
            vec3 r = texture2DProj(tDiffuse, uv, asper * 3.0).rgb;
            gl_FragColor = vec4(min(r, vec3(12.0)) * fresnel * mix(0.45, 1.0, poca) * uForca, 1.0);
          }`,
      },
    });
    espelho.material.uniforms.tNormal.value = tAsfalto.nor;
    espelho.material.transparent = true; espelho.material.blending = THREE.AdditiveBlending; espelho.material.depthWrite = false;
    const alvo = espelho.getRenderTarget();
    alvo.texture.generateMipmaps = true; alvo.texture.minFilter = THREE.LinearMipmapLinearFilter;
    espelho.rotation.x = -Math.PI / 2; espelho.position.set(0, -0.155, 2.6 + 23); espelho.renderOrder = 1;
    mundo.add(espelho);
  }

  // ---------------------------------------------------------------------------------------------------------
  // Casas
  // ---------------------------------------------------------------------------------------------------------
  const madeira = new THREE.MeshStandardMaterial({ color: 0x3b2618, roughness: 0.8 });
  const brancoPintado = new THREE.MeshStandardMaterial({ color: 0xe6e2d8, roughness: 0.6 });
  const ferro = new THREE.MeshStandardMaterial({ color: 0x1b1d20, roughness: 0.55, metalness: 0.7 });
  const metalClaro = new THREE.MeshStandardMaterial({ color: 0xb8bec4, roughness: 0.35, metalness: 1 });

  function contorno(x0, x1, h, portas) {
    const f = new THREE.Shape();
    f.moveTo(x0, 0);
    for (const p of [...portas].sort((a, b) => a.x0 - b.x0)) { f.lineTo(p.x0, 0); f.lineTo(p.x0, p.y1); f.lineTo(p.x1, p.y1); f.lineTo(p.x1, 0); }
    f.lineTo(x1, 0); f.lineTo(x1, h); f.lineTo(x0, h); f.closePath();
    return f;
  }
  function parede({ x0, x1, h, portas = [], janelas = [], esp = 0.24, z = 0, mat }) {
    const f = contorno(x0, x1, h, portas);
    for (const j of janelas) {
      if (j.y0 >= h) continue;
      const b = new THREE.Path();
      b.moveTo(j.x0, j.y0); b.lineTo(j.x1, j.y0); b.lineTo(j.x1, Math.min(j.y1, h - 0.01)); b.lineTo(j.x0, Math.min(j.y1, h - 0.01)); b.closePath();
      f.holes.push(b);
    }
    const g = new THREE.ExtrudeGeometry(f, { depth: esp, bevelEnabled: false });
    g.translate(0, 0, z - esp);
    const m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true; mundo.add(m); return m;
  }

  // cortina iluminada das janelas acesas
  const cortina = (() => {
    const c = document.createElement('canvas'); c.width = 128; c.height = 128;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, '#ffd9a0'); g.addColorStop(1, '#f2a65a');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 128; i += 8) { x.fillStyle = `rgba(120,60,10,${0.1 + 0.12 * Math.sin(i * 0.9)})`; x.fillRect(i, 0, 4, 128); }
    x.fillStyle = 'rgba(60,30,10,.35)'; x.fillRect(60, 0, 8, 128);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();

  function janela({ x, y = 1.05, l = 1.1, a = 1.15, acesa = 0, grade = false, moldura = brancoPintado }) {
    const g = new THREE.Group(); g.position.set(x, y + a / 2, 0); mundo.add(g);
    const e = 0.06;
    caixa(l, e, 0.1, moldura, 0, a / 2 - e / 2, -0.07, g); caixa(l, e, 0.1, moldura, 0, -a / 2 + e / 2, -0.07, g);
    caixa(e, a, 0.1, moldura, -l / 2 + e / 2, 0, -0.07, g); caixa(e, a, 0.1, moldura, l / 2 - e / 2, 0, -0.07, g);
    caixa(0.04, a, 0.05, moldura, 0, 0, -0.08, g); caixa(l, 0.035, 0.05, moldura, 0, a * 0.12, -0.08, g);
    caixa(l + 0.16, 0.05, 0.14, moldura, 0, -a / 2 - 0.025, 0.02, g);        // peitoril
    const fundo = new THREE.Mesh(new THREE.PlaneGeometry(l, a), acesa
      ? new THREE.MeshBasicMaterial({ map: cortina, color: new THREE.Color(1, 0.86, 0.7).multiplyScalar(acesa) })
      : new THREE.MeshBasicMaterial({ color: 0x04070b }));
    fundo.position.z = -0.2; g.add(fundo);
    const vidro = new THREE.Mesh(new THREE.PlaneGeometry(l, a), new THREE.MeshPhysicalMaterial({ color: 0x000000, roughness: 0.05, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, envMapIntensity: 1.6 }));
    vidro.position.z = -0.09; g.add(vidro);
    if (grade) {
      const n = Math.round(l / 0.12);
      for (let i = 0; i <= n; i++) caixa(0.014, a + 0.06, 0.014, ferro, -l / 2 + (l * i) / n, 0, 0.03, g);
      for (const yy of [-a / 2 + 0.08, a / 2 - 0.08]) caixa(l + 0.04, 0.02, 0.02, ferro, 0, yy, 0.03, g);
    }
    return { x0: x - l / 2, x1: x + l / 2, y0: y, y1: y + a };
  }

  const matFolha = pbr(tPorta, { rep: [1, 1], color: 0xb89a7a, envMapIntensity: 0.6 });
  function porta({ x, l = 0.9, a = 2.12, aberta = 0, cor = 0xffffff }) {
    const e = 0.07;
    caixa(e, a + e, 0.26, madeira, x - l / 2 - e / 2, (a + e) / 2, -0.12);
    caixa(e, a + e, 0.26, madeira, x + l / 2 + e / 2, (a + e) / 2, -0.12);
    caixa(l + 2 * e, e, 0.26, madeira, x, a + e / 2, -0.12);
    caixa(l + 0.3, 0.06, 0.42, new THREE.MeshStandardMaterial({ color: 0x77726b, roughness: 0.5 }), x, 0.03, -0.05);  // soleira
    const eixo = new THREE.Group(); eixo.position.set(x + l / 2, 0, -0.16); mundo.add(eixo);
    const mat = matFolha.clone(); mat.color.set(cor).multiply(new THREE.Color(0xb89a7a));
    const folha = caixa(l, a, 0.045, mat, -l / 2, a / 2 + 0.06, 0, eixo);
    const mac = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 10), metalClaro); mac.position.set(-l + 0.09, 1.02, 0.05); eixo.add(mac);
    const mac2 = mac.clone(); mac2.position.z = -0.05; eixo.add(mac2);
    eixo.rotation.y = -aberta;
    void folha;
    return { x0: x - l / 2 - e, x1: x + l / 2 + e, y1: a + e };
  }

  const matTelha = (larg) => pbr(tTelha, { rep: [larg / 1.5, 4], color: 0xa8826c, envMapIntensity: 0.45, side: THREE.DoubleSide });
  function telhado(x0, x1, h, { beiral = 0.55, fundo = 5.2, sobe = 1.9 } = {}) {
    const larg = x1 - x0 + 0.3, comp = Math.hypot(beiral + fundo, sobe), ang = Math.atan2(sobe, beiral + fundo);
    const t = new THREE.Mesh(new THREE.PlaneGeometry(larg, comp), matTelha(larg));
    t.rotation.x = -Math.PI / 2 + ang; t.position.set((x0 + x1) / 2, h + 0.1 + sobe / 2, (beiral - fundo) / 2);
    t.castShadow = true; t.receiveShadow = true; mundo.add(t);
    caixa(larg, 0.11, 0.035, madeira, (x0 + x1) / 2, h + 0.045, beiral - 0.01);
    caixa(larg, 0.03, beiral + 0.02, madeira, (x0 + x1) / 2, h + 0.0, beiral / 2);
    // caibros aparentes sob o beiral
    const n = Math.round(larg / 0.55);
    for (let i = 0; i <= n; i++) caixa(0.05, 0.07, beiral, madeira, x0 - 0.1 + (larg - 0.1) * (i / n), h - 0.04, beiral / 2);
  }

  function casa({ x0, x1, h, cor, corBarrado, portas = [], janelas = [], comTelhado = true }) {
    const vp = portas.map(porta), vj = janelas.map(janela);
    parede({ x0, x1, h, portas: vp, janelas: vj, mat: pbr(tReboco, { rep: [0.45, 0.45], color: cor, envMapIntensity: 0.45 }) });
    if (corBarrado !== undefined) {
      // barrado: a faixa pintada de outra cor no pé da parede, interrompida nas portas
      let x = x0;
      for (const p of [...vp].sort((a, b) => a.x0 - b.x0).concat([{ x0: x1, x1 }])) {
        const l = p.x0 - x;
        if (l > 0.02) caixa(l, 0.92, 0.03, pbr(tReboco, { rep: [l * 0.45, 0.42], color: corBarrado, envMapIntensity: 0.5 }), x + l / 2, 0.46, 0.015).castShadow = false;
        x = p.x1;
      }
    }
    if (comTelhado) telhado(x0, x1, h);
  }

  // da esquerda para a direita
  casa({ x0: -19, x1: -11.2, h: 3.5, cor: 0xcdbf9f, corBarrado: 0x7d5f48, portas: [{ x: -12.6 }], janelas: [{ x: -15.4, grade: true }] });
  // casa do serviço (onde ele está)
  casa({ x0: -11.2, x1: -3.3, h: 3.3, cor: 0xc9d3d6, corBarrado: 0x4f6b7c, portas: [{ x: -4.5, cor: 0xd9e4ea }], janelas: [{ x: -9.6, acesa: 0.55, l: 1.2 }] });
  casa({ x0: -3.3, x1: 0.6, h: 3.05, cor: 0xd9b27c, corBarrado: 0x8a5a3a, portas: [{ x: -0.35 }], janelas: [{ x: -2.1, acesa: 0.0, grade: true, l: 1.0 }] });
  // casa da cliente
  casa({ x0: 4.3, x1: 10.6, h: 3.3, cor: 0xe7dcc2, corBarrado: 0xb5673d, portas: [{ x: ANCORAS.porta, aberta: 1.75 }], janelas: [{ x: 9.05, acesa: 1.5, l: 1.25 }, { x: 5.25, acesa: 0, l: 0.8, a: 0.9, y: 1.3 }] });
  casa({ x0: 10.6, x1: 19, h: 3.6, cor: 0xa9b8a2, corBarrado: 0x586b57, portas: [{ x: 12.2 }], janelas: [{ x: 14.6, grade: true }, { x: 17.2, acesa: 0.35 }] });

  // muro com portão entre as casas, e uma casa recuada atrás dele
  {
    const matMuro = pbr(tReboco, { rep: [0.45, 0.45], color: 0xbfb9ad, envMapIntensity: 0.45 });
    parede({ x0: 0.6, x1: 1.55, h: 2.25, mat: matMuro, esp: 0.2 }); parede({ x0: 3.35, x1: 4.3, h: 2.25, mat: matMuro, esp: 0.2 });
    caixa(1.05, 0.07, 0.3, concreto, 1.075, 2.285, -0.1); caixa(1.05, 0.07, 0.3, concreto, 3.825, 2.285, -0.1);
    for (let i = 0; i <= 15; i++) caixa(0.022, 2.0, 0.022, ferro, 1.6 + i * (1.7 / 15), 1.05, -0.1);
    for (const y of [0.12, 1.1, 2.02]) caixa(1.8, 0.035, 0.03, ferro, 2.45, y, -0.1);
    const recuada = pbr(tReboco, { rep: [0.45, 0.45], color: 0xd6c8b8 });
    const pr = new THREE.Mesh(new THREE.BoxGeometry(5.2, 3.4, 0.3), recuada); pr.position.set(2.45, 1.7, -4.2); pr.receiveShadow = true; mundo.add(pr);
    const jr = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.0), new THREE.MeshBasicMaterial({ map: cortina, color: new THREE.Color(1, 0.82, 0.62).multiplyScalar(0.8) }));
    jr.position.set(3.1, 1.75, -4.04); mundo.add(jr);
    const tr = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 4.6), matTelha(5.6));
    tr.rotation.x = -Math.PI / 2 + 0.36; tr.position.set(2.45, 4.25, -5.8); mundo.add(tr);
    const piso = new THREE.Mesh(new THREE.PlaneGeometry(3.7, 4.2), new THREE.MeshStandardMaterial({ color: 0x5c5a55, roughness: 0.9 }));
    piso.rotation.x = -Math.PI / 2; piso.position.set(2.45, 0.005, -2.1); piso.receiveShadow = true; mundo.add(piso);
  }

  // interior da casa da cliente: o corredor quente que se vê pela porta
  {
    const px = ANCORAS.porta;
    const sala = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.75, 4.2), new THREE.MeshStandardMaterial({ color: 0xe9c08a, roughness: 0.9, side: THREE.BackSide, emissive: 0xffa450, emissiveIntensity: 0.42 }));
    sala.position.set(px + 0.5, 1.385, -2.36); sala.receiveShadow = true; mundo.add(sala);
    const piso = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 4.2), new THREE.MeshStandardMaterial({ color: 0x8a5a3c, roughness: 0.35, emissive: 0x4a2408, emissiveIntensity: 0.3 }));
    piso.rotation.x = -Math.PI / 2; piso.position.set(px + 0.5, 0.06, -2.36); piso.receiveShadow = true; mundo.add(piso);
    const lustre = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.78, 0.5).multiplyScalar(5) }));
    lustre.position.set(px + 0.1, 2.42, -1.7); mundo.add(lustre);
    const quadro = caixa(0.6, 0.45, 0.03, madeira, px - 0.3, 1.6, -4.4);
    const tela = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.35), new THREE.MeshStandardMaterial({ color: 0x4f7c8a, roughness: 0.8, emissive: 0x2b4650, emissiveIntensity: 0.5 }));
    tela.position.set(px - 0.3, 1.6, -4.38); mundo.add(tela); void quadro;
  }

  // caixa do medidor (o "quadro" que ele trocou), com eletroduto até o beiral
  {
    const cinza = new THREE.MeshStandardMaterial({ color: 0x9aa1a6, roughness: 0.45, metalness: 0.6 });
    const x = -7.35;
    caixa(0.42, 0.56, 0.16, cinza, x, 1.52, 0.08);
    caixa(0.36, 0.5, 0.012, new THREE.MeshStandardMaterial({ color: 0xb4bbc0, roughness: 0.35, metalness: 0.7 }), x, 1.52, 0.166);
    const visor = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.12), new THREE.MeshPhysicalMaterial({ color: 0x0c1418, roughness: 0.08 }));
    visor.position.set(x, 1.62, 0.174); mundo.add(visor);
    const led = new THREE.Mesh(new THREE.CircleGeometry(0.009, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 1, 0.35).multiplyScalar(6) }));
    led.position.set(x + 0.11, 1.38, 0.175); mundo.add(led);
    const duto = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.5, 8), new THREE.MeshStandardMaterial({ color: 0x2b2e31, roughness: 0.6 }));
    duto.position.set(x, 2.55, 0.03); duto.castShadow = true; mundo.add(duto);
    for (const y of [2.1, 2.9]) caixa(0.07, 0.025, 0.03, metalClaro, x, y, 0.04);
  }

  // ---------------------------------------------------------------------------------------------------------
  // Postes, fios e luminárias
  // ---------------------------------------------------------------------------------------------------------
  const zPoste = 2.2;
  // O poste fica escuro de propósito: a luminária real quase não ilumina o próprio poste (aqui a luz não tem esse corte).
  const matPoste = new THREE.MeshStandardMaterial({ color: 0x34322e, roughness: 0.95 });
  const matFio = new THREE.MeshStandardMaterial({ color: 0x0b0c0e, roughness: 0.5, metalness: 0.3 });
  const xsPoste = [-23, -13.6, -4.1, 4.75, 13.3, 22.5];
  const luzes = { postes: [] };
  const cones = [];

  function cone(x, y, z, cor, forca, raio = 3.3, alt = 7.6) {
    const g = new THREE.ConeGeometry(raio, alt, 40, 1, true); g.translate(0, -alt / 2, 0);
    const m = new THREE.Mesh(g, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
      uniforms: { uCor: { value: new THREE.Color(cor) }, uForca: { value: forca } },
      vertexShader: /* glsl */ `varying vec3 vN; varying vec3 vV; varying float vY;
        void main() { vY = uv.y; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: /* glsl */ `uniform vec3 uCor; uniform float uForca; varying vec3 vN; varying vec3 vV; varying float vY;
        void main() { float borda = pow(abs(dot(normalize(vN), normalize(vV))), 2.2); float y = clamp(vY, 0.0, 1.0); float cai = pow(y, 2.4) * smoothstep(0.0, 0.12, y);
          gl_FragColor = vec4(uCor * uForca * borda * cai, 1.0); }`,
    }));
    m.position.set(x, y, z); m.renderOrder = 3; mundo.add(m); cones.push(m); return m;
  }

  function poste(x, { cor = null, forca = 0, sombra = false, alvo = null, transformador = false, soLente = false } = {}) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.14, 9.4, 12), matPoste);
    p.position.set(x, 4.6, zPoste); p.castShadow = true; p.receiveShadow = true; mundo.add(p);
    caixa(0.1, 0.1, 2.0, madeira, x, 8.85, zPoste);
    for (const dz of [-0.85, 0, 0.85]) { const i = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.14, 8), brancoPintado); i.position.set(x, 8.97, zPoste + dz); mundo.add(i); }
    caixa(0.05, 0.75, 0.05, ferro, x, 7.1, zPoste + 0.15);
    if (transformador) {
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.7, 16), new THREE.MeshStandardMaterial({ color: 0x6f777c, roughness: 0.5, metalness: 0.6 }));
      t.position.set(x, 7.9, zPoste - 0.42); t.castShadow = true; mundo.add(t);
    }
    if (!cor) return;
    // braço e luminária
    const curva = new THREE.CatmullRomCurve3([new THREE.Vector3(x, 7.55, zPoste), new THREE.Vector3(x, 8.05, zPoste + 0.7), new THREE.Vector3(x, 8.1, zPoste + 1.75)]);
    const braco = new THREE.Mesh(new THREE.TubeGeometry(curva, 14, 0.028, 6), metalClaro); braco.castShadow = true; mundo.add(braco);
    caixa(0.2, 0.09, 0.52, new THREE.MeshStandardMaterial({ color: 0x5f666b, roughness: 0.5, metalness: 0.5 }), x, 8.08, zPoste + 1.95);
    const lente = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.36), new THREE.MeshBasicMaterial({ color: new THREE.Color(cor).multiplyScalar(forca > 0 || soLente ? 9 : 0.02) }));
    lente.rotation.x = Math.PI / 2; lente.position.set(x, 8.03, zPoste + 1.98); mundo.add(lente);
    if (forca <= 0) return;
    const luz = new THREE.SpotLight(cor, forca, 26, 0.95, 0.9, 2);
    luz.position.set(x, 8.0, zPoste + 1.98);
    luz.target.position.copy(alvo ?? new THREE.Vector3(x, 0, zPoste + 0.6));
    if (sombra) {
      luz.castShadow = true; luz.shadow.mapSize.set(sombra, sombra); luz.shadow.camera.near = 2; luz.shadow.camera.far = 16;
      luz.shadow.bias = -0.0006; luz.shadow.normalBias = 0.03; luz.shadow.radius = 5; luz.shadow.blurSamples = 12;
    }
    mundo.add(luz, luz.target);
    luzes.postes.push(luz);
    cone(x, 8.02, zPoste + 1.98, cor, 0.016);
    return luz;
  }
  poste(xsPoste[0]);
  poste(xsPoste[1], { cor: FRIA, forca: 0, soLente: true });
  luzes.poste = poste(xsPoste[2], { cor: FRIA, forca: 430, sombra: leve ? 1024 : 2048, alvo: new THREE.Vector3(-5.6, 0, 1.5) });
  poste(xsPoste[3], { transformador: true, cor: FRIA, forca: 0 });
  poste(xsPoste[4], { cor: SODIO, forca: leve ? 0 : 330, soLente: leve, alvo: new THREE.Vector3(12.4, 0, 2.2) });
  poste(xsPoste[5]);

  // fios com barriga entre os postes
  function fio(y, dz, raio, barriga, z0 = zPoste) {
    for (let i = 0; i < xsPoste.length - 1; i++) {
      const a = xsPoste[i], b = xsPoste[i + 1], pts = [];
      for (let k = 0; k <= 10; k++) { const t = k / 10; pts.push(new THREE.Vector3(a + (b - a) * t, y - barriga * 4 * t * (1 - t), z0 + dz)); }
      const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, raio, 4), matFio);
      mundo.add(m);
    }
  }
  for (const dz of [-0.85, 0, 0.85]) fio(9.04, dz, 0.009, 0.3);
  for (const [i, y] of [7.42, 7.22, 7.02, 6.82].entries()) fio(y, 0.19, 0.008, 0.26 + i * 0.015);
  fio(5.75, -0.16, 0.022, 0.42); fio(5.5, -0.15, 0.014, 0.5);
  // ramais de ligação das casas
  const ramal = (de, para) => {
    const pts = []; for (let k = 0; k <= 8; k++) { const t = k / 8; const p = de.clone().lerp(para, t); p.y -= 0.35 * 4 * t * (1 - t); pts.push(p); }
    mundo.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, 0.008, 4), matFio));
  };
  ramal(new THREE.Vector3(-4.1, 6.9, zPoste), new THREE.Vector3(-7.35, 3.32, 0.1));
  ramal(new THREE.Vector3(4.75, 6.9, zPoste), new THREE.Vector3(8.0, 3.35, 0.3));
  ramal(new THREE.Vector3(4.75, 6.9, zPoste), new THREE.Vector3(0.1, 3.1, 0.3));

  // ---------------------------------------------------------------------------------------------------------
  // Luzes da casa da cliente
  // ---------------------------------------------------------------------------------------------------------
  {
    const px = ANCORAS.porta;
    const luz = new THREE.SpotLight(QUENTE, 125, 18, 0.62, 0.7, 2);
    luz.position.set(px + 0.25, 2.3, -2.6); luz.target.position.set(px - 0.55, 0.3, 3.2);
    luz.castShadow = true; luz.shadow.mapSize.set(leve ? 1024 : 2048, leve ? 1024 : 2048);
    luz.shadow.camera.near = 0.6; luz.shadow.camera.far = 14; luz.shadow.bias = -0.0005; luz.shadow.normalBias = 0.025; luz.shadow.radius = 4; luz.shadow.blurSamples = 12;
    mundo.add(luz, luz.target);
    luzes.porta = luz;
    const arandela = new THREE.PointLight(QUENTE, 5, 7, 2);
    arandela.position.set(5.95, 2.32, 0.34); mundo.add(arandela);
    luzes.arandela = arandela;
  }
  // luz da lua: fria, rasante, sem sombra
  const lua = new THREE.DirectionalLight(0x8fb2ff, 0.32);
  lua.position.set(-14, 16, 9); mundo.add(lua);
  luzes.lua = lua;

  // ---------------------------------------------------------------------------------------------------------
  // Objetos (Poly Haven, CC0): escada, caixa de ferramentas, arandela, plantas
  // ---------------------------------------------------------------------------------------------------------
  const [escada, ferramentas, arandela, planta1, planta2] = await Promise.all(['escada', 'caixa-ferramentas', 'arandela', 'planta-1', 'planta-2'].map((n) => glb(`modelos/${n}.glb`)));
  const prepara = (g, env = 0.6) => { g.scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.material.envMapIntensity = env; } }); return g.scene; };
  const medida = (o) => new THREE.Box3().setFromObject(o);
  const objetos = {};
  {
    const e = prepara(escada); const b = medida(e); const alt = b.max.y - b.min.y;
    const k = 3.75 / alt; e.scale.setScalar(k);
    const pivo = new THREE.Group(); pivo.add(e);
    e.position.set(-(b.min.x + b.max.x) / 2 * k, -b.min.y * k, -(b.min.z + b.max.z) / 2 * k);
    pivo.position.set(-8.35, 0, 1.02); pivo.rotation.x = -0.27;
    mundo.add(pivo); objetos.escada = pivo; objetos.escadaCaixa = b;
  }
  {
    const f = prepara(ferramentas); const b = medida(f); const k = 0.52 / Math.max(b.max.x - b.min.x, b.max.z - b.min.z); f.scale.setScalar(k);
    f.position.set(-7.5, -b.min.y * k, 0.72); f.rotation.y = 0.5; mundo.add(f); objetos.ferramentas = f;
  }
  {
    const a = prepara(arandela, 1); const b = medida(a); const k = 0.3 / (b.max.y - b.min.y); a.scale.setScalar(k);
    a.position.set(5.95, 2.3, 0.0); mundo.add(a); objetos.arandela = a; objetos.arandelaCaixa = b;
    a.traverse((o) => { if (o.isMesh && o.material.emissiveMap) { o.material.emissive.set(QUENTE); o.material.emissiveIntensity = 6; } });
  }
  {
    const p = prepara(planta1); const b = medida(p); const k = 0.95 / (b.max.y - b.min.y); p.scale.setScalar(k);
    p.position.set(5.5, -b.min.y * k, 0.42); p.rotation.y = 1.2; mundo.add(p);
    p.traverse((o) => { if (o.isMesh) { o.material.side = THREE.DoubleSide; if (o.material.map && /leav/i.test(o.material.name)) o.material.alphaTest = 0.4; } });
    const q = prepara(planta2); const b2 = medida(q); const k2 = 0.42 / (b2.max.y - b2.min.y); q.scale.setScalar(k2);
    q.position.set(8.25, -b2.min.y * k2, 0.4); mundo.add(q);
    const q2 = q.clone(); q2.position.set(-3.75, -b2.min.y * k2, 0.35); q2.rotation.y = 2; mundo.add(q2);
  }

  // ---------------------------------------------------------------------------------------------------------
  // Fundo: árvores, prédios distantes, morro com luzes e o céu
  // ---------------------------------------------------------------------------------------------------------
  {
    const matCopa = new THREE.MeshStandardMaterial({ color: 0x0c1610, roughness: 1, envMapIntensity: 0.25 });
    const copa = (x, y, z, r) => {
      const g = mergeVertices(new THREE.IcosahedronGeometry(r, 7).deleteAttribute('normal').deleteAttribute('uv')); const p = g.attributes.position; const v = new THREE.Vector3();
      for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const n = 1 + 0.2 * Math.sin(v.x * 2.3 + x) * Math.cos(v.y * 2.1) + 0.12 * Math.sin(v.z * 4.3 + v.x * 2.0) + 0.06 * Math.sin(v.x * 9.0 + v.y * 7.0) * Math.cos(v.z * 8.0); v.multiplyScalar(n); p.setXYZ(i, v.x, v.y * 0.82, v.z); }
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, matCopa); m.position.set(x, y, z); mundo.add(m);
      const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, y, 8), new THREE.MeshStandardMaterial({ color: 0x1c140e, roughness: 1 })); tr.position.set(x, y / 2, z); mundo.add(tr);
    };
    copa(2.6, 5.4, -7.5, 2.6); copa(0.2, 4.7, -8.6, 2.0); copa(-13.5, 6.2, -9, 3.1); copa(15.5, 6.0, -8, 2.9); copa(-6.5, 6.6, -12, 3.2); copa(9.5, 6.8, -13, 3.4);

    // prédios e casas ao longe, com janelinhas acesas
    const janelas = (() => {
      const c = document.createElement('canvas'); c.width = 64; c.height = 128; const x = c.getContext('2d');
      x.fillStyle = '#060a10'; x.fillRect(0, 0, 64, 128);
      const r = sorteio(5);
      for (let j = 0; j < 12; j++) for (let i = 0; i < 6; i++) if (r() < 0.26) { x.fillStyle = r() < 0.7 ? `rgba(255,${170 + r() * 50},${90 + r() * 60},${0.5 + r() * 0.5})` : 'rgba(170,205,255,.75)'; x.fillRect(4 + i * 10, 5 + j * 10, 5, 6); }
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.NearestFilter; return t;
    })();
    for (let i = 0; i < 18; i++) {
      const l = 8 + rnd() * 9, a = 7 + rnd() * 22, x = -84 + i * 9.6 + rnd() * 4, z = -42 - rnd() * 36;
      const t = janelas.clone(); t.repeat.set(l / 8.4, a / 36); t.offset.set(rnd(), rnd()); t.needsUpdate = true;
      const m = new THREE.Mesh(new THREE.BoxGeometry(l, a, 8), new THREE.MeshStandardMaterial({ color: 0x070b11, roughness: 1, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.75 }));
      m.position.set(x, a / 2, z); mundo.add(m);
    }

    // morro ao fundo: silhueta + luzinhas das casas
    const perfil = (x) => 9 + 13 * Math.exp(-(((x - 28) / 34) ** 2)) + 8 * Math.exp(-(((x + 46) / 26) ** 2)) + 1.6 * Math.sin(x * 0.21) + 0.8 * Math.sin(x * 0.53 + 1);
    const f = new THREE.Shape(); f.moveTo(-130, -2);
    for (let x = -130; x <= 130; x += 4) f.lineTo(x, perfil(x));
    f.lineTo(130, -2); f.closePath();
    const morro = new THREE.Mesh(new THREE.ShapeGeometry(f), new THREE.MeshBasicMaterial({ color: 0x050a12, fog: false }));
    morro.position.z = -95; mundo.add(morro);
    const n = leve ? 500 : 900, pos = new Float32Array(n * 3), cor = new Float32Array(n * 3), tam = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = -120 + rnd() * 240, h = perfil(x), y = 1 + rnd() ** 1.5 * (h - 1.5);
      pos.set([x, y, -94.5], i * 3);
      const quente = rnd() < 0.78; const b = 0.5 + rnd() * 1.6;
      cor.set(quente ? [1.0 * b, 0.66 * b, 0.32 * b] : [0.7 * b, 0.85 * b, 1.0 * b], i * 3);
      tam[i] = 1 + rnd() * 1.6;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(cor, 3)); g.setAttribute('aTam', new THREE.BufferAttribute(tam, 1));
    const luzinhas = new THREE.Points(g, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uTempo: { value: 0 }, uPx: { value: 1 } }, vertexColors: true,
      vertexShader: /* glsl */ `attribute float aTam; uniform float uTempo, uPx; varying vec3 vC;
        void main() { vC = color * (0.75 + 0.25 * sin(uTempo * (0.6 + aTam) + position.x * 3.0)); gl_PointSize = aTam * uPx; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `varying vec3 vC; void main() { float r = length(gl_PointCoord - 0.5) * 2.0; gl_FragColor = vec4(vC * smoothstep(1.0, 0.2, r), 1.0); }`,
    }));
    mundo.add(luzinhas); objetos.luzinhas = luzinhas;
  }

  // céu: degradê noturno, estrelas, lua e um véu de nuvens
  const dirLua = new THREE.Vector3(-0.42, 0.5, -0.76).normalize();
  const ceu = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 20), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uLua: { value: dirLua }, uTempo: { value: 0 } },
    vertexShader: /* glsl */ `varying vec3 vDir; void main() { vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uLua; uniform float uTempo; varying vec3 vDir;
      ${GLSL_RUIDO}
      float hash31(vec3 p) { p = fract(p * vec3(443.897, 441.423, 437.195)); p += dot(p, p.yzx + 19.19); return fract((p.x + p.y) * p.z); }
      float estrelas(vec3 d, float esc, float lim) {
        vec3 p = d * esc, i = floor(p), f = fract(p) - 0.5;
        float h = hash31(i);
        vec3 o = vec3(hash31(i + 1.3), hash31(i + 2.7), hash31(i + 4.1)) - 0.5;
        float s = smoothstep(0.11, 0.0, length(f - o * 0.6));
        return s * step(lim, h) * (0.4 + 2.6 * fract(h * 37.0));
      }
      void main() {
        vec3 d = normalize(vDir);
        float h = max(d.y, 0.0);
        vec3 topo = vec3(0.0025, 0.006, 0.019), meio = vec3(0.008, 0.02, 0.05), horiz = vec3(0.035, 0.05, 0.085);
        vec3 cor = mix(horiz, meio, smoothstep(0.0, 0.22, h));
        cor = mix(cor, topo, smoothstep(0.18, 0.85, h));
        cor += vec3(0.07, 0.04, 0.018) * exp(-h * 9.0);                      // clarão da cidade no horizonte
        float cint = 0.75 + 0.25 * sin(uTempo * 2.0 + d.x * 90.0 + d.z * 70.0);
        float e = estrelas(d, 150.0, 0.955) + 0.6 * estrelas(d, 260.0, 0.94);
        float m = max(dot(d, uLua), 0.0);
        float nuvem = smoothstep(0.42, 0.85, fbm2(d.xz / (h + 0.25) * 1.6 + vec2(uTempo * 0.004, 0.0))) * smoothstep(0.02, 0.3, h);
        cor += vec3(0.85, 0.92, 1.0) * e * cint * smoothstep(0.03, 0.25, h) * (1.0 - nuvem * 0.85);
        cor += vec3(0.03, 0.04, 0.06) * nuvem * (0.5 + 2.2 * pow(m, 6.0));
        cor += vec3(0.55, 0.68, 1.0) * (pow(m, 900.0) * 0.6 + pow(m, 60.0) * 0.07 + pow(m, 8.0) * 0.02);
        cor += vec3(1.0, 0.97, 0.9) * smoothstep(0.99962, 0.99974, m) * 5.0;  // disco da lua
        gl_FragColor = vec4(cor, 1.0);
      }`,
  }));
  ceu.frustumCulled = false; ceu.renderOrder = -10;
  mundo.add(ceu);

  // poeira no ar, perto das luzes
  const nPoeira = leve ? 120 : 320;
  const pp = new Float32Array(nPoeira * 3), ps = new Float32Array(nPoeira);
  for (let i = 0; i < nPoeira; i++) {
    const perto = i % 2 === 0;
    if (perto) pp.set([-7.5 + rnd() * 6, 0.3 + rnd() * 5.5, 0.6 + rnd() * 5], i * 3);
    else pp.set([4.6 + rnd() * 4.5, 0.3 + rnd() * 2.6, 0.2 + rnd() * 3.6], i * 3);
    ps[i] = rnd();
  }
  const gPoeira = new THREE.BufferGeometry();
  gPoeira.setAttribute('position', new THREE.BufferAttribute(pp, 3)); gPoeira.setAttribute('aSem', new THREE.BufferAttribute(ps, 1));
  const poeira = new THREE.Points(gPoeira, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uTempo: { value: 0 }, uTam: { value: 14 } },
    vertexShader: /* glsl */ `attribute float aSem; uniform float uTempo, uTam; varying float vA; varying float vQ;
      void main() {
        vec3 p = position + vec3(sin(uTempo * 0.21 + aSem * 40.0), sin(uTempo * 0.13 + aSem * 70.0) * 0.6, cos(uTempo * 0.17 + aSem * 55.0)) * 0.35;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vA = (0.25 + 0.75 * aSem) * smoothstep(0.35, 1.6, -mv.z) * (0.6 + 0.4 * sin(uTempo * 0.9 + aSem * 30.0));
        vQ = step(0.0, position.x);
        gl_PointSize = uTam * (0.4 + aSem) / max(0.5, -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `varying float vA; varying float vQ;
      void main() { float r = length(gl_PointCoord - 0.5) * 2.0; float m = smoothstep(1.0, 0.0, r);
        vec3 cor = mix(vec3(0.55, 0.7, 1.0), vec3(1.0, 0.66, 0.35), vQ);
        gl_FragColor = vec4(cor * m * m * vA * 0.22, 1.0); }`,
  }));
  poeira.frustumCulled = false; poeira.renderOrder = 4;
  mundo.add(poeira);

  // Junta as peças paradas que usam o mesmo material numa malha só: de centenas de chamadas de desenho para dezenas.
  {
    mundo.updateMatrixWorld(true);
    const grupos = new Map();
    mundo.traverse((o) => {
      if (!o.isMesh || o.isSkinnedMesh || o === espelho || Array.isArray(o.material) || o.material.isShaderMaterial) return;
      // os modelos comprimidos (glb com meshopt) guardam posições quantizadas: ficam como estão
      if (!(o.geometry.attributes.position.array instanceof Float32Array)) return;
      const chave = [o.material.uuid, o.castShadow, o.receiveShadow, o.renderOrder].join('|');
      if (!grupos.has(chave)) grupos.set(chave, []);
      grupos.get(chave).push(o);
    });
    for (const malhas of grupos.values()) {
      if (malhas.length < 2) continue;
      const geos = malhas.map((o) => {
        const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
        for (const nome of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(nome)) g.deleteAttribute(nome);
        if (!g.attributes.normal) g.computeVertexNormals();
        if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
        g.applyMatrix4(o.matrixWorld);
        return g;
      });
      const junta = new THREE.Mesh(mergeGeometries(geos), malhas[0].material);
      junta.castShadow = malhas[0].castShadow; junta.receiveShadow = malhas[0].receiveShadow; junta.renderOrder = malhas[0].renderOrder;
      for (const o of malhas) { o.removeFromParent(); o.geometry.dispose(); }
      for (const g of geos) g.dispose();
      mundo.add(junta);
    }
  }

  return {
    mundo, luzes, objetos, dirLua, espelho,
    atualiza(tempo, alturaPx = 900, dpr = 1) {
      ceu.material.uniforms.uTempo.value = tempo;
      poeira.material.uniforms.uTempo.value = tempo;
      poeira.material.uniforms.uTam.value = alturaPx * dpr * 0.009;
      objetos.luzinhas.material.uniforms.uTempo.value = tempo;
      objetos.luzinhas.material.uniforms.uPx.value = Math.max(1.5, (alturaPx * dpr) / 520);
    },
  };
}
