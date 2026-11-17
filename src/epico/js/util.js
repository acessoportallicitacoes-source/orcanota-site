// Pequenas ferramentas de conta e de movimento usadas pela cena 1.

export const limita = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const mistura = (a, b, t) => a + (b - a) * t;
export const suave = (a, b, v) => { const t = limita((v - a) / (b - a)); return t * t * (3 - 2 * t); };
export const rad = (g) => (g * Math.PI) / 180;

// Curvas de entrada: desacelera forte no fim; e a que passa um pouco do ponto e volta
export const saiForte = (t) => 1 - Math.pow(1 - limita(t), 4);
export const saiExpo = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * limita(t)));
export const passaEVolta = (t, s = 1.4) => { const u = limita(t) - 1; return 1 + (s + 1) * u * u * u + s * u * u; };
export const entraESai = (t) => { const u = limita(t); return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; };

// Trecho de uma linha do tempo: 0 antes de `inicio`, 1 depois de `inicio + duracao`
export const trecho = (t, inicio, duracao) => limita((t - inicio) / duracao);

// Mola: o valor persegue o alvo com inércia e passa um pouco do ponto, como um objeto com peso.
export class Mola {
  constructor(valor = 0, rigidez = 40, atrito = 8) { this.v = valor; this.alvo = valor; this.vel = 0; this.k = rigidez; this.c = atrito; }
  passo(dt) {
    // passos curtos para a conta não explodir quando o quadro demora
    let resto = Math.min(dt, 0.1);
    while (resto > 0) {
      const h = Math.min(resto, 1 / 120);
      this.vel += (this.k * (this.alvo - this.v) - this.c * this.vel) * h;
      this.v += this.vel * h;
      resto -= h;
    }
    return this.v;
  }
  fixa(v) { this.v = v; this.alvo = v; this.vel = 0; }
}
