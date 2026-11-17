// As telas reais do app (capturas de 720×1600) com vida: cada uma tem as áreas que respondem ao toque,
// os remendos de texto (serviço de exemplo e nome do negócio do visitante) e a barra de status do Android.

export const LARG = 720, ALT_APP = 1600, BARRA = 56, ALT = ALT_APP + BARRA;

const arquivo = (n) => new URL(`../telas/${n}.webp`, import.meta.url).href;
// Áreas medidas na captura reduzida a 450×1000
const area = (x0, y0, x1, y1, para, tipo = 'entra') => ({ r: [x0 / 450, y0 / 1000, x1 / 450, y1 / 1000], para, tipo });
const ABAS = [
  area(0, 900, 112, 1000, 'inicio', 'aba'), area(112, 900, 225, 1000, 'documentos', 'aba'),
  area(225, 900, 337, 1000, 'clientes', 'aba'), area(337, 900, 450, 1000, 'mais', 'aba'),
];
const VOLTA = area(0, 0, 72, 72, '<', 'volta');
const NOVO = area(183, 808, 432, 882, 'novo');

const SERVICO = 'Instalação de ar-condicionado';
const TINTA = '#161d2b';

export const TELAS = {
  inicio: {
    arq: '15-inicio-resumo',
    areas: [
      area(20, 255, 146, 380, 'recibo'), area(162, 255, 288, 380, 'catalogo'), area(304, 255, 430, 380, 'relatorios'),
      area(20, 400, 146, 525, 'copia'), area(162, 400, 288, 525, 'empresa'), area(304, 400, 430, 525, 'pro'), NOVO, ...ABAS,
    ],
    remendo(c, d, cor) {
      c.fillStyle = cor(12, 12); c.fillRect(24, 36, 680, 62);
      texto(c, `Olá, ${d.nome}`, 41, 77, '600 32px', '#ffffff', 0, 640);
    },
  },
  documentos: { arq: '05-documentos', areas: [area(0, 228, 450, 336, 'detalhe'), NOVO, ...ABAS] },
  clientes: { arq: '06-clientes', areas: [area(0, 162, 450, 228, 'ficha'), ...ABAS] },
  mais: {
    arq: '07-mais',
    areas: [
      area(0, 75, 450, 170, 'empresa'), area(0, 175, 450, 270, 'catalogo'), area(0, 275, 450, 370, 'relatorios'),
      area(0, 375, 450, 445, 'copia'), area(0, 450, 450, 520, 'pro'), area(0, 600, 450, 695, 'ajuda'),
      area(0, 775, 450, 870, 'privacidade'), ...ABAS,
    ],
  },
  recibo: {
    arq: '12-recibo', areas: [VOLTA],
    remendo(c, d, cor) {
      if (d.receba) {   // no fim da história o recibo é do valor inteiro
        c.fillStyle = cor(620, 560); c.fillRect(76, 556, 560, 62);
        texto(c, 'R$ 650,00', 98, 595, '400 32px', TINTA, 1);
        c.fillStyle = cor(620, 662); c.fillRect(84, 640, 440, 46);
      }
      c.fillStyle = cor(100, 815); c.fillRect(76, 738, 568, 66);
      texto(c, SERVICO, 98, 773, '400 32px', TINTA, 1);
      c.fillStyle = cor(60, 1250); c.fillRect(48, 1254, 624, 104);
      if (d.receba) {
        c.fillRect(48, 1156, 624, 204);
        ['Recebi de Ana Souza a importância', 'de R$ 650,00 (seiscentos e', 'cinquenta reais) referente a', 'Instalação de ar-condicionado.'].forEach((l, i) => texto(c, l, 65, 1187 + i * 48.5, '400 32px', TINTA, 1));
        return;
      }
      texto(c, 'referente a Instalação de', 65, 1284, '400 32px', TINTA, 1);
      texto(c, 'ar-condicionado.', 65, 1332, '400 32px', TINTA, 1);
    },
  },
  catalogo: { arq: '23-catalogo', areas: [VOLTA, area(30, 292, 215, 338, 'pro')] },
  relatorios: { arq: '24-relatorios', areas: [VOLTA, area(30, 268, 215, 312, 'pro')] },
  copia: { arq: '16-copia-de-seguranca', areas: [VOLTA] },
  empresa: {
    arq: '20-sua-empresa-marca', areas: [VOLTA],
    remendo(c, d, cor) {
      c.fillStyle = cor(80, 300); c.fillRect(78, 312, 564, 66);
      texto(c, d.nome, 89, 356, '600 32px', '#ffffff', 0, 540);
    },
  },
  pro: {
    arq: '17-pro', areas: [VOLTA],
    remendo(c, d, cor) {   // tira a data do preço de lançamento, que envelheceria na vitrine
      c.fillStyle = cor(80, 600); c.fillRect(78, 616, 564, 100);
      texto(c, 'Preço de lançamento', 89, 655, '400 28px', '#6b4a05', 1);
    },
  },
  novo: {
    arq: '02-novo-orcamento', areas: [VOLTA],
    remendo(c, d, cor) {
      // na história os campos se preenchem com a rolagem (d.crie); fora dela já vêm preenchidos
      const h = d.crie ?? { cliente: 'Ana Souza', desc: SERVICO, valor: '650,00', ativo: null };
      const fundo = cor(100, 860);
      const cursor = (x, y) => { c.fillStyle = '#0E5A8A'; c.fillRect(x + 4, y - 28, 3, 38); };
      c.fillStyle = fundo; c.fillRect(74, 352, 572, 72);
      texto(c, h.cliente, 98, 395, '400 32px', TINTA, 1);
      if (h.ativo === 'cliente') cursor(98 + largura(c, h.cliente, '400 32px', 1), 395);
      c.fillStyle = fundo; c.fillRect(74, 800, 572, 72);
      texto(c, h.desc, 98, 843, '400 32px', TINTA, 1);
      if (h.ativo === 'desc') cursor(98 + largura(c, h.desc, '400 32px', 1), 843);
      c.fillStyle = fundo; c.fillRect(150, 1076, 494, 56);
      const lv = largura(c, h.valor, '400 32px', 1);
      texto(c, h.valor, 616 - lv, 1113, '400 32px', TINTA, 1);
      if (h.ativo === 'valor') cursor(616, 1113);
      c.fillStyle = fundo; c.fillRect(300, 1304, 360, 46);
      const total = `Total do item: R$ ${h.valor.length === 6 ? h.valor : '0,00'}`;
      texto(c, total, 654 - largura(c, total, '400 29px', 0.8), 1334, '400 29px', TINTA, 0.8);
    },
  },
  detalhe: {
    arq: '10-detalhe-orcamento', areas: [VOLTA],
    remendo(c, d, cor) {
      c.fillStyle = cor(60, 600); c.fillRect(48, 606, 430, 98);
      texto(c, 'Instalação de', 65, 643, '400 32px', TINTA, 1);
      texto(c, 'ar-condicionado', 65, 692, '400 32px', TINTA, 1);
    },
  },
  ficha: { arq: '14-ficha-cliente', areas: [VOLTA, area(0, 315, 450, 425, 'detalhe')] },
  ajuda: { arq: '25-ajuda', areas: [VOLTA] },
  privacidade: { arq: '19-privacidade', areas: [VOLTA] },
};

