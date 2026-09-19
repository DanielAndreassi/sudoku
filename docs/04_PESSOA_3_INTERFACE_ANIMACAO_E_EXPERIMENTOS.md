# Pessoa 3 — Interface, controlador de execução, animação e experimentos comparativos

## 1. Papel da Pessoa 3

A Pessoa 3 começa **somente depois do marco BASE-V1**, construído pelos três integrantes em conjunto.

Sua trilha não é apenas estética. Ela implementa a camada que transforma os algoritmos em um sistema demonstrável e mensurável:

1. entrada manual e representação gráfica do Sudoku;
2. controlador de execução dos resolvedores;
3. player de eventos com pausa, passo e velocidade;
4. painel de métricas e comparação;
5. runner de experimentos/benchmark sem animação;
6. integração final dos componentes reais das Pessoas 1 e 2.

Até os algoritmos ficarem prontos, esta pessoa deve trabalhar com os mocks criados na BASE-V1, evitando ficar bloqueada.

---

# Mapa de dependências

```text
BASE-V1
  |
  +--> P3-01 tabuleiro e entrada
  |        |
  |        v
  +--> P3-02 controlador de execução com mocks
  |        |
  |        v
  +--> P3-03 player de eventos e animação
  |        |
  |        +------------------+
  |                           |
  +--> P3-04 painel de métricas+
  |                           |
  +--> P3-05 benchmark -------+
                              |
                 P1-05 -------+
                 P2-06 -------+--> P3-06 integração real
                                      |
                                      v
                                  P3-07 testes E2E e entrega
```

### Dependências externas

- P3-01 a P3-05 dependem apenas de **BASE-V1** e podem ser feitos com mocks.
- P3-06 precisa de **P1-05** para validação real e de **P2-06** para GBFS real; para integração mais estável, preferir também P1-06 e P2-07.
- Dessa forma, a Pessoa 3 não precisa esperar os algoritmos para iniciar a maior parte de sua implementação.

---

# P3-01 — Implementar o tabuleiro gráfico e a entrada manual

## Dependências

- BASE-V1.

## Objetivo

Criar uma interface 9x9 editável que represente exatamente o estado usado pelo núcleo.

## Requisitos funcionais

- 81 células;
- separação visual dos nove blocos 3x3;
- entrada apenas de `1..9` ou vazio;
- vazio convertido internamente para `0`;
- capacidade de carregar uma matriz 9x9;
- capacidade de extrair uma matriz 9x9 da UI;
- preservar quais células pertenciam ao estado inicial;
- diferenciar valores iniciais dos valores produzidos pela busca.

## Estados visuais necessários

A interface deve conseguir representar, no mínimo:

```text
given/original
search-value
selected
trial
backtrack/pruned
error
solution
```

Não é obrigatório usar exatamente esses nomes ou cores.

## Controles básicos

- limpar;
- resetar para estado inicial;
- resolver;
- seleção de algoritmo;
- espaço para os controles de animação que virão depois.

## Aceite

- [ ] Existem exatamente 81 células editáveis antes da execução.
- [ ] Os blocos 3x3 são visualmente distinguíveis.
- [ ] Entrada inválida é normalizada ou rejeitada.
- [ ] UI -> matriz produz 9x9 com `0..9`.
- [ ] Matriz -> UI reconstrói o mesmo tabuleiro.
- [ ] Reset restaura o estado inicial.
- [ ] É possível destacar coordenadas de erro recebidas em `ValidationResult`.
- [ ] Pistas originais são distinguíveis dos valores da busca.

<details>
<summary>Dica 1 — Não use o DOM como única fonte da verdade</summary>

Mantenha um estado de aplicação ou funções claras de leitura/escrita. Isso facilita carregar snapshots vindos do GBFS.

</details>

<details>
<summary>Dica 2 — Bordas de bloco</summary>

As divisões depois das linhas 2 e 5 e colunas 2 e 5 devem ser mais fortes para que os blocos 3x3 sejam percebidos imediatamente.

</details>

<details>
<summary>Dica 3 — Pseudocódigo conceitual</summary>

