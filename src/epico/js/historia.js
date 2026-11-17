// A história contada pela rolagem: CRIE (o orçamento é preenchido e sai do celular como papel), a queda da
// folha com o orçamento sendo impresso, a dobra em avião (ENVIE), o voo até o celular da cliente e o RECEBA.
// `s` é a posição da rolagem em telas (0 = primeira tela). Tudo aqui é função de `s`; o tempo só dá o balanço.
import * as THREE from 'three';
import { limita, mistura, suave, trecho, entraESai } from './util.js';
import { CEL, criaCelular } from './celular.js';
import { criaCenario, FOTOS_CLIENTE } from './cenario.js';
import { criaFolha, criaDocumento, criaSelo, FOLHA } from './folha.js';
import { criaLuzes } from './luzes.js';
import { desenhaConversa } from './conversa.js';
import { LARG, ALT } from './telas.js';

export const TELAS_DA_HISTORIA = 6;
const img = (n) => new URL(`../imagens/${n}`, import.meta.url).href;

// momentos da história (em telas de rolagem)
const S = {
  toque: 0.585, sai: 0.61, solta: 0.96, dobra: 1.915, aviao: 2.45, fura: 2.84,
  chega: 3.45, pousa: 3.88, gira: 4.5, corte: 4.64, recibo: 4.9, carimbo: 5.3, some: 5.62,
};

// Curva suave por pontos-chave [s, [valores]]: passa por todos, sem trancos (tangentes pela vizinhança)
function trilha(chaves) {
  const n = chaves.length, dim = chaves[0][1].length;
  const tang = chaves.map((c, i) => {
    const a = chaves[Math.max(0, i - 1)], b = chaves[Math.min(n - 1, i + 1)], ds = b[0] - a[0] || 1;
    return c[1].map((_, k) => (b[1][k] - a[1][k]) / ds);
  });
  return (s, out = new Array(dim)) => {
    if (s <= chaves[0][0]) { for (let k = 0; k < dim; k++) out[k] = chaves[0][1][k]; return out; }
    if (s >= chaves[n - 1][0]) { for (let k = 0; k < dim; k++) out[k] = chaves[n - 1][1][k]; return out; }
    let i = 0; while (s > chaves[i + 1][0]) i++;
    const h = chaves[i + 1][0] - chaves[i][0], t = (s - chaves[i][0]) / h, t2 = t * t, t3 = t2 * t;
    const a = 2 * t3 - 3 * t2 + 1, b = t3 - 2 * t2 + t, c = -2 * t3 + 3 * t2, d = t3 - t2;
    for (let k = 0; k < dim; k++) out[k] = a * chaves[i][1][k] + b * h * tang[i][k] + c * chaves[i + 1][1][k] + d * h * tang[i + 1][k];
    return out;
  };
}

const reais = (v) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const CLIENTE = 'Ana Souza', SERVICO = 'Instalação de ar-condicionado', VALOR = '650,00', RESPOSTA = 'Perfeito! Pode fazer 👍';

