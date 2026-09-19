# Base comum do grupo — Fundação obrigatória antes da divisão

## 1. Objetivo deste documento

Esta etapa **não pertence a nenhuma pessoa específica**. Os três integrantes devem construí-la juntos antes de iniciarem suas trilhas individuais.

A finalidade é impedir que cada integrante crie uma interpretação diferente de estado, regras, eventos, métricas ou formatos de retorno. Quando esta base estiver concluída, as três pessoas poderão trabalhar em paralelo com o mínimo de dependências cruzadas.

A base comum deve terminar no marco **BASE-V1**.

---

## 2. Como trabalhar em conjunto nesta fase

Para que os três aprendam a fundação do projeto, recomenda-se alternar os papéis em cada passo:

- **driver:** escreve o código naquele momento;
- **revisor:** acompanha e questiona decisões;
- **testador:** prepara exemplos e verifica os critérios de aceite.

No passo seguinte, os papéis podem ser trocados. Assim, a base continua sendo coletiva e ninguém fica apenas observando.

---

## 3. Equilíbrio planejado das três trilhas

A divisão não tenta igualar apenas a quantidade de passos, porque um passo de algoritmo pode ser muito mais complexo que um passo de interface. O equilíbrio foi feito pela combinação de raciocínio, implementação, testes e integração:

| Pessoa   | Núcleo de implementação                 | Parte conceitualmente mais difícil                       | Responsabilidade de integração/teste                       |
| -------- | --------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------- |
| Pessoa 1 | DFS + backtracking + validação completa | busca recursiva e prova de solucionabilidade             | eventos/métricas da DFS e pipeline de validação            |
| Pessoa 2 | GBFS + MRV + Degree + LCV +`h(state)`   | heurísticas e fronteira prioritária                      | eventos/métricas do GBFS e testes isolados das heurísticas |
| Pessoa 3 | UI + controlador + player + benchmark   | reprodução correta de dois tipos de busca e orquestração | comparação, integração ponta a ponta e experimentos        |

Assim, todos implementam lógica relevante, precisam compreender a matéria e possuem uma entrega que pode ser testada isoladamente antes da integração final.

---

# Mapa da base comum

```text
B-01 Modelagem e organização
  |
  v
B-02 Estado, cópia e transição
  |
  v
B-03 Regras, domínios, objetivo e estado morto
  |
  v
B-04 Contratos compartilhados
  |
  v
B-05 Instrumentação mínima e eventos de teste
  |
  v
B-06 Casos de teste comuns e aceite
  |
  v
BASE-V1
  |
  +--> Pessoa 1: DFS + validação
  +--> Pessoa 2: GBFS + heurísticas
  +--> Pessoa 3: UI + animação + benchmark
```

---

# B-01 — Organizar a modelagem e os módulos do projeto

## Dependências

Nenhuma.

## Objetivo

Transformar o protótipo atual em uma estrutura em que regras, algoritmos e interface não fiquem misturados.

## O que deve ser decidido

O grupo deve concordar com pelo menos estas áreas conceituais:

```text
core/
  estado
  regras
  domínios
  transição
  objetivo

search/
  dfs
  gbfs

heuristics/
  mrv
  degree
  lcv
  stateHeuristic

validation/
  validações

instrumentation/
  métricas
  eventos

ui/
  tabuleiro
  controles
  animação

experiments/
  puzzles
  benchmark
```

Os nomes físicos de arquivos podem ser diferentes, mas a separação de responsabilidades deve existir.

## Aceite

- [x] O grupo consegue apontar onde ficará cada responsabilidade.
- [x] Funções de regra do Sudoku não dependerão do HTML/DOM.
- [x] Algoritmos não manipularão diretamente componentes visuais.
- [x] A interface consumirá resultados/eventos produzidos pelos algoritmos.
- [x] Os três integrantes concordam com os mesmos nomes/conceitos básicos.

<details>
<summary>Dica 1 — Como identificar responsabilidades misturadas</summary>

Se uma função ao mesmo tempo verifica se um número é válido, altera uma célula HTML e incrementa uma métrica, ela está fazendo responsabilidades demais.

Tente responder: “essa função ainda faria sentido se a interface fosse removida?”. Se sim, ela provavelmente pertence ao núcleo ou à busca.

</details>

<details>
<summary>Dica 2 — O mínimo necessário</summary>

Não é necessário criar uma arquitetura sofisticada. Basta garantir que existam fronteiras claras:

