# circuits.csv — Relatório de validação dos SVGs e resumo de preenchimento

APEX GP Manager 2.0 · 14/10/2026

## 1. Resumo

| Item                                                                               | Resultado                                                                       |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Circuitos cadastrados (1 linha por configuração)                                   | **43**                                                                          |
| SVGs encontrados e vinculados (1:1, sem repetição)                                 | **43 / 43**                                                                     |
| SVGs com percurso contínuo utilizável (`track_path_id = track`)                    | **43 / 43**                                                                     |
| Com `race_direction` proposto                                                      | **36** (34 `forward`, 2 `reverse`)                                              |
| Com linha de chegada (`start_finish_progress`)                                     | **1** (CIR-0021, piloto, aguardando aprovação)                                  |
| Com caminho de boxes                                                               | **1** (CIR-0021, piloto, aguardando aprovação)                                  |
| **Prontos para animação completa**                                                 | **1 em aprovação** (CIR-0021). Os outros 42 dependem de largada/chegada e boxes |
| Com extensão, altitude, exigências, perda de pit e volta de referência preenchidas | **24**                                                                          |
| Com exigências qualitativas propostas                                              | **32**                                                                          |
| Sem nenhuma exigência técnica (sem F1 entre 2014 e 2026)                           | **11**                                                                          |

Arquivos de entrada verificados: `CSV/circuits.csv` (modelo só com cabeçalho, 9 campos preservados), `CSV/assets_manifest.csv` (só cabeçalho, sem `asset_id` para vincular) e os 43 arquivos em `circuitos/svg/`. O `calendario_f1_2026.pdf` **não existe** no projeto. Os PDFs de documentação (Documento-Base ADM, Páginas e Subpáginas, Diagnóstico) não trazem dados técnicos de circuitos. O item 1.3.7.2 "Traçado, largada e sentido" do ADM é o lugar natural para fechar as pendências gráficas.

## 2. Método de validação

Cada SVG real da pasta do projeto foi copiado e aberto no Chromium (Playwright). Para cada um foram verificados:

- estrutura XML, elementos e `id`s;
- comandos do `d` (só `M`, `L` e `Z`), número de subcaminhos e fechamento;
- `getTotalLength()` e 4.000 amostras de `getPointAtLength()`. O maior passo entre amostras foi comparado ao passo esperado: 1,000 indica ausência de saltos ou descontinuidades;
- auto-interseções do polígono e orientação (horário ou anti-horário na tela);
- comprimento da geometria geográfica de origem comparado à extensão cadastrada.

**O caminho `track` não é um contorno do asfalto.** É a linha central de origem (traçado do GeoJSON ou via `highway=raceway` do OSM), desenhada com `stroke` de 16 e `fill="none"`. Por isso serve diretamente para animação por distância. A precisão é a da fonte (alguns metros).

Constatações gerais:

- Os 43 arquivos têm exatamente 1 `<path id="track">`, 1 subcaminho, fechado com `Z`, viewBox `0 0 1600 900`.
- Todos contêm um bloco `<metadata>` com manifesto de procedência C2PA, sem efeito no desenho nem na animação.
- Única auto-interseção: **Suzuka** (viaduto do traçado em oito, esperado).
- Os SVGs estão girados para ocupar o quadro. Norte não é "para cima", o que não afeta o progresso ao longo do caminho.

## 3. Validação por circuito

Legenda: **Contínuo** = percurso contínuo utilizável · **Passo** = passo máximo relativo (1,000 = contínuo) · **Desvio** = geometria × extensão cadastrada · **Sentido** = `race_direction`. Em todos: linha de chegada **não marcada** e boxes **ausentes**.