export async function criaHistoria(ctx) {
  const { cena, camera, cel, cenario, uCen, rep, dados, leve, renderer, dom: el } = ctx;
  const [medOrc, medRec] = await Promise.all(['folha-orcamento.json', 'folha-recibo.json'].map((f) => fetch(img(f)).then((r) => r.json())));
  const docOrc = criaDocumento(img('folha-orcamento.webp'), medOrc, leve);
  const docRec = criaDocumento(img('folha-recibo.webp'), medRec, leve);
  docOrc.total(reais(0));
  docOrc.pronto.then(() => { conversa.chave = ''; });       // a miniatura do PDF na conversa usa a folha: redesenha quando ela chega

  const folha = criaFolha(docOrc); folha.grupo.visible = false; cena.add(folha.grupo);
  const folhaR = criaFolha(docRec); folhaR.grupo.visible = false; folhaR.uniforms.uRevela.value = 1; folhaR.uniforms.uSelo.value = criaSelo(); cena.add(folhaR.grupo);
  const luzes = criaLuzes(leve); cena.add(luzes.grupo);

  // --- o celular da cliente e a mesa dela, num outro ponto do mundo ---
  const telaC = document.createElement('canvas'); telaC.width = LARG; telaC.height = ALT;
  const texC = new THREE.CanvasTexture(telaC);
  texC.colorSpace = THREE.SRGBColorSpace; texC.generateMipmaps = true; texC.minFilter = THREE.LinearMipmapLinearFilter; texC.anisotropy = 8;
  const celC = criaCelular(texC, texC);
  celC.metal.color.set(0xd8c4b4); celC.matTela.uniforms.uLiga.value = 1; celC.grupo.visible = false; cena.add(celC.grupo);
  const ORIGEM = new THREE.Vector3(9, 0, 0);          // y é definido no arrumar (depende da foto)
  const cenC = criaCenario(texC, texC, FOTOS_CLIENTE, { sobreposto: true, sombra: 0.42, fundo: 0xe9e2d6, origem: ORIGEM });
  cenC.grupo.visible = false; cenC.uniforms.uLuz.value = 1; cena.add(cenC.grupo);
  const conversa = { chave: '', alvo: [0.38, 0.5] };

  // ---------- pontos-chave, refeitos a cada mudança de janela ----------
  let T = null;
  const P0 = new THREE.Vector3(), PC = new THREE.Vector3(), CC = new THREE.Vector3(), ALVO_C = new THREE.Vector3();
  const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3(), v4 = new THREE.Vector3();
  const q1 = new THREE.Quaternion(), q2 = new THREE.Quaternion(), eu = new THREE.Euler(), m4 = new THREE.Matrix4();
  const aux = new THREE.PerspectiveCamera();            // para saber onde a câmera estaria em outro `s`
  const pTotal = docOrc.ponto(606, 234);

  function arrumar() {
    const tv = rep.tanV, a = rep.a;
    const cabe = (l, al, f) => Math.max(al / (2 * f * tv), l / (2 * f * tv * a));
    P0.set(rep.x, rep.y, rep.z);
    const telaY = (v) => P0.y + (0.5 - v) * CEL.telaA;
    const topo = P0.y + CEL.A / 2;
    const dPerto = cabe(CEL.telaL * 1.14, CEL.telaA * 0.62, 1);
    const dSaida = cabe(FOLHA.L * 1.7, FOLHA.A + CEL.A * 0.24, 1);
    const dInt = cabe(FOLHA.L, FOLHA.A, rep.deitado ? 0.72 : 0.8);
    const x = P0.x, z = P0.z;

    // a mesa da cliente: mesma distância e mesmo lugar na tela que o celular da bancada, para o corte casar
    const nomeFoto = rep.deitado ? 'paisagem' : 'retrato', fc = FOTOS_CLIENTE[nomeFoto];
    ORIGEM.y = -2.6 - fc.altura; cenC.usar(nomeFoto);
    CC.set(ORIGEM.x, -2.6, 0);
    const yc = CEL.A / 2 + 0.011, inclina = Math.atan((fc.altura - yc) / rep.d) - Math.atan((rep.deitado ? 0 : 0.04) * tv);
    ALVO_C.set(0, -Math.sin(inclina), -Math.cos(inclina)).multiplyScalar(rep.d).add(CC);
    PC.set(ORIGEM.x + rep.x, ORIGEM.y + yc, -rep.d);
    cenC.uniforms.uFoco.value = rep.d; cenC.uniforms.uDesfoque.value = 0.0004;        // a foto da sala já tem o fundo desfocado: aqui o tampo fica nítido cenC.uniforms.uTelaLuz.value = 0.22;

    // câmera: [s, [px, py, pz, ax, ay, az]] (posição e ponto para onde olha)
    const cam1 = trilha([
      [0.00, [0, rep.alt, 0, rep.alvo.x, rep.alvo.y, rep.alvo.z]],
      [0.24, [x, telaY(0.27) + 0.012, z + dPerto, x, telaY(0.27), z]],
      [0.36, [x, telaY(0.5) + 0.006, z + dPerto, x, telaY(0.5), z]],
      [0.47, [x, telaY(0.66) + 0.004, z + dPerto, x, telaY(0.68), z]],
      [0.57, [x, telaY(0.72), z + dPerto * 1.2, x, telaY(0.78), z]],
      [0.70, [x - 0.03, topo - 0.006, z + dSaida, x, topo + FOLHA.A * 0.2, z]],
      [0.95, [x + 0.035, topo + FOLHA.A * 0.5, z + dSaida, x, topo + FOLHA.A * 0.42, z]],
      [1.12, [x + 0.03, 0.30, 0.12, x, 0.17, z + 0.25]],
      [1.30, [x, 0.12, 0.30, x, -0.08, -0.02]],
      [1.45, [x - 0.03, -0.45, 0.36, x, -0.75, 0.02]],
      [1.65, [x - 0.04, -1.15, 0.38, x, -1.42, 0.03]],
      [1.90, [x, -1.95, 0.40, x, -2.10, -0.2]],
      [2.45, [x + 0.05, -2.45, 0.40, x + 0.05, -2.50, -0.6]],
      [S.fura, [x + 0.05, -2.55, 0.40, x + 0.05, -2.58, -0.6]],
    ]);
    const cam3 = trilha([
      [S.corte, [0, rep.alt, 0, rep.alvo.x, rep.alvo.y, rep.alvo.z]],
      [4.9, [0, rep.alt + 0.015, 0.05, rep.alvo.x, rep.alvo.y + 0.02, rep.alvo.z]],
      [5.12, [0, rep.alt + 0.035, 0.13, rep.alvo.x - 0.01, rep.alvo.y + 0.045, rep.alvo.z]],
      [5.4, [-0.015, rep.alt + 0.02, 0.03, rep.alvo.x - 0.035, rep.alvo.y + 0.022, rep.alvo.z]],
      [6.0, [-0.02, rep.alt + 0.02, 0.0, rep.alvo.x - 0.04, rep.alvo.y + 0.022, rep.alvo.z]],
    ]);
    // a câmera em qualquer ponto da história, sem o desvio do mouse
    const cam = (s, o = new Array(6)) => {
      if (s < S.fura) return cam1(s, o);
      if (s >= S.corte) return cam3(s, o);
      // voo de lado: anda com o avião e, no fim, assenta diante do celular da cliente
      const u = 1 - trecho(s, S.fura, 0.92), px = mistura(1.0, CC.x, 1 - Math.pow(u, 1.9));
      o[0] = px; o[1] = -2.6; o[2] = 0.45; o[3] = px + 0.08; o[4] = -2.62; o[5] = -0.6;
      const w = entraESai(trecho(s, 3.34, 0.44));
      o[0] = mistura(o[0], CC.x, w); o[1] = mistura(o[1], CC.y, w); o[2] = mistura(o[2], CC.z, w);
      o[3] = mistura(o[3], ALVO_C.x, w); o[4] = mistura(o[4], ALVO_C.y, w); o[5] = mistura(o[5], ALVO_C.z, w);
      return o;
    };

    // folha presa à câmera durante a queda: [dist, ox, oy, rx, ry, rz, curva, torce, onda]
    eu.set(0.5, -0.2, -0.04, 'XYZ'); v1.copy(pTotal).applyEuler(eu);
    const dRente = dInt * (rep.deitado ? 0.36 : 0.5);
    const solta = trilha([
      [1.12, [dInt * 0.95, 0, 0, -0.35, 0.30, 0.10, 5, 0.25, 0.0025]],
      [1.30, [dInt * 0.85, 0.008, 0, 0.30, -0.35, -0.10, -3, -0.3, 0.003]],
      [1.45, [dInt * 0.6, -0.012, -0.016, 0.42, 0.22, 0.06, 3, 0.2, 0.0022]],
      [1.56, [dRente, -v1.x, -v1.y, 0.5, -0.2, -0.04, 2, 0.1, 0.0012]],
      [1.72, [dInt * 0.9, 0, 0, 0.16, 0.18, 0.03, -2, -0.1, 0.0015]],
      [1.90, [dInt, 0, 0, 0, 0, 0, 0, 0, 0]],
      [2.05, [dInt * 0.92, 0, 0, -0.5, 0.45, 0, 0, 0, 0]],
      [2.22, [dInt * 0.92, 0, 0, -0.75, -0.4, 0, 0, 0, 0]],
      [S.aviao, [dInt * 0.95, 0, 0.004, -1.15, 0.5, 0.1, 0, 0, 0]],
    ]);
    // o avião dá a volta e mergulha na direção de quem assiste: posição em relação à câmera [x, y, z]
    const la = Math.min(1, a / 1.78);
    const volta = trilha([
      [S.aviao, [0, 0.004, -dInt * 0.95]],
      [2.56, [0.07 * la, 0.04, -dInt * 1.6]],
      [2.66, [-0.045 * la, 0.05, -dInt * 1.8]],
      [2.76, [-0.008 * la, 0.03, -dInt * 0.85]],
      [S.fura, [0, -0.012, -0.04]],
    ]);
    // de lado: tamanho do avião na tela e de onde ele entra
    const dLado = FOLHA.A / ((rep.deitado ? 0.2 : 0.34) * 2 * tv * a), meiaL = tv * a * dLado;
    T = { cam, solta, volta, topo, x, z, dInt, dLado, meiaL, la };
  }

  // posição do avião (mundo) no voo de lado e na chegada, para um `s` qualquer
  function aviaoLado(s, tempo, out) {
    const c = T.cam(s);
    aux.position.set(c[0], c[1], c[2]); aux.up.set(0, 1, 0); aux.lookAt(c[3], c[4], c[5]);
    const entra = 1 - entraESai(trecho(s, S.fura, 0.2));
    out.set(T.meiaL * (-0.06 - entra * 1.25) + Math.sin(tempo * 0.8) * 0.012, (rep.deitado ? -0.05 : -0.02) * T.dLado / 0.5 + Math.sin(tempo * 1.3) * 0.009 + entra * 0.03, -T.dLado).applyQuaternion(aux.quaternion).add(aux.position);
    const w = entraESai(trecho(s, S.chega, S.pousa - S.chega));
    if (w > 0) {
      const [u, v] = conversa.alvo;
      v4.set((u - 0.5) * CEL.telaL, (0.5 - v) * CEL.telaA, CEL.E / 2 + 0.002).applyMatrix4(celC.grupo.matrixWorld);
      out.lerp(v4, w); out.y += Math.sin(Math.PI * w) * 0.03; out.z += Math.sin(Math.PI * w) * 0.07;
    }
    return out;
  }

  // ---------- o que acontece na tela do celular do prestador ----------
  function telaDoCelular(s) {
    const p = trecho(s, 0.14, 0.36);
    const n1 = Math.round(limita(p / 0.28) * CLIENTE.length), n2 = Math.round(limita((p - 0.3) / 0.42) * SERVICO.length), n3 = Math.round(limita((p - 0.76) / 0.24) * VALOR.length);
    const ativo = s < 0.1 ? null : n1 < CLIENTE.length ? 'cliente' : n2 < SERVICO.length ? 'desc' : 'valor';
    dados.crie = s > 0.06 && s < 2 ? { cliente: CLIENTE.slice(0, n1), desc: SERVICO.slice(0, n2), valor: VALOR.slice(0, n3), ativo } : null;
    dados.receba = s > 2;
    estado.tela = s > 2.9 ? 'recibo' : s > 0.07 ? 'novo' : 'inicio';
    estado.chaveTela = `${estado.tela}.${n1}.${n2}.${n3}.${ativo}`;
  }

  // ---------- a conversa no celular da cliente ----------
  function telaDaCliente(s) {
    const pdf = trecho(s, S.pousa - 0.02, 0.1);
    const n = Math.round(limita(trecho(s, 4.06, 0.2)) * [...RESPOSTA].length), enviada = s > 4.3;
    const e = { nome: dados.nome, pdf, digitado: enviada ? '' : [...RESPOSTA].slice(0, n).join(''), resposta: trecho(s, 4.3, 0.07), lida: s > 4.42 };
    const chave = `${e.nome}|${pdf.toFixed(2)}|${e.digitado}|${e.resposta.toFixed(2)}|${e.lida}`;
    if (chave === conversa.chave) return;
    conversa.chave = chave;
    conversa.alvo = desenhaConversa(telaC, e, docOrc).alvo; texC.needsUpdate = true;
  }

  // ---------- legendas e apontadores (HTML) ----------
  const proj = new THREE.Vector3();
  function naTela(p, L, H) { proj.copy(p).project(camera); return { x: (proj.x * 0.5 + 0.5) * L, y: (0.5 - proj.y * 0.5) * H }; }
  const janela = (s, a, b, borda = 0.06) => suave(a, a + borda, s) * (1 - suave(b - borda, b, s));
  const APONTA = [
    { id: 'logo', de: 1.15, ate: 1.4, p: docOrc.ponto(116, 106), lado: -1 },
    { id: 'pix', de: 1.6, ate: 1.9, p: docOrc.ponto(105, 692), lado: -1 },
    { id: 'fotos', de: 1.68, ate: 1.93, p: docOrc.ponto(640, 930), lado: 1 },
  ];

  const estado = { s: 0, tela: 'inicio', chaveTela: '', toque: null, clara: false, claridade: 0 };
  let toque1 = false, toque2 = false, totalMostrado = -1, modoDobra = null, recebidoMostrado = -1;

  // a folha saindo de trás do celular (serve para o orçamento e para o recibo)
  function saindo(f, sai, tempo) {
    f.grupo.position.set(0, CEL.A / 2 - FOLHA.A / 2 + sai * FOLHA.A, -CEL.E / 2 - 0.0016).applyMatrix4(cel.grupo.matrixWorld);
    f.grupo.quaternion.copy(cel.grupo.quaternion); f.grupo.scale.setScalar(1);
    f.soltar({ curva: 7 * sai, pe: 1 - sai, retoAbaixo: true, onda: 0.0006 * sai, fase: tempo * 2.2 });
  }
  function luzDaFolha(u, noite, clara = 0) {
    u.uAmb.value.setRGB(mistura(mistura(0.3, 0.36, noite), 0.62, clara), mistura(mistura(0.33, 0.42, noite), 0.6, clara), mistura(mistura(0.38, 0.52, noite), 0.58, clara));
    u.uLuzCor.value.setRGB(mistura(1.2, 1.0, noite), mistura(1.02, 0.8, noite), mistura(0.8, 0.62, noite));
    u.uContra.value.setRGB(0.5 * noite * (1 - clara), 0.3 * noite * (1 - clara), 0.1 * noite * (1 - clara));
  }

  // ---------- quadro a quadro ----------
  // heroi: desvio da câmera e giro do celular vindos do mouse (ou da inclinação do aparelho)
  function aplica(s, dt, tempo, heroi, L, H) {
    estado.s = s; estado.toque = null;
    if (!T) return estado;
    telaDoCelular(s);

    // --- câmera ---
    const c = T.cam(s);
    const folga = mistura(1, 0.3, suave(0, 0.3, s));
    camera.position.set(c[0], c[1], c[2]); camera.up.set(0, 1, 0); camera.lookAt(c[3], c[4], c[5]);
    camera.translateX(heroi.desvioX * folga); camera.translateY(heroi.desvioY * folga);
    camera.lookAt(c[3], c[4], c[5]);
    camera.updateMatrixWorld(true);

    // --- quem está em cena ---
    const naBancada = s < 1.42 || s >= S.corte, naCliente = s > 3.2 && s < S.corte;
    cenario.grupo.visible = naBancada; cel.grupo.visible = naBancada;
    const descida = suave(1.0, 1.32, s) * (1 - suave(S.corte - 0.01, S.corte, s));
    uCen.uDesfoque.value = (leve ? 0.0008 : 0.001) * (1 + suave(0.05, 0.5, s) * 1.25 * (s < 2 ? 1 : 0) + descida * 9);
    // o celular do prestador termina o giro que o da cliente começou
    const giro = entraESai(trecho(s, S.gira, 0.28)) * Math.PI * 2;
    if (s >= S.corte) { cel.grupo.rotation.y += rep.guinada + giro - Math.PI * 2; cel.grupo.updateMatrixWorld(true); }

    // --- noite da cidade ---
    luzes.ajusta(suave(1.38, 1.75, s) * (1 - suave(3.5, 3.74, s)), tempo, camera, H * renderer.getPixelRatio(), L / H);

    // --- a mesa e o celular da cliente ---
    const opC = naCliente ? suave(3.24, 3.52, s) : 0;
    cenC.grupo.visible = celC.grupo.visible = opC > 0.001;
    estado.clara = opC > 0.6; estado.claridade = Math.round(opC * 40) / 40;
    if (opC > 0.001) {
      telaDaCliente(s);
      const uc = cenC.uniforms; uc.uOpaco.value = opC; uc.uTempo.value = tempo;
      celC.grupo.position.set(PC.x, PC.y + Math.sin(tempo * 1.25) * 0.0016, PC.z);
      celC.grupo.rotation.set(heroi.inc, rep.guinada + heroi.gui + giro, 0, 'YXZ');
      celC.grupo.updateMatrixWorld(true);
      const e = celC.grupo.matrixWorld.elements;
      uc.uC.value.setFromMatrixPosition(celC.grupo.matrixWorld);
      uc.uU.value.set(e[0], e[1], e[2]).normalize(); uc.uV.value.set(e[4], e[5], e[6]).normalize(); uc.uN.value.set(e[8], e[9], e[10]).normalize();
      celC.matTela.uniforms.uTempo.value = tempo; celC.matTela.uniforms.uToque.value.z += dt;
      if (s > 4.3 && !toque2) { toque2 = true; celC.matTela.uniforms.uToque.value.set(0.92, 1 - 0.95, 0); }
      if (s < 4.2) toque2 = false;
    }

    // --- toques no "Ver PDF" (orçamento e recibo) ---
    const tocar = (s > S.toque && s < 1) || (s > S.recibo - 0.03 && s < 5.2);
    if (tocar && !toque1) { toque1 = true; estado.toque = [0.262, 1 - 0.947]; }
    if (!tocar) toque1 = false;

    // o total conta quando a câmera passa rente a ele; depois disso vale para o resto da história
    const total = Math.round(650 * entraESai(trecho(s, 1.47, 0.13)) * 100) / 100;
    if (total !== totalMostrado) { totalMostrado = total; docOrc.total(reais(total)); conversa.chave = ''; }

    // --- a folha do orçamento: sai, cai, dobra e voa ---
    const visivel = s > S.sai - 0.01 && s < S.pousa;
    folha.grupo.visible = visivel;
    if (visivel) {
      const u = folha.uniforms;
      const dobrando = s >= S.dobra;
      if (dobrando !== modoDobra) { modoDobra = dobrando; folha.modo(dobrando); }
      folha.grupo.scale.setScalar(1);
      if (s < S.dobra) {
        const sai = entraESai(trecho(s, S.sai, 0.33)), preso = suave(S.solta, 1.14, s);
        saindo(folha, sai, tempo);
        if (preso > 0) {
          const k = T.solta(Math.max(s, 1.12)), bal = k[8] / 0.003;
          v1.copy(folha.grupo.position); q1.copy(folha.grupo.quaternion); v1.y += suave(0.93, 1.1, s) * 0.02;
          eu.set(k[3] + Math.sin(tempo * 1.3) * 0.05 * bal, k[4] + Math.sin(tempo * 0.9 + 1) * 0.07 * bal, k[5] + Math.sin(tempo * 0.7 + 2) * 0.03 * bal, 'XYZ');
          q2.setFromEuler(eu).premultiply(camera.quaternion);
          v2.set(k[1], k[2], -k[0]).applyQuaternion(camera.quaternion).add(camera.position);
          folha.grupo.position.lerpVectors(v1, v2, preso); folha.grupo.quaternion.slerpQuaternions(q1, q2, preso);
          folha.soltar({ curva: mistura(7, k[6], preso), pe: mistura(0, 0.5, preso), torce: k[7] * preso, onda: mistura(0.0006, k[8], preso), fase: tempo * 2.6, canto: 0.004 * preso * bal });
        }
      } else if (s < S.aviao) {
        const k = T.solta(s);
        eu.set(k[3], k[4] + Math.sin(tempo * 0.9) * 0.04, k[5], 'XYZ');
        folha.grupo.quaternion.setFromEuler(eu).premultiply(camera.quaternion);
        folha.grupo.position.set(k[1], k[2], -k[0]).applyQuaternion(camera.quaternion).add(camera.position);
        const asas = entraESai(trecho(s, 2.22, 0.2));
        folha.dobrar([entraESai(trecho(s, 1.93, 0.13)), entraESai(trecho(s, 2.07, 0.13)), asas, asas]);
      } else if (s < S.fura) {
        // a volta: o bico segue o caminho e o avião inclina nas curvas
        const p = T.volta(s), pa = T.volta(Math.min(S.fura, s + 0.012)), pb = T.volta(Math.max(S.aviao, s - 0.012));
        v1.set(pa[0] - pb[0], pa[1] - pb[1], pa[2] - pb[2]).normalize();
        v1.y -= 0.42 * suave(2.62, 2.74, s); v1.normalize();          // mergulha de bico: quem assiste vê as asas com a tinta
        v2.set(-v1.x * 1.6, 1, 0).normalize(); v3.crossVectors(v1, v2).normalize(); v4.crossVectors(v3, v1);
        q2.setFromRotationMatrix(m4.makeBasis(v3, v1, v4));       // avião: bico em +y, cima em +z
        eu.set(-1.15, 0.5, 0.1, 'XYZ'); q1.setFromEuler(eu).slerp(q2, suave(S.aviao, 2.54, s));
        folha.grupo.quaternion.copy(q1).premultiply(camera.quaternion);
        folha.grupo.position.set(p[0], p[1], p[2]).applyQuaternion(camera.quaternion).add(camera.position);
        folha.dobrar([1, 1, 1, 1]);
      } else {
        // de lado, planando; depois a curva até a tela do celular da cliente
        aviaoLado(s, tempo, folha.grupo.position);
        aviaoLado(s + 0.01, tempo, v1); aviaoLado(s - 0.01, tempo, v2);
        const w = entraESai(trecho(s, S.chega, S.pousa - S.chega));
        v1.sub(v2); v2.set(0.96, -0.03 + Math.sin(tempo * 1.1) * 0.05, 0.27).normalize();
        if (v1.lengthSq() < 1e-12) v1.copy(v2); else v1.normalize();       // parado no pouso: mantém a direção do voo
        v1.lerpVectors(v2, v1, suave(0.05, 0.5, w)).normalize();                 // bico: de lado no voo, na direção do pouso na chegada
        v2.set(-0.06, 0.86, 0.5 + Math.sin(tempo * 0.9) * 0.16).lerp(v3.set(0, 1, 0.25), w).normalize();       // inclinado para a câmera: a tinta das asas aparece
        v3.crossVectors(v1, v2).normalize(); v4.crossVectors(v3, v1);
        folha.grupo.quaternion.setFromRotationMatrix(m4.makeBasis(v3, v1, v4));
        folha.grupo.scale.setScalar(mistura(1, 0.22, suave(0.55, 1, w)));
        folha.dobrar([1, 1, 1, 1]);
      }
      folha.rastro(suave(S.fura, S.fura + 0.12, s) * (1 - suave(S.pousa - 0.2, S.pousa - 0.04, s)), tempo);
      // impressão do orçamento durante a queda e o total contando quando a câmera passa rente a ele
      u.uRevela.value = entraESai(trecho(s, 0.68, 0.3)) * 0.24 + trecho(s, 1.0, 0.56) * 0.76;
      u.uTela.value = (1 - suave(0.95, 1.2, s)) * suave(0.6, 0.7, s);
      luzDaFolha(u, suave(1.25, 1.7, s), opC);
    }

    // --- o recibo: sai do celular, recebe o carimbo e cresce até virar o fundo claro ---
    const comRecibo = s > S.recibo;
    folhaR.grupo.visible = comRecibo;
    if (comRecibo) {
      const u = folhaR.uniforms, sai = entraESai(trecho(s, S.recibo, 0.26)), ao = entraESai(trecho(s, 5.14, 0.24)), fim = entraESai(trecho(s, S.some, 0.36));
      saindo(folhaR, sai, tempo);
      if (ao > 0) {
        // ao lado do celular, de frente para quem assiste
        v1.copy(folhaR.grupo.position); q1.copy(folhaR.grupo.quaternion);
        v2.set(P0.x - (rep.deitado ? 0.088 : 0.012) * T.la, P0.y + (rep.deitado ? 0.02 : 0.085), P0.z + 0.08);
        eu.set(-0.06 + Math.sin(tempo * 1.1) * 0.03, 0.3 + Math.sin(tempo * 0.8) * 0.05, 0.04, 'XYZ'); q2.setFromEuler(eu);
        v1.lerp(v2, ao); q1.slerp(q2, ao);
        // saída: vem até a câmera e toma a tela
        if (fim > 0) {
          v2.set(0, 0.02, -0.11).applyQuaternion(camera.quaternion).add(camera.position);
          v1.lerp(v2, fim); q1.slerp(camera.quaternion, fim);
        }
        folhaR.grupo.position.copy(v1); folhaR.grupo.quaternion.copy(q1);
        folhaR.grupo.scale.setScalar(mistura(1, rep.deitado ? 1.22 : 1.05, ao) * mistura(1, 2.6, fim));
        folhaR.soltar({ curva: mistura(7, 2.5, ao) * (1 - fim), pe: mistura(0, 0.5, ao), onda: 0.0014 * ao * (1 - fim), fase: tempo * 2.2, torce: 0.12 * ao * (1 - fim) });
      }
      u.uCarimbo.value = trecho(s, S.carimbo, 0.11);
      u.uTela.value = (1 - ao) * suave(S.recibo, S.recibo + 0.08, s);
      luzDaFolha(u, 0, fim * 0.9);
    }

    if (el) interface_(s, L, H);
    return estado;
  }

  function interface_(s, L, H) {
    el.raiz.style.visibility = s > 0.02 ? 'visible' : 'hidden';
    for (const g of el.legendas) {
      const de = +g.dataset.de, ate = +g.dataset.ate, o = janela(s, de, ate, 0.07);
      g.style.opacity = o.toFixed(3); g.style.transform = `translateY(${((1 - o) * 26 * (s < (de + ate) / 2 ? 1 : -1)).toFixed(1)}px)`;
    }
    folha.grupo.updateMatrixWorld(true);
    for (const a of APONTA) {
      const no = el.aponta[a.id]; if (!no) continue;
      const o = folha.grupo.visible ? janela(s, a.de, a.ate, 0.05) : 0;
      no.style.opacity = o.toFixed(3);
      if (o <= 0.001) continue;
      const t = naTela(v1.copy(a.p).applyMatrix4(folha.grupo.matrixWorld), L, H);
      no.style.transform = `translate(${t.x.toFixed(1)}px, ${t.y.toFixed(1)}px)`;
      no.classList.toggle('esq', L < 700 ? t.x > L * 0.5 : a.lado < 0);      // em tela estreita o rótulo vai para o lado que tem espaço
    }
    // clarões: o avião atravessa a tela; o corte da casa da cliente para a bancada; o recibo vira o fundo claro
    const fura = suave(2.77, 2.83, s) * (1 - suave(2.86, 3.02, s)), corte = janela(s, S.corte - 0.05, S.corte + 0.07, 0.05) * 0.5;
    el.clarao.style.opacity = Math.max(fura, corte).toFixed(3);
    el.onda.style.opacity = (suave(2.8, 2.84, s) * (1 - suave(2.9, 3.1, s))).toFixed(3);
    el.onda.style.transform = `translate(-50%, -50%) scale(${(0.2 + trecho(s, 2.8, 0.32) * 3.2).toFixed(3)})`;
    el.claro.style.opacity = suave(5.8, 5.97, s).toFixed(3);
    // a marca some enquanto o papel claro passa por trás dela
    el.marca.style.opacity = (1 - Math.max(janela(s, 1.4, 1.9, 0.06), suave(5.66, 5.76, s))).toFixed(3);
    // "recebido no mês" em números grandes
    const or = janela(s, 5.22, 5.84, 0.07);
    el.recebido.style.opacity = or.toFixed(3);
    if (or > 0) {
      const v = Math.round(650 * entraESai(trecho(s, 5.26, 0.26)));
      if (v !== recebidoMostrado) { recebidoMostrado = v; el.recebidoValor.textContent = reais(v); }
    }
    // etapas
    const etapa = s < 0.1 ? -1 : s < S.dobra ? 0 : s < S.gira ? 1 : 2;
    el.etapas.forEach((li, i) => li.classList.toggle('ativa', i === etapa));
    el.progresso.style.transform = `scaleX(${limita(s / TELAS_DA_HISTORIA).toFixed(4)})`;
  }

  return { arrumar, aplica, estado, docOrc, docRec, folha, folhaR, celC, cenC, nome(n) { docOrc.nome(n); docRec.nome(n); conversa.chave = ''; }, pronto: Promise.all([docOrc.pronto, docRec.pronto]) };
}