```text
regras -> não conhecem algoritmos
algoritmos -> não conhecem interface
interface -> chama serviços e reproduz eventos
```

</details>

<details>
<summary>Dica 3 — Possível organização em pseudocódigo</summary>

```text
core:
    cloneBoard
    isValidMove
    getDomain
    transition
    isGoal
    isDeadEnd

search:
    solveDFS
    solveGBFS

ui:
    readBoard
    renderBoard
    playEvents
```

</details>

---

# B-02 — Definir estado, ação, cópia e função de transição

## Dependências

- B-01.

## Objetivo

Permitir que diferentes estados existam simultaneamente sem corromper uns aos outros.

## Estruturas conceituais

```text
SudokuState
- board: matriz 9x9

Action
- x
- y
- value
```

A função de transição deve receber um estado e uma ação e devolver um **novo estado**.

## Requisitos

- `0` representa célula vazia;
- valores `1..9` representam células preenchidas;
- cópia deve ser profunda ao menos no nível das linhas;
- o estado inicial deve permanecer preservado;
- alterar um filho não pode alterar o pai.

## Aceite

- [x] É possível criar um estado a partir de uma matriz.
- [x] É possível clonar uma matriz 9x9.
- [x] Uma alteração no clone não muda o original.
- [x] Uma ação pode ser representada explicitamente.
- [x] Uma transição válida produz um novo estado.
- [x] O estado inicial pode ser reutilizado pelos dois algoritmos.

<details>
<summary>Dica 1 — Por que a cópia é necessária</summary>

O GBFS pode manter vários estados na fronteira ao mesmo tempo. Se todos apontarem para a mesma matriz, alterar um ramo altera todos os outros.

</details>

<details>
<summary>Dica 2 — Cópia suficiente para a matriz atual</summary>

Como cada linha contém apenas números, copiar cada linha individualmente já separa as matrizes.

</details>

<details>
<summary>Dica 3 — Pseudocódigo possível</summary>

```text
FUNÇÃO cloneBoard(board):
    novo = []
    PARA cada linha EM board:
        novo.adicionar(cópia da linha)
    RETORNAR novo

FUNÇÃO transition(state, action):
    novoBoard = cloneBoard(state.board)
    novoBoard[action.y][action.x] = action.value
    RETORNAR { board: novoBoard }
```

</details>

---

# B-03 — Consolidar regras, domínios, objetivo e detecção de estado morto

## Dependências

- B-02.

## Objetivo

Criar a camada comum que conhece as regras do Sudoku, mas não sabe se quem a está usando é DFS ou GBFS.

## Funções/conceitos necessários

- verificar existência de valor na linha;
- verificar existência de valor na coluna;
- verificar existência de valor no bloco 3x3;
- verificar se uma ação é válida;
- calcular domínio de uma célula vazia;
- calcular domínios de todas as células vazias;
- detectar estado objetivo;
- detectar domínio zero/estado morto.

## Estrutura de domínio

```text
CellDomain
- x
- y
- values
- size
- degree: opcional nesta base; será preenchido pela heurística quando necessário
```

## Aceite

- [x] O domínio de uma célula contém apenas valores legais.
- [x] Células preenchidas não são tratadas como variáveis da busca.
- [x] Estado completo inválido não é aceito como objetivo.
- [x] Estado completo válido é aceito como objetivo.
- [x] Uma célula vazia com domínio vazio torna o estado morto.
- [x] Todas as funções recebem explicitamente o estado/matriz analisado.
- [x] Nenhuma função depende exclusivamente de `matrizPrincipal` global.

<details>
<summary>Dica 1 — Aproveitando o código já existente</summary>

As funções `numeroExisteNaLinha`, `numeroExisteNaColuna`, `numeroExisteNoQuadrante` e `recuperaValoresPossiveisCelula` já representam boa parte desta etapa. A principal mudança conceitual é fazer com que trabalhem sobre qualquer estado recebido.

</details>

<details>
<summary>Dica 2 — Estado morto</summary>

Depois de calcular os domínios das células vazias, basta existir uma com `size == 0` para provar que aquele ramo não pode continuar.

</details>

<details>
<summary>Dica 3 — Pseudocódigo possível</summary>