function largura(c, t, fonte, espaco = 0) {
  c.font = `${fonte} "Inter Variable", Inter, system-ui, sans-serif`; c.letterSpacing = `${espaco}px`;
  const l = c.measureText(t).width; c.letterSpacing = '0px'; return l;
}

function texto(c, t, x, y, fonte, cor, espaco = 0, max = 0) {
  c.font = `${fonte} "Inter Variable", Inter, system-ui, sans-serif`;
  c.letterSpacing = `${espaco}px`;
  c.fillStyle = cor; c.textBaseline = 'alphabetic'; c.textAlign = 'left';
  let s = t;
  if (max) while (s.length > 3 && c.measureText(s).width > max) s = s.slice(0, -2).trimEnd() + '…';
  c.fillText(s, x, y);
  c.letterSpacing = '0px';
}

const imagens = new Map();
export function carregar(id) {
  if (!imagens.has(id)) {
    imagens.set(id, new Promise((ok, erro) => {
      const im = new Image(); im.decoding = 'async';
      im.onload = () => ok(im); im.onerror = erro; im.src = arquivo(TELAS[id].arq);
    }));
  }
  return imagens.get(id);
}

// Barra de status do Android (hora, sinal, bateria) na cor do topo da tela
export function barraDeStatus(c, corTopo) {
  c.fillStyle = corTopo; c.fillRect(0, 0, LARG, BARRA + 1);
  const m = corTopo.match(/\d+/g).map(Number);
  const clara = m[0] * 0.3 + m[1] * 0.59 + m[2] * 0.11 > 140;
  const cor = clara ? '#1b2330' : '#ffffff';
  texto(c, '09:41', 40, 39, '600 25px', cor, 0.4);
  c.fillStyle = cor; c.strokeStyle = cor;
  // sinal
  for (let i = 0; i < 4; i++) { const h = 7 + i * 4.5; c.globalAlpha = i < 3 ? 1 : 0.35; c.fillRect(566 + i * 8, 40 - h, 5, h); }
  c.globalAlpha = 1;
  // wi-fi
  c.lineWidth = 3.2; c.lineCap = 'round';
  for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(622, 40, 5 + i * 6.5, -Math.PI * 0.75, -Math.PI * 0.25); c.stroke(); }
  c.beginPath(); c.arc(622, 39, 2.4, 0, Math.PI * 2); c.fill();
  // bateria
  c.lineWidth = 2.4; c.beginPath(); c.roundRect(650, 21, 36, 19, 5); c.stroke();
  c.fillRect(687.5, 27, 3, 7); c.beginPath(); c.roundRect(653.5, 24.5, 22, 12, 2.5); c.fill();
}

// Desenha a tela `id` inteira (barra de status + captura + remendos) no canvas dado.
export async function desenhar(id, canvas, dados) {
  const im = await carregar(id);
  const c = canvas.getContext('2d', { willReadFrequently: true });
  c.drawImage(im, 0, BARRA, LARG, ALT_APP);
  const cor = (x, y) => { const p = c.getImageData(x, y + BARRA, 1, 1).data; return `rgb(${p[0]}, ${p[1]}, ${p[2]})`; };
  const corTopo = cor(6, 4);
  const t = TELAS[id];
  if (t.remendo) { c.save(); c.translate(0, BARRA); t.remendo(c, dados, cor); c.restore(); }
  barraDeStatus(c, corTopo);
}

// Dado um ponto da tela inteira (0–1, origem no canto de cima à esquerda), devolve a área tocável ou nada.
export function areaEm(id, u, v) {
  const y = (v * ALT - BARRA) / ALT_APP;
  if (y < 0) return null;
  return TELAS[id].areas.find(({ r }) => u >= r[0] && u <= r[2] && y >= r[1] && y <= r[3]) ?? null;
}

export const preCarregar = () => Object.keys(TELAS).forEach((id) => carregar(id).catch(() => {}));
