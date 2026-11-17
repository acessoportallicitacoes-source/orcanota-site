// Os programas de desenho da cena (WebGL2). Tudo é desenhado em um único canvas, nesta ordem:
// placa(s) fotográfica(s) → fita do sinal → partículas → clarões → lente (vinheta, grão e sombra do topo).

// Um triângulo que cobre a tela inteira. vUv vai de (0,0) no canto de cima à esquerda a (1,1) embaixo à direita.
export const VS_TELA = /* glsl */ `#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = vec2(p.x, 1.0 - p.y);
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

// A placa: uma fotografia vista por uma câmera 2D (centro + tamanho visível), com
//  - paralaxe pelo mapa de profundidade (o que está perto anda mais que o fundo),
//  - desfoque pela profundidade (profundidade de campo) e desfoque geral nas transições,
//  - a tela do celular trocada pela tela real, encaixada em perspectiva, com os dedos por cima,
//  - luzes que pulsam (telas, lâmpadas) e a luz do sinal passando.
export const fsPlaca = (amostras) => /* glsl */ `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv;
out vec4 o;
uniform sampler2D uPlaca, uPlaca2, uProf, uTela;   // uPlaca2: o quadro seguinte do vídeo (no plano aberto)
uniform float uMistura, uNitidez; // quanto do quadro seguinte entra; reforço de nitidez do vídeo ampliado
uniform vec4 uRecorte;            // onde a textura fica dentro da placa: x, y, largura, altura
uniform vec2 uCentro, uVisao;     // câmera
uniform vec2 uPar;                // paralaxe: deslocamento por unidade de profundidade
uniform float uParZoom, uRef, uFoco, uAbertura, uDesfoque;   // uRef: profundidade que fica parada na paralaxe; uFoco: a que fica nítida
uniform float uTexel, uPxTela, uAlfa, uExposicao;
uniform float uTemTela, uRaioTela, uAspTela, uToque, uBrilhoTela;
uniform mat3 uH;                  // pixels da placa → coordenadas da tela do celular (0 a 1)
uniform vec4 uLinha;              // v inicial, v final, e o ponto do toque (u, v)
uniform vec2 uZonaPele;
uniform vec3 uTintaTela;
uniform vec4 uLuz[6];             // x, y, raio, força
uniform vec3 uLuzCor[6];
uniform vec4 uReflexo;            // x, y do chão, força, raio
uniform vec3 uReflexoCor;
uniform vec2 uPx;                 // tamanho da foto original, em pixels
const int N = ${amostras};

vec3 amostra(vec2 p, float lod) {
  vec2 uv = (p - uRecorte.xy) / uRecorte.zw;
  vec3 c = textureLod(uPlaca, uv, lod).rgb;
  return uMistura > 0.0 ? mix(c, textureLod(uPlaca2, uv, lod).rgb, uMistura) : c;
}

