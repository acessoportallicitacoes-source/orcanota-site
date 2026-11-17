# Créditos dos recursos da cena 4

Todos os modelos, texturas e o HDRI desta cena são **CC0 1.0 (domínio público)**. Nada veio do Mixamo, de
bibliotecas pagas ou de fontes de licença duvidosa. As telas dos celulares são capturas reais do Orçanota
(`src/assets/telas/`).

## Personagens

| Arquivo | Recurso | Autor | Fonte | Licença |
| --- | --- | --- | --- | --- |
| `recursos/modelos/eletricista.glb` | Universal Base Characters (versão Standard), corpo "Superhero Male" com olhos e sobrancelhas | Quaternius | https://quaternius.com/packs/universalbasecharacters.html | CC0 1.0 |
| `recursos/modelos/cliente.glb` | Universal Base Characters (versão Standard), corpo "Superhero Female" com olhos e sobrancelhas | Quaternius | https://quaternius.com/packs/universalbasecharacters.html | CC0 1.0 |
| `recursos/modelos/cabelo-curto.glb` | Universal Base Characters, cabelo "Hair_Buzzed" | Quaternius | https://quaternius.com/packs/universalbasecharacters.html | CC0 1.0 |
| `recursos/modelos/cabelo-longo.glb` | Universal Base Characters, cabelo "Hair_Long" | Quaternius | https://quaternius.com/packs/universalbasecharacters.html | CC0 1.0 |

Feito à mão nesta cena, em código (sem recurso externo): as roupas (camisa azul com faixa refletiva, calças, blusa),
o capacete, o cinto de ferramentas, as botas, os chinelos, a pose de segurar o celular e a respiração.

## Objetos

| Arquivo | Recurso | Autor | Fonte | Licença |
| --- | --- | --- | --- | --- |
| `recursos/modelos/escada.glb` | Ladder Sectioned 01 | MP | https://polyhaven.com/a/ladder_sectioned_01 | CC0 1.0 |
| `recursos/modelos/caixa-ferramentas.glb` | Metal Toolbox | Mateusz Sadek | https://polyhaven.com/a/metal_toolbox | CC0 1.0 |
| `recursos/modelos/arandela.glb` | Industrial Wall Lamp | Kuutti Siitonen | https://polyhaven.com/a/industrial_wall_lamp | CC0 1.0 |
| `recursos/modelos/planta-1.glb` | Potted Plant 02 | Rico Cilliers | https://polyhaven.com/a/potted_plant_02 | CC0 1.0 |
| `recursos/modelos/planta-2.glb` | Potted Plant 04 | James Ray Cock | https://polyhaven.com/a/potted_plant_04 | CC0 1.0 |

## Texturas (cor, normal e AO/rugosidade/metal)

| Arquivos | Recurso | Autor | Fonte | Licença |
| --- | --- | --- | --- | --- |
| `recursos/texturas/asfalto-*.webp` | Asphalt 02 | Rob Tuytel | https://polyhaven.com/a/asphalt_02 | CC0 1.0 |
| `recursos/texturas/calcada-*.webp` | Hexagonal Concrete Paving | Stephan Seeliger | https://polyhaven.com/a/hexagonal_concrete_paving | CC0 1.0 |
| `recursos/texturas/reboco-*.webp` | Painted Plaster Wall | Amal Kumar | https://polyhaven.com/a/painted_plaster_wall | CC0 1.0 |
| `recursos/texturas/porta-*.webp` | Rough Pine Door | Dimitrios Savva | https://polyhaven.com/a/rough_pine_door | CC0 1.0 |
| `recursos/texturas/telha-*.webp` | Clay Roof Tiles 02 | Amal Kumar | https://polyhaven.com/a/clay_roof_tiles_02 | CC0 1.0 |

## Luz ambiente

| Arquivo | Recurso | Autor | Fonte | Licença |
| --- | --- | --- | --- | --- |
| `recursos/hdri/preller_drive_1k.hdr` | Preller Drive (HDRI noturno, 1K) | Greg Zaal | https://polyhaven.com/a/preller_drive | CC0 1.0 |

## Como os arquivos foram preparados

Os originais foram baixados em glTF/JPG/HDR de 1K e convertidos fora do site: modelos em `.glb` com texturas WebP
(os objetos também com compressão Meshopt e menos polígonos; os personagens sem compressão de malha, porque a roupa
é calculada a partir das posições originais) e texturas em WebP de 1024 px. Ferramentas usadas na conversão:
glTF-Transform e sharp.

## Código de terceiros (via npm)

- three.js 0.187.0 (MIT): https://threejs.org
- postprocessing 6.39.6 (Zlib): https://github.com/pmndrs/postprocessing
- Fontes Urbanist e Inter (SIL OFL 1.1), pelos pacotes `@fontsource-variable/*` que o site já usava.
