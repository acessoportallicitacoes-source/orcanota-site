// Pequenas funções de apoio usadas pela cena.
import * as THREE from 'three';

export const limita = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const faixa = (v, a, b) => limita((v - a) / (b - a));
export const suave = (t) => t * t * (3 - 2 * t);
export const mistura = (a, b, t) => a + (b - a) * t;

// Cor sRGB (hex) como vec3 linear para colar em GLSL.
export function glslCor(hex, ganho = 1) {
  const c = new THREE.Color(hex);
  return `vec3(${(c.r * ganho).toFixed(4)}, ${(c.g * ganho).toFixed(4)}, ${(c.b * ganho).toFixed(4)})`;
}

// Gerador pseudoaleatório com semente: a cena sai igual a cada carga.
export function sorteio(semente = 1) {
  let s = semente >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Ruído em GLSL (valor + fbm), usado no asfalto molhado e no céu.
export const GLSL_RUIDO = /* glsl */ `
float hash21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float ruido2(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x), mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm2(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * ruido2(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }
`;
