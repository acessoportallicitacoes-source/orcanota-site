// O sinal: a linha de energia que sai do celular do prestador (azul, o "o" da marca) e chega ao celular da
// cliente (âmbar, o "n"). Núcleo brilhante + halo + ponto de luz na frente + partículas. Tudo depende só do avanço
// `cabeca` (0..1), então rolar para trás desfaz o desenho.
import * as THREE from 'three';
import { glslCor } from './util.js';

const CORES = /* glsl */ `
vec3 corSinal(float u) {
  vec3 a = ${glslCor('#7EC0E6', 1.0)}, b = ${glslCor('#0E5A8A', 5.0)}, c = ${glslCor('#F5A30A', 1.5)};
  // do azul para o âmbar passando por um branco quente: misturar os dois direto daria um tom apagado no meio
  vec3 w = vec3(1.25, 1.02, 0.78);
  vec3 cor = mix(a, b, smoothstep(0.0, 0.36, u));
  cor = mix(cor, w, smoothstep(0.5, 0.7, u));
  return mix(cor, c, smoothstep(0.66, 0.88, u));
}`;

function texturaBrilho() {
  const n = 128, c = document.createElement('canvas'); c.width = c.height = n;
  const x = c.getContext('2d'), g = x.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.12, 'rgba(255,255,255,.75)');
  g.addColorStop(0.35, 'rgba(255,255,255,.16)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, n, n);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function corDoSinal(u, alvo = new THREE.Color()) {
  const a = new THREE.Color('#7EC0E6'), b = new THREE.Color('#2A8FD0'), w = new THREE.Color('#FFE2B8'), c = new THREE.Color('#F5A30A');
  const s = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
  return alvo.copy(a).lerp(b, s(0, 0.36, u)).lerp(w, s(0.5, 0.7, u)).lerp(c, s(0.66, 0.88, u));
}