```text
FUNÇÃO renderBoard(board):
    PARA y 0..8:
        PARA x 0..8:
            mostrar board[y][x] ou vazio

FUNÇÃO readBoard():
    board = matriz 9x9 com zeros
    PARA cada input:
        normalizar valor
        board[y][x] = valor normalizado
    RETORNAR board
```

</details>

---

# P3-02 — Implementar o controlador de execução usando mocks

## Dependências

- P3-01.
- Mocks e contratos de BASE-V1.

## Objetivo

Criar a camada que coordena o fluxo da aplicação sem conhecer detalhes internos dos algoritmos.

## Estados de execução sugeridos

```text
IDLE
VALIDATING
READY
SOLVING
PLAYING
PAUSED
FINISHED
ERROR
```

## Responsabilidades do controlador

Ao clicar em resolver:

1. ler estado da interface;
2. impedir edição durante a execução;
3. solicitar validação;
4. se inválido, exibir mensagem e não chamar solver;
5. selecionar solver de acordo com o algoritmo escolhido;
6. executar a busca;
7. receber `SolverResult`;
8. armazenar métricas;
9. entregar `events` ao player;
10. finalizar/restaurar controles adequadamente.

Nesta etapa, use funções simuladas compatíveis com `ValidationResult` e `SolverResult`.

## Aceite

- [ ] Trocar DFS/GBFS muda o solver chamado.
- [ ] Entrada inválida interrompe o fluxo antes da busca.
- [ ] Botões são habilitados/desabilitados conforme o estado da aplicação.
- [ ] É impossível iniciar duas execuções simultâneas acidentalmente.
- [ ] Reset cancela/encerra o estado visual da execução atual.
- [ ] O controlador não conhece MRV, LCV ou detalhes da recursão DFS.
- [ ] Os mocks podem ser substituídos por implementações reais sem redesenhar o fluxo.

<details>
<summary>Dica 1 — Pense em uma pequena máquina de estados</summary>

Quando o sistema está `PLAYING`, por exemplo, editar pistas ou disparar outra resolução deve ser proibido. Definir estados explícitos evita combinações estranhas de botões.

</details>

<details>
<summary>Dica 2 — Faça dependência por interface, não por implementação</summary>

Conceitualmente:

```text
solvers = {
  dfs: função,
  gbfs: função
}
```

O controlador escolhe uma função, mas não precisa saber como ela resolve.

</details>

<details>
<summary>Dica 3 — Pseudocódigo possível</summary>

```text
AO clicar Resolver:
    setStatus(VALIDATING)
    board = readBoard()
    validation = validate(board)

    SE !validation.valid:
        showValidationError(validation)
        setStatus(ERROR)
        RETORNAR

    setStatus(SOLVING)
    solver = solvers[selectedAlgorithm]
    result = solver(board)

    saveMetrics(result.metrics)
    loadEvents(result.events)
    setStatus(PAUSED ou PLAYING)
```

</details>

---

# P3-03 — Implementar o player de eventos e a animação

## Dependências

- P3-02.
- Contrato `SearchEvent` da BASE-V1.

## Objetivo

Reproduzir visualmente a sequência produzida pelos algoritmos sem reexecutar a busca.

## Controles obrigatórios/recomendados

- iniciar reprodução;
- pausar;
- continuar;
- próximo passo;
- resetar animação;
- ajustar velocidade;
- ir diretamente ao resultado final, opcionalmente.

## Regra central

O player deve ter um índice:

```text
currentEventIndex
```

Ele consome os eventos em ordem de `sequence`.

## Como tratar DFS

Eventos podem mostrar:

- célula selecionada;
- valor tentado;
- filho gerado;
- backtracking;
- solução.

## Como tratar GBFS

Quando chegar `NODE_EXPANDED` com `stateSnapshot`, o tabuleiro deve ser substituído pelo snapshot daquele nó. Isso é essencial porque a busca pode saltar visualmente entre ramos da fronteira.

## Painel explicativo durante animação

Mostrar quando disponível:

