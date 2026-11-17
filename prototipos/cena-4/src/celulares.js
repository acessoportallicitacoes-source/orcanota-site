// Os dois celulares: corpo, tela emissiva com a textura real do app (ou a conversa desenhada em canvas) e um
// vidro por cima que só soma o reflexo.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const CEL = { l: 0.0742, a: 0.1608, e: 0.0086, telaL: 0.0692, telaA: 0.1538 };

function retanguloArredondado(l, a, r) {
  const f = new THREE.Shape();
  const x = -l / 2, y = -a / 2;
  f.moveTo(x + r, y); f.lineTo(x + l - r, y); f.quadraticCurveTo(x + l, y, x + l, y + r);
  f.lineTo(x + l, y + a - r); f.quadraticCurveTo(x + l, y + a, x + l - r, y + a);
  f.lineTo(x + r, y + a); f.quadraticCurveTo(x, y + a, x, y + a - r);
  f.lineTo(x, y + r); f.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ShapeGeometry(f, 6);
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / l + 0.5, p.getY(i) / a + 0.5);
  return g;
}

/** Cria um celular. `mapa` é a textura da tela (sRGB). */
export function criaCelular(mapa, { anisotropia = 8 } = {}) {
  const g = new THREE.Group();
  const corpo = new THREE.Mesh(
    new RoundedBoxGeometry(CEL.l, CEL.a, CEL.e, 5, 0.0042),
    new THREE.MeshStandardMaterial({ color: 0x14181d, roughness: 0.32, metalness: 0.85 }),
  );
  corpo.castShadow = true;
  const camera = new THREE.Mesh(new RoundedBoxGeometry(0.03, 0.034, 0.003, 3, 0.0015), new THREE.MeshStandardMaterial({ color: 0x0b0d10, roughness: 0.2, metalness: 0.9 }));
  camera.position.set(-0.017, 0.055, -CEL.e / 2 - 0.001);

  mapa.anisotropy = anisotropia;
  const tela = new THREE.Mesh(
    retanguloArredondado(CEL.telaL, CEL.telaA, 0.0062),
    new THREE.MeshBasicMaterial({ map: mapa }),
  );
  tela.position.z = CEL.e / 2 + 0.0002;
  const vidro = new THREE.Mesh(
    retanguloArredondado(CEL.telaL + 0.002, CEL.telaA + 0.002, 0.0068),
    new THREE.MeshPhysicalMaterial({ color: 0x000000, roughness: 0.06, metalness: 0, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, envMapIntensity: 1.1 }),
  );
  vidro.position.z = CEL.e / 2 + 0.0005;
  g.add(corpo, camera, tela, vidro);
  g.userData.tela = tela;
  /** brilho 0..1.x da tela */
  g.userData.brilho = (v) => tela.material.color.setScalar(v);
  return g;
}

/** Onda do toque sobre a tela do prestador, na linha "PDF pelo WhatsApp". u, v em fração da tela (v a partir do topo). */
export function criaToque(celular, u = 0.36, v = 0.805) {
  const x = (u - 0.5) * CEL.telaL, y = (0.5 - v) * CEL.telaA, z = CEL.e / 2 + 0.0004;
  const linha = new THREE.Mesh(
    new THREE.PlaneGeometry(CEL.telaL, CEL.telaA * 0.066),
    new THREE.MeshBasicMaterial({ color: 0x0e5a8a, transparent: true, opacity: 0, depthWrite: false }),
  );
  linha.position.set(0, y, z);
  const onda = new THREE.Mesh(
    new THREE.CircleGeometry(1, 40),
    new THREE.MeshBasicMaterial({ color: 0x7ec0e6, transparent: true, opacity: 0, depthWrite: false }),
  );
  onda.position.set(x, y, z + 0.00005);
  celular.add(linha, onda);
  /** t: 0 (antes) → 1 (toque completo) */
  return (t) => {
    const k = Math.min(1, Math.max(0, t));
    onda.scale.setScalar(0.004 + k * 0.03);
    onda.material.opacity = k <= 0 ? 0 : 0.55 * (1 - k) ** 1.2 + (k < 1 ? 0.1 : 0);
    linha.material.opacity = k <= 0 ? 0 : 0.16 * Math.sin(Math.min(1, k * 1.4) * Math.PI) + (k >= 1 ? 0.07 : 0);
  };
}

