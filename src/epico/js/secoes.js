// O resto da página: botões de baixar, pop-ups da política e dos termos, medição, entrada das seções ao
// rolar, esteira dos ofícios e o 3D leve dos cartões.
import { GA_ID, PLAY_URL } from '../../config.js';
import { iniciarMedicao, medir } from '../../medicao.js';

// todos os botões de baixar levam à Google Play e contam o clique (com o lugar da página)
for (const a of document.querySelectorAll('[data-play]')) {
  a.href = PLAY_URL; a.target = '_blank'; a.rel = 'noopener';
  a.addEventListener('click', () => medir('clique_baixar', { local: a.dataset.local }));
}

// pop-ups da política e dos termos; sem JavaScript o link abre a página avulsa
function abrirDialogo(nome) {
  const d = document.getElementById(`dialogo-${nome}`);
  if (!d || d.open) return;
  d.showModal(); d.scrollTop = 0;
  medir('abriu_documento', { documento: nome });
}
for (const link of document.querySelectorAll('[data-dialogo]')) {
  link.addEventListener('click', (e) => { e.preventDefault(); document.querySelector('dialog[open]')?.close(); abrirDialogo(link.dataset.dialogo); });
}
for (const d of document.querySelectorAll('dialog')) {
  d.addEventListener('click', (e) => { if (e.target === d || e.target.closest('[data-fechar]')) d.close(); });
}
if (location.hash === '#privacidade' || location.hash === '#termos') abrirDialogo(location.hash.slice(1));

// quais dúvidas as pessoas abrem
for (const p of document.querySelectorAll('.duvidas-lista details')) {
  p.addEventListener('toggle', () => { if (p.open) medir('abriu_pergunta', { pergunta: p.querySelector('summary').textContent }); });
}
iniciarMedicao(GA_ID);

// cada bloco entra quando aparece na tela
const olheiro = 'IntersectionObserver' in window
  ? new IntersectionObserver((itens) => { for (const i of itens) if (i.isIntersecting) { i.target.classList.add('visto'); olheiro.unobserve(i.target); } }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 })
  : null;
for (const el of document.querySelectorAll('.revela')) olheiro ? olheiro.observe(el) : el.classList.add('visto');
// garantia: se o aviso de "apareceu" não chegar, uma conferência simples mostra o que já está na tela
const vigia = setInterval(() => {
  const faltam = document.querySelectorAll('.revela:not(.visto)');
  if (!faltam.length) { clearInterval(vigia); return; }
  for (const el of faltam) { const r = el.getBoundingClientRect(); if (r.top < innerHeight * 0.94 && r.bottom > 0) el.classList.add('visto'); }
}, 350);

// a esteira dos ofícios dá a volta sem emenda: a lista é repetida uma vez, escondida dos leitores de tela
for (const e of document.querySelectorAll('[data-esteira]')) {
  for (const s of [...e.children]) { const c = s.cloneNode(true); c.setAttribute('aria-hidden', 'true'); e.append(c); }
}

// conferência: ?so-secoes mostra só o que vem depois da história, já com tudo visível
if (new URLSearchParams(location.search).has('so-secoes')) {
  document.getElementById('historia').style.display = 'none';
  for (const el of document.querySelectorAll('.revela')) { el.style.transition = 'none'; el.classList.add('visto'); }
  const ir = new URLSearchParams(location.search).get('rola');
  // a captura sem janela não acompanha a rolagem: para fotografar uma seção, as anteriores somem
  for (let e = ir && document.getElementById(ir)?.previousElementSibling; e; e = e.previousElementSibling) e.style.display = 'none';
}

// 3D leve nos cartões: acompanham o mouse e voltam ao repouso quando ele sai (só com mouse, não no toque)
for (const el of document.querySelectorAll('.tres-d')) {
  el.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
    el.classList.add('mexendo');
    el.style.setProperty('--ry', (x * 9).toFixed(2) + 'deg'); el.style.setProperty('--rx', (-y * 7).toFixed(2) + 'deg');
  });
  el.addEventListener('pointerleave', () => { el.classList.remove('mexendo'); el.style.removeProperty('--ry'); el.style.removeProperty('--rx'); });
}