export function criaSinal({ de, para, particulas = 1400, altura = 6.4 }) {
  const grupo = new THREE.Group();
  const curva = new THREE.CubicBezierCurve3(
    de.clone(),
    de.clone().add(new THREE.Vector3(0.9, altura * 0.92, 0.9)),
    para.clone().add(new THREE.Vector3(-1.6, altura, 1.1)),
    para.clone(),
  );
  const uniformes = { uCabeca: { value: 0 }, uTempo: { value: 0 }, uForca: { value: 1 }, uRastro: { value: 1 }, uQuente: { value: 1 }, uApagaFim: { value: 0 } };

  // O tubo afina perto dos dois celulares e engrossa no ar.
  const vert = (raio) => /* glsl */ `
    varying vec2 vUv; varying vec3 vN; varying vec3 vV;
    void main() {
      vUv = uv;
      float fino = mix(0.22, 1.0, smoothstep(0.0, 0.16, uv.x) * (1.0 - smoothstep(0.86, 1.0, uv.x)));
      vec3 p = position - normal * ${raio.toFixed(4)} * (1.0 - fino);
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
      gl_Position = projectionMatrix * mv;
    }`;
  const nucleo = new THREE.Mesh(
    new THREE.TubeGeometry(curva, 260, 0.02, 8, false),
    new THREE.ShaderMaterial({
      uniforms: uniformes, vertexShader: vert(0.02), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      fragmentShader: /* glsl */ `
        uniform float uCabeca, uTempo, uForca, uRastro, uQuente, uApagaFim; varying vec2 vUv;
        ${CORES}
        void main() {
          float u = vUv.x;
          if (u > uCabeca) discard;
          float d = uCabeca - u;
          float quente = exp(-d * 30.0) * uQuente;
          float pulso = 0.82 + 0.18 * sin(u * 120.0 - uTempo * 9.0);
          float nasce = smoothstep(0.0, 0.012, u);
          float rastro = mix(uRastro, 1.0, quente) * (1.0 - uApagaFim * smoothstep(0.78, 0.97, u));
          vec3 cor = corSinal(u) * (1.5 + 4.0 * quente) * pulso + vec3(1.0) * quente * quente * 3.0;
          gl_FragColor = vec4(cor * nasce * rastro * uForca, 1.0);
        }`,
    }),
  );
  const halo = new THREE.Mesh(
    new THREE.TubeGeometry(curva, 200, 0.085, 10, false),
    new THREE.ShaderMaterial({
      uniforms: uniformes, vertexShader: vert(0.085), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide,
      fragmentShader: /* glsl */ `
        uniform float uCabeca, uTempo, uForca, uRastro, uQuente, uApagaFim; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
        ${CORES}
        void main() {
          float u = vUv.x;
          if (u > uCabeca) discard;
          float d = uCabeca - u;
          float quente = exp(-d * 14.0) * uQuente;
          float centro = pow(abs(dot(normalize(vN), normalize(vV))), 2.6);
          float nasce = smoothstep(0.0, 0.03, u) * smoothstep(0.0, 0.01, d);
          float rastro = mix(uRastro, 1.0, quente) * (1.0 - uApagaFim * smoothstep(0.78, 0.97, u));
          gl_FragColor = vec4(corSinal(u) * centro * (0.16 + 0.8 * quente) * nasce * rastro * uForca, 1.0);
        }`,
    }),
  );
  nucleo.frustumCulled = halo.frustumCulled = false;
  nucleo.renderOrder = halo.renderOrder = 5;
  grupo.add(halo, nucleo);

  // ponto de luz na frente
  const brilho = texturaBrilho();
  const ponto = new THREE.Sprite(new THREE.SpriteMaterial({ map: brilho, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, color: 0xffffff }));
  const aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: brilho, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  ponto.renderOrder = aura.renderOrder = 6;
  const luz = new THREE.PointLight(0xffffff, 0, 16, 1.8);
  grupo.add(ponto, aura, luz);

  // partículas finas que se soltam do rastro
  const n = particulas;
  const pos = new Float32Array(n * 3), dir = new Float32Array(n * 3), us = new Float32Array(n), sem = new Float32Array(n);
  const p = new THREE.Vector3(), v = new THREE.Vector3();
  let s = 7;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < n; i++) {
    const u = rnd() ** 0.9;
    curva.getPoint(u, p);
    v.set(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize().multiplyScalar(0.3 + rnd() * 0.7);
    pos.set([p.x, p.y, p.z], i * 3); dir.set([v.x, v.y, v.z], i * 3); us[i] = u; sem[i] = rnd();
  }
  const geoP = new THREE.BufferGeometry();
  geoP.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geoP.setAttribute('aDir', new THREE.BufferAttribute(dir, 3));
  geoP.setAttribute('aU', new THREE.BufferAttribute(us, 1));
  geoP.setAttribute('aSem', new THREE.BufferAttribute(sem, 1));
  const uPart = { ...uniformes, uTam: { value: 30 }, uFim: { value: 1 } };
  const pontos = new THREE.Points(geoP, new THREE.ShaderMaterial({
    uniforms: uPart, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute vec3 aDir; attribute float aU, aSem;
      uniform float uCabeca, uTempo, uTam, uFim;
      varying float vA; varying float vU;
      void main() {
        float idade = uCabeca - aU;
        float vida = clamp(idade / mix(0.07, 0.3, aSem), 0.0, 1.0);
        vec3 p = position + aDir * (0.04 + vida * 0.75) + vec3(0.0, -0.5 * vida * vida, 0.0);
        p += 0.03 * vec3(sin(uTempo * 1.7 + aSem * 50.0), cos(uTempo * 1.3 + aSem * 80.0), sin(uTempo * 1.1 + aSem * 20.0));
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float cintila = 0.55 + 0.45 * sin(uTempo * (6.0 + aSem * 8.0) + aSem * 100.0);
        vA = step(0.0, idade) * (1.0 - vida) * (1.0 - vida) * cintila * uFim;
        vU = aU;
        gl_PointSize = uTam * (0.35 + aSem * 0.9) * (1.0 - 0.55 * vida) / max(0.4, -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      varying float vA; varying float vU;
      ${CORES}
      void main() {
        if (vA <= 0.001) discard;
        float r = length(gl_PointCoord - 0.5) * 2.0;
        float m = smoothstep(1.0, 0.0, r); m *= m;
        gl_FragColor = vec4((corSinal(vU) * 1.6 + vec3(0.6)) * m * vA, 1.0);
      }`,
  }));
  pontos.frustumCulled = false; pontos.renderOrder = 6;
  grupo.add(pontos);

  // anéis de partida e de chegada
  const anel = (cor) => {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.94, 1, 64), new THREE.MeshBasicMaterial({ color: cor, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    m.renderOrder = 6; grupo.add(m); return m;
  };
  const anelSaida = anel(new THREE.Color('#7EC0E6').multiplyScalar(2.5));
  const anelChegada = anel(new THREE.Color('#F5A30A').multiplyScalar(2.5));
  anelSaida.position.copy(de); anelChegada.position.copy(para);

  const cor = new THREE.Color(), pc = new THREE.Vector3();
  return {
    grupo, curva, uniformes,
    /** posição da cabeça do sinal no mundo */
    ponta: (alvo = new THREE.Vector3(), u = uniformes.uCabeca.value) => curva.getPoint(Math.min(1, Math.max(0, u)), alvo),
    /**
     * @param cabeca 0..1 avanço do sinal
     * @param tempo segundos
     * @param saida 0..1 anel de partida; chegada 0..1 anel de chegada
     * @param rastro 0..1 quanto o rastro continua aceso atrás da cabeça
     */
    atualiza({ cabeca, tempo, saida = 0, chegada = 0, rastro = 1, apagaFim = 0, camera, luzMax = 60 }) {
      uniformes.uCabeca.value = cabeca; uniformes.uTempo.value = tempo; uniformes.uRastro.value = rastro;
      uniformes.uQuente.value = (1 - chegada) ** 2 * (0.35 + 0.65 * Math.min(1, cabeca / 0.08)); uniformes.uApagaFim.value = apagaFim;
      uPart.uFim.value = 1 - chegada * 0.85;
      const ativo = cabeca > 0.0005 && cabeca < 0.9995;
      curva.getPoint(cabeca, pc);
      corDoSinal(cabeca, cor);
      const pulso = 1 + 0.12 * Math.sin(tempo * 11);
      ponto.visible = aura.visible = cabeca > 0.0005;
      ponto.position.copy(pc); aura.position.copy(pc);
      const viva = ativo ? 1 : cabeca >= 0.9995 ? Math.max(0, 1 - chegada) ** 3 * 0.9 : 0;
      // perto dos celulares a luz do sinal baixa, para não estourar quem está segurando
      const perto = Math.min(1, Math.min(cabeca, 1 - cabeca) / 0.1); const longe = 0.12 + 0.88 * perto * perto;
      ponto.scale.setScalar(0.42 * pulso * (0.4 + 0.6 * viva) * (0.45 + 0.55 * perto));
      ponto.material.color.setScalar(3.2 * viva * (0.25 + 0.75 * perto));
      aura.scale.setScalar((0.5 + 1.2 * perto) * pulso);
      aura.material.color.copy(cor).multiplyScalar(0.9 * viva);
      luz.position.copy(pc);
      luz.color.copy(cor);
      luz.intensity = luzMax * viva * longe;
      for (const [a, k, raio] of [[anelSaida, saida, 0.13], [anelChegada, chegada, 0.24]]) {
        a.visible = k > 0.001 && k < 0.999;
        if (!a.visible) continue;
        a.scale.setScalar(0.03 + (1 - (1 - k) ** 2) * raio);
        a.material.opacity = 0.5 * (1 - k) ** 1.5;
        if (camera) a.quaternion.copy(camera.quaternion);
      }
    },
    defineTamanho(alturaPx, dpr) { uPart.uTam.value = alturaPx * dpr * 0.034; },
  };
}