```text
FUNÇÃO getDomain(state, x, y):
    SE célula não está vazia:
        RETORNAR []

    candidatos = []
    PARA valor DE 1 ATÉ 9:
        SE valor não está na linha
           E valor não está na coluna
           E valor não está no bloco:
            candidatos.adicionar(valor)

    RETORNAR candidatos

FUNÇÃO isDeadEnd(state):
    PARA cada célula vazia:
        SE getDomain(state, x, y).tamanho == 0:
            RETORNAR verdadeiro
    RETORNAR falso
```

</details>

---

# B-04 — Definir contratos compartilhados entre algoritmos e interface

## Dependências

- B-03.

## Objetivo

Garantir que DFS e GBFS possam ser usados pela mesma interface sem adaptações improvisadas no final.

## Resultado de resolvedor

```text
SolverResult
- status: solved | unsolvable | invalid | cancelled
- solution: matriz ou null
- metrics
- events
- solutionPath: opcional
```

## Métricas comuns

```text
Metrics
- elapsedMs
- exploredStates
- generatedStates
- candidateAttempts
- deadEnds
- prunedStates
- solutionDepth
- maxFrontier
- heuristicEvaluations
- backtracks
```

Os campos podem ter `0` quando não se aplicarem. Exemplo: `heuristicEvaluations = 0` na DFS.

## Eventos comuns

```text
SearchEvent
- sequence
- algorithm
- type
- stateSnapshot
- cell
- value
- candidates
- heuristicScore
- frontierSize
- depth
- reason
```

Tipos sugeridos:

```text
SEARCH_STARTED
NODE_EXPANDED
CELL_SELECTED
CANDIDATES_COMPUTED
VALUE_TRIED
CHILD_GENERATED
STATE_PRUNED
BACKTRACK
SOLUTION_FOUND
SEARCH_FINISHED
```

## Validação

```text
ValidationResult
- valid
- code
- message
- cells
```

## Aceite

- [x] DFS e GBFS utilizarão o mesmo formato de `SolverResult`.
- [x] As métricas têm definições únicas para o grupo.
- [x] Os eventos necessários à animação estão acordados.
- [x] `ValidationResult` consegue indicar erro e células relacionadas.
- [x] Campos opcionais e valores padrão foram combinados.

<details>
<summary>Dica 1 — Pense primeiro na integração</summary>

A interface deveria conseguir fazer algo conceitualmente parecido com:

```text
resultado = solverSelecionado.solve(board)
mostrarMetricas(resultado.metrics)
animar(resultado.events)
```

sem precisar saber detalhes internos da DFS ou do GBFS.

</details>

<details>
<summary>Dica 2 — Métricas com a mesma semântica</summary>

Não deixem uma pessoa contar “estado explorado” ao gerar o nó e outra apenas ao retirar o nó da fronteira. Definam uma regra única antes da implementação.

</details>

<details>
<summary>Dica 3 — Pseudocódigo de fábrica de métricas</summary>

```text
FUNÇÃO createEmptyMetrics():
    RETORNAR {
        elapsedMs: 0,
        exploredStates: 0,
        generatedStates: 0,
        candidateAttempts: 0,
        deadEnds: 0,
        prunedStates: 0,
        solutionDepth: 0,
        maxFrontier: 0,
        heuristicEvaluations: 0,
        backtracks: 0
    }
```

</details>

---

# B-05 — Criar instrumentação mínima e eventos simulados

## Dependências

- B-04.

## Objetivo

Entregar à Pessoa 3 exemplos de eventos e resultados antes de os algoritmos reais estarem prontos.

Isso reduz a dependência da interface em relação às Pessoas 1 e 2.

## O que fazer

Criar pelo menos:

- um `SolverResult` simulado de sucesso;
- um resultado simulado de insolúvel;
- uma pequena sequência de eventos de DFS;
- uma pequena sequência de eventos de GBFS;
- métricas fictícias claramente identificadas como mock.

Esses dados existem apenas para desenvolvimento da UI e não entram no relatório experimental.

## Aceite

- [x] A UI pode ser desenvolvida sem esperar os algoritmos reais.
- [x] Há evento com `stateSnapshot` suficiente para trocar o tabuleiro inteiro.
- [x] Há evento de backtracking para testar a animação da DFS.
- [x] Há evento com `heuristicScore` para testar a visualização do GBFS.
- [x] Os mocks respeitam exatamente os contratos de B-04.

**Verificação:** `MockResolucao` fornece resultados de sucesso e insolúvel, eventos de DFS com `BACKTRACK`, eventos de GBFS com `scoreHeuristico` e snapshots completos de `SudokuEstado`. Os contratos são exercitados pelos testes da base.