// ---------------------------------------------------------------------------------------------------------------
// A conversa no celular da cliente, desenhada em canvas com as mesmas cores da versão base do site.
// ---------------------------------------------------------------------------------------------------------------
function caixa(ctx, x, y, l, a, r, cantoVivo) {
  const rr = [r, r, r, r];
  if (cantoVivo === 'esq') rr[0] = r * 0.2; else if (cantoVivo === 'dir') rr[1] = r * 0.2;
  ctx.beginPath(); ctx.roundRect(x, y, l, a, rr); ctx.fill();
}

function quebra(ctx, texto, larg) {
  const linhas = []; let atual = '';
  for (const p of texto.split(' ')) {
    const t = atual ? atual + ' ' + p : p;
    if (ctx.measureText(t).width > larg && atual) { linhas.push(atual); atual = p; } else atual = t;
  }
  if (atual) linhas.push(atual);
  return linhas;
}

export function criaConversa(imgPdf) {
  const L = 900, A = 2000;
  const canvas = document.createElement('canvas'); canvas.width = L; canvas.height = A;
  const ctx = canvas.getContext('2d');
  const mapa = new THREE.CanvasTexture(canvas);
  mapa.colorSpace = THREE.SRGBColorSpace;
  const TEXTO = `'Inter Variable', 'Inter', system-ui, sans-serif`;
  let ultimo = -1;

  /** chegada: 0 (só as duas primeiras mensagens) → 1 (o PDF chegou) */
  function desenha(chegada) {
    const passo = Math.round(chegada * 14) / 14;
    if (passo === ultimo) return;
    ultimo = passo;
    ctx.fillStyle = '#E9EEF3'; ctx.fillRect(0, 0, L, A);

    // topo azul-petróleo
    ctx.fillStyle = '#0A4467'; ctx.fillRect(0, 0, L, 250);
    ctx.fillStyle = '#BCDCEE'; ctx.font = `500 30px ${TEXTO}`; ctx.textBaseline = 'middle';
    ctx.fillText('20:47', 48, 52);
    ctx.textAlign = 'right'; ctx.fillText('4G  ▮▮▮', L - 48, 52); ctx.textAlign = 'left';
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(76, 138); ctx.lineTo(48, 166); ctx.lineTo(76, 194); ctx.stroke();
    ctx.fillStyle = '#F5A30A'; ctx.beginPath(); ctx.arc(160, 166, 50, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2A1A00'; ctx.font = `700 46px ${TEXTO}`; ctx.textAlign = 'center'; ctx.fillText('E', 160, 169); ctx.textAlign = 'left';
    ctx.fillStyle = '#fff'; ctx.font = `600 44px ${TEXTO}`; ctx.fillText('Elétrica Rocha', 236, 146);
    ctx.fillStyle = '#BCDCEE'; ctx.font = `400 32px ${TEXTO}`; ctx.fillText('online', 236, 196);

    // marcador do dia
    ctx.fillStyle = '#D5DEE7'; caixa(ctx, L / 2 - 80, 284, 160, 52, 26);
    ctx.fillStyle = '#4A5668'; ctx.font = `500 28px ${TEXTO}`; ctx.textAlign = 'center'; ctx.fillText('Hoje', L / 2, 311); ctx.textAlign = 'left';

    const balao = (texto, y, dela, hora) => {
      ctx.font = `400 42px ${TEXTO}`;
      const maxL = L * 0.74;
      const linhas = quebra(ctx, texto, maxL - 64);
      const larg = Math.max(...linhas.map((l) => ctx.measureText(l).width), 150) + 64;
      const alt = linhas.length * 56 + 76;
      const x = dela ? 40 : L - 40 - larg;
      ctx.fillStyle = 'rgba(15,27,45,.08)'; caixa(ctx, x, y + 3, larg, alt, 34, dela ? 'esq' : 'dir');
      ctx.fillStyle = dela ? '#FFFFFF' : '#E2EFF6'; caixa(ctx, x, y, larg, alt, 34, dela ? 'esq' : 'dir');
      ctx.fillStyle = '#0F1B2D'; ctx.textBaseline = 'alphabetic';
      linhas.forEach((l, i) => ctx.fillText(l, x + 32, y + 62 + i * 56));
      ctx.fillStyle = '#7A8697'; ctx.font = `400 26px ${TEXTO}`; ctx.textAlign = 'right';
      ctx.fillText(hora, x + larg - 26, y + alt - 18); ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      return y + alt;
    };
    let y = balao('Oi! Consegue me passar o valor da troca do quadro?', 372, true, '20:41');
    y = balao('Já te mando o orçamento.', y + 28, false, '20:42');

    // o PDF chega: sobe e aparece
    if (passo > 0) {
      const k = 1 - (1 - passo) ** 3;
      const larg = L * 0.74, x = L - 40 - larg, yy = y + 28 + (1 - k) * 90;
      const altImg = (larg - 28) / 1.35, alt = altImg + 28 + 132;
      ctx.save(); ctx.globalAlpha = Math.min(1, passo * 1.6);
      ctx.fillStyle = 'rgba(15,27,45,.08)'; caixa(ctx, x, yy + 3, larg, alt, 34, 'dir');
      ctx.fillStyle = '#E2EFF6'; caixa(ctx, x, yy, larg, alt, 34, 'dir');
      // miniatura da página real do orçamento
      ctx.save(); ctx.beginPath(); ctx.roundRect(x + 14, yy + 14, larg - 28, altImg, 22); ctx.clip();
      ctx.fillStyle = '#fff'; ctx.fillRect(x + 14, yy + 14, larg - 28, altImg);
      if (imgPdf) { const esc = (larg - 28) / imgPdf.width; ctx.drawImage(imgPdf, x + 14, yy + 14 - imgPdf.height * esc * 0.035, larg - 28, imgPdf.height * esc); }
      ctx.restore();
      // selo PDF e nome do arquivo
      ctx.fillStyle = '#C0392B'; caixa(ctx, x + 26, yy + altImg + 40, 76, 76, 14);
      ctx.fillStyle = '#fff'; ctx.font = `700 26px ${TEXTO}`; ctx.textAlign = 'center'; ctx.fillText('PDF', x + 64, yy + altImg + 80); ctx.textAlign = 'left';
      ctx.fillStyle = '#0F1B2D'; ctx.font = `600 34px ${TEXTO}`; ctx.fillText('Orçamento nº 1, Elétrica Rocha.pdf', x + 120, yy + altImg + 62);
      ctx.fillStyle = '#7A8697'; ctx.font = `400 26px ${TEXTO}`; ctx.fillText('1 página · PDF', x + 120, yy + altImg + 104);
      ctx.textAlign = 'right'; ctx.fillText('20:47', x + larg - 26, yy + alt - 22); ctx.textAlign = 'left';
      ctx.restore();
    }

    // campo de mensagem
    ctx.fillStyle = '#fff'; caixa(ctx, 32, A - 150, L - 190, 104, 52);
    ctx.fillStyle = '#9AA6B5'; ctx.font = `400 38px ${TEXTO}`; ctx.fillText('Mensagem', 80, A - 96);
    ctx.fillStyle = '#0E5A8A'; ctx.beginPath(); ctx.arc(L - 86, A - 98, 54, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(L - 104, A - 124); ctx.lineTo(L - 60, A - 98); ctx.lineTo(L - 104, A - 72); ctx.closePath(); ctx.fill();
    mapa.needsUpdate = true;
  }
  desenha(0);
  return { mapa, desenha };
}