| ID       | SVG                                   | Contínuo | Comprimento (px) | Passo | Interseções | Desvio | Sentido           | Pendências específicas                                                                                                      |
| -------- | ------------------------------------- | -------- | ---------------- | ----- | ----------- | ------ | ----------------- | --------------------------------------------------------------------------------------------------------------------------- |
| CIR-0001 | `circuitos/svg/01-Australia.svg`      | sim      | 3677.1           | 1.000 | 0           | -0.4%  | forward           | —                                                                                                                           |
| CIR-0002 | `circuitos/svg/02-China.svg`          | sim      | 4946.5           | 1.000 | 0           | -0.3%  | forward           | —                                                                                                                           |
| CIR-0003 | `circuitos/svg/03-Japao.svg`          | sim      | 3985.6           | 1.000 | 1           | -0.1%  | —                 | race_direction: traçado em oito, orientação não dedutível pela área                                                         |
| CIR-0004 | `circuitos/svg/04-Bahrein.svg`        | sim      | 5470.9           | 1.000 | 0           | -0.2%  | forward           | —                                                                                                                           |
| CIR-0005 | `circuitos/svg/05-Arabia_Saudita.svg` | sim      | 3360.7           | 1.000 | 0           | -0.1%  | forward           | —                                                                                                                           |
| CIR-0006 | `circuitos/svg/06-Miami.svg`          | sim      | 5176.6           | 1.000 | 0           | +0.0%  | forward           | —                                                                                                                           |
| CIR-0007 | `circuitos/svg/07-Canada.svg`         | sim      | 3370.4           | 1.000 | 0           | -0.4%  | forward           | —                                                                                                                           |
| CIR-0008 | `circuitos/svg/08-Monaco.svg`         | sim      | 4229.8           | 1.000 | 0           | -0.6%  | forward           | —                                                                                                                           |
| CIR-0009 | `circuitos/svg/09-Barcelona.svg`      | sim      | 4767.2           | 1.000 | 0           | -0.1%  | forward           | —                                                                                                                           |
| CIR-0010 | `circuitos/svg/10-Madrid.svg`         | sim      | 3910.2           | 1.000 | 0           | -1.1%  | —                 | circuito novo: características dependem de dados de corrida; race_direction: sentido de corrida não confirmado              |
| CIR-0011 | `circuitos/svg/11-Austria.svg`        | sim      | 4406.9           | 1.000 | 0           | -0.5%  | forward           | —                                                                                                                           |
| CIR-0012 | `circuitos/svg/12-Silverstone.svg`    | sim      | 4496.0           | 1.000 | 0           | -0.5%  | forward           | —                                                                                                                           |
| CIR-0013 | `circuitos/svg/13-Belgica.svg`        | sim      | 4389.4           | 1.000 | 0           | -0.7%  | forward           | —                                                                                                                           |
| CIR-0014 | `circuitos/svg/14-Hungria.svg`        | sim      | 3866.3           | 1.000 | 0           | -0.4%  | forward           | —                                                                                                                           |
| CIR-0015 | `circuitos/svg/15-Holanda.svg`        | sim      | 4234.6           | 1.000 | 0           | -0.3%  | forward           | —                                                                                                                           |
| CIR-0016 | `circuitos/svg/16-Monza.svg`          | sim      | 3521.6           | 1.000 | 0           | -0.5%  | forward           | —                                                                                                                           |
| CIR-0017 | `circuitos/svg/17-Azerbaijao.svg`     | sim      | 3620.1           | 1.000 | 0           | -1.2%  | forward           | —                                                                                                                           |
| CIR-0018 | `circuitos/svg/18-Singapura.svg`      | sim      | 4582.1           | 1.000 | 0           | +0.0%  | reverse           | —                                                                                                                           |
| CIR-0019 | `circuitos/svg/19-USA.svg`            | sim      | 4367.4           | 1.000 | 0           | -0.0%  | forward           | —                                                                                                                           |
| CIR-0020 | `circuitos/svg/20-Mexico.svg`         | sim      | 3831.0           | 1.000 | 0           | -0.2%  | forward           | —                                                                                                                           |
| CIR-0021 | `circuitos/svg/21-Brasil.svg` (v2)    | sim      | 5367.3           | 1.000 | 0           | -0.6%  | forward (DOC-osm) | Piloto SVG-INTERLAGOS-01: chegada 0.98566, path#pit 0.89824→0.22959, aguardando aprovação                                   |
| CIR-0022 | `circuitos/svg/22-Las_Vegas.svg`      | sim      | 4191.6           | 1.000 | 0           | +0.0%  | forward           | —                                                                                                                           |
| CIR-0023 | `circuitos/svg/23-Qatar.svg`          | sim      | 4556.1           | 1.000 | 0           | +0.5%  | forward           | —                                                                                                                           |
| CIR-0024 | `circuitos/svg/24-Abu_Dhabi.svg`      | sim      | 4457.9           | 1.000 | 0           | -0.1%  | forward           | —                                                                                                                           |
| CIR-0025 | `circuitos/svg/25-Imola.svg`          | sim      | 3604.3           | 1.000 | 0           | -0.3%  | forward           | —                                                                                                                           |
| CIR-0026 | `circuitos/svg/26-Portimao.svg`       | sim      | 5426.8           | 1.000 | 0           | -0.4%  | forward           | —                                                                                                                           |
| CIR-0027 | `circuitos/svg/27-Istambul.svg`       | sim      | 4213.1           | 1.000 | 0           | -0.7%  | forward           | —                                                                                                                           |
| CIR-0028 | `circuitos/svg/28-Sepang.svg`         | sim      | 4940.5           | 1.000 | 0           | +0.0%  | forward           | —                                                                                                                           |
| CIR-0029 | `circuitos/svg/29-Nurburgring.svg`    | sim      | 4129.5           | 1.000 | 0           | -0.5%  | forward           | —                                                                                                                           |
| CIR-0030 | `circuitos/svg/30-Hockenheim.svg`     | sim      | 4236.0           | 1.000 | 0           | -0.6%  | forward           | —                                                                                                                           |
| CIR-0031 | `circuitos/svg/31-Paul_Ricard.svg`    | sim      | 3644.7           | 1.000 | 0           | -0.5%  | reverse           | —                                                                                                                           |
| CIR-0032 | `circuitos/svg/32-Magny_Cours.svg`    | sim      | 5499.3           | 1.000 | 0           | +0.6%  | forward           | —                                                                                                                           |
| CIR-0033 | `circuitos/svg/33-Adelaide.svg`       | sim      | 3864.6           | 1.000 | 0           | +1.3%  | —                 | decidir se o jogo usa o traçado Adelaide 500 ou exige redesenho do GP F1; race_direction: sentido de corrida não confirmado |
| CIR-0034 | `circuitos/svg/34-Estoril.svg`        | sim      | 5104.2           | 1.000 | 0           | -4.5%  | forward           | geometria -4.5% vs extensão: confirmar variante do traçado                                                                  |
| CIR-0035 | `circuitos/svg/35-Kyalami.svg`        | sim      | 4314.3           | 1.000 | 0           | -0.4%  | —                 | traçado do SVG não é o da F1 1992–93; race_direction: sentido de corrida não confirmado                                     |
| CIR-0036 | `circuitos/svg/36-Jerez.svg`          | sim      | 4484.7           | 1.000 | 0           | -0.3%  | forward           | —                                                                                                                           |
| CIR-0037 | `circuitos/svg/37-Mugello.svg`        | sim      | 5162.4           | 1.000 | 0           | -0.4%  | forward           | —                                                                                                                           |
| CIR-0038 | `circuitos/svg/38-Indianapolis.svg`   | sim      | 3802.8           | 1.000 | 0           | -2.9%  | forward           | geometria -2.9% vs extensão: confirmar variante do traçado; confirmar variante (F1 2000–2007 x misto posterior)             |
| CIR-0039 | `circuitos/svg/39-Fuji.svg`           | sim      | 3967.5           | 1.000 | 0           | -0.5%  | forward           | —                                                                                                                           |
| CIR-0040 | `circuitos/svg/40-Jacarepagua.svg`    | sim      | 5727.9           | 1.000 | 0           | -1.5%  | —                 | race_direction: sentido de corrida não confirmado                                                                           |
| CIR-0041 | `circuitos/svg/41-Brasilia.svg`       | sim      | 5738.8           | 1.000 | 0           | -2.4%  | —                 | geometria -2.4% vs extensão: confirmar variante do traçado; race_direction: sentido de corrida não confirmado               |
| CIR-0042 | `circuitos/svg/42-Goiania.svg`        | sim      | 4627.7           | 1.000 | 0           | -0.4%  | —                 | race_direction: sentido de corrida não confirmado                                                                           |
| CIR-0043 | `circuitos/svg/43-Sochi.svg`          | sim      | 4080.4           | 1.000 | 0           | -0.4%  | forward           | —                                                                                                                           |

