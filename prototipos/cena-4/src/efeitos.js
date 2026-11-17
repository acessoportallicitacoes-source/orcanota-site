// Pós-processamento: profundidade de campo nos closes, bloom no sinal e nas telas, vinheta, tonemapping e um grão
// leve (que também esconde as faixas do degradê do céu).
import * as THREE from 'three';
import { EffectComposer, RenderPass, EffectPass, BloomEffect, DepthOfFieldEffect, VignetteEffect, ToneMappingEffect, ToneMappingMode, NoiseEffect, BlendFunction } from 'postprocessing';

export function criaEfeitos(renderer, cena, camera, { leve, tom = 'aces', sem = [] }) {
  const composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType, multisampling: leve ? 2 : 4 });
  composer.addPass(new RenderPass(cena, camera));

  let dof = null, passeDof = null;
  if (!leve && !sem.includes('dof')) {
    dof = new DepthOfFieldEffect(camera, { focusDistance: 1, focusRange: 0.4, bokehScale: 4, resolutionScale: 0.5 });
    passeDof = new EffectPass(camera, dof);
    composer.addPass(passeDof);
  }
  const bloom = new BloomEffect({ mipmapBlur: true, luminanceThreshold: 1.0, luminanceSmoothing: 0.3, intensity: leve ? 0.95 : 1.2, radius: 0.8, levels: leve ? 6 : 8 });
  const vinheta = new VignetteEffect({ offset: 0.3, darkness: 0.6 });
  const mapa = new ToneMappingEffect({ mode: tom === 'agx' ? ToneMappingMode.AGX : tom === 'neutro' ? ToneMappingMode.NEUTRAL : ToneMappingMode.ACES_FILMIC });
  const grao = new NoiseEffect({ blendFunction: BlendFunction.OVERLAY, premultiply: false });
  grao.blendMode.opacity.value = leve ? 0.1 : 0.14;
  composer.addPass(new EffectPass(camera, ...[['bloom', bloom], ['vinheta', vinheta], ['tom', mapa], ['grao', grao]].filter(([n]) => !sem.includes(n)).map(([, e]) => e)));

  return {
    composer, bloom, dof,
    foco(dist, faixaFoco, desfoque) {
      if (!dof) return;
      const ligado = desfoque > 0.08;
      passeDof.enabled = ligado;
      if (!ligado) return;
      dof.cocMaterial.focusDistance = dist;
      dof.cocMaterial.focusRange = faixaFoco;
      dof.bokehScale = desfoque;
    },
    tamanho(l, a) { composer.setSize(l, a); },
    desenha(dt) { composer.render(dt); },
  };
}
