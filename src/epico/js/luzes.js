// A noite da cidade vista de longe e fora de foco: um fundo em degradê com névoa e centenas de luzes em
// disco (o desfoque de lente das luzes distantes). Tudo em profundidades diferentes, para que a descida e
// o voo do avião tenham paralaxe de verdade.
import * as THREE from 'three';

export function criaLuzes(leve) {
  const grupo = new THREE.Group();

  // --- fundo: acompanha a câmera, sempre atrás de tudo ---
  const fundo = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    depthWrite: false, transparent: true,
    uniforms: { uForca: { value: 0 }, uTempo: { value: 0 }, uDesl: { value: new THREE.Vector2() }, uA: { value: 1.78 } },
    vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, .99995, 1.); }`,
    fragmentShader: /* glsl */`
      uniform float uForca, uTempo, uA; uniform vec2 uDesl; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 45758.5); }
      float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
        return mix(mix(h(i), h(i + vec2(1., 0.)), f.x), mix(h(i + vec2(0., 1.)), h(i + 1.), f.x), f.y); }
      void main(){
        vec2 p = vec2((vUv.x - .5) * uA, vUv.y - .5);
        // céu noturno azul-petróleo, mais claro e quente perto do "horizonte" da cidade
        vec3 alto = vec3(.004, .018, .03), baixo = vec3(.016, .055, .08), quente = vec3(.42, .19, .04);
        float y = vUv.y + uDesl.y;
        vec3 c = mix(baixo, alto, smoothstep(-.1, .95, y));
        float nev = n(p * 1.6 + vec2(uTempo * .012 + uDesl.x, uDesl.y * 2.)) * .6 + n(p * 3.7 - vec2(uTempo * .02 - uDesl.x * 2., 0.)) * .4;
        c += quente * (1. - smoothstep(-.15, .5, y)) * (.2 + .8 * nev) * .3;
        c += vec3(.02, .06, .08) * nev * .5;
        c *= 1. - .45 * dot(p, p);
        gl_FragColor = vec4(c, uForca);
        #include <colorspace_fragment>
      }`,
  }));
  fundo.frustumCulled = false; fundo.renderOrder = -20; grupo.add(fundo);

  // --- luzes em disco ---
  const N = leve ? 150 : 340;
  const pos = new Float32Array(N * 3), cor = new Float32Array(N * 3), dad = new Float32Array(N * 2);
  const paleta = [[1, .62, .2], [1, .74, .36], [1, .5, .16], [.35, .78, .95], [.55, .86, 1], [1, .92, .78], [.95, .36, .3]];
  let sem = 7; const al = () => ((sem = (sem * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < N; i++) {
    const fundoZ = al();
    pos.set([-4 + al() * 17, -0.7 - Math.pow(al(), 0.8) * 5.6, -2.4 - fundoZ * 7.5], i * 3);
    const c = paleta[Math.floor(al() * (al() < 0.72 ? 3 : paleta.length))];
    const b = 0.4 + al() * 1.1;
    cor.set([c[0] * b, c[1] * b, c[2] * b], i * 3);
    dad.set([0.1 + al() * al() * 0.62, al() * 6.283], i * 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('aCor', new THREE.BufferAttribute(cor, 3)); geo.setAttribute('aDad', new THREE.BufferAttribute(dad, 2));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uForca: { value: 0 }, uTempo: { value: 0 }, uEsc: { value: 800 } },
    vertexShader: /* glsl */`
      attribute vec3 aCor; attribute vec2 aDad; uniform float uTempo, uEsc; varying vec3 vCor; varying float vT;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.);
        vT = .72 + .28 * sin(uTempo * (.5 + aDad.y * .2) + aDad.y * 9.);
        vCor = aCor / (.6 + aDad.x * 2.4);                 // discos grandes são mais tênues
        gl_PointSize = min(uEsc * aDad.x / -mv.z, 420.);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform float uForca; varying vec3 vCor; varying float vT;
      void main(){
        float r = length(gl_PointCoord - .5) * 2.;
        // disco de desfoque: miolo suave, borda um pouco mais clara, corte macio
        float d = (1. - smoothstep(.9, 1., r)) * (.5 + .5 * smoothstep(.55, .95, r));
        gl_FragColor = vec4(vCor * d * vT * uForca * .3, 1.);
        #include <colorspace_fragment>
      }`,
  });
  const pontos = new THREE.Points(geo, mat); pontos.frustumCulled = false; pontos.renderOrder = -10; grupo.add(pontos);

  return {
    grupo,
    ajusta(forca, tempo, camera, alturaPx, aspecto) {
      const v = forca > 0.001; grupo.visible = v; if (!v) return;
      fundo.material.uniforms.uForca.value = Math.min(1, forca * 1.2); fundo.material.uniforms.uTempo.value = tempo; fundo.material.uniforms.uA.value = aspecto;
      fundo.material.uniforms.uDesl.value.set(camera.position.x * 0.04, camera.position.y * 0.05);
      mat.uniforms.uForca.value = forca; mat.uniforms.uTempo.value = tempo; mat.uniforms.uEsc.value = alturaPx * 0.9;
    },
  };
}
