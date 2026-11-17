import './styles.css';
import { GA_ID, PLAY_URL } from './config.js';
import { iniciarHistoria } from './historia.js';
import { iniciarMedicao, medir } from './medicao.js';

// Botões de baixar: todos levam à Google Play e contam o clique (com o lugar da página).
for (const link of document.querySelectorAll('[data-play]')) {
  link.href = PLAY_URL;
  link.target = '_blank';
  link.rel = 'noopener';
  link.addEventListener('click', () => medir('clique_baixar', { local: link.dataset.local }));
}

// Pop-ups da política e dos termos. O link também funciona sem JavaScript (abre a página avulsa).
function abrirDialogo(nome) {
  const dialogo = document.getElementById(`dialogo-${nome}`);
  if (!dialogo || dialogo.open) return;
  dialogo.showModal();
  dialogo.scrollTop = 0;
  medir('abriu_documento', { documento: nome });
}
for (const link of document.querySelectorAll('[data-dialogo]')) {
  link.addEventListener('click', (evento) => {
    evento.preventDefault();
    document.querySelector('dialog[open]')?.close();
    abrirDialogo(link.dataset.dialogo);
  });
}
for (const dialogo of document.querySelectorAll('dialog')) {
  dialogo.addEventListener('click', (evento) => {
    if (evento.target === dialogo || evento.target.closest('[data-fechar]')) dialogo.close();
  });
}
const pedido = location.hash.slice(1);
if (pedido === 'privacidade' || pedido === 'termos') abrirDialogo(pedido);

// Perguntas abertas: quais dúvidas as pessoas têm.
for (const pergunta of document.querySelectorAll('.duvidas details')) {
  pergunta.addEventListener('toggle', () => {
    if (pergunta.open) medir('abriu_pergunta', { pergunta: pergunta.querySelector('summary').textContent });
  });
}

iniciarMedicao(GA_ID);
iniciarHistoria({ aoChegarNaCena: (cena) => medir('historia_cena', { cena }) });
