// Cena 4, "O envio": protótipo com fotografia (placas geradas por IA) e movimento por código, preso à rolagem.
// Endereço: /prototipos/cena-4-ia/   Parâmetros úteis para conferir:
//   ?p=0.5      fixa o avanço (0 a 1) sem depender da rolagem
//   ?q=leve     força a qualidade de celular; ?q=alta força a de computador
//   ?fps        mostra o medidor de quadros
//   ?parado     mostra o estado final sem animação (o mesmo que prefers-reduced-motion)
//   ?sem=grao,vinheta,paralaxe,poeira   desliga efeitos, para comparar
import { criaPrograma, criaTextura, atualizaTextura, carregaImagem, homografia, proporcaoDoQuadrilatero } from './gl.js';
import { VS_TELA, fsPlaca, VS_FITA, FS_FITA, VS_PONTOS, FS_PONTOS, FS_CLARAO, FS_LENTE } from './shaders.js';
import { PLACAS, CORES_SINAL, urlTelaEnviar, urlPaginaPdf, urlRua, corDoSinal } from './dados.js';
import { roteiro, limita, mistura, faixa } from './roteiro.js';
import { criaConversa } from './conversa.js';

const params = new URLSearchParams(location.search);
const secao = document.getElementById('cena-4');
const palco = secao.querySelector('.palco');
const canvas = palco.querySelector('.quadro');
const barra = palco.querySelector('.carregando');
const medidor = palco.querySelector('.medidor');
const progresso = palco.querySelector('.progresso');

const semMovimento = matchMedia('(prefers-reduced-motion: reduce)').matches || params.has('parado');
if (semMovimento) document.documentElement.classList.add('sem-movimento');
const leve = params.get('q') ? params.get('q') === 'leve' : (matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 600);
const pFixo = params.has('p') ? limita(parseFloat(params.get('p'))) : null;
const sem = (params.get('sem') ?? '').split(',');
const ehVertical = () => palco.clientWidth / palco.clientHeight < 0.9;

// Sem WebGL2 a página mostra o plano aberto parado, com a legenda.
function semGl(erro) {
  if (erro) console.error(erro);
  canvas.remove();
  palco.style.backgroundImage = `url(${urlRua})`;
  palco.classList.add('pronta');
}

const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'high-performance' });
if (gl) inicia().catch(semGl); else semGl();

