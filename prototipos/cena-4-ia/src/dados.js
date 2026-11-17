// As placas fotográficas da cena e o que o código precisa saber de cada uma.
// `px` é o tamanho da foto original; as medidas "em pixels" (cantos da tela) são desse tamanho. O resto vai de 0 a 1
// dentro da foto (y para baixo). `recorte` diz que parte da foto a textura cobre (x, y, largura, altura).
// As fotos foram geradas por IA a partir das fichas dos personagens; os originais em PNG, os rascunhos e os prompts
// ficam fora do site, em OrçaNotas/ia/cena-4/. Cada placa tem um mapa de profundidade (claro = perto), também gerado.
// No plano aberto, um trecho de parede lisa entre os dois foi retirado por código para aproximá-los.
import urlMaos from '../imagens/maos-eletricista.webp';
import urlMaosProf from '../imagens/maos-eletricista-prof.webp';
import urlMaosVertical from '../imagens/maos-eletricista-vertical.webp';
import urlMaosVerticalProf from '../imagens/maos-eletricista-vertical-prof.webp';
import urlRua from '../imagens/rua.webp';
import urlRuaLeve from '../imagens/rua-leve.webp';
import urlRuaProf from '../imagens/rua-prof.webp';
import urlCliente from '../imagens/maos-cliente.webp';
import urlClienteVertical from '../imagens/maos-cliente-vertical.webp';
import urlClienteProf from '../imagens/maos-cliente-prof.webp';
import urlTelaEnviar from '../../../src/assets/telas/09-folha-enviar.webp';
import urlPaginaPdf from '../../../src/assets/telas/orcamento-pagina.webp';

export { urlTelaEnviar, urlPaginaPdf, urlRua };

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

// B: o plano aberto. Os dois estão em frente à mesma casa (a dela), a cerca de dois metros um do outro.
const B = {
  prof: urlRuaProf, px: [2452, 1536], recorte: [0, 0, 1, 1],
  foco: 0.54,                        // a parede: é o que fica parado na paralaxe
  celEle: [0.522, 0.490],
  celEla: [0.775, 0.473],
  chao: 0.925,                       // onde começam o meio-fio e o asfalto (reflexo do sinal)
  luzes: [
    { pos: [0.8825, 0.2835], raio: 0.075, cor: [1.0, 0.72, 0.36], forca: 0.15, pulso: 3.1 },   // arandela ao lado da porta
    { pos: [0.775, 0.50], raio: 0.10, cor: [1.0, 0.70, 0.34], forca: 0.06, pulso: 1.3 },        // luz da porta
    { pos: [0.522, 0.490], raio: 0.04, cor: [0.60, 0.80, 1.0], forca: 0.20, pulso: 1.9 },       // tela do celular dele
  ],
  poeira: [0.90, 0.84, 0.74],
  // o sinal: uma curva de Bézier cúbica curta, do celular dele ao dela, passando acima das cabeças
  sinal: { p0: [0.522, 0.490], p1: [0.575, 0.195], p2: [0.715, 0.185], p3: [0.775, 0.473] },
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
  larga: { A: A_LARGA, B: { ...B, url: urlRua }, E: { ...E, url: urlCliente, recorte: [0, 0, 1, 1] } },
  vertical: { A: A_VERTICAL, B: { ...B, url: urlRuaLeve }, E: { ...E, url: urlClienteVertical, recorte: [853 / 2752, 0, 1040 / 2752, 1] } },
};

export const CORES_SINAL = [[0.494, 0.753, 0.902], [0.13, 0.52, 0.86], [0.961, 0.639, 0.039]];   // #7EC0E6 → azul da marca aceso → #F5A30A

export function pontoDoSinal(t, { p0, p1, p2, p3 } = B.sinal) {
  const u = 1 - t;
  return [0, 1].map((i) => u * u * u * p0[i] + 3 * u * u * t * p1[i] + 3 * u * t * t * p2[i] + t * t * t * p3[i]);
}
export function corDoSinal(t) {
  const [a, b, c] = CORES_SINAL, k = t < 0.5 ? t * 2 : t * 2 - 1, [de, para] = t < 0.5 ? [a, b] : [b, c];
  return de.map((v, i) => v + (para[i] - v) * k);
}
