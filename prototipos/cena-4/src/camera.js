// O roteiro da câmera, preso à rolagem. Cada chave diz onde a câmera está, para onde olha, qual é o "para cima"
// (nos closes a câmera gira para o celular ficar em pé no quadro), a abertura (fov), o quanto segue a ponta do
// sinal e a força do desfoque. Entre as chaves, a posição passa por uma curva suave.
import * as THREE from 'three';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const CIMA = V(0, 1, 0);

// Curva de Hermite entre duas chaves, com as tangentes m1 e m2.
function hermite(p1, m1, p2, m2, t, alvo) {
  const t2 = t * t, t3 = t2 * t;
  const a = 2 * t3 - 3 * t2 + 1, b = t3 - 2 * t2 + t, c = -2 * t3 + 3 * t2, d = t3 - t2;
  for (const e of ['x', 'y', 'z']) alvo[e] = a * p1[e] + b * m1[e] + c * p2[e] + d * m2[e];
  return alvo;
}

/**
 * @param ele, ela { cel, nTela, cimaTela, dirTela, cabeca, frente, lado }
 *   cel: centro do celular; nTela/cimaTela/dirTela: eixos da tela; lado: vetor para o ombro do lado da rua.
 */
export function criaRoteiro({ ele, ela, vertical }) {
  const soma = (base, ...pares) => { const r = base.clone(); for (let i = 0; i < pares.length; i += 2) r.addScaledVector(pares[i], pares[i + 1]); return r; };
  const plano = (v) => v.clone().setY(0).normalize();
  const paraEla = plano(ela.cabeca.clone().sub(ele.cabeca));       // dele para ela, no chão
  // "para cima" dos closes: o eixo do aparelho, um pouco endireitado
  const cimaCel = (p) => p.cimaTela.clone().lerp(CIMA, 0.25).normalize();
  // de que lado da tela a câmera fica: do lado da mão que segura
  const sEle = Math.sign(ele.dirTela.dot(ele.lado)) || 1, sEla = Math.sign(ela.dirTela.dot(ela.lado)) || 1;

  let chaves;
  if (!vertical) {
    const closeEle = (dist, lado, sobe) => soma(ele.cel, ele.nTela, dist, ele.dirTela, sEle * lado, ele.cimaTela, sobe);
    const closeEla = (dist, lado, sobe) => soma(ela.cel, ela.nTela, dist, ela.dirTela, sEla * lado, ela.cimaTela, sobe);
    chaves = [
      { p: 0.0, pos: closeEle(0.42, 0.2, 0.0), alvo: soma(ele.cel, ele.cimaTela, 0.004, ele.dirTela, -sEle * 0.02), cima: cimaCel(ele), fov: 31, desfoque: 6, faixaFoco: 0.1, focoEm: ele.cel },
      { p: 0.17, pos: closeEle(0.4, 0.19, 0.0), alvo: soma(ele.cel, ele.cimaTela, 0.004, ele.dirTela, -sEle * 0.02), cima: cimaCel(ele), fov: 31, desfoque: 6, faixaFoco: 0.1, focoEm: ele.cel },
      { p: 0.235, pos: soma(ele.cabeca, paraEla, -0.3, ele.lado, 0.6, CIMA, 0.1), alvo: soma(ele.cel, paraEla, 0.9, CIMA, 0.08), fov: 34, desfoque: 4, faixaFoco: 0.5, focoEm: ele.cel },
      { p: 0.31, pos: soma(ele.cabeca, paraEla, -0.95, ele.lado, 0.68, CIMA, 0.24), alvo: soma(ele.cel, paraEla, 3.6, CIMA, 0.12), fov: 36, desfoque: 3, faixaFoco: 1.4, focoEm: ele.cel },
      { p: 0.47, pos: V(-0.9, 3.3, 19.8), alvo: V(-0.1, 3.5, 0), fov: 35, desfoque: 0, faixaFoco: 30 },
      { p: 0.66, pos: V(0.9, 2.9, 18.6), alvo: V(0.5, 3.35, 0), fov: 35, desfoque: 0, faixaFoco: 30 },
      { p: 0.83, pos: soma(ela.cabeca, ela.frente, -0.8, ela.lado, 1.55, CIMA, 0.08), alvo: soma(ela.cel, CIMA, 0.14, ela.frente, 0.1), fov: 36, desfoque: 3, faixaFoco: 0.9, focoEm: ela.cel },
      { p: 0.94, pos: closeEla(0.42, 0.2, 0.0), alvo: soma(ela.cel, ela.cimaTela, 0.004, ela.dirTela, -sEla * 0.02), cima: cimaCel(ela), fov: 31, desfoque: 6, faixaFoco: 0.1, focoEm: ela.cel },
      { p: 1.0, pos: closeEla(0.4, 0.19, 0.0), alvo: soma(ela.cel, ela.cimaTela, 0.004, ela.dirTela, -sEla * 0.02), cima: cimaCel(ela), fov: 31, desfoque: 6, faixaFoco: 0.1, focoEm: ela.cel },
    ];
  } else {
    const closeEle = (dist, lado, sobe) => soma(ele.cel, ele.nTela, dist, ele.dirTela, sEle * lado, ele.cimaTela, sobe);
    const closeEla = (dist, lado, sobe) => soma(ela.cel, ela.nTela, dist, ela.dirTela, sEla * lado, ela.cimaTela, sobe);
    chaves = [
      { p: 0.0, pos: closeEle(0.37, 0.09, 0.1), alvo: soma(ele.cel, ele.cimaTela, 0.02), cima: cimaCel(ele), fov: 38, desfoque: 5, faixaFoco: 0.1, focoEm: ele.cel },
      { p: 0.17, pos: closeEle(0.35, 0.08, 0.095), alvo: soma(ele.cel, ele.cimaTela, 0.02), cima: cimaCel(ele), fov: 38, desfoque: 5, faixaFoco: 0.1, focoEm: ele.cel },
      { p: 0.32, pos: soma(ele.cabeca, ele.frente, 1.5, ele.lado, 3.4, CIMA, -0.45), alvo: soma(ele.cabeca, CIMA, 0.5), fov: 50, desfoque: 0, faixaFoco: 30, segue: 0.3 },
      { p: 0.5, pos: V(-0.8, 2.3, 13.5), alvo: V(0, 5.6, 1.5), fov: 52, desfoque: 0, faixaFoco: 30, segue: 0.85 },
      { p: 0.68, pos: V(4.6, 2.0, 9.0), alvo: V(5.6, 3.6, 1.2), fov: 50, desfoque: 0, faixaFoco: 30, segue: 0.7 },
      { p: 0.83, pos: soma(ela.cabeca, ela.frente, -0.7, ela.lado, 1.6, CIMA, 0.1), alvo: soma(ela.cel, CIMA, 0.2), fov: 46, desfoque: 2.4, faixaFoco: 1.0, focoEm: ela.cel },
      { p: 0.94, pos: closeEla(0.37, 0.09, 0.08), alvo: soma(ela.cel, ela.cimaTela, 0.02), cima: cimaCel(ela), fov: 38, desfoque: 5, faixaFoco: 0.1, focoEm: ela.cel },
      { p: 1.0, pos: closeEla(0.35, 0.08, 0.075), alvo: soma(ela.cel, ela.cimaTela, 0.02), cima: cimaCel(ela), fov: 38, desfoque: 5, faixaFoco: 0.1, focoEm: ela.cel },
    ];
  }
  for (const c of chaves) { c.segue ??= 0; c.focoEm ??= c.alvo; c.cima ??= CIMA; }
  // Tangentes: na direção entre as vizinhas, mas limitadas ao trecho mais curto, para a câmera não "passar do ponto"
  // quando um close (centímetros) é vizinho de um plano aberto (metros).
  chaves.forEach((c, i) => {
    const a = chaves[i - 1], b = chaves[i + 1];
    c.tan = V();
    if (!a || !b) return;
    const curto = Math.min(c.pos.distanceTo(a.pos), c.pos.distanceTo(b.pos));
    c.tan.subVectors(b.pos, a.pos).normalize().multiplyScalar(curto * 0.9);
  });

  const pos = V(), alvo = V(), foco = V(), cima = V();
  return {
    chaves,
    avalia(p, ponta) {
      let i = 0;
      while (i < chaves.length - 2 && p > chaves[i + 1].p) i++;
      const a = chaves[i], b = chaves[i + 1];
      const t = Math.min(1, Math.max(0, (p - a.p) / (b.p - a.p)));
      const te = 0.4 * t + 0.6 * t * t * (3 - 2 * t);
      hermite(a.pos, a.tan, b.pos, b.tan, te, pos);
      alvo.lerpVectors(a.alvo, b.alvo, te);
      foco.lerpVectors(a.focoEm, b.focoEm, te);
      cima.lerpVectors(a.cima, b.cima, te).normalize();
      const segue = a.segue + (b.segue - a.segue) * te;
      if (segue > 0 && ponta) alvo.lerp(ponta, segue);
      const L = (k) => a[k] + (b[k] - a[k]) * te;
      return { pos, alvo, cima, fov: L('fov'), desfoque: L('desfoque'), faixaFoco: L('faixaFoco'), distFoco: pos.distanceTo(foco) };
    },
  };
}