void main() {
  vec2 p = uCentro + (vUv - 0.5) * uVisao;
  float d0 = texture(uProf, p).r;
  p += (d0 - uRef) * (uPar + uParZoom * (vUv - 0.5));
  float d = texture(uProf, p).r;

  // desfoque: discos de amostras sobre os mipmaps (barato e sem serrilhado, em qualquer raio)
  float r = uDesfoque + uAbertura * abs(d - uFoco);
  float lodBase = log2(max(uPxTela * uTexel, 1.0));
  vec3 nitida = amostra(p, lodBase);
  if (uNitidez > 0.0) {             // máscara de nitidez: o vídeo é 720p e aparece ampliado
    vec2 e = 1.25 / (uPx * uTexel);
    vec3 viz = (amostra(p + vec2(e.x, 0.0), lodBase) + amostra(p - vec2(e.x, 0.0), lodBase) + amostra(p + vec2(0.0, e.y), lodBase) + amostra(p - vec2(0.0, e.y), lodBase)) * 0.25;
    nitida = clamp(nitida + (nitida - viz) * uNitidez, 0.0, 1.0);
  }
  vec3 cor = nitida;
  if (r > 0.6) {
    float lod = max(lodBase, log2(max(r * 0.62 * uTexel, 1.0)));
    vec3 soma = amostra(p, lod);
    for (int i = 0; i < N; i++) {
      float a = float(i) * 2.39996;
      float rr = sqrt((float(i) + 0.5) / float(N)) * r;
      soma += amostra(p + vec2(cos(a), sin(a)) * rr / uPx, lod);
    }
    cor = soma / float(N + 1);
  }

  // a tela real no lugar da tela da foto
  if (uTemTela > 0.5) {
    vec3 q = uH * vec3(p * uPx, 1.0);
    vec2 s = q.xy / max(q.z, 1e-4);
    vec2 c = (s - 0.5) * vec2(uAspTela, 1.0);
    float raio = uRaioTela * uAspTela;
    vec2 dd = abs(c) - vec2(uAspTela * 0.5, 0.5) + raio;
    float sd = length(max(dd, 0.0)) + min(max(dd.x, dd.y), 0.0) - raio;
    float aa = max(fwidth(sd), 1e-4) * (1.0 + r * 0.9);
    float dentro = (1.0 - smoothstep(-aa, aa, sd)) * step(1e-4, q.z);
    vec3 tela = texture(uTela, clamp(s, 0.0, 1.0), log2(1.0 + r * 0.55)).rgb;
    // o toque: a tinta do material se espalha pela linha tocada e a linha fica marcada
    float naLinha = step(uLinha.x, s.y) * step(s.y, uLinha.y);
    float dist = length((s - uLinha.zw) * vec2(uAspTela, 1.0));
    float onda = uToque * 0.56;
    float tinta = naLinha * (1.0 - smoothstep(onda - 0.035, onda, dist)) * min(uToque * 6.0, 1.0);
    tela = mix(tela, vec3(0.055, 0.353, 0.541), tinta * 0.14);
    tela *= uTintaTela * uBrilhoTela;
    // um brilho de vidro bem leve, na diagonal
    tela += 0.022 * (1.0 - smoothstep(0.0, 0.32, abs(s.x * 0.55 + s.y - 0.42)));
    // os dedos ficam por cima: onde a foto tem cor de pele dentro da zona permitida, vale a foto
    float zona = max(step(uZonaPele.x, s.x) * step(uZonaPele.y, s.y), max(step(s.x, 0.03), step(0.97, s.x)));
    vec3 suave = amostra(p, lodBase + 2.3);            // a máscara sai de uma versão levemente borrada: borda lisa
    float pele = smoothstep(0.010, 0.042, suave.r - suave.g) * zona;
    cor = mix(cor, tela, dentro * (1.0 - pele));
  }

  // um pouco mais de contraste, para as três placas terem o mesmo peso de noite
  cor = mix(cor, cor * cor * (3.0 - 2.0 * cor), 0.22);

  // luzes: somam mais onde a foto já é clara, para parecer luz na cena e não uma mancha por cima
  float lum = dot(cor, vec3(0.299, 0.587, 0.114));
  float AP = uPx.x / uPx.y;
  for (int i = 0; i < 6; i++) {
    vec4 L = uLuz[i];
    if (L.w <= 0.0) continue;
    vec2 dv = (p - L.xy) * vec2(AP, 1.0);
    cor += uLuzCor[i] * exp(-dot(dv, dv) / (L.z * L.z)) * L.w * (0.16 + 1.5 * lum);
  }
  // reflexo do sinal no asfalto molhado: um risco vertical logo abaixo do meio-fio
  if (uReflexo.z > 0.0) {
    vec2 dv = vec2((p.x - uReflexo.x) * AP, (p.y - uReflexo.y) * 0.22);
    float f = exp(-dot(dv, dv) / (uReflexo.w * uReflexo.w)) * smoothstep(uReflexo.y, uReflexo.y + 0.035, p.y);
    cor += uReflexoCor * f * uReflexo.z * (0.22 + 2.2 * lum);
  }
  o = vec4(cor * uExposicao, uAlfa);
}`;

// A fita do sinal: uma tira ao longo da curva, com perfil suave. Desenhada duas vezes (halo largo e núcleo fino).
const BEZIER = /* glsl */ `
uniform vec2 uP0, uP1, uP2, uP3;
vec2 bez(float t) { float u = 1.0 - t; return u * u * u * uP0 + 3.0 * u * u * t * uP1 + 3.0 * u * t * t * uP2 + t * t * t * uP3; }
vec2 dbez(float t) { float u = 1.0 - t; return 3.0 * u * u * (uP1 - uP0) + 6.0 * u * t * (uP2 - uP1) + 3.0 * t * t * (uP3 - uP2); }
vec3 corSinal(float t, vec3 a, vec3 b, vec3 c) { return t < 0.5 ? mix(a, b, t * 2.0) : mix(b, c, t * 2.0 - 1.0); }
`;

export const VS_FITA = /* glsl */ `#version 300 es
precision highp float;
layout(location = 0) in vec2 aPos;       // t ao longo da curva, lado (-1 a 1)
uniform vec2 uCentro, uVisao, uRes;
uniform float uLargura;
out vec2 vPos;
${BEZIER}
void main() {
  vec2 s = ((bez(aPos.x) - uCentro) / uVisao + 0.5) * uRes;
  vec2 tg = normalize(dbez(aPos.x) / uVisao * uRes);
  s += vec2(-tg.y, tg.x) * aPos.y * uLargura;
  vPos = aPos;
  vec2 c = s / uRes * 2.0 - 1.0;
  gl_Position = vec4(c.x, -c.y, 0.0, 1.0);
}`;

export const FS_FITA = /* glsl */ `#version 300 es
precision highp float;
in vec2 vPos;
out vec4 o;
uniform float uCabeca, uForca, uNitidez, uBranco;
uniform vec3 uCorA, uCorB, uCorC;
void main() {
  float t = vPos.x;
  float visivel = (1.0 - smoothstep(uCabeca - 0.01, uCabeca, t)) * smoothstep(0.0, 0.012, t);
  float rastro = 0.42 + 0.58 * exp(-(uCabeca - t) * 6.5);
  float perfil = exp(-vPos.y * vPos.y * uNitidez);
  vec3 cor = t < 0.5 ? mix(uCorA, uCorB, t * 2.0) : mix(uCorB, uCorC, t * 2.0 - 1.0);
  cor = mix(cor, vec3(1.0), uBranco * exp(-(uCabeca - t) * 9.0));
  o = vec4(cor * perfil * visivel * rastro * uForca, 1.0);
}`;

// Partículas: 0 = poeira desfocada perto da lente (espaço da tela), 1 = poeira nos cones de luz da rua,
// 2 = faíscas que ficam para trás do sinal.
export const VS_PONTOS = /* glsl */ `#version 300 es
precision highp float;
layout(location = 0) in vec4 aA;         // x, y, tamanho, fase
layout(location = 1) in vec4 aB;         // tipo, fator, t na curva, desvio
uniform vec2 uCentro, uVisao, uRes, uDeriva;
uniform vec3 uCamVideo;                  // movimento da câmera do vídeo: escala, deslocamento x e y (no quadro)
uniform vec4 uQuadro;                    // o quadro do vídeo dentro da foto
uniform float uTempo, uCabeca, uAlfaRua, uAlfaLente, uSinal, uDpr;
uniform vec3 uCorLente, uCorA, uCorB, uCorC;
out vec3 vCor;
${BEZIER}
void main() {
  vec2 s; vec3 cor; float alfa; float tam = aA.z;
  if (aB.x < 0.5) {
    vec2 q = fract(aA.xy + vec2(0.004, -0.0065) * uTempo * aB.y + uDeriva * aB.y);
    s = (q * 1.2 - 0.1) * uRes;
    alfa = uAlfaLente * (0.55 + 0.45 * sin(uTempo * 0.6 + aA.w));
    cor = uCorLente;
    tam *= uRes.y / 900.0;
  } else if (aB.x < 1.5) {
    vec2 p = aA.xy + vec2(sin(uTempo * 0.23 + aA.w), cos(uTempo * 0.19 + aA.w * 1.7)) * 0.009 * aB.y;
    vec2 q = (p - uQuadro.xy) / uQuadro.zw;
    q = uCamVideo.x * (q - 0.5) + 0.5 + uCamVideo.yz;
    p = q * uQuadro.zw + uQuadro.xy;
    s = ((p - uCentro) / uVisao + 0.5) * uRes;
    alfa = uAlfaRua * (0.25 + 0.75 * (0.5 + 0.5 * sin(uTempo * 1.1 + aA.w * 3.0)));
    cor = aA.x < 0.64 ? vec3(0.78, 0.86, 1.0) : vec3(1.0, 0.76, 0.42);
    tam *= uRes.y / 900.0 / max(uVisao.y, 0.25);
  } else {
    float idade = uCabeca - aB.z;
    vec2 tg = normalize(dbez(aB.z));
    vec2 p = bez(aB.z) + vec2(-tg.y, tg.x) * aB.w * (0.003 + idade * 0.06) + vec2(0.0, idade * idade * 0.30);
    s = ((p - uCentro) / uVisao + 0.5) * uRes;
    alfa = uSinal * step(0.0, idade) * exp(-idade * 10.0) * (0.45 + 0.55 * sin(uTempo * 8.0 + aA.w * 20.0));
    cor = mix(corSinal(aB.z, uCorA, uCorB, uCorC), vec3(1.0), 0.35);
    tam *= uRes.y / 900.0 / max(uVisao.y, 0.25);
  }
  vCor = cor * max(alfa, 0.0);
  vec2 c = s / uRes * 2.0 - 1.0;
  gl_Position = vec4(c.x, -c.y, 0.0, 1.0);
  gl_PointSize = max(tam * uDpr, 1.0);
}`;

export const FS_PONTOS = /* glsl */ `#version 300 es
precision highp float;
in vec3 vCor;
out vec4 o;
void main() {
  float r = length(gl_PointCoord - 0.5) * 2.0;
  float a = 1.0 - smoothstep(0.0, 1.0, r);
  o = vec4(vCor * a * a, 1.0);
}`;

// Clarões: a luz que nasce da tela no toque, a cabeça do sinal e a chegada no celular da cliente.
export const FS_CLARAO = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 o;
uniform vec4 uF[3];                      // x, y (na tela), raio (fração da altura), força
uniform vec3 uFCor[3];
uniform vec2 uRes;
void main() {
  vec3 c = vec3(0.0);
  float asp = uRes.x / uRes.y;
  for (int i = 0; i < 3; i++) {
    vec4 F = uF[i];
    if (F.w <= 0.0) continue;
    vec2 dv = (vUv - F.xy) * vec2(asp, 1.0);
    float d2 = dot(dv, dv), r2 = F.z * F.z;
    float halo = exp(-d2 / r2) * 0.55 + exp(-d2 / (r2 * 0.09)) * 0.6;
    float risco = exp(-dv.y * dv.y / (r2 * 0.0035)) * exp(-dv.x * dv.x / (r2 * 5.0)) * 0.30;   // risco horizontal, de lente anamórfica
    vec3 cor = mix(uFCor[i], vec3(1.0), 0.65 * exp(-d2 / (r2 * 0.05)));
    c += cor * (halo + risco) * F.w;
  }
  o = vec4(c, 1.0);
}`;

// Lente: escurece os cantos, sombreia o topo (para a legenda) e põe o grão. É multiplicada sobre o quadro.
export const FS_LENTE = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 o;
uniform float uSemente, uGrao, uTopo, uVinheta;
void main() {
  vec2 c = vUv - 0.5;
  float vinheta = 1.0 - uVinheta * smoothstep(0.12, 0.75, dot(c, c) * 1.6);
  float topo = 1.0 - uTopo * (1.0 - smoothstep(0.0, 0.36, vUv.y));
  float n = fract(sin(dot(gl_FragCoord.xy + uSemente * vec2(37.0, 17.0), vec2(12.9898, 78.233))) * 43758.5453);
  o = vec4(vec3(vinheta * topo * (1.0 - uGrao * n)), 1.0);
}`;