```text
algoritmo
célula selecionada
candidatos
valor atual
profundidade
fronteira
MRV
Degree
ordem LCV
h(state)
razão da poda/backtracking
```

## Aceite

- [ ] Eventos são reproduzidos em ordem.
- [ ] Pausa impede avanço automático.
- [ ] Próximo passo avança exatamente um evento lógico.
- [ ] Velocidade altera apenas reprodução, não métricas da busca.
- [ ] Reset volta ao estado inicial da animação.
- [ ] DFS consegue mostrar backtracking.
- [ ] GBFS consegue trocar para snapshots de ramos diferentes.
- [ ] A solução final exibida é o `solution` do resultado.

<details>
<summary>Dica 1 — A busca já terminou quando a animação começa</summary>

Isso simplifica muito o problema. O player é semelhante a reproduzir um vídeo composto por eventos já gravados.

</details>

<details>
<summary>Dica 2 — Eventos sem efeito visual ainda podem atualizar texto</summary>

Por exemplo, `CANDIDATES_COMPUTED` talvez não mude a matriz, mas pode atualizar o painel explicativo.

</details>

<details>
<summary>Dica 3 — Pseudocódigo possível</summary>

```text
FUNÇÃO applyEvent(event):
    SE event.stateSnapshot existe:
        renderBoard(event.stateSnapshot)

    ESCOLHER event.type:
        CELL_SELECTED -> destacar célula
        VALUE_TRIED -> mostrar valor em tentativa
        BACKTRACK -> marcar reversão
        STATE_PRUNED -> mostrar motivo
        SOLUTION_FOUND -> renderBoard(snapshot da solução)

FUNÇÃO nextStep():
    SE currentEventIndex >= events.length:
        finalizar player
        RETORNAR

    event = events[currentEventIndex]
    applyEvent(event)
    currentEventIndex++
```

</details>

---

# P3-04 — Implementar painel de métricas e comparação entre algoritmos

## Dependências

- P3-02.
- Contrato `Metrics` da BASE-V1.

## Objetivo

Tornar visível a diferença de comportamento entre DFS e GBFS.

## Métricas a exibir

```text
tempo de busca
estados explorados
estados gerados
tentativas de candidatos
dead ends
estados podados
profundidade da solução
máximo da fronteira
avaliações heurísticas
backtracks
```

## Tratamento de métricas não aplicáveis

Exemplos:

- `heuristicEvaluations` na DFS: mostrar `0` ou `—` com legenda;
- `backtracks` no GBFS: mostrar `0` ou `—`.

O grupo deve escolher uma convenção e manter consistência.

## Comparação lado a lado

Depois que ambos os algoritmos forem executados sobre o mesmo puzzle, permitir uma visão semelhante a:

```text
Métrica                 DFS        GBFS
Tempo                    ...        ...
Estados explorados       ...        ...
Estados gerados          ...        ...
Tentativas               ...        ...
Máx. fronteira           ...        ...
Backtracks               ...        —
Avaliações heurísticas   —          ...
```

Não é necessário declarar automaticamente “vencedor”. O relatório analisará os dados.

## Aceite

- [ ] Métricas de uma execução aparecem ao final.
- [ ] Métricas não mudam durante a reprodução da animação.
- [ ] É possível guardar o resultado da DFS e depois o do GBFS para o mesmo puzzle.
- [ ] A comparação deixa claro que o estado inicial deve ser o mesmo.
- [ ] Valores são rotulados com definições coerentes com BASE-V1.
- [ ] Tempo não inclui atraso artificial da animação.

<details>
<summary>Dica 1 — Separe resultado de execução de estado da animação</summary>

`elapsedMs` vem do solver. O player só exibe esse número; ele não deve recalculá-lo usando o tempo que o usuário levou assistindo.

</details>

<details>
<summary>Dica 2 — Identifique o puzzle da comparação</summary>

Pode ser útil guardar uma serialização/hash simples do estado inicial junto ao resultado. Assim, a UI evita comparar resultados de puzzles diferentes como se fossem equivalentes.

</details>

<details>
<summary>Dica 3 — Pseudocódigo de armazenamento</summary>

