# Site do Orçanota

Página de apresentação do app em `orcanota.com.br`, com a política de privacidade e os termos de uso.

## Rodar e publicar

```
npm install
npm run dev      # http://localhost:5173
npm run build    # gera dist/
```

A publicação é pelo GitHub Pages: cada push na `main` roda `.github/workflows/deploy.yml`, e o domínio vem de
`public/CNAME`.

## O que trocar sem mexer no resto

- **Link da Google Play e ID do Google Analytics:** em `src/config.js`. Sem ID, o site não mede nada nem mostra o
  aviso de cookies.
- **Política e termos:** em `src/content/privacidade.html` e `src/content/termos.html`. O mesmo arquivo alimenta o
  pop-up da página principal e as páginas `/privacidade/` e `/termos/` (o link que vai na Google Play).
- **Telas do app:** em `src/assets/telas/`, em WebP de 1080 × 2400. Os originais em PNG de 1440 × 3200 ficam fora
  do site, em `OrçaNotas/telas-hd/`, gerados pelo roteiro de capturas do app (`test/visual/capturas_test.dart`) em
  pixel ratio 4 (`ORCANOTA_PIXEL_RATIO=4`). O nome de cada arquivo é o mesmo do roteiro.

## Estrutura

- `index.html`: a página. Começa pela história em 6 telas de rolagem (`#historia`, com o palco 3D preso à tela) e
  segue com o documento grátis x Pro, o app, os ofícios, os planos, as dúvidas, a chamada final e o rodapé.
- `src/epico/js/`: o 3D e a história. `main.js` (primeira tela, celular, toque nas telas do app), `historia.js`
  (o roteiro: tudo é função da rolagem; os momentos estão em `S`), `folha.js` (papel, dobra em avião, carimbo),
  `cenario.js` (fotos projetadas no tampo e o relevo das ferramentas), `luzes.js`, `conversa.js`, `telas.js` e
  `secoes.js` (botões de baixar, pop-ups, medição, entrada das seções e o 3D leve dos cartões).
- `src/epico/historia.css` e `src/epico/pagina.css`: o visual da história e o das seções.
- `src/epico/imagens/` e `src/epico/telas/`: cenários, relevo, folhas e as capturas do app usadas no celular 3D.
- `src/medicao.js`: Google Analytics 4 com aceite de cookies. Eventos: `clique_baixar` (com o `local` do botão),
  `abriu_pergunta` e `abriu_documento`.
- `antigo/index.html`: a página anterior (história em 6 cenas desenhadas), guardada em 2026-11-17. Usa
  `src/main.js`, `src/historia.js` e `src/styles.css`, que também servem às páginas `/privacidade/` e `/termos/`.
  Não entra na versão publicada.
- `prototipos/epico/`: material de produção. `documento.html` é a matriz das folhas (orçamento e recibo, grátis e
  Pro), fotografada sem janela para virar as imagens de `src/epico/imagens/`. Os roteiros que geram o relevo e as
  capturas de conferência ficam em `OrçaNotas/ia/epico/relevo/`.

## Conferir sem rolar

- `/?semintro&semvez&s=1.56` fixa a história num ponto (0 a 6); `/?so-secoes&rola=planos` mostra só as seções.
- `npm run build` e `npm run preview` (porta 4173) mostram a versão que vai para o ar.
