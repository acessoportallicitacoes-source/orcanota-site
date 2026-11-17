// A conversa no celular da cliente, desenhada em código: já existe uma troca de mensagens antes, o PDF do
// orçamento chega (é a própria folha da história, em miniatura) e ela responde.
import { LARG, ALT, BARRA, barraDeStatus } from './telas.js';
import { limita, passaEVolta } from './util.js';

const FONTE = '"Inter Variable", Inter, system-ui, sans-serif';
const VERDE = '#0B5C52', PAPEL = '#EFE7DC', MINHA = '#D9FDD3', DELE = '#FFFFFF', TINTA = '#111B21', SUAVE = '#667781';

function caixa(c, x, y, w, h, r, cor, sombra = true) {
  c.save();
  if (sombra) { c.shadowColor = 'rgba(11, 20, 26, .16)'; c.shadowBlur = 5; c.shadowOffsetY = 2; }
  c.fillStyle = cor; c.beginPath(); c.roundRect(x, y, w, h, r); c.fill();
  c.restore();
}
function tiques(c, x, y, azul) {
  c.save(); c.strokeStyle = azul ? '#53BDEB' : '#8696A0'; c.lineWidth = 2.6; c.lineCap = 'round'; c.lineJoin = 'round';
  for (const dx of [0, 9]) { c.beginPath(); c.moveTo(x + dx, y); c.lineTo(x + dx + 6, y + 7); c.lineTo(x + dx + 18, y - 8); c.stroke(); }
  c.restore();
}
// balão de texto; devolve a altura. lado: 'd' (dela, à direita) ou 'e' (dele, à esquerda)
function balao(c, lado, y, linhas, hora, visto) {
  c.font = `400 30px ${FONTE}`;
  const larg = Math.max(...linhas.map((l) => c.measureText(l).width)), w = Math.max(190, larg + 44), h = linhas.length * 40 + 54;
  const x = lado === 'd' ? LARG - 22 - w : 22;
  caixa(c, x, y, w, h, 20, lado === 'd' ? MINHA : DELE);
  c.fillStyle = TINTA; c.textBaseline = 'alphabetic'; c.textAlign = 'left';
  linhas.forEach((l, i) => c.fillText(l, x + 22, y + 46 + i * 40));
  c.font = `400 21px ${FONTE}`; c.fillStyle = SUAVE; c.textAlign = 'right';
  c.fillText(hora, x + w - (lado === 'd' ? 52 : 18), y + h - 14);
  if (lado === 'd') tiques(c, x + w - 44, y + h - 22, visto);
  return h;
}

