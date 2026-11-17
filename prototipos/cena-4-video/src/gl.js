// Apoio mínimo para WebGL2: programas, texturas e a homografia que encaixa a tela do celular em perspectiva.

export function criaPrograma(gl, vs, fs) {
  const compila = (tipo, fonte) => {
    const s = gl.createShader(tipo);
    gl.shaderSource(s, fonte); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(`shader: ${gl.getShaderInfoLog(s)}`);
    return s;
  };
  const p = gl.createProgram();
  gl.attachShader(p, compila(gl.VERTEX_SHADER, vs)); gl.attachShader(p, compila(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(`programa: ${gl.getProgramInfoLog(p)}`);
  const u = {};
  for (let i = 0, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); i < n; i++) {
    const nome = gl.getActiveUniform(p, i).name.replace(/\[0\]$/, '');
    u[nome] = gl.getUniformLocation(p, nome);
  }
  return { p, u };
}

/** Textura a partir de imagem ou canvas. Com mipmaps e filtro trilinear, a não ser que `simples`. */
export function criaTextura(gl, fonte, { simples = false, anisotropia = 0 } = {}) {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, fonte);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  if (simples) gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  else {
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    const ext = anisotropia && gl.getExtension('EXT_texture_filter_anisotropic');
    if (ext) gl.texParameterf(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(anisotropia, gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
  }
  return { t, l: fonte.width, a: fonte.height };
}

export function atualizaTextura(gl, tex, fonte) {
  gl.bindTexture(gl.TEXTURE_2D, tex.t);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, fonte);
  gl.generateMipmap(gl.TEXTURE_2D);
}

export async function carregaImagem(url) {
  const resposta = await fetch(url);
  if (!resposta.ok) throw new Error(`imagem ${url}: ${resposta.status}`);
  return createImageBitmap(await resposta.blob(), { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
}

/**
 * Homografia que leva os pixels da placa às coordenadas (0 a 1) da tela do celular.
 * `cantos`: cima-esq, cima-dir, baixo-dir, baixo-esq, em pixels da placa. Devolve mat3 em ordem de colunas (GLSL).
 */
export function homografia([[x0, y0], [x1, y1], [x2, y2], [x3, y3]]) {
  const dx1 = x1 - x2, dx2 = x3 - x2, sx = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2, dy2 = y3 - y2, sy = y0 - y1 + y2 - y3;
  const det = dx1 * dy2 - dx2 * dy1;
  const g = (sx * dy2 - dx2 * sy) / det, h = (dx1 * sy - sx * dy1) / det;
  // quadrado unitário → quadrilátero
  const a = x1 - x0 + g * x1, b = x3 - x0 + h * x3, c = x0;
  const d = y1 - y0 + g * y1, e = y3 - y0 + h * y3, f = y0;
  // inversa (adjunta): quadrilátero → quadrado unitário
  const A = e - f * h, B = c * h - b, C = b * f - c * e;
  const D = f * g - d, E = a - c * g, F = c * d - a * f;
  const G = d * h - e * g, H = b * g - a * h, I = a * e - b * d;
  return new Float32Array([A, D, G, B, E, H, C, F, I]);
}

/** Proporção (largura / altura) da tela, pela média dos lados do quadrilátero. */
export function proporcaoDoQuadrilatero([p0, p1, p2, p3]) {
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  return (dist(p0, p1) + dist(p3, p2)) / (dist(p0, p3) + dist(p1, p2));
}
