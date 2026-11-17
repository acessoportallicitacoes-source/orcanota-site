// Cena 4, "O envio": protótipo em 3D em tempo real, preso à rolagem.
// Endereço: /prototipos/cena-4/   Parâmetros úteis para conferir:
//   ?p=0.5      fixa o avanço (0 a 1) sem depender da rolagem
//   ?q=leve     força a qualidade de celular; ?q=alta força a de computador
//   ?fps        mostra o medidor de quadros
//   ?livre      câmera livre (arrastar para girar); ?livre=ela começa perto da cliente
//   ?tom=agx    troca o tonemapping (aces é o padrão)
//   ?parado     mostra o estado final sem animação (o mesmo que prefers-reduced-motion)
//   ?sem=dof,bloom,grao,vinheta,tom,reflexo   desliga efeitos, para comparar custo
//   ?captura    carrega a ferramenta que gerou as imagens da pasta capturas/ (ver captura.js)
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { faixa, suave, limita } from './util.js';
import { criaMundo, ANCORAS } from './mundo.js';
import { Personagem } from './personagens.js';
import { criaCelular, criaToque, criaConversa, CEL } from './celulares.js';
import { criaSinal } from './sinal.js';
import { criaRoteiro } from './camera.js';
import { criaEfeitos } from './efeitos.js';
import urlTelaEnviar from '../../../src/assets/telas/09-folha-enviar.webp';
import urlPaginaPdf from '../../../src/assets/telas/orcamento-pagina.webp';

const RECURSOS = import.meta.url.slice(0, import.meta.url.lastIndexOf('/src/')) + '/recursos/';
const params = new URLSearchParams(location.search);
const secao = document.getElementById('cena-4');
const palco = secao.querySelector('.palco');
const canvas = palco.querySelector('.tela3d');
const barra = palco.querySelector('.carregando');
const medidor = palco.querySelector('.medidor');

const semMovimento = matchMedia('(prefers-reduced-motion: reduce)').matches || params.has('parado');
if (semMovimento) document.documentElement.classList.add('sem-movimento');
const leve = params.get('q') ? params.get('q') === 'leve' : (matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 600);
const ehVertical = () => palco.clientWidth / palco.clientHeight < 0.8;
const pFixo = params.has('p') ? limita(parseFloat(params.get('p'))) : null;

// ---------------------------------------------------------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false, alpha: false });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;             // o tonemapping é feito no pós-processamento
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
const dprMax = leve ? 1.5 : 1.75;
let dpr = Math.min(devicePixelRatio || 1, dprMax);
renderer.setPixelRatio(dpr);

const cena = new THREE.Scene();
cena.background = new THREE.Color(0x04080f);
cena.fog = new THREE.FogExp2(0x0a1524, 0.0125);
const camera = new THREE.PerspectiveCamera(35, 1, 0.03, 600);

// ---- carga ----
let total = 0, feitos = 0;
const conta = (promessa) => { total++; return promessa.then((r) => { feitos++; barra.style.setProperty('--carga', (feitos / total).toFixed(3)); return r; }); };
const carregaTex = new THREE.TextureLoader();
const carregaGlb = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const textura = (c) => conta(carregaTex.loadAsync(c.startsWith('http') || c.startsWith('/') || c.startsWith('data:') ? c : RECURSOS + c));
const glb = (c) => conta(carregaGlb.loadAsync(RECURSOS + c));
const imagem = (src) => conta(new Promise((ok, erro) => { const i = new Image(); i.onload = () => ok(i); i.onerror = erro; i.src = src; }));