```text
comparison = {
    puzzleKey,
    dfsResult: null,
    gbfsResult: null
}

AO terminar uma execução:
    SE puzzleKey ainda é o mesmo:
        comparison[algoritmo] = result
    SENÃO:
        limpar comparação anterior
        criar nova comparison
```

</details>

---

# P3-05 — Implementar runner de benchmark e conjunto experimental

## Dependências

- P3-04.
- Puzzles fixos da BASE-V1.

## Objetivo

Permitir produzir dados reproduzíveis para o relatório sem depender da animação manual.

## Regras do benchmark

Para cada puzzle selecionado:

1. preservar a matriz original;
2. validar uma vez;
3. executar DFS em modo silencioso;
4. executar GBFS em modo silencioso;
5. garantir que ambos recebam cópias independentes do mesmo estado inicial;
6. repetir cada execução um número definido de vezes, se desejado;
7. registrar métricas;
8. calcular média ou mediana de tempo;
9. manter as contagens determinísticas de estados separadas das medidas temporais.

## Dados recomendados por linha experimental

```text
puzzleId
algoritmo
runNumber
elapsedMs
exploredStates
generatedStates
candidateAttempts
deadEnds
prunedStates
solutionDepth
maxFrontier
heuristicEvaluations
backtracks
status
```

## Saída

Pode ser:

- tabela na própria interface;
- objeto/JSON;
- CSV opcional;
- tabela copiada para o relatório.

## Aceite

- [ ] Benchmark não reproduz animação.
- [ ] DFS e GBFS recebem o mesmo puzzle.
- [ ] Cada execução recebe uma cópia limpa.
- [ ] Resultados de múltiplas execuções podem ser armazenados.
- [ ] É possível distinguir puzzle e algoritmo.
- [ ] O runner detecta falha/`unsolvable` em vez de fingir resultado.
- [ ] O conjunto de experimentos pode ser executado novamente depois.

<details>
<summary>Dica 1 — Tempo varia, contagens normalmente não</summary>

Em um algoritmo determinístico, `exploredStates` deve ser igual em execuções repetidas do mesmo puzzle. Já `elapsedMs` pode variar por carga da máquina e pelo motor JavaScript.

</details>

<details>
<summary>Dica 2 — Mediana é útil</summary>

Se fizerem 5 ou 10 repetições, a mediana do tempo costuma ser menos sensível a uma execução isolada afetada pelo sistema operacional ou aquecimento do runtime.

</details>

<details>
<summary>Dica 3 — Pseudocódigo possível</summary>

```text
PARA puzzle EM benchmarkSet:
    validation = validate(puzzle)
    SE inválido:
        registrar erro
        CONTINUAR

    PARA algorithm EM [DFS, GBFS]:
        PARA run DE 1 ATÉ N:
            input = cloneBoard(puzzle)
            result = solver[algorithm](input, silent=true)
            registrar métricas

agrupar resultados por puzzle + algoritmo
calcular resumo temporal
```

</details>

---

# P3-06 — Integrar validação real, DFS real e GBFS real

## Dependências

- P3-01 a P3-05.
- P1-05 concluído; preferencialmente P1-06.
- P2-06 concluído; preferencialmente P2-07.

## Objetivo

Substituir mocks pelos componentes reais sem alterar a arquitetura da interface.

## Integrações

### Validação

Substituir o mock pela função final da Pessoa 1.

### DFS

Conectar o solver real ao seletor de algoritmo.

### GBFS

Conectar o solver real ao mesmo seletor.

### Eventos

Executar os dois algoritmos e confirmar que o player entende ambos sem lógica especial espalhada pela aplicação.

### Métricas

Confirmar que os dois resultados podem ser mostrados pelo mesmo painel.

## Aceite

- [ ] Entrada inválida não dispara solver.
- [ ] Entrada insolúvel é informada claramente.
- [ ] DFS real resolve e anima.
- [ ] GBFS real resolve e anima.
- [ ] Trocar algoritmo não exige recarregar o estado manualmente.
- [ ] O mesmo puzzle pode ser executado em ambos.
- [ ] Snapshots do GBFS aparecem corretamente.
- [ ] Backtracking da DFS aparece corretamente.
- [ ] Métricas do benchmark não incluem animação.
- [ ] Não restaram mocks no fluxo principal.