## 4. Pendências para animar os carros

Por ordem de impacto:

1. **Linha de largada/chegada (43 circuitos).** Nenhum SVG marca a linha. Proposta: o ADM clica no ponto da linha sobre o mini-mapa (tela 1.3.7.2), e o sistema grava `start_finish_progress` com `getTotalLength` e a busca do ponto mais próximo. Alternativa: eu localizo a linha pelas coordenadas geográficas de cada circuito, com validação visual sua.
2. **Boxes (43 circuitos).** Nenhum SVG tem `pit_path_id`. Mudança necessária: acrescentar a cada SVG um segundo `<path id="pit">` aberto, da entrada à saída, e registrar `pit_entry_progress` e `pit_exit_progress`. A geometria pode vir do OSM (`highway=raceway` com nome "Pit Lane"), que já tem esse dado para vários autódromos. **Não aplicado nesta etapa.**
3. **Sentido de corrida (7 circuitos sem valor; 36 a validar).** Suzuka (oito), Madrid, Adelaide, Kyalami, Jacarepaguá, Brasília e Goiânia. Para os demais, o sentido vem de referência (REF) cruzada com a orientação medida no SVG. Só Fuji tem confirmação documental (OSM, mão única). Singapura e Paul Ricard estão com o path no sentido contrário ao da corrida (`reverse`).
4. **Variantes de traçado a confirmar.** Estoril (geometria 4,6% menor que a extensão), Indianapolis (−2,9%, possível traçado misto posterior à F1), Adelaide (o SVG é o Adelaide 500, não o GP de F1) e Kyalami (o SVG é o traçado atual, não o de 1992–93).

