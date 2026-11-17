// As placas fotográficas da cena e o que o código precisa saber de cada uma.
// `px` é o tamanho da foto original; as medidas "em pixels" (cantos da tela) são desse tamanho. O resto vai de 0 a 1
// dentro da foto (y para baixo). `recorte` diz que parte da foto a textura cobre (x, y, largura, altura).
// As fotos foram geradas por IA a partir das fichas dos personagens; os originais em PNG, os rascunhos e os prompts
// ficam fora do site, em OrçaNotas/ia/cena-4/. Cada placa tem um mapa de profundidade (claro = perto), também gerado.
// O plano aberto aqui é um vídeo (gerado a partir da foto do plano aberto), guardado como sequência de quadros e
// controlado pela rolagem. Há três clipes, um por modelo de vídeo; só o escolhido é baixado.
import urlMaos from '../imagens/maos-eletricista.webp';
import urlMaosProf from '../imagens/maos-eletricista-prof.webp';
import urlMaosVertical from '../imagens/maos-eletricista-vertical.webp';
import urlMaosVerticalProf from '../imagens/maos-eletricista-vertical-prof.webp';
import urlCliente from '../imagens/maos-cliente.webp';
import urlClienteVertical from '../imagens/maos-cliente-vertical.webp';
import urlClienteProf from '../imagens/maos-cliente-prof.webp';
import urlTelaEnviar from '../../../src/assets/telas/09-folha-enviar.webp';
import urlPaginaPdf from '../../../src/assets/telas/orcamento-pagina.webp';

export { urlTelaEnviar, urlPaginaPdf };

// A: as mãos do eletricista, vistas por ele. A tela real do app entra no lugar da tela da foto.
const telaEnviar = {
  raio: 0.095,
  zonaPele: [0.45, 0.70],            // só daqui para a direita e para baixo um dedo pode cobrir o visor
  tinta: [0.985, 0.99, 1.0],
  linha: [0.770, 0.840],             // faixa vertical da opção "PDF pelo WhatsApp" na tela do app
};
const A_LARGA = {
  url: urlMaos, prof: urlMaosProf, px: [2752, 1536], recorte: [0, 0, 1, 1],
  foco: 0.99, centro: [0.501, 0.436],
  tela: { ...telaEnviar, cantos: [[1219, 314], [1536, 313], [1539, 1025], [1221, 1026]], toque: [0.76, 0.812] },   // cantos: cima-esq, cima-dir, baixo-dir, baixo-esq
  luzes: [{ pos: [0.501, 0.436], raio: 0.26, cor: [0.55, 0.74, 1.0], forca: 0.03, pulso: 1.6 }],
  poeira: [0.80, 0.80, 0.86],
};
const A_VERTICAL = {
  url: urlMaosVertical, prof: urlMaosVerticalProf, px: [1536, 2752], recorte: [0, 0, 1, 1],
  foco: 0.886, centro: [0.503, 0.443],
  tela: { ...telaEnviar, cantos: [[554, 735], [986, 733], [991, 1705], [560, 1708]], toque: [0.75, 0.818] },
  luzes: [{ pos: [0.503, 0.443], raio: 0.16, cor: [0.55, 0.74, 1.0], forca: 0.03, pulso: 1.6 }],
  poeira: [0.80, 0.80, 0.86],
};

// B: o plano aberto, em vídeo. O primeiro quadro de cada clipe é a foto do plano aberto (2452 × 1536) recortada em
// 16:9, da linha 40 à 1419: por isso o vídeo ocupa esse recorte dentro da foto, e as medidas continuam as da foto.
const Y0 = 40 / 1536, ALT = 1379 / 1536;
export const QUADRO = [0, Y0, 1, ALT];                       // o quadro inteiro do vídeo, em coordenadas da foto
const B = {
  px: [2452, 1536], foco: 0.5, chao: 0.925, poeira: [0.90, 0.84, 0.74], video: true,
};
const B_LARGA = { ...B, recorte: QUADRO };
const B_VERTICAL = { ...B, recorte: [358 / 1280, Y0, 884 / 1280, ALT] };   // no celular os quadros vêm recortados na largura

// Os três clipes. `trilha` traz, quadro a quadro, onde estão os dois celulares e a arandela, e o movimento da câmera
// em relação ao primeiro quadro (escala e deslocamento), medidos por rastreamento.
export const MODELOS = {
  kling: { nome: 'Kling Standard', quadros: new URL('../videos/quadros-kling.bin', import.meta.url).href, quadrosVertical: new URL('../videos/quadros-kling-vertical.bin', import.meta.url).href, trilha: () => import('./trilhas/kling.json') },
  'veo-lite': { nome: 'Veo Lite', quadros: new URL('../videos/quadros-veo-lite.bin', import.meta.url).href, quadrosVertical: new URL('../videos/quadros-veo-lite-vertical.bin', import.meta.url).href, trilha: () => import('./trilhas/veo-lite.json') },
  'veo-fast': { nome: 'Veo Fast', quadros: new URL('../videos/quadros-veo-fast.bin', import.meta.url).href, quadrosVertical: new URL('../videos/quadros-veo-fast-vertical.bin', import.meta.url).href, trilha: () => import('./trilhas/veo-fast.json') },
};

// E: as mãos da cliente, na porta. A conversa é desenhada por código e entra no lugar da tela da foto.
const E = {
  prof: urlClienteProf, px: [2752, 1536],
  foco: 0.87, centro: [0.499, 0.45],
  tela: {
    cantos: [[1214, 394], [1496, 385], [1533, 984], [1250, 1001]],
    raio: 0.10, zonaPele: [0.36, 0.70], tinta: [0.86, 0.895, 0.92], linha: [2, 2], toque: [0.5, 0.5],
  },
  luzes: [{ pos: [0.499, 0.45], raio: 0.26, cor: [0.80, 0.88, 1.0], forca: 0.05, pulso: 1.4 }],
  poeira: [1.0, 0.76, 0.46],
};

// Um conjunto para telas largas e outro para telas em pé (celular).
export const PLACAS = {
  larga: { A: A_LARGA, B: B_LARGA, E: { ...E, url: urlCliente, recorte: [0, 0, 1, 1] } },
  vertical: { A: A_VERTICAL, B: B_VERTICAL, E: { ...E, url: urlClienteVertical, recorte: [853 / 2752, 0, 1040 / 2752, 1] } },
};

export const CORES_SINAL = [[0.494, 0.753, 0.902], [0.13, 0.52, 0.86], [0.961, 0.639, 0.039]];   // #7EC0E6 → azul da marca aceso → #F5A30A

/** Curva do sinal (Bézier cúbica) entre os dois celulares; `escala` é o quanto a câmera do vídeo já se aproximou. */
export function curvaDoSinal(ele, ela, escala = 1) {
  const dx = ela[0] - ele[0];
  return { p0: ele, p1: [ele[0] + dx * 0.21, ele[1] - 0.29 * escala], p2: [ela[0] - dx * 0.24, ela[1] - 0.28 * escala], p3: ela };
}
export function pontoDoSinal(t, { p0, p1, p2, p3 }) {
  const u = 1 - t;
  return [0, 1].map((i) => u * u * u * p0[i] + 3 * u * u * t * p1[i] + 3 * u * t * t * p2[i] + t * t * t * p3[i]);
}
export function corDoSinal(t) {
  const [a, b, c] = CORES_SINAL, k = t < 0.5 ? t * 2 : t * 2 - 1, [de, para] = t < 0.5 ? [a, b] : [b, c];
  return de.map((v, i) => v + (para[i] - v) * k);
}