async function inicia() {
  // ---- carga ----
  let total = 0, feitos = 0;
  const conta = (promessa) => { total++; return promessa.then((r) => { feitos++; barra.style.setProperty('--carga', (feitos / total).toFixed(3)); return r; }); };
  const anisotropia = leve ? 4 : 8;
  let vertical = ehVertical();

  const profundidades = new Map();      // os mapas de profundidade repetidos entre os conjuntos são carregados uma vez
  const profundidade = (url) => { if (!profundidades.has(url)) profundidades.set(url, conta(carregaImagem(url)).then((img) => criaTextura(gl, img, { simples: true }))); return profundidades.get(url); };
  const carregaPlacas = async (vert) => {
    const defs = PLACAS[vert ? 'vertical' : 'larga'], nomes = Object.keys(defs);
    const [imagens, profs] = await Promise.all([
      Promise.all(nomes.map((n) => conta(carregaImagem(defs[n].url)))),
      Promise.all(nomes.map((n) => profundidade(defs[n].prof))),
    ]);
    return Object.fromEntries(nomes.map((n, i) => {
      const def = defs[n], tex = criaTextura(gl, imagens[i], { anisotropia });
      imagens[i].close?.();
      return [n, {
        def, tex, prof: profs[i], recorte: def.recorte, ap: def.px[0] / def.px[1], texel: tex.l / (def.recorte[2] * def.px[0]),
        H: def.tela && homografia(def.tela.cantos), aspTela: def.tela && proporcaoDoQuadrilatero(def.tela.cantos),
      }];
    }));
  };

  const [placasIniciais, imgEnviar, imgPdf] = await Promise.all([
    carregaPlacas(vertical),
    conta(carregaImagem(urlTelaEnviar)), conta(carregaImagem(urlPaginaPdf)),
    document.fonts?.load(`600 44px 'Inter Variable'`).catch(() => {}),
    document.fonts?.load(`400 42px 'Inter Variable'`).catch(() => {}),
  ]);
  let placas = placasIniciais;

  // as telas dos dois celulares: a captura real do app e a conversa desenhada por código
  const telas = { A: criaTextura(gl, imgEnviar, { anisotropia: 16 }) };
  const conversa = criaConversa(imgPdf, placas.E.aspTela);
  telas.E = criaTextura(gl, conversa.canvas, { anisotropia: 16 });

  // ---- programas ----
  const progPlaca = criaPrograma(gl, VS_TELA, fsPlaca(leve ? 6 : 10));
  const progFita = criaPrograma(gl, VS_FITA, FS_FITA);
  const progPontos = criaPrograma(gl, VS_PONTOS, FS_PONTOS);
  const progClarao = criaPrograma(gl, VS_TELA, FS_CLARAO);
  const progLente = criaPrograma(gl, VS_TELA, FS_LENTE);
  const vaoVazio = gl.createVertexArray();

  // fita do sinal: pares (t, lado) ao longo da curva
  const TRECHOS = 160;
  const fita = new Float32Array((TRECHOS + 1) * 4);
  for (let i = 0; i <= TRECHOS; i++) fita.set([i / TRECHOS, -1, i / TRECHOS, 1], i * 4);
  const vaoFita = gl.createVertexArray();
  gl.bindVertexArray(vaoFita);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, fita, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  // partículas (sorteio com semente: a cena sai igual a cada carga)
  let semente = 20261111;
  const sorteio = () => { semente = (semente + 0x6D2B79F5) >>> 0; let t = semente; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const entre = (a, b) => a + (b - a) * sorteio();
  const pontos = [];
  for (let i = 0, n = leve ? 12 : 24; i < n; i++) pontos.push(sorteio(), sorteio(), entre(10, 54), entre(0, 6.28), 0, entre(0.4, 1.6), 0, 0);
  for (let i = 0, n = leve ? 44 : 96; i < n; i++) {
    const fria = i % 2 === 0;   // metade em volta do eletricista (fria), metade na luz da porta (quente)
    pontos.push(fria ? entre(0.36, 0.60) : entre(0.68, 0.97), fria ? entre(0.28, 0.80) : entre(0.22, 0.82), entre(1.6, 3.6), entre(0, 6.28), 1, entre(0.5, 1.6), 0, 0);
  }
  for (let i = 0, n = leve ? 70 : 160; i < n; i++) pontos.push(0, 0, entre(2.2, 5.5), entre(0, 6.28), 2, 0, entre(0.02, 0.985), entre(-1, 1));
  const nPontos = pontos.length / 8;
  const vaoPontos = gl.createVertexArray();
  gl.bindVertexArray(vaoPontos);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pontos), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 32, 0);
  gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 32, 16);
  gl.bindVertexArray(null);

  // ---- tamanho ----
  let L = 1, A = 1, dpr = 1, VA = 1;
  let trocando = false;
  function ajusta() {
    dpr = Math.min(devicePixelRatio || 1, leve ? 1.75 : 2);
    L = Math.max(1, Math.round(palco.clientWidth * dpr)); A = Math.max(1, Math.round(palco.clientHeight * dpr));
    if (canvas.width !== L || canvas.height !== A) { canvas.width = L; canvas.height = A; }
    VA = L / A;
    const v = ehVertical();
    if (v !== vertical && !trocando) {      // virou o aparelho ou mudou muito a janela: troca o conjunto de placas
      trocando = true;
      carregaPlacas(v).then((novas) => { for (const n in placas) gl.deleteTexture(placas[n].tex.t); placas = novas; vertical = v; pede(); })
        .catch(console.error).finally(() => { trocando = false; });
    }
  }

  // ---- câmera ----
  // Encaixa o enquadramento pedido dentro do que a textura cobre (o recorte) e devolve centro e tamanho visível.
  function camera(pl, c, h) {
    const rec = pl.recorte, kx = VA / pl.ap, M = 0.008;
    const hh = Math.min(h, rec[3] - 2 * M, (rec[2] - 2 * M) / kx), w = hh * kx;
    return { c: [limita(c[0], rec[0] + M + w / 2, rec[0] + rec[2] - M - w / 2), limita(c[1], rec[1] + M + hh / 2, rec[1] + rec[3] - M - hh / 2)], v: [w, hh] };
  }
  const naTela = (cam, pt) => [(pt[0] - cam.c[0]) / cam.v[0] + 0.5, (pt[1] - cam.c[1]) / cam.v[1] + 0.5];

  // ---- rolagem e ponteiro ----
  const medeP = () => {
    const caixa = secao.getBoundingClientRect(), curso = caixa.height - innerHeight;
    return curso > 0 ? limita(-caixa.top / curso) : 1;
  };
  const rato = [0, 0], ratoAlvo = [0, 0];
  if (!semMovimento && matchMedia('(pointer: fine)').matches) {
    palco.addEventListener('pointermove', (e) => { ratoAlvo[0] = e.clientX / innerWidth - 0.5; ratoAlvo[1] = e.clientY / innerHeight - 0.5; pede(); });
  }

  // ---- desenho ----
  const luzes = new Float32Array(24), luzesCor = new Float32Array(18), claroes = new Float32Array(12), claroesCor = new Float32Array(9);
  let tempo = 0, antes = performance.now(), pS = null, visivel = true, pedido = 0;
  let quadros = 0, marca = antes;

  function desenhaPlaca(nome, cam, e, alfa, R, peso) {
    const pl = placas[nome], def = pl.def, u = progPlaca.u;
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, pl.tex.t);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, pl.prof.t);
    gl.uniform4fv(u.uRecorte, pl.recorte); gl.uniform2fv(u.uPx, def.px);
    gl.uniform2fv(u.uCentro, cam.c); gl.uniform2fv(u.uVisao, cam.v);
    const semPar = sem.includes('paralaxe') ? 0 : 1;
    gl.uniform2f(u.uPar, (e.par[0] + balanco[0] + rato[0] * 0.010) * semPar, (e.par[1] + balanco[1] + rato[1] * 0.006) * semPar);
    gl.uniform1f(u.uParZoom, e.zoom * semPar);
    gl.uniform1f(u.uRef, def.foco); gl.uniform1f(u.uFoco, e.foco ?? def.foco);
    gl.uniform1f(u.uAbertura, e.abertura); gl.uniform1f(u.uDesfoque, e.desfoque);
    gl.uniform1f(u.uTexel, pl.texel); gl.uniform1f(u.uPxTela, cam.v[1] * def.px[1] / A);
    gl.uniform1f(u.uAlfa, alfa); gl.uniform1f(u.uExposicao, nome === 'B' ? 1 - 0.24 * R.sinal : 1);

    // tela do celular
    if (def.tela) {
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, telas[nome].t);
      gl.uniform1f(u.uTemTela, 1);
      gl.uniformMatrix3fv(u.uH, false, pl.H);
      gl.uniform1f(u.uRaioTela, def.tela.raio); gl.uniform1f(u.uAspTela, pl.aspTela);
      gl.uniform4f(u.uLinha, def.tela.linha[0], def.tela.linha[1], def.tela.toque[0], def.tela.toque[1]);
      gl.uniform2fv(u.uZonaPele, def.tela.zonaPele); gl.uniform3fv(u.uTintaTela, def.tela.tinta);
      gl.uniform1f(u.uToque, nome === 'A' ? R.toque : 0);
      gl.uniform1f(u.uBrilhoTela, (nome === 'A' ? R.brilhoA : R.brilhoE) * (1 + 0.018 * Math.sin(tempo * 1.7)));
    } else gl.uniform1f(u.uTemTela, 0);

    // luzes fixas da placa (pulsando) e as luzes do sinal
    luzes.fill(0); luzesCor.fill(0);
    let n = 0;
    const luz = (pos, raio, cor, forca) => { if (n < 6 && forca > 0) { luzes.set([pos[0], pos[1], raio, forca], n * 4); luzesCor.set(cor, n * 3); n++; } };
    for (const l of def.luzes) luz(l.pos, l.raio, l.cor, l.forca * (1 + 0.22 * Math.sin(tempo * l.pulso) + 0.07 * Math.sin(tempo * l.pulso * 3.7 + 1)));
    gl.uniform4f(u.uReflexo, 0, 0, 0, 1);
    if (nome === 'A') luz(def.centro, 0.34, [0.50, 0.74, 1.0], 0.5 * R.clarao1[0]);
    if (nome === 'B') {
      const cor = corDoSinal(R.viagem);
      luz(R.cabeca, 0.075, cor, 0.42 * R.sinal);
      luz(def.celEla, 0.10, [1.0, 0.66, 0.2], 0.55 * R.clarao2[0]);
      gl.uniform4f(u.uReflexo, R.cabeca[0], def.chao, 0.5 * R.sinal * mistura(0.6, 1, faixa(R.cabeca[1], 0.15, 0.54)), 0.042);
      gl.uniform3fv(u.uReflexoCor, cor);
    }
    if (nome === 'E') luz(def.centro, 0.36, [1.0, 0.66, 0.2], 0.42 * Math.sin(Math.PI * faixa(peso, 0.765, 0.93)));
    gl.uniform4fv(u.uLuz, luzes); gl.uniform3fv(u.uLuzCor, luzesCor);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  const balanco = [0, 0];
  function quadro(agora) {
    pedido = 0;
    const dt = Math.min(0.05, Math.max(0, (agora - antes) / 1000)); antes = agora;
    if (!semMovimento) tempo += dt;
    const alvo = pFixo ?? (semMovimento ? 1 : medeP());
    pS = pS === null ? alvo : pS + (alvo - pS) * (1 - Math.exp(-dt * 9));
    if (Math.abs(alvo - pS) < 0.00005) pS = alvo;
    for (let i = 0; i < 2; i++) rato[i] += (ratoAlvo[i] - rato[i]) * (1 - Math.exp(-dt * 4));
    if (!semMovimento) { balanco[0] = Math.sin(tempo * 0.37) * 0.0034 + Math.sin(tempo * 0.83) * 0.0011; balanco[1] = Math.cos(tempo * 0.29) * 0.0024; }
    progresso.style.setProperty('--p', pS.toFixed(4));

    const R = roteiro(pS, vertical);
    if (conversa.desenha(R.chegada)) atualizaTextura(gl, telas.E, conversa.canvas);

    const cams = {};
    for (const n of ['A', 'B', 'E']) cams[n] = camera(placas[n], R[n].c, R[n].h);
    const pesoB = R.mAB * (1 - R.mBE);

    gl.viewport(0, 0, L, A);
    gl.bindVertexArray(vaoVazio);

    // 1. placas: a de baixo opaca, a que entra por cima com transparência
    gl.useProgram(progPlaca.p);
    gl.uniform1i(progPlaca.u.uPlaca, 0); gl.uniform1i(progPlaca.u.uProf, 1); gl.uniform1i(progPlaca.u.uTela, 2);
    const camadas = [];
    if (R.mAB < 1) camadas.push(['A', 1]);
    if (R.mAB > 0 && R.mBE < 1) camadas.push(['B', R.mAB]);
    if (R.mBE > 0) camadas.push(['E', R.mBE]);
    camadas.forEach(([nome, alfa], i) => {
      if (i === 0) gl.disable(gl.BLEND); else { gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); }
      desenhaPlaca(nome, cams[nome], R[nome], i === 0 ? 1 : alfa, R, pS);
    });

    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    const camB = cams.B, escala = (A / 900) / Math.sqrt(Math.max(camB.v[1], 0.2)), SINAL = placas.B.def.sinal;

    // 2. a fita do sinal: halo largo e núcleo fino
    if (R.sinal > 0 && pesoB > 0) {
      const u = progFita.u;
      gl.useProgram(progFita.p);
      gl.bindVertexArray(vaoFita);
      gl.uniform2fv(u.uP0, SINAL.p0); gl.uniform2fv(u.uP1, SINAL.p1); gl.uniform2fv(u.uP2, SINAL.p2); gl.uniform2fv(u.uP3, SINAL.p3);
      gl.uniform2fv(u.uCentro, camB.c); gl.uniform2fv(u.uVisao, camB.v); gl.uniform2f(u.uRes, L, A);
      gl.uniform3fv(u.uCorA, CORES_SINAL[0]); gl.uniform3fv(u.uCorB, CORES_SINAL[1]); gl.uniform3fv(u.uCorC, CORES_SINAL[2]);
      gl.uniform1f(u.uCabeca, R.viagem);
      const pulso = 1 + 0.08 * Math.sin(tempo * 5.3);
      for (const [largura, nitidez, forca, branco] of [[52, 3.2, 0.24, 0], [18, 3.4, 0.52, 0.2], [5.4, 3.0, 1.15, 0.9]]) {
        gl.uniform1f(u.uLargura, largura * escala); gl.uniform1f(u.uNitidez, nitidez);
        gl.uniform1f(u.uForca, forca * R.sinal * pesoB * pulso); gl.uniform1f(u.uBranco, branco);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, (TRECHOS + 1) * 2);
      }
    }

    // 3. partículas
    if (!sem.includes('poeira')) {
      const u = progPontos.u;
      gl.useProgram(progPontos.p);
      gl.bindVertexArray(vaoPontos);
      gl.uniform2fv(u.uP0, SINAL.p0); gl.uniform2fv(u.uP1, SINAL.p1); gl.uniform2fv(u.uP2, SINAL.p2); gl.uniform2fv(u.uP3, SINAL.p3);
      gl.uniform2fv(u.uCentro, camB.c); gl.uniform2fv(u.uVisao, camB.v); gl.uniform2f(u.uRes, L, A);
      gl.uniform3fv(u.uCorA, CORES_SINAL[0]); gl.uniform3fv(u.uCorB, CORES_SINAL[1]); gl.uniform3fv(u.uCorC, CORES_SINAL[2]);
      gl.uniform1f(u.uTempo, tempo); gl.uniform1f(u.uCabeca, R.viagem); gl.uniform1f(u.uDpr, 1);
      gl.uniform1f(u.uAlfaRua, 0.42 * pesoB); gl.uniform1f(u.uSinal, R.sinal * pesoB);
      gl.uniform1f(u.uAlfaLente, 0.055);
      const pesos = [1 - R.mAB, pesoB, R.mBE], cor = [0, 0, 0];
      ['A', 'B', 'E'].forEach((n, i) => placas[n].def.poeira.forEach((v, j) => { cor[j] += v * pesos[i]; }));
      gl.uniform3fv(u.uCorLente, cor);
      gl.uniform2f(u.uDeriva, pS * 0.9 - rato[0] * 0.05, -pS * 0.25 - rato[1] * 0.04);
      gl.drawArrays(gl.POINTS, 0, nPontos);
    }

    // 4. clarões: o envio (azul), a chegada (âmbar) e a cabeça do sinal
    gl.bindVertexArray(vaoVazio);
    claroes.fill(0);
    const pos1 = naTela(cams.A, placas.A.def.centro), pos1b = naTela(camB, placas.B.def.celEle);
    const pos2 = naTela(camB, placas.B.def.celEla), pos2b = naTela(cams.E, placas.E.def.centro);
    claroes.set([mistura(pos1[0], pos1b[0], R.mAB), mistura(pos1[1], pos1b[1], R.mAB), R.clarao1[1], 0.92 * R.clarao1[0]], 0);
    claroes.set([mistura(pos2[0], pos2b[0], R.mBE), mistura(pos2[1], pos2b[1], R.mBE), R.clarao2[1], 0.88 * R.clarao2[0]], 4);
    const cab = naTela(camB, R.cabeca);
    claroes.set([cab[0], cab[1], 0.034 * Math.min(2.2, 1 / Math.sqrt(Math.max(camB.v[1], 0.2))), 0.62 * R.sinal * pesoB * (1 + 0.1 * Math.sin(tempo * 7.1))], 8);
    claroesCor.set([0.42, 0.72, 0.96], 0); claroesCor.set([1.0, 0.66, 0.16], 3); claroesCor.set(corDoSinal(R.viagem), 6);
    if (claroes[3] + claroes[7] + claroes[11] > 0) {
      gl.useProgram(progClarao.p);
      gl.uniform4fv(progClarao.u.uF, claroes); gl.uniform3fv(progClarao.u.uFCor, claroesCor); gl.uniform2f(progClarao.u.uRes, L, A);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    // 5. lente: vinheta, sombra do topo (legenda) e grão, multiplicados sobre tudo
    gl.blendFunc(gl.DST_COLOR, gl.ZERO);
    gl.useProgram(progLente.p);
    gl.uniform1f(progLente.u.uSemente, Math.floor(tempo * 24) % 1024);
    gl.uniform1f(progLente.u.uGrao, sem.includes('grao') ? 0 : 0.085);
    gl.uniform1f(progLente.u.uVinheta, sem.includes('vinheta') ? 0 : 0.36);
    gl.uniform1f(progLente.u.uTopo, 0.40);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.disable(gl.BLEND);

    if (!palco.classList.contains('pronta')) palco.classList.add('pronta');
    if (!medidor.hidden) {
      quadros++;
      if (agora - marca > 500) { medidor.textContent = `${Math.round(quadros * 1000 / (agora - marca))} qps · ${L}×${A} · p ${pS.toFixed(3)}`; quadros = 0; marca = agora; }
    }
    // com movimento, a cena respira o tempo todo enquanto está na tela; sem movimento, só redesenha quando pedem
    if (!semMovimento && visivel) pede();
  }
  function pede() { if (!pedido) pedido = requestAnimationFrame(quadro); }

  if (params.has('fps')) medidor.hidden = false;
  new ResizeObserver(() => { ajusta(); pede(); }).observe(palco);
  new IntersectionObserver(([e]) => { visivel = e.isIntersecting; if (visivel) { antes = performance.now(); pede(); } }).observe(secao);
  addEventListener('scroll', pede, { passive: true });
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); semGl(); });
  ajusta();
  pede();
}
