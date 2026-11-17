// O roteiro da cena: para cada avanço p (0 a 1) da rolagem, onde está a câmera de cada placa, quanto cada uma
// aparece, e em que ponto estão o toque, o sinal e a chegada do PDF. É uma função pura de p: rolar para trás desfaz.
//
//   0,00–0,13  close nas mãos do eletricista; o toque em "PDF pelo WhatsApp" acontece em 0,055–0,12
//   0,13–0,34  a câmera recua; a luz que nasce da tela cobre a passagem para o plano aberto (o primeiro quadro do vídeo)
//   0,20–0,75  o vídeo do plano aberto corre com a rolagem, para frente e para trás
//   0,245–0,675 o sinal vai do celular dele ao dela (azul → âmbar), seguindo os dois quadro a quadro
//   0,60–0,77  a câmera avança até a cliente; o sinal pousa e a luz âmbar cobre a passagem para as mãos dela
//   0,80–0,89  o PDF chega na conversa
import { pontoDoSinal, curvaDoSinal } from './dados.js';

const CURVAS = {
  lin: (t) => t,
  suave: (t) => t * t * (3 - 2 * t),
  sai: (t) => 1 - (1 - t) ** 3,
  entra: (t) => t * t * t,
  vai: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
};
export const limita = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const faixa = (v, a, b) => limita((v - a) / (b - a));
export const mistura = (a, b, t) => a + (b - a) * t;

/** Trilha de quadros-chave: [p, valor, curva do trecho que termina aqui]. O valor pode ser número ou lista. */
function trilha(p, pontos) {
  if (p <= pontos[0][0]) return pontos[0][1];
  for (let i = 1; i < pontos.length; i++) {
    if (p <= pontos[i][0]) {
      const [p0, v0] = pontos[i - 1], [p1, v1, curva = 'suave'] = pontos[i];
      const t = CURVAS[curva]((p - p0) / (p1 - p0));
      return Array.isArray(v0) ? v0.map((a, j) => a + (v1[j] - a) * t) : v0 + (v1 - v0) * t;
    }
  }
  return pontos[pontos.length - 1][1];
}

// Enquadramentos. `h` é a fração da altura da placa que cabe na tela (menor = mais perto).
// No plano aberto a câmera do código recua do celular dele até a fachada, fica quase parada enquanto o vídeo corre
// (o movimento é o do próprio vídeo) e avança até o celular dela. As posições dos celulares vêm do vídeo.
const LARGO = {
  A: { c: [[0, [0.501, 0.43]], [0.12, [0.501, 0.405]], [0.24, [0.501, 0.45], 'entra']], h: [[0, 0.84], [0.12, 0.74], [0.24, 1.0, 'entra']] },
  B: { h: [[0.165, 0.34], [0.34, 1.0, 'sai'], [0.62, 1.0], [0.77, 0.30, 'entra']] },
  E: { c: [[0.705, [0.499, 0.47]], [0.87, [0.499, 0.416], 'sai']], h: [[0.705, 1.0], [0.87, 0.62, 'sai'], [1, 0.60, 'lin']] },
};
const VERTICAL = {
  A: { c: [[0, [0.508, 0.50]], [0.12, [0.512, 0.437]], [0.24, [0.508, 0.47], 'entra']], h: [[0, 0.80], [0.12, 0.614], [0.24, 0.86, 'entra']] },
  B: { h: [[0.165, 0.42], [0.31, 1.0, 'sai'], [0.64, 1.0], [0.77, 0.36, 'entra']] },
  E: { c: [[0.705, [0.499, 0.5]], [0.87, [0.499, 0.454], 'sai']], h: [[0.705, 1.0], [0.87, 0.758, 'sai'], [1, 0.74, 'lin']] },
};

/** Em que ponto do vídeo (0 a 1) a rolagem p está: começa a andar quando o plano aberto aparece e termina com ele. */
export function pontoDoVideo(p) {
  const t = faixa(p, 0.20, 0.75);
  return mistura(t, CURVAS.suave(t), 0.35);        // quase linear, com partida e chegada macias
}