Mudanças propostas nos SVGs para uma próxima etapa (nenhuma aplicada):

- incluir `<path id="pit">`;
- opcional: marcar a linha de chegada com `<circle id="start_finish">` ou um atributo `data-start-progress` no `track`;
- opcional: remover o bloco `<metadata>` C2PA, se o pipeline de mídia preferir arquivos mínimos.

## 5. Resumo de preenchimento

**Dados documentados (DOC/MED)**

- Geometria de 43/43 circuitos: 38 do bacinger/f1-circuits e 5 do OpenStreetMap.
- `length_km` e `altitude_m` de 38 circuitos (bacinger).
- Todas as medições de SVG.

**Aproximados ou estimados (REF/EST)**

- `turn_count` (38), `tipo`, `configuracao_tracado`, `sentido_corrida`.
- `length_km` dos 5 circuitos OSM.
- `tempo_volta_ref_s` (32): recordes de volta em corrida, arredondados.
- `perda_pit_stop_s` (24).

**Propostas para balanceamento (PROP)**

- 8 exigências qualitativas para 32 circuitos com F1 entre 2014 e 2026.

**Não determinados (vazios)**

- `start_finish_progress`, `pit_*` (43).
- `layout_asset_id`, `svg_asset_id` (43; manifesto vazio).
- `race_direction` (7), `turn_count` (5), `altitude_m` (5), `perda_pit_stop_s` (19), `tempo_volta_ref_s` (11).
- Exigências técnicas (11): Madrid, Magny-Cours, Adelaide, Estoril, Kyalami, Jerez, Indianapolis, Fuji, Jacarepaguá, Brasília e Goiânia.

