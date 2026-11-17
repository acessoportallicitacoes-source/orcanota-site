// A conversa no celular da cliente, desenhada em um canvas que vira a tela do aparelho na foto.
// É o celular DELA: as mensagens dela ficam à direita e as da Elétrica Rocha, à esquerda.
const TEXTO = `'Inter Variable', 'Inter', system-ui, sans-serif`;
const ARQUIVO = 'Orçamento nº 1, Elétrica Rocha.pdf';

// navegadores antigos não têm roundRect: os balões saem com cantos retos, mas a cena não quebra
if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, l, a) { this.rect(x, y, l, a); };
}

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

/** `proporcao` é largura / altura do visor na foto, para a conversa encaixar sem esticar. */
export function criaConversa(imgPdf, proporcao) {
  const L = 800, A = Math.round(L / proporcao);
  const canvas = document.createElement('canvas'); canvas.width = L; canvas.height = A;
  const ctx = canvas.getContext('2d');
  let ultimo = -1;

  /** chegada: 0 (só as duas primeiras mensagens) → 1 (o PDF chegou). Devolve true se redesenhou. */
  function desenha(chegada) {
    const passo = Math.round(chegada * 24) / 24;
    if (passo === ultimo) return false;
    ultimo = passo;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#E9EEF3'; ctx.fillRect(0, 0, L, A);

    // topo azul-petróleo
    ctx.fillStyle = '#0A4467'; ctx.fillRect(0, 0, L, 250);
    ctx.fillStyle = '#BCDCEE'; ctx.font = `500 30px ${TEXTO}`;
    ctx.fillText('20:47', 56, 52);
    ctx.textAlign = 'right'; ctx.fillText('4G  ▮▮▮', L - 56, 52); ctx.textAlign = 'left';
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
      const linhas = quebra(ctx, texto, L * 0.74 - 64);
      const larg = Math.max(...linhas.map((l) => ctx.measureText(l).width), 150) + 64;
      const alt = linhas.length * 56 + 76;
      const x = dela ? L - 40 - larg : 40;
      ctx.fillStyle = 'rgba(15,27,45,.08)'; caixa(ctx, x, y + 3, larg, alt, 34, dela ? 'dir' : 'esq');
      ctx.fillStyle = dela ? '#D6E9F4' : '#FFFFFF'; caixa(ctx, x, y, larg, alt, 34, dela ? 'dir' : 'esq');
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
      const larg = L * 0.78, x = 40, yy = y + 28 + (1 - k) * 110;
      const altImg = (larg - 28) / 1.35, alt = altImg + 28 + 132;
      ctx.save(); ctx.globalAlpha = Math.min(1, passo * 1.8);
      ctx.fillStyle = 'rgba(15,27,45,.10)'; caixa(ctx, x, yy + 4, larg, alt, 34, 'esq');
      ctx.fillStyle = '#FFFFFF'; caixa(ctx, x, yy, larg, alt, 34, 'esq');
      // miniatura da página real do orçamento
      ctx.save(); ctx.beginPath(); ctx.roundRect(x + 14, yy + 14, larg - 28, altImg, 22); ctx.clip();
      ctx.fillStyle = '#fff'; ctx.fillRect(x + 14, yy + 14, larg - 28, altImg);
      if (imgPdf) { const esc = (larg - 28) / imgPdf.width; ctx.drawImage(imgPdf, x + 14, yy + 14 - imgPdf.height * esc * 0.035, larg - 28, imgPdf.height * esc); }
      ctx.restore();
      ctx.strokeStyle = 'rgba(15,27,45,.10)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(x + 14, yy + 14, larg - 28, altImg, 22); ctx.stroke();
      // selo PDF e nome do arquivo
      ctx.fillStyle = '#C0392B'; caixa(ctx, x + 26, yy + altImg + 40, 76, 76, 14);
      ctx.fillStyle = '#fff'; ctx.font = `700 26px ${TEXTO}`; ctx.textAlign = 'center'; ctx.fillText('PDF', x + 64, yy + altImg + 80); ctx.textAlign = 'left';
      ctx.fillStyle = '#0F1B2D';
      let corpo = 31; do { ctx.font = `600 ${corpo}px ${TEXTO}`; } while (ctx.measureText(ARQUIVO).width > larg - 120 - 24 && --corpo > 20);   // o nome cabe em uma linha
      ctx.fillText(ARQUIVO, x + 120, yy + altImg + 62);
      ctx.fillStyle = '#7A8697'; ctx.font = `400 26px ${TEXTO}`; ctx.fillText('1 página · PDF', x + 120, yy + altImg + 104);
      ctx.textAlign = 'right'; ctx.fillText('20:47', x + larg - 26, yy + alt - 22); ctx.textAlign = 'left';
      ctx.restore();
    }

    // campo de mensagem
    ctx.fillStyle = '#fff'; caixa(ctx, 32, A - 150, L - 190, 104, 52);
    ctx.fillStyle = '#9AA6B5'; ctx.font = `400 38px ${TEXTO}`; ctx.fillText('Mensagem', 80, A - 96);
    ctx.fillStyle = '#0E5A8A'; ctx.beginPath(); ctx.arc(L - 86, A - 98, 54, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(L - 104, A - 124); ctx.lineTo(L - 60, A - 98); ctx.lineTo(L - 104, A - 72); ctx.closePath(); ctx.fill();
    return true;
  }
  desenha(0);
  return { canvas, desenha };
}
