# APEX GP Manager 2.0 — pacote completo de circuitos

Situação em 15/10/2026, após a rodada SVG-CIRCUITS-03J. Os arquivos são cópia exata dos que estão na pasta `Apex2.0`.

## Conteúdo

- `circuitos/svg/`: os 43 SVGs canônicos (viewBox 0 0 1600 900, com `path#track`, `path#pit` e `g#start_finish` quando existem).
- `CSV/circuits.csv`: o cadastro de circuitos (43 linhas, 38 colunas).
- `docs/`: a validação dos SVGs, a matriz de pendências, os relatórios, o visualizador e a prancha de aprovação.
- `SHA256SUMS.txt`: a soma de verificação de cada arquivo.

## Níveis

- **N2:** chegada, sentido e boxes definidos.
- **N1:** chegada e sentido definidos, sem boxes.
- **parcial:** falta a chegada.
- **desativado:** `active=false`; o circuito está fora do catálogo jogável.

## Lista

| ID | Circuito | SVG | Ativo | Nível | Provisório |
|---|---|---|---|---|---|
| CIR-0001 | Albert Park Circuit | 01-Australia.svg | sim | N2 |  |
| CIR-0002 | Shanghai International Circuit | 02-China.svg | sim | N2 | sim |
| CIR-0003 | Suzuka International Racing Course | 03-Japao.svg | sim | N2 | sim |
| CIR-0004 | Bahrain International Circuit | 04-Bahrein.svg | sim | N2 |  |
| CIR-0005 | Jeddah Corniche Circuit | 05-Arabia_Saudita.svg | sim | N2 | sim |
| CIR-0006 | Miami International Autodrome | 06-Miami.svg | sim | N2 |  |
| CIR-0007 | Circuit Gilles-Villeneuve | 07-Canada.svg | sim | N2 | sim |
| CIR-0008 | Circuit de Monaco | 08-Monaco.svg | sim | N2 |  |
| CIR-0009 | Circuit de Barcelona-Catalunya | 09-Barcelona.svg | sim | N2 |  |
| CIR-0010 | Madring | 10-Madrid.svg | sim | N2 | sim |
| CIR-0011 | Red Bull Ring | 11-Austria.svg | sim | N2 |  |
| CIR-0012 | Silverstone Circuit | 12-Silverstone.svg | sim | N2 |  |
| CIR-0013 | Circuit de Spa-Francorchamps | 13-Belgica.svg | sim | N2 |  |
| CIR-0014 | Hungaroring | 14-Hungria.svg | sim | N2 | sim |
| CIR-0015 | Circuit Zandvoort | 15-Holanda.svg | sim | N2 |  |
| CIR-0016 | Autodromo Nazionale Monza | 16-Monza.svg | sim | N2 |  |
| CIR-0017 | Baku City Circuit | 17-Azerbaijao.svg | sim | N2 |  |
| CIR-0018 | Marina Bay Street Circuit | 18-Singapura.svg | sim | N2 |  |
| CIR-0019 | Circuit of the Americas | 19-USA.svg | sim | N2 |  |
| CIR-0020 | Autódromo Hermanos Rodríguez | 20-Mexico.svg | sim | N2 |  |
| CIR-0021 | Autódromo José Carlos Pace (Interlagos) | 21-Brasil.svg | sim | N2 |  |
| CIR-0022 | Las Vegas Strip Circuit | 22-Las_Vegas.svg | sim | N2 |  |
| CIR-0023 | Lusail International Circuit | 23-Qatar.svg | sim | N2 |  |
| CIR-0024 | Yas Marina Circuit | 24-Abu_Dhabi.svg | sim | N2 |  |
| CIR-0025 | Autodromo Internazionale Enzo e Dino Ferrari | 25-Imola.svg | sim | N2 |  |
| CIR-0026 | Autódromo Internacional do Algarve | 26-Portimao.svg | sim | N2 |  |
| CIR-0027 | Istanbul Park | 27-Istambul.svg | sim | N2 |  |
| CIR-0028 | Sepang International Circuit | 28-Sepang.svg | sim | N2 |  |
| CIR-0029 | Nürburgring (GP-Strecke) | 29-Nurburgring.svg | sim | N2 |  |
| CIR-0030 | Hockenheimring | 30-Hockenheim.svg | sim | N2 |  |
| CIR-0031 | Circuit Paul Ricard | 31-Paul_Ricard.svg | sim | N2 |  |
| CIR-0032 | Circuit de Nevers Magny-Cours | 32-Magny_Cours.svg | sim | N2 | sim |
| CIR-0033 | Adelaide Street Circuit | 33-Adelaide.svg | não | desativado | sim |
| CIR-0034 | Circuito do Estoril | 34-Estoril.svg | sim | N2 | sim |
| CIR-0035 | Kyalami Grand Prix Circuit | 35-Kyalami.svg | sim | N2 |  |
| CIR-0036 | Circuito de Jerez – Ángel Nieto | 36-Jerez.svg | sim | N2 | sim |
| CIR-0037 | Autodromo Internazionale del Mugello | 37-Mugello.svg | sim | N2 | sim |
| CIR-0038 | Indianapolis Motor Speedway (misto) | 38-Indianapolis.svg | sim | N2 | sim |
| CIR-0039 | Fuji Speedway | 39-Fuji.svg | sim | N2 | sim |
| CIR-0040 | Autódromo Internacional Nelson Piquet (Jacarepaguá) | 40-Jacarepagua.svg | sim | N2 | sim |
| CIR-0041 | Autódromo Internacional Nelson Piquet (Brasília) | 41-Brasilia.svg | não | desativado |  |
| CIR-0042 | Autódromo Internacional Ayrton Senna (Goiânia) | 42-Goiania.svg | sim | N2 | sim |
| CIR-0043 | Sochi Autodrom | 43-Sochi.svg | sim | N2 | sim |

**Provisório** quer dizer que a linha de chegada ou os boxes vieram de fonte secundária, de aproximação ou de decisão do proprietário. Nesses casos ainda falta a aprovação visual.

A homologação final dos 43 circuitos cabe ao proprietário.