// e: { nome, pdf (0 a 1), digitado (texto na caixa), resposta (0 a 1), lida }
export function desenhaConversa(canvas, e, doc) {
  const c = canvas.getContext('2d');
  c.setTransform(1, 0, 0, 1, 0, 0);
  // papel de parede
  c.fillStyle = PAPEL; c.fillRect(0, 0, LARG, ALT);
  c.fillStyle = 'rgba(90, 70, 40, .045)';
  for (let y = 190; y < ALT - 140; y += 46) for (let x = (y / 46) % 2 ? 23 : 0; x < LARG; x += 46) { c.beginPath(); c.arc(x + 11, y, 2.2, 0, 6.3); c.fill(); }

  // cabeçalho
  c.fillStyle = VERDE; c.fillRect(0, 0, LARG, BARRA + 122);
  barraDeStatus(c, 'rgb(11, 92, 82)');
  const cy = BARRA + 60;
  c.strokeStyle = '#fff'; c.lineWidth = 3.4; c.lineCap = 'round'; c.lineJoin = 'round';
  c.beginPath(); c.moveTo(46, cy - 13); c.lineTo(32, cy); c.lineTo(46, cy + 13); c.moveTo(32, cy); c.lineTo(60, cy); c.stroke();
  c.fillStyle = '#0E5A8A'; c.beginPath(); c.arc(116, cy, 38, 0, 6.3); c.fill();
  c.fillStyle = '#fff'; c.save(); c.translate(116 - 20, cy - 20); c.beginPath();   // o raio da logo de exemplo
  c.moveTo(23, 3); c.lineTo(8, 23); c.lineTo(17, 23); c.lineTo(15, 37); c.lineTo(30, 17); c.lineTo(21, 17); c.closePath(); c.fill(); c.restore();
  c.textAlign = 'left'; c.textBaseline = 'alphabetic'; c.fillStyle = '#fff'; c.font = `600 31px ${FONTE}`;
  let nome = e.nome; while (nome.length > 3 && c.measureText(nome).width > 440) nome = nome.slice(0, -2).trimEnd() + '…';
  c.fillText(nome, 172, cy - 4);
  c.font = `400 23px ${FONTE}`; c.fillStyle = 'rgba(255, 255, 255, .82)'; c.fillText(e.digitandoEle ? 'digitando…' : 'online', 172, cy + 30);
  c.fillStyle = '#fff'; for (let i = -1; i <= 1; i++) { c.beginPath(); c.arc(680, cy + i * 13, 3.6, 0, 6.3); c.fill(); }

  // dia
  let y = BARRA + 146;
  caixa(c, LARG / 2 - 62, y, 124, 42, 14, 'rgba(255, 255, 255, .92)');
  c.font = `500 21px ${FONTE}`; c.fillStyle = SUAVE; c.textAlign = 'center'; c.fillText('HOJE', LARG / 2, y + 29);
  y += 66;

  // o que já tinha sido conversado
  y += balao(c, 'd', y, ['Oi, Carlos! Consegue me passar o', 'orçamento do ar-condicionado?'], '09:12', true) + 16;
  y += balao(c, 'e', y, ['Oi, Ana! Consigo sim.', 'Já te mando o PDF.'], '09:14') + 16;

  // o PDF que chega
  const yPdf = y, wPdf = 520, hMini = 236, hPdf = hMini + 132;
  if (e.pdf > 0.001) {
    const k = passaEVolta(limita(e.pdf), 1.6);
    c.save(); c.translate(22, yPdf + hPdf / 2); c.scale(k, k); c.translate(0, -hPdf / 2); c.globalAlpha = Math.min(1, e.pdf * 2.5);
    caixa(c, 0, 0, wPdf, hPdf, 20, DELE);
    c.save(); c.beginPath(); c.roundRect(8, 8, wPdf - 16, hMini, 14); c.clip();
    c.fillStyle = '#fff'; c.fillRect(8, 8, wPdf - 16, hMini);
    const im = doc?.tex.image; if (im) c.drawImage(im, 0, 0, im.width, im.width * (hMini / (wPdf - 16)), 8, 8, wPdf - 16, hMini);
    c.restore();
    c.strokeStyle = 'rgba(17, 27, 33, .08)'; c.lineWidth = 2; c.beginPath(); c.roundRect(8, 8, wPdf - 16, hMini, 14); c.stroke();
    caixa(c, 22, hMini + 24, 58, 68, 8, '#E5484D', false);
    c.font = `700 19px ${FONTE}`; c.fillStyle = '#fff'; c.textAlign = 'center'; c.fillText('PDF', 51, hMini + 66);
    c.textAlign = 'left'; c.fillStyle = TINTA; c.font = `500 27px ${FONTE}`; c.fillText('Orçamento nº 1.pdf', 98, hMini + 52);
    c.font = `400 22px ${FONTE}`; c.fillStyle = SUAVE; c.fillText('1 página · PDF · 84 kB', 98, hMini + 84);
    c.font = `400 21px ${FONTE}`; c.textAlign = 'right'; c.fillText('09:18', wPdf - 18, hPdf - 12);
    c.restore();
  }
  y += hPdf + 16;

  // a resposta dela
  if (e.resposta > 0.001) {
    const k = passaEVolta(limita(e.resposta), 1.5);
    c.save(); c.translate(LARG - 22, y + 47); c.scale(k, k); c.translate(-(LARG - 22), -(y + 47)); c.globalAlpha = Math.min(1, e.resposta * 2.5);
    balao(c, 'd', y, ['Perfeito! Pode fazer 👍'], '09:19', e.lida);
    c.restore();
  }

  // caixa de escrever
  const yb = ALT - 128;
  caixa(c, 18, yb, 586, 92, 46, '#fff');
  c.textAlign = 'left'; c.font = `400 30px ${FONTE}`;
  if (e.digitado) {
    c.fillStyle = TINTA; c.fillText(e.digitado, 52, yb + 57);
    c.fillStyle = '#1DAA61'; c.fillRect(54 + c.measureText(e.digitado).width, yb + 26, 3, 40);
  } else { c.fillStyle = '#8696A0'; c.fillText('Mensagem', 52, yb + 57); }
  c.fillStyle = '#1DAA61'; c.beginPath(); c.arc(662, yb + 46, 46, 0, 6.3); c.fill();
  c.fillStyle = '#fff'; c.beginPath();
  if (e.digitado) { c.moveTo(646, yb + 28); c.lineTo(684, yb + 46); c.lineTo(646, yb + 64); c.lineTo(652, yb + 46); c.closePath(); c.fill(); }
  else { c.roundRect(653, yb + 22, 18, 32, 9); c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 3.4; c.beginPath(); c.arc(662, yb + 44, 17, 0.15, Math.PI - 0.15); c.moveTo(662, yb + 61); c.lineTo(662, yb + 70); c.stroke(); }

  // onde o avião pousa: o centro da miniatura do PDF, em fração da tela (origem em cima, à esquerda)
  return { alvo: [(22 + wPdf / 2) / LARG, (yPdf + hPdf * 0.42) / ALT] };
}