**Para revisão prioritária**

1. Confirmar a escala de 7 níveis e as propostas qualitativas antes de calibrar o motor.
2. Validar `tempo_volta_ref_s` e `perda_pit_stop_s` contra uma fonte oficial.
3. Decidir Adelaide (aceitar o Adelaide 500 ou redesenhar o GP de F1) e confirmar a variante de Estoril e Indianapolis.
4. Cadastrar os SVGs em `assets_manifest.csv` e preencher `svg_asset_id`/`layout_asset_id`.
5. Definir a convenção de `country_code` (alfa-2 adotado) para os demais CSVs.

## 6. Fontes

- bacinger/f1-circuits, GeoJSON de circuitos (licença MIT): https://github.com/bacinger/f1-circuits
- © colaboradores do OpenStreetMap (ODbL): https://www.openstreetmap.org/copyright. Fonte de Adelaide (relation 3121459), Jerez, Fuji (way 148622740), Brasília (way 32900091) e Goiânia (ways 288004307 e 288004311).

## 7. Atualização 14/10/2026 — piloto SVG-INTERLAGOS-01

Somente o CIR-0021 foi alterado.

- **SVG:** Interlagos recebeu `path#pit` e `g#start_finish` (versão 2, SHA-256 `d5dbfea65b5f7e98bd015ac44bbe05c61b7206c7d09483a1064c6897f9121662`). O `path#track` está idêntico ao da v1, preservada em `circuitos/svg/_versoes/21-Brasil_v1.svg`.
- **Fonte:** relação OSM `6781071` (type=circuit), com papéis `pit_lane`, `start` e `finish`.
- **Testes executados:** 13 testes automatizados em Chromium, todos aprovados. Cobrem a continuidade da volta e do pit, as junções (< 0,07 px), o sentido, o marcador de chegada, pausa, retomada, velocidade e cruzamento da linha, inclusive pelos boxes.
- **Detalhes:** `docs/circuitos/piloto_interlagos/relatorio_piloto_interlagos.md`.

## 8. Atualização 14/10/2026 — SVG-CIRCUITS-02

- **SVGs:** mais 26 receberam a versão 2. Em todos, o `path#track` é byte a byte idêntico ao da v1, e a v1 foi preservada em `circuitos/svg/_versoes/`.
- **Situação atual:**
  - sentido confirmado em 31 circuitos (27 com SVG v2 ou Interlagos; 4 sem chegada nem boxes, só registrado no CSV: Arábia Saudita, Bélgica, Hungria, Mugello);
  - linha de chegada em 18;
  - boxes em 24;
  - N1 (animação na pista) em 18;
  - N2 (animação com boxes) em 15.
- **Hashes:** os SHA-256 dos arquivos efetivamente gravados estão em `circuits_validacao_svg.csv`.
- **Detalhes:** relatório completo em `docs/circuitos/relatorio_svg_circuits_02.md` e matriz por circuito em `diagnostico_circuits_02.csv`.

## 9. Atualização 14/10/2026 — SVG-CIRCUITS-03A

- **SVGs:** 13 foram atualizados (8 de v1 para v2, 5 de v2 para v3). O `path#track` está byte a byte idêntico à v1 em todos. As versões anteriores estão em `circuitos/svg/_versoes/`.
- **Situação atual:**
  - sentido confirmado em 42 circuitos (37 por OSM ou documento oficial, 5 só por fonte secundária);
  - linha de chegada em 22, largada em 22 (13 distintas);
  - boxes em 35;
  - N1 em 22;
  - N2 em 22.
