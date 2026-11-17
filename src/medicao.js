// Google Analytics 4, só depois do "Aceitar" no aviso de cookies (LGPD). Sem aceite, nada é carregado nem contado.

const CHAVE = 'orcanota-cookies';
let gaId = '';
let ligado = false;

function lerEscolha() {
  try { return localStorage.getItem(CHAVE); } catch { return null; }
}
function gravarEscolha(valor) {
  try { localStorage.setItem(CHAVE, valor); } catch { /* sem armazenamento: pergunta de novo na próxima visita */ }
}

function ligar() {
  if (ligado || !gaId) return;
  ligado = true;
  window[`ga-disable-${gaId}`] = false;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', gaId);
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`;
  document.head.append(script);
}

function desligar() {
  if (!gaId) return;
  window[`ga-disable-${gaId}`] = true;
  ligado = false;
  // Apaga os cookies do Analytics deste domínio.
  for (const cookie of document.cookie.split(';')) {
    const nome = cookie.split('=')[0].trim();
    if (nome.startsWith('_ga')) {
      for (const dominio of ['', `; domain=${location.hostname}`, `; domain=.${location.hostname.replace(/^www\./, '')}`]) {
        document.cookie = `${nome}=; Max-Age=0; path=/${dominio}`;
      }
    }
  }
}

/** Conta um evento (só com o aceite). */
export function medir(evento, parametros = {}) {
  if (ligado && window.gtag) window.gtag('event', evento, parametros);
  else if (import.meta.env.DEV) console.debug('[medição]', evento, parametros);
}

export function iniciarMedicao(id) {
  gaId = id;
  const aviso = document.getElementById('cookies');
  const botaoRodape = document.querySelector('[data-cookies]');
  if (!gaId) {
    botaoRodape?.remove();
    return;
  }
  const escolha = lerEscolha();
  if (escolha === 'aceitar') ligar();
  else if (escolha !== 'recusar') aviso.hidden = false;

  for (const botao of aviso.querySelectorAll('[data-consentimento]')) {
    botao.addEventListener('click', () => {
      const valor = botao.dataset.consentimento;
      gravarEscolha(valor);
      aviso.hidden = true;
      if (valor === 'aceitar') ligar();
      else desligar();
    });
  }
  botaoRodape?.addEventListener('click', () => { aviso.hidden = false; });
}