async function inicia() {
  const anisotropia = Math.min(leve ? 4 : 8, renderer.capabilities.getMaxAnisotropy());
  const sem = (params.get('sem') ?? '').split(',');
  const [hdr, mundo, gEle, gEla, gCabeloCurto, gCabeloLongo, texEnviar, imgPdf] = await Promise.all([
    conta(new HDRLoader().loadAsync(RECURSOS + 'hdri/preller_drive_1k.hdr')),
    criaMundo({ textura, glb, leve, anisotropia, reflexo: !sem.includes('reflexo') }),
    glb('modelos/eletricista.glb'), glb('modelos/cliente.glb'),
    glb('modelos/cabelo-curto.glb'), glb('modelos/cabelo-longo.glb'),
    textura(urlTelaEnviar), imagem(urlPaginaPdf),
    document.fonts?.load(`600 44px 'Inter Variable'`).catch(() => {}),
    document.fonts?.load(`400 42px 'Inter Variable'`).catch(() => {}),
  ]);

  // luz ambiente e reflexos: HDRI noturno
  const pmrem = new THREE.PMREMGenerator(renderer);
  hdr.mapping = THREE.EquirectangularReflectionMapping;
  cena.environment = pmrem.fromEquirectangular(hdr).texture;
  cena.environmentIntensity = 0.38;
  hdr.dispose(); pmrem.dispose();
  cena.add(mundo.mundo);

  // ---- celulares ----
  texEnviar.colorSpace = THREE.SRGBColorSpace;
  const celEle = criaCelular(texEnviar, { anisotropia: renderer.capabilities.getMaxAnisotropy() });
  const toque = criaToque(celEle);
  const conversa = criaConversa(imgPdf);
  const celEla = criaCelular(conversa.mapa, { anisotropia: renderer.capabilities.getMaxAnisotropy() });

  // ---- personagens ----
  const ele = new Personagem({ tipo: 'eletricista', gltf: gEle, cabelos: [gCabeloCurto], mao: 'r', pele: 0xf2d6c0, cabelo: 0x2a1d15, celular: celEle, fase: 0.0 });
  const ela = new Personagem({ tipo: 'cliente', gltf: gEla, cabelos: [gCabeloLongo], mao: 'l', pele: 0xc9a68c, cabelo: 0x1c120d, celular: celEla, fase: 1.7 });
  for (const [pers, anc] of [[ele, ANCORAS.ele], [ela, ANCORAS.ela]]) {
    pers.grupo.position.copy(anc.pos);
    pers.grupo.rotation.y = Math.atan2(anc.frente.x, anc.frente.z);
    cena.add(pers.grupo);
  }
  ele.celLocal.set(-0.11, 1.33, 0.37); ele.inclina = -0.35;
  ela.celLocal.set(0.1, 1.27, 0.33); ela.inclina = -0.3; ela.pega = 0.68;
  Object.assign(ela.dedos, { polegarAbre: -0.25, polegarFecha: 0.35 });   // o polegar dela fica atrás do aparelho
  Object.assign(ela.dobra, { index: 0.3, middle: 0.28, ring: 0.25, pinky: 0.2 });
  ele.atualiza(0); ela.atualiza(0);

  // luz das telas no rosto de cada um
  const luzDaTela = (cel, cor) => {
    const l = new THREE.SpotLight(cor, 1, 1.4, 0.7, 1, 2);
    l.position.set(0, 0, 0.02); l.target.position.set(0, 0.45, 1);
    cel.add(l, l.target); return l;
  };
  // no celular (qualidade leve) as telas não acendem luz de verdade: é uma luz a menos por pixel
  const luzTelaEle = leve ? { intensity: 0 } : luzDaTela(celEle, 0xcfe4ff);
  const luzTelaEla = leve ? { intensity: 0 } : luzDaTela(celEla, 0xdfeaff);

  // ---- sinal ----
  const de = celEle.localToWorld(new THREE.Vector3(0, CEL.a / 2 + 0.004, 0));
  const para = celEla.localToWorld(new THREE.Vector3(0, CEL.a * 0.32, 0.012));
  const sinal = criaSinal({ de, para, particulas: leve ? 600 : 1500 });
  cena.add(sinal.grupo);

  // ---- câmera ----
  const ancora = (pers, anc) => {
    const frente = anc.frente.clone();
    const direita = new THREE.Vector3().crossVectors(frente, new THREE.Vector3(0, 1, 0)).normalize();
    const qCel = pers.celular.getWorldQuaternion(new THREE.Quaternion());
    return {
      cel: pers.posCelular(), nTela: new THREE.Vector3(0, 0, 1).applyQuaternion(qCel),
      cimaTela: new THREE.Vector3(0, 1, 0).applyQuaternion(qCel), dirTela: new THREE.Vector3(1, 0, 0).applyQuaternion(qCel),
      cabeca: pers.osso.Head.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.08, 0)),
      frente, lado: pers.mao === 'r' ? direita : direita.clone().negate(),
    };
  };
  let vertical = ehVertical();
  let roteiro = criaRoteiro({ ele: ancora(ele, ANCORAS.ele), ela: ancora(ela, ANCORAS.ela), vertical });
  const efeitos = criaEfeitos(renderer, cena, camera, { leve, tom: params.get('tom') ?? 'aces', sem });

  let controles = null;
  if (params.has('livre')) {
    const { OrbitControls } = await import('three/addons/controls/OrbitControls.js');
    controles = new OrbitControls(camera, canvas);
    const quem = params.get('livre') === 'ela' ? ela : ele;
    const c = quem.posCelular();
    controles.target.copy(c).add(new THREE.Vector3(0, 0.1, 0));
    camera.position.copy(c).add(new THREE.Vector3(quem === ele ? 1.2 : -1.2, 0.5, 2.2));
    camera.fov = 40;
    canvas.style.touchAction = 'none';
    palco.style.position = 'fixed'; palco.style.inset = '0';
  }

  // ---- tamanho ----
  function ajusta() {
    const l = palco.clientWidth, a = palco.clientHeight;
    renderer.setPixelRatio(dpr);
    renderer.setSize(l, a, false);
    efeitos.tamanho(l, a);
    camera.aspect = l / a; camera.updateProjectionMatrix();
    sinal.defineTamanho(a, dpr);
    const v = ehVertical();
    if (v !== vertical) { vertical = v; roteiro = criaRoteiro({ ele: ancora(ele, ANCORAS.ele), ela: ancora(ela, ANCORAS.ela), vertical }); }
    pedeQuadro();
  }
  new ResizeObserver(ajusta).observe(palco);

  // ---- avanço pela rolagem ----
  function avancoDaRolagem() {
    if (pForcado !== null) return pForcado;
    if (semMovimento) return 1;
    const percurso = secao.offsetHeight - innerHeight;
    return percurso <= 0 ? 1 : limita(-secao.getBoundingClientRect().top / percurso);
  }
  let pForcado = pFixo;
  let p = avancoDaRolagem();
  let visivel = true, pedido = 0, antes = performance.now(), tempo = 0;
  new IntersectionObserver(([e]) => { visivel = e.isIntersecting; if (visivel) pedeQuadro(); }).observe(secao);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { antes = performance.now(); pedeQuadro(); } });
  addEventListener('scroll', () => pedeQuadro(), { passive: true });

  const ponta = new THREE.Vector3(), corLuz = new THREE.Color();
  const estado = { quadros: 0, somaMs: 0, fps: 0, ultimoAjuste: 0 };
  let nQuadro = 0;
  renderer.shadowMap.autoUpdate = false;
  renderer.info.autoReset = false;

  function quadro(agora) {
    if (pedido) cancelAnimationFrame(pedido);
    renderer.info.reset();
    pedido = 0;
    const dtReal = Math.min(0.1, (agora - antes) / 1000); antes = agora;
    const dt = semMovimento ? 0 : dtReal;
    tempo += dt;

    const alvoP = avancoDaRolagem();
    p = semMovimento || pForcado !== null ? alvoP : p + (alvoP - p) * (1 - Math.exp(-dtReal * 9));
    if (Math.abs(alvoP - p) < 0.0002) p = alvoP;
    palco.style.setProperty('--p', p.toFixed(4));

    // linha do tempo da cena
    const aperta = suave(faixa(p, 0.06, 0.112)) * (1 - suave(faixa(p, 0.13, 0.19)));
    const onda = faixa(p, 0.112, 0.2);
    const s = faixa(p, 0.185, 0.745);
    const cabeca = 0.35 * s + 0.65 * suave(s);
    const saida = faixa(p, 0.175, 0.3);
    const chegada = faixa(p, 0.745, 0.86);
    const acende = suave(faixa(p, 0.735, 0.775));
    const clarao = Math.exp(-(((p - 0.765) / 0.022) ** 2));
    const rastro = 1 - 0.72 * suave(faixa(p, 0.8, 0.97));

    ele.toque = aperta; toque(onda);
    // a pose é refeita a cada quadro no computador e a cada dois no celular; as sombras, de tempos em tempos
    nQuadro++;
    if (!leve || nQuadro % 2 === 0 || semMovimento) { ele.atualiza(dt * (leve ? 2 : 1)); ela.atualiza(dt * (leve ? 2 : 1)); }
    if (nQuadro < 4 || nQuadro % (leve ? 45 : 3) === 0) renderer.shadowMap.needsUpdate = true;

    celEle.userData.brilho(0.9);
    celEla.userData.brilho(0.28 + 0.54 * acende + 0.25 * clarao);
    conversa.desenha(faixa(p, 0.752, 0.83));
    luzTelaEle.intensity = 0.7;
    luzTelaEla.intensity = 0.2 + 0.4 * acende + 0.5 * clarao;

    sinal.atualiza({ cabeca, tempo, saida, chegada, rastro, apagaFim: suave(faixa(p, 0.8, 0.9)), camera, luzMax: leve ? 45 : 60 });
    sinal.ponta(ponta);
    mundo.atualiza(tempo, palco.clientHeight, dpr);

    if (controles) controles.update();
    else {
      const c = roteiro.avalia(p, ponta);
      const respira = semMovimento ? 0 : 1;
      camera.position.copy(c.pos);
      camera.position.x += Math.sin(tempo * 0.37) * 0.004 * respira * (1 + c.faixaFoco);
      camera.position.y += Math.sin(tempo * 0.29 + 1.3) * 0.003 * respira * (1 + c.faixaFoco);
      camera.up.copy(c.cima);
      camera.lookAt(c.alvo);
      if (Math.abs(camera.fov - c.fov) > 0.001) { camera.fov = c.fov; camera.updateProjectionMatrix(); }
      efeitos.foco(c.distFoco, c.faixaFoco, c.desfoque);
    }
    efeitos.desenha(dtReal);

    // medidor e resolução adaptativa
    estado.quadros++; estado.somaMs += dtReal * 1000;
    if (estado.somaMs > 1000) {
      estado.fps = (estado.quadros * 1000) / estado.somaMs;
      if (!medidor.hidden) medidor.textContent = `${estado.fps.toFixed(0)} fps · dpr ${dpr.toFixed(2)} · p ${p.toFixed(3)}\n${renderer.info.render.triangles} tri · ${renderer.info.render.calls} chamadas`;
      if (!semMovimento && agora - estado.ultimoAjuste > 2500) {
        if (estado.fps < 45 && dpr > 0.8) { dpr = Math.max(0.75, dpr * 0.85); estado.ultimoAjuste = agora; ajusta(); }
        else if (estado.fps > 58 && dpr < Math.min(devicePixelRatio || 1, dprMax) && agora - estado.ultimoAjuste > 8000) { dpr = Math.min(Math.min(devicePixelRatio || 1, dprMax), dpr * 1.1); estado.ultimoAjuste = agora; ajusta(); }
      }
      estado.quadros = 0; estado.somaMs = 0;
    }
    if (!semMovimento || Math.abs(alvoP - p) > 0.0002) pedeQuadro();
  }
  function pedeQuadro() { if (!pedido && visivel && !document.hidden) pedido = requestAnimationFrame(quadro); }

  if (params.has('fps')) medidor.hidden = false;
  ajusta();
  // compila os materiais antes de mostrar, para a primeira rolagem não engasgar
  await renderer.compileAsync(cena, camera).catch(() => {});
  quadro(performance.now());
  palco.classList.add('pronta');
  const vaiPara = (v) => { pForcado = v; p = v ?? avancoDaRolagem(); quadro(performance.now()); };
  if (params.has('captura')) (await import('./captura.js')).instalaCaptura({ renderer, vaiPara, quadro: () => quadro(performance.now()), legenda: palco.querySelector('.legenda') });
  window.__cena4 = { THREE, vaiPara, controles, renderer, cena, camera, ele, ela, sinal, mundo, efeitos, estado, roteiro: () => roteiro, redesenha: pedeQuadro, celEle, celEla };
}

inicia().catch((erro) => {
  console.error(erro);
  barra.querySelector('.carregando-texto').textContent = 'Não foi possível carregar a cena 3D neste aparelho.';
});