- **Extensões oficiais (F1):** Madrid 5,414 km, Singapura 4,927 km, Lusail 5,419 km, Barcelona 4,657 km, Jeddah 6,174 km.
- **Detalhes:** `docs/circuitos/relatorio_svg_circuits_03a.md` e `matriz_pendencias_03a.csv`.

## 10. Atualização 15/10/2026 — SVG-CIRCUITS-03B

- **SVGs.** Seis foram atualizados, só com acréscimo de `g#start_finish`:
  - Bahrein, Miami, Spa e Abu Dhabi passaram de v2 para v3;
  - Canadá e Indianápolis passaram de v1 para v2.

  O `path#track` e o `path#pit` estão idênticos aos da 03A. As versões anteriores estão em `circuitos/svg/_versoes/`. A proposta do misto F1 2000–2007 de Indianápolis está em `circuitos/svg/_propostas/`; ela não é canônica, porque a geometria canônica já coincide com o traçado (desvio máximo de 22 m).

- **Situação atual:**
  - sentido confirmado em 43 circuitos (39 por OSM ou documento oficial, 4 só por fonte secundária);
  - linha de chegada em 28 circuitos e largada em 27 (17 distintas);
  - boxes em 35;
  - N1 em 28 (antes 22);
  - N2 em 26 (antes 22).
- **Extensões e variantes:**
  - Áustria: 4,326 km (F1 2026);
  - COTA: 5,513 km (F1 2026);
  - Estoril: 4,182 km, 13 curvas (decisão do proprietário);
  - Brasília: 5,384 km, 16 curvas (decisão do proprietário);
  - Indianápolis: misto F1 2000–2007, 13 curvas;
  - Kyalami: traçado moderno;
  - Adelaide: variante F1 registrada, com `length_km` mantido na geometria canônica até a troca.
- **Nova coluna `length_geo_km`.** É a extensão medida do `track` e fica separada de `length_km`.
- **Testes:**
  - suíte Chromium: 424/424 (base 03A: 371);
  - integridade: 43/43 SVG;
  - testes adicionais da 03B: 369/369.
- **Detalhes:** `docs/circuitos/relatorio_svg_circuits_03b.md` e `matriz_pendencias_03b.csv`.

## 11. Atualização 15/10/2026 — SVG-CIRCUITS-03C

- **Adelaide (CIR-0033):** o `path#track` foi trocado do traçado curto (v1, preservado em `_versoes/`) para o traçado F1 1985–1995 (v2).
  - Ajuste aos dois mapas Commons: RMS de 16 e 18 m.
  - Extensão medida: 3,873 km, contra 3,780 km oficiais (+2,5%).
  - `length_km` passou a 3,780 e `turn_count` a 16.
  - Continua sem chegada e sem boxes.
- **Indianápolis (CIR-0038):** largada registrada como coincidente com a chegada na Yard of Bricks, com base em fontes secundárias. As duas linhas são provisórias. Os boxes continuam sem preenchimento, porque a entrada F1 a partir da curva 13 não está mapeada. SVG v3.
- **Brasília (CIR-0041):** variante conferida. A CBA informa que o traçado original foi mantido; a Secretaria de Turismo do DF dá 5.384 m e 16 curvas; a cronometragem dá 5.380 m. A geometria corresponde ao Full Circuit, não ao Alternative. A chegada segue pendente.
- **Linhas candidatas** (Magny-Cours, Jerez, Mugello, Estoril, China, Japão; e, no complemento, Sochi, Fuji, Goiânia, Jacarepaguá e Brasília): comparativo em `svg_circuits_03c/prancha_linhas_candidatas.html`. Nenhuma foi registrada.
- **Situação:** N1 em 28 e N2 em 26, sem mudança. Nenhuma regressão.
- **Testes:**
  - suíte Chromium: 425/425 (03B: 424);
  - integridade: 43/43;
  - testes 03C: 425/425.
- **Detalhes:** `docs/circuitos/relatorio_svg_circuits_03c.md`, `matriz_pendencias_03c.csv` e `prancha_aprovacao_n1.html`.

