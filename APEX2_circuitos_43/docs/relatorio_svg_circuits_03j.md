# SVG-CIRCUITS-03J — Jeddah pelo mapa do proprietário

APEX GP Manager 2.0 · 15/10/2026 · executado em `Apex2.0`. Sem alteração no APEX 1.0, no banco de produção ou no GitHub. A homologação final continua com o proprietário.

## Fonte

Mapa do Jeddah Corniche Circuit enviado pelo proprietário. Traz:

- curvas 1–27;
- seta de sentido;
- bandeira "Start/finish";
- desenho do "Pitlane".

Cópia em `svg_circuits_03j/evidencias/mapa_jeddah_proprietario.png`.

## Medição

| Ponto do mapa     | Coordenada (px) | Progress no traçado |
| ----------------- | --------------- | ------------------- |
| Ápice da curva 27 | (1610,598)      | 0,8944              |
| Ápice da curva 1  | (1046,470)      | 0,0685              |

O caminho no mapa entre os dois ápices mede 600 px. Ele passa pela dobra da reta, em (1400,510).

| Elemento          | Posição no mapa                        | Progress    |
| ----------------- | -------------------------------------- | ----------- |
| Bandeira          | 340,7 px a partir da curva 27 (56,75%) | **0,99320** |
| Pit lane, entrada | Sai da reta na dobra (37,9%)           | **0,96039** |
| Pit lane, saída   | Volta na curva 1, entre a 1 e a 2      | **0,07199** |

O pit lane fica do lado esquerdo do sentido de corrida e foi desenhado como faixa esquemática a 15 m da pista.

**Correção da 03I:** a entrada foi estimada antes da curva 27 (0,88). O mapa mostra que ela fica depois da curva 27.

## Registro

| Campo                   | Valor                   |
| ----------------------- | ----------------------- |
| `start_finish_progress` | 0.99320                 |
| `start_line_progress`   | 0.99320 (símbolo único) |
| Boxes                   | 0.96039 → 0.07199       |

- **Situação:** provisório, com tolerância de ±40 m, porque o mapa é esquemático.
- **SVG:** v2 → v3. A v2 está em `_versoes/05-Arabia_Saudita_v2.svg`.

## Resultado

Os **41 circuitos ativos estão em N2**, com linha de chegada, sentido e boxes. Adelaide e Brasília continuam desativados.

**Testes:**

| Verificação    | Resultado |
| -------------- | --------- |
| Suíte Chromium | 573/573   |
| Integridade    | 43/43     |
| Testes 03J     | 92/92     |

Os outros 42 SVGs ficaram idênticos à 03I.

**Pendente:** aprovação visual e homologação final do proprietário, principalmente dos itens marcados como PROVISÓRIO ou APROXIMADO.