<details>
<summary>Dica 1 — Integre um componente de cada vez</summary>

Sugestão:

```text
1. validação real
2. DFS real
3. GBFS real
4. benchmark real
```

Assim, quando algo quebrar, a origem fica mais clara.

</details>

<details>
<summary>Dica 2 — Compare os contratos, não os detalhes internos</summary>

Se o mock e o solver real seguem `SolverResult`, a troca deveria ser pequena. Se exigir reescrever o controlador, investigue onde o contrato divergiu.

</details>

<details>
<summary>Dica 3 — Pseudocódigo de registro</summary>

```text
solvers = {
    dfs: solveDFS,
    gbfs: solveGBFS
}

validator = validateInitialBoard

controller.configure({solvers, validator})
```

</details>

---

# P3-07 — Executar testes de ponta a ponta e entregar a trilha da Pessoa 3

## Dependências

- P3-06.
- P1-DONE.
- P2-DONE.

## Objetivo

Garantir que o sistema inteiro funciona como produto demonstrável e que os dados experimentais são confiáveis.

## Cenários obrigatórios

1. digitar puzzle válido manualmente e resolver com DFS;
2. resetar e resolver o mesmo puzzle com GBFS;
3. pausar animação;
4. avançar passo a passo;
5. mudar velocidade;
6. verificar backtracking da DFS;
7. verificar MRV/Degree/LCV/h na exibição do GBFS;
8. tentar duplicata em linha;
9. tentar duplicata em coluna;
10. tentar duplicata em bloco;
11. tentar puzzle insolúvel;
12. limpar tabuleiro;
13. executar benchmark silencioso;
14. confirmar que a comparação usa o mesmo estado inicial;
15. confirmar que a solução final de ambos é válida.

## Aceite final P3-DONE

- [ ] Todos os cenários acima passam.
- [ ] A aplicação não trava ao pausar/resetar.
- [ ] Não é possível editar pistas durante reprodução sem reset apropriado.
- [ ] Erros de validação são claros.
- [ ] Métricas aparecem corretamente.
- [ ] Eventos reais são reproduzidos sem depender do algoritmo internamente.
- [ ] Benchmark produz dados reutilizáveis no relatório.
- [ ] Há pelo menos um conjunto de resultados DFS x GBFS salvo para apresentação.

<details>
<summary>Dica 1 — Teste o fluxo como o professor usaria</summary>

Evite testar apenas chamando funções pelo console. Digite um Sudoku, escolha algoritmo, resolva, pause, compare e provoque erros deliberadamente.

</details>

<details>
<summary>Dica 2 — Faça uma lista de demonstração</summary>

Antes da apresentação, salvem 2 ou 3 puzzles que saibam exatamente quanto tempo aproximado levam e quais eventos interessantes exibem.

</details>

<details>
<summary>Dica 3 — Pseudocódigo do teste E2E principal</summary>

```text
carregar puzzle A
validar
executar DFS silencioso e guardar resultado
reproduzir eventos DFS
resetar para puzzle A
executar GBFS silencioso e guardar resultado
reproduzir eventos GBFS
abrir comparação
verificar que ambas soluções são válidas
verificar que puzzleKey é o mesmo
```

</details>

---

# 2. O que a Pessoa 3 deve saber explicar na apresentação

Ao terminar sua trilha, esta pessoa deve conseguir explicar sem ler código:

1. por que a busca foi separada da animação;
2. como `SearchEvent` permite demonstrar algoritmos diferentes;
3. por que o GBFS precisa de `stateSnapshot` ao trocar de ramo;
4. diferença entre tempo de busca e tempo de animação;
5. como a aplicação impede comparar puzzles diferentes injustamente;
6. como o benchmark reproduz os mesmos testes;
7. como a validação bloqueia a busca principal quando a entrada é inválida ou insolúvel;
8. quais métricas são úteis para comparar DFS e GBFS.