## 12. Atualização 15/10/2026 — SVG-CIRCUITS-03D

- **Goiânia (CIR-0042):** linha de chegada e largada registradas em 0.35400.
  - Fonte: circuit guide da Michelin do GP de MotoGP 2026, fornecido pelo proprietário.
  - Precisão: ±25 m, porque o mapa é esquemático. A linha é provisória.
  - Sentido horário e 14 curvas. SVG v3.
- **Situação:** N1 em 29 e N2 em 27.
- **Testes:**
  - suíte Chromium: 436/436;
  - integridade: 43/43;
  - testes 03D: 427/427.
- **Detalhes:** `docs/circuitos/relatorio_svg_circuits_03d.md`.

## 13. Atualização 15/10/2026 — SVG-CIRCUITS-03E

- **Brasília (CIR-0041):** `path#track` trocado para o traçado 2025 com a chicane nova antes da curva final (v2). A v1, o laço original sem a chicane, ficou preservada em `_versoes/`.
  - Base da troca: aprovação do proprietário, a descrição "traçado original preservado + nova chicane e curva adicional antes da curva final" e a imagem de satélite, que mostra a chicane pavimentada.
  - Geometria: via OSM 1450655793 no lugar do trecho diagonal 0,512–0,547 da v1.
  - Extensão medida: 5,410 km, contra 5,384 km oficiais (+0,5%; a v1 dava −0,8%).
  - `svg_track_length_px` 5799,9 e `svg_m_por_px` 0,9328.
  - Corrige a conclusão da 03C, que tomava o laço sem os ramais novos como traçado 2025.
  - Chegada e boxes continuam pendentes.
- **Situação:** N1 em 29 e N2 em 27, sem mudança. Nenhuma regressão.
- **Testes:**
  - suíte Chromium: 436/436;
  - integridade: 43/43;
  - testes 03E: 435/435.
- **Detalhes:** `docs/circuitos/relatorio_svg_circuits_03e.md`.

## 14. Atualização 15/10/2026 — SVG-CIRCUITS-03F

- **Adelaide (CIR-0033):** linha de chegada e largada registradas em 0.73730, como provisórias.
  - Posição: na reta dos boxes do Victoria Park, 282 m após o hairpin e 228 m antes da Senna Chicane.
  - Fonte principal: bandeira do mapa Commons do traçado F1, transferida pelo ajuste da 03C (RMS 18 m). Confere com a informação do proprietário.
  - Conferência: o mapa atual do Adelaide 500 mostra a largada na mesma reta, 60 m antes.
  - Tolerância estimada: ±40 m.
  - SVG v3. Passa a N1; continua sem boxes.
- **Fuji (CIR-0039):** linha de chegada e largada registradas em 0.83250, como provisórias.
  - Fonte: "START" do mapa 51gt3, a 49% da reta principal.
  - Conferências: calibrando pelo pit lane da OSM dá 0,831; o mapa Brembo dá ~0,827.
  - Tolerância estimada: ±40 m.
  - SVG v3. Passa a N1 e N2.
- **Indianápolis (CIR-0038):** sem mudança. A entrada dos boxes pela curva 13 continua sem via mapeada.
- **Situação:** N1 em 31 e N2 em 28.
- **Testes:**
  - suíte Chromium: 452/452;
  - integridade: 43/43;
  - testes 03F: 448/448.
- **Detalhes:** `docs/circuitos/relatorio_svg_circuits_03f.md`.

## 15. Atualização 15/10/2026 — SVG-CIRCUITS-03G

- **Adelaide (CIR-0033) e Brasília (CIR-0041) desativados** por decisão do proprietário: `active=false`.
  - Os dois saíram do visualizador e das pranchas.
  - Linha, ID, SVG e versões foram preservados. Para reativar, basta voltar a `active=true`.
- **Nenhum SVG alterado.**
- **Situação dos ativos:**
  - 41 circuitos;
  - N1 em 30 e N2 em 28.