/** `T`: onde estão, no quadro atual do vídeo, o celular dele (`ele`), o dela (`ela`) e a aproximação da câmera (`escala`). */
export function roteiro(p, vertical, T) {
  const k = vertical ? VERTICAL : LARGO;
  const viagem = CURVAS.suave(faixa(p, 0.245, 0.675));          // posição da cabeça do sinal na curva
  const curva = curvaDoSinal(T.ele, T.ela, T.escala);
  const cabeca = pontoDoSinal(viagem, curva);

  let cB;
  if (vertical) {
    // segue a cabeça do sinal na horizontal, com partida e chegada suaves
    const segue = CURVAS.suave(faixa(cabeca[0], T.ele[0] + 0.01, T.ela[0] - 0.01));
    const xViagem = mistura(T.ele[0] - 0.082, T.ela[0] + 0.015, segue), yViagem = 0.5;
    const entrada = CURVAS.sai(faixa(p, 0.165, 0.31)), saida = CURVAS.entra(faixa(p, 0.64, 0.77));
    cB = [mistura(mistura(T.ele[0], xViagem, entrada), T.ela[0], saida), mistura(mistura(T.ele[1] + 0.01, yViagem, entrada), T.ela[1] + 0.015, saida)];
  } else {
    // sai do celular dele, abre para a fachada inteira (o vídeo faz o resto do movimento) e fecha no celular dela
    const entrada = CURVAS.sai(faixa(p, 0.165, 0.34)), saida = CURVAS.entra(faixa(p, 0.62, 0.77));
    cB = [mistura(mistura(T.ele[0], 0.5, entrada), T.ela[0], saida), mistura(mistura(T.ele[1] + 0.01, 0.475, entrada), T.ela[1] + 0.015, saida)];
  }

  const mAB = CURVAS.suave(faixa(p, 0.165, 0.228));
  const mBE = CURVAS.suave(faixa(p, 0.708, 0.768));

  return {
    viagem, cabeca, curva, mAB, mBE,
    toque: faixa(p, 0.055, 0.12),
    chegada: faixa(p, 0.80, 0.89),
    A: {
      c: trilha(p, k.A.c), h: trilha(p, k.A.h),
      desfoque: trilha(p, [[0.13, 0], [0.228, 30, 'entra']]),
      abertura: trilha(p, [[0, 5], [0.10, 0]]),
      par: [mistura(-0.010, 0.012, faixa(p, 0, 0.24)), mistura(0.006, -0.004, faixa(p, 0, 0.24))],
      zoom: -0.05 * (1 - trilha(p, k.A.h)),
    },
    B: {
      c: cB, h: trilha(p, k.B.h),
      desfoque: trilha(p, [[0.165, 26], [0.26, 0, 'sai'], [0.67, 0], [0.768, 26, 'entra']]),
      abertura: 0, par: [0, 0], zoom: 0,      // o vídeo não tem mapa de profundidade: o movimento vem do próprio clipe
    },
    E: {
      c: trilha(p, k.E.c), h: trilha(p, k.E.h),
      desfoque: trilha(p, [[0.708, 24], [0.80, 0, 'sai']]),
      abertura: trilha(p, [[0.78, 0], [0.9, 4]]),
      par: [mistura(-0.012, 0.008, faixa(p, 0.705, 1)), mistura(-0.006, 0.004, faixa(p, 0.705, 1))],
      zoom: -0.05 * (1 - trilha(p, k.E.h)),
    },
    sinal: trilha(p, [[0.243, 0], [0.262, 1], [0.70, 1], [0.765, 0]]),
    // clarões: [força, raio (fração da altura da tela)]
    clarao1: [trilha(p, [[0.095, 0], [0.195, 1, 'entra'], [0.275, 0, 'sai']]), trilha(p, [[0.095, 0.10], [0.195, 0.85], [0.275, 0.10]])],
    clarao2: [trilha(p, [[0.66, 0], [0.735, 1, 'entra'], [0.815, 0, 'sai']]), trilha(p, [[0.66, 0.08], [0.735, 0.80], [0.815, 0.12]])],
    brilhoA: 1 + 0.10 * faixa(p, 0.10, 0.19),
    brilhoE: 1 + 0.10 * Math.sin(Math.PI * faixa(p, 0.80, 0.90)),
  };
}