<details>
<summary>Dica 1 — O mock não precisa resolver um Sudoku</summary>

Ele só precisa ter a mesma forma dos dados reais que chegarão depois.

</details>

<details>
<summary>Dica 2 — Sequência curta é suficiente</summary>

Três ou quatro estados já permitem testar: iniciar, selecionar célula, tentar valor, voltar e finalizar.

</details>

<details>
<summary>Dica 3 — Pseudocódigo de uma sequência mock</summary>

```text
events = [
  SEARCH_STARTED(snapshotInicial),
  CELL_SELECTED(cell=(2,4), candidates=[3,7]),
  VALUE_TRIED(cell=(2,4), value=3),
  BACKTRACK(cell=(2,4), value=3),
  VALUE_TRIED(cell=(2,4), value=7),
  SOLUTION_FOUND(snapshotFinal),
  SEARCH_FINISHED(snapshotFinal)
]
```

</details>

---

# B-06 — Criar casos de teste comuns e fechar BASE-V1

## Dependências

- B-01 a B-05.

## Objetivo

Criar dados fixos que serão usados por todos e provar que a fundação é confiável antes da divisão.

## Casos mínimos

1. Sudoku válido fácil.
2. Sudoku válido intermediário.
3. Sudoku válido difícil.
4. Sudoku completo e válido.
5. Duplicata em linha.
6. Duplicata em coluna.
7. Duplicata em bloco.
8. Estado localmente válido mas insolúvel, se o grupo já possuir um caso conhecido.
9. Estado com domínio zero.
10. Caso preparado para empate de MRV.
11. Caso preparado para desempate por Degree.
12. Caso em que LCV possa ser verificado depois.

## Regra de reprodutibilidade

Os puzzles usados nos testes e no benchmark devem ser armazenados como dados fixos. Não depender somente de geração aleatória.

## Aceite do marco BASE-V1

- [x] B-01 a B-05 aprovados.
- [x] Casos fixos estão disponíveis para todos.
- [x] Clonagem de estado foi testada.
- [x] Regras e domínios foram testados.
- [x] Objetivo e estado morto foram testados.
- [x] Contratos foram congelados para a primeira integração.
- [x] Mocks foram validados pela Pessoa 3.
- [x] Pessoa 1 consegue iniciar DFS sem criar nova infraestrutura.
- [x] Pessoa 2 consegue iniciar heurísticas sem criar nova infraestrutura.
- [x] Pessoa 3 consegue iniciar UI usando mocks.

**Status verificado da BASE-V1:** concluída. A versão atual passa em `npm test` com 14/14 testes. Além dos testes existentes, o caso `localmenteValidoInsoluvel` foi conferido como realmente insolúvel e os impactos registrados no caso de LCV foram conferidos (`2 -> 7` e `6 -> 2`). A conclusão/freeze da base e a validação coletiva dos mocks foram confirmadas pelo grupo ao declarar esta base pronta para o início das trilhas individuais.

<details>
<summary>Dica 1 — Não usar apenas puzzles aleatórios</summary>

Se um teste falhar amanhã e o puzzle tiver sido gerado aleatoriamente, pode ser difícil reproduzir o problema. Guardem matrizes conhecidas.

</details>

<details>
<summary>Dica 2 — Faça testes pequenos das funções do núcleo</summary>

Antes de testar um resolvedor completo, verifiquem coisas simples como:

```text
“o domínio desta célula deve ser {2,5}”
“esta transição não pode mudar o pai”
“este tabuleiro deve ser objetivo”
```

</details>

<details>
<summary>Dica 3 — Pseudocódigo de aceite da base</summary>

```text
PARA cada caso comum:
    executar verificações esperadas
    SE alguma falhar:
        BASE-V1 ainda não está liberada

SE todas passarem:
    marcar BASE-V1
    iniciar as três trilhas em paralelo
```

</details>

---

# 3. Regra após BASE-V1

Depois que **BASE-V1** estiver concluída:

- a Pessoa 1 não deve alterar contratos compartilhados unilateralmente;
- a Pessoa 2 não deve alterar contratos compartilhados unilateralmente;
- a Pessoa 3 não deve alterar contratos compartilhados unilateralmente.

Se algum contrato realmente precisar mudar, os três devem combinar a alteração e atualizar os mocks/testes comuns antes de continuar.

Isso evita que uma trilha quebre silenciosamente as outras duas.