- **Testes:**
  - suíte Chromium: 441/441 (41 circuitos);
  - integridade: 43/43;
  - testes 03G: 91/91.
- **Detalhes:** `docs/circuitos/relatorio_svg_circuits_03g.md`.

## 16. Atualização 15/10/2026 — SVG-CIRCUITS-03H

- **Candidatos da prancha 03C aprovados pelo proprietário e registrados como provisórios:**

  | Circuito    | Chegada | Largada        |
  | ----------- | ------- | -------------- |
  | China       | 0.92160 | 0.96050        |
  | Japão       | 0.94560 | 0.99890        |
  | Magny-Cours | 0.00015 | coincidente    |
  | Estoril     | 0.99357 | 0.99866        |
  | Jerez       | 0.70786 | coincidente    |
  | Mugello     | 0.00050 | não registrada |
  | Sochi       | 0.95493 | 0.99700        |

- **SVGs:** seis passaram de v2 para v3 e Sochi de v1 para v2, todos com `g#start_finish`. `path#track` e `path#pit` não mudaram.
- **Situação dos 41 ativos:** N1 em 37 e N2 em 34.
- **Testes:**
  - suíte Chromium: 511/511;
  - integridade: 43/43;
  - testes 03H: 126/126.
- **Detalhes:** `docs/circuitos/relatorio_svg_circuits_03h.md`.

## 17. Atualização 15/10/2026 — SVG-CIRCUITS-03I

- **Boxes por aproximação, autorizados pelo proprietário.** Todos marcados como "APROXIMADO".

  | Circuito     | Entrada | Saída   | Como foi traçado                                      |
  | ------------ | ------- | ------- | ----------------------------------------------------- |
  | Canadá       | 0.93640 | 0.08552 | Sobre a imagem de satélite                            |
  | Indianápolis | 0.82328 | 0.18595 | Vias OSM; a ligação a partir da curva 13 é aproximada |
  | Sochi        | 0.93500 | 0.03000 | Faixa esquemática                                     |
  | Hungria      | 0.87500 | 0.09500 | Faixa esquemática                                     |
  | Jeddah       | 0.88000 | 0.08000 | Faixa esquemática                                     |
  | Jacarepaguá  | 0.93000 | 0.06000 | Faixa esquemática                                     |

- **Linhas de chegada e largada provisórias:**

  | Circuito    | Posição | Fonte                                                                           |
  | ----------- | ------- | ------------------------------------------------------------------------------- |
  | Madrid      | 0.94900 | Mapa enviado pelo proprietário                                                  |
  | Hungria     | 0.95120 | Imagem aérea enviada pelo proprietário                                          |
  | Jacarepaguá | 0.98200 | Decisão delegada pelo proprietário, a partir da marca visível na imagem de 2014 |

- **Situação dos 41 ativos:** N1 em 40 e N2 em 40. Falta só a chegada de Jeddah.
- **Testes:**
  - suíte Chromium: 562/562;
  - integridade: 43/43;
  - testes 03I: 127/127.
- **Detalhes:** `docs/circuitos/relatorio_svg_circuits_03i.md`.

## 18. Atualização 15/10/2026 — SVG-CIRCUITS-03J

- **Jeddah (CIR-0005):** chegada e largada registradas em 0.99320, como provisórias.
  - Fonte: mapa enviado pelo proprietário. A bandeira "Start/finish" fica a 56,75% do caminho entre os ápices das curvas 27 e 1.
  - Tolerância: ±40 m.
- **Boxes de Jeddah refeitos pelo mesmo mapa:**
  - entrada na reta depois da curva 27, em 0.96039;
  - saída na curva 1, em 0.07199;
  - antes: entrada estimada antes da curva 27, em 0.88.
  - SVG v3.
- **Situação:** os 41 circuitos ativos estão em N2.
- **Testes:**
  - suíte Chromium: 573/573;
  - integridade: 43/43;
  - testes 03J: 92/92.
