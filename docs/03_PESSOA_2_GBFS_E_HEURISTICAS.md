# Pessoa 2 — Greedy Best-First Search, MRV, Degree, LCV e heurística de estado

## 1. Papel da Pessoa 2

A Pessoa 2 começa **somente depois do marco BASE-V1**, construído pelos três integrantes em conjunto.

Sua trilha é responsável pela busca informada do trabalho. Ela possui duas camadas de decisão:

1. decidir **como expandir um estado** usando MRV + Degree + LCV;
2. decidir **qual estado da fronteira expandir primeiro** usando a função `h(state)` do Greedy Best-First Search.

Esta separação é importante para que a implementação seja realmente um GBFS e não apenas um backtracking com uma boa ordem de células.

---

# Mapa de dependências

```text
BASE-V1
  |
  +--> P2-01 MRV + Degree
  |        |
  |        v
  |     P2-02 LCV
  |        |
  |        +------------------+
  |                           |
  +--> P2-03 h(state) --------+--> P2-04 fila de prioridade
                                  |
                                  v
                              P2-05 GBFS
                                  |
                                  v
                              P2-06 eventos/métricas
                                  |
                                  v
                              P2-07 testes e entrega
```

### Dependências externas

- P2-01 a P2-07 dependem apenas de **BASE-V1** e de passos anteriores da própria Pessoa 2.
- A Pessoa 3 pode desenvolver a interface com mocks e só precisa esperar **P2-06** para integrar o GBFS real.
- A integração final deve preferir a versão aprovada em **P2-07**.

---

# P2-01 — Implementar seleção de célula com MRV e desempate por Degree

## Dependências

- BASE-V1.

## Objetivo

Escolher, dentro de um estado, a célula vazia mais promissora para expansão.

## Parte A — MRV

Para cada célula vazia:

1. calcular seu domínio;
2. observar `size`;
3. selecionar a menor quantidade de valores restantes.

Formalmente:

```text
minimizar |D(c)|
```

## Parte B — Degree

Se duas ou mais células empatarem no MRV:

1. obter os vizinhos vazios únicos de cada célula;
2. contar quantos compartilham linha, coluna ou bloco;
3. escolher a célula com maior grau.

Formalmente:

```text
degree(c) = quantidade de vizinhos vazios únicos
```

## Desempate final

Se MRV e Degree ainda empatarem:

1. menor linha;
2. menor coluna.

Isso torna a busca reproduzível.

## Estrutura útil

```text
CellDomain
- x
- y
- values
- size
- degree
```

## Aceite

- [ ] MRV escolhe corretamente a menor quantidade de candidatos.
- [ ] Célula com domínio zero não é tratada como escolha normal; o estado deve ser podado.
- [ ] Degree só é usado em empate de MRV.
- [ ] Vizinhos duplicados não são contados duas vezes.
- [ ] Células preenchidas não contam como vizinhos ativos.
- [ ] Empate final é determinístico por coordenadas.
- [ ] A função não modifica o estado.

<details>
<summary>Dica 1 — MRV primeiro, Degree depois</summary>

Não some as duas heurísticas em uma única nota. Primeiro reduza o conjunto às células com menor domínio; somente dentro desse conjunto use o Degree.

</details>

<details>
<summary>Dica 2 — Como evitar vizinho duplicado</summary>

Uma célula pode compartilhar ao mesmo tempo a linha e o bloco 3x3. Use uma estrutura de conjunto baseada em coordenadas, como uma chave `"x,y"`, para contá-la uma única vez.

</details>

<details>
<summary>Dica 3 — Pseudocódigo possível</summary>

```text
FUNÇÃO selectCellMRVDegree(state):
    domains = calcular domínios das células vazias

    SE algum domain.size == 0:
        RETORNAR estado inconsistente

    minSize = menor domain.size
    empatadas = domains onde size == minSize

    PARA cada domain EM empatadas:
        domain.degree = countEmptyUniqueNeighbors(state, domain.cell)

    ordenar empatadas por:
        degree decrescente
        y crescente
        x crescente

    RETORNAR primeira
```

</details>

---

# P2-02 — Implementar LCV para ordenar candidatos

## Dependências

- P2-01.
- Função de transição da BASE-V1.

## Objetivo

Depois de escolher a célula com MRV + Degree, ordenar os valores candidatos pela regra **Least Constraining Value**.

## Ideia

Para cada valor candidato da célula selecionada:

1. simular a atribuição;
2. observar as células vizinhas vazias;
3. recalcular seus domínios;
4. medir quantas possibilidades foram removidas;
5. tentar primeiro o valor que causa menor impacto.

## Impacto

Para candidato `v`:

```text
impact(v) = soma das reduções de domínio dos vizinhos
```

Exemplo:

```text
antes: vizinho A = {1,2,3}
depois: vizinho A = {1,3}
impacto local = 1
```

Some isso para todos os vizinhos relevantes.

## Contradição imediata

Se um candidato provocar domínio zero em algum vizinho, recomenda-se descartá-lo antes de gerar o filho para a fronteira.

## Desempate

Se dois candidatos tiverem o mesmo impacto, usar valor numérico crescente.

## Aceite

- [ ] Todos os candidatos legais são avaliados.
- [ ] Impacto é calculado apenas sobre vizinhos relevantes.
- [ ] Domínios anteriores e posteriores são comparados corretamente.
- [ ] Candidato que gera contradição imediata é identificado.
- [ ] Menor impacto vem primeiro.
- [ ] Empate é resolvido por valor crescente.
- [ ] A simulação não modifica o estado original.

<details>
<summary>Dica 1 — O LCV não escolhe a célula</summary>

MRV + Degree decide **onde** atuar. LCV decide **qual valor tentar primeiro** naquela célula.

</details>

<details>
<summary>Dica 2 — Calcule o “antes” uma vez</summary>

Para os vizinhos da célula escolhida, obtenha os domínios antes de testar qualquer valor. Depois compare com os domínios após cada simulação.

</details>

<details>
<summary>Dica 3 — Pseudocódigo possível</summary>

```text
FUNÇÃO orderValuesLCV(state, cell):
    candidates = getDomain(state, cell)
    baseDomains = domínios dos vizinhos vazios
    avaliados = []

    PARA value EM candidates:
        child = transition(state, {cell, value})

        SE algum vizinho fica com domínio zero:
            marcar candidato como contraditório
            CONTINUAR

        impact = 0
        PARA cada vizinho:
            before = tamanho do domínio antes
            after = tamanho do domínio depois
            impact += before - after

        avaliados.adicionar({value, impact})

    ordenar por impact crescente e value crescente
    RETORNAR valores ordenados
```

</details>

---

# P2-03 — Implementar a heurística de prioridade `h(state)`

## Dependências

- BASE-V1.

## Objetivo

Dar ao GBFS uma forma de comparar estados diferentes que estão simultaneamente na fronteira.

MRV, Degree e LCV sozinhos não fazem isso.

## Grandezas definidas no documento geral

Para estado `s`:

```text
E(s) = número de células vazias
m(s) = menor tamanho de domínio entre células vazias
U(s) = soma de (|D(c)| - 1) para todas as células vazias
```

No estado objetivo:

```text
m(s) = 0
```

## Função adotada

```text
h(s) = E(s) + U(s) / 9 + m(s) / 9
```

Menor `h` significa estado mais prioritário.

## Regras

- estado com domínio zero deve ser podado antes de ser considerado normalmente;
- cada cálculo de `h` incrementa `heuristicEvaluations` quando executado dentro da busca;
- a função deve ser pura: recebe estado, devolve score e dados auxiliares, sem modificá-lo.

## Estrutura útil

```text
HeuristicEvaluation
- h
- emptyCount
- uncertainty
- minDomain
- inconsistent
```

## Aceite

- [ ] `E(s)` é contado corretamente.
- [ ] `U(s)` segue a definição comum.
- [ ] `m(s)` é calculado corretamente.
- [ ] Estado objetivo recebe valores coerentes.
- [ ] Estado com domínio zero é marcado inconsistente.
- [ ] Dois estados conhecidos podem ser comparados manualmente e o resultado bate.
- [ ] A função não usa `g(n)` nem custo acumulado, pois o algoritmo é GBFS, não A*.

<details>
<summary>Dica 1 — Separe os componentes da nota</summary>

Durante os testes, retornar também `E`, `U` e `m` ajuda a descobrir por que um `h` ficou inesperado.

</details>

<details>
<summary>Dica 2 — Cuidado com estado objetivo</summary>

Se não há células vazias, não existe “menor domínio” para calcular. Use a convenção definida no projeto: `m = 0`.

</details>

<details>
<summary>Dica 3 — Pseudocódigo possível</summary>

```text
FUNÇÃO evaluateState(state):
    domains = domínios das células vazias

    SE algum domínio tem size 0:
        RETORNAR { inconsistent: true }

    E = quantidade de domains

    SE E == 0:
        m = 0
        U = 0
    SENÃO:
        m = menor size
        U = soma(size - 1 para cada domain)

    h = E + U/9 + m/9

    RETORNAR {h, emptyCount:E, uncertainty:U, minDomain:m, inconsistent:false}
```

</details>

---

# P2-04 — Implementar fronteira com prioridade e desempates determinísticos

## Dependências

- P2-03.

## Objetivo

Criar a estrutura que mantém os estados gerados aguardando expansão.

O GBFS sempre retira o nó de menor `h`.

## Campos recomendados no nó

```text
SearchNode
- state
- depth
- action
- parentId ou parent, opcional
- heuristicScore
- emptyCount
- uncertainty
- insertionOrder
```

## Critérios de ordenação

1. menor `heuristicScore`;
2. menor `emptyCount`;
3. menor `uncertainty`;
4. menor `insertionOrder`.

## Estrutura física

Para o tamanho típico deste trabalho, duas alternativas são aceitáveis:

- fila de prioridade/heap;
- lista ordenada após inserção.

Uma heap é mais eficiente e didaticamente interessante, mas uma lista pode ser suficiente se o grupo quiser reduzir implementação auxiliar. A decisão deve ser documentada.

## Aceite

- [ ] O menor `h` sempre sai primeiro.
- [ ] Empates seguem os critérios definidos.
- [ ] `insertionOrder` garante estabilidade final.
- [ ] É possível consultar o tamanho atual da fronteira.
- [ ] `maxFrontier` pode ser atualizado pela busca.
- [ ] A estrutura não altera os estados armazenados.

<details>
<summary>Dica 1 — Teste a fila isoladamente</summary>

Antes do GBFS, insira nós artificiais com scores conhecidos e retire todos. A ordem de saída deve ser previsível.

</details>

<details>
<summary>Dica 2 — Lista ordenada é válida para o trabalho</summary>

Se a disciplina não exigir estruturas de dados avançadas, o foco pode continuar sendo o algoritmo de busca. Só documente a complexidade e a escolha.

</details>

<details>
<summary>Dica 3 — Pseudocódigo de comparação</summary>

```text
FUNÇÃO compareNodes(a, b):
    SE a.h != b.h: retornar a.h - b.h
    SE a.emptyCount != b.emptyCount: retornar a.emptyCount - b.emptyCount
    SE a.uncertainty != b.uncertainty: retornar a.uncertainty - b.uncertainty
    RETORNAR a.insertionOrder - b.insertionOrder
```

</details>

---

# P2-05 — Implementar o Greedy Best-First Search completo

## Dependências

- P2-01.
- P2-02.
- P2-03.
- P2-04.

## Objetivo

Construir o resolvedor informado combinando corretamente as duas camadas heurísticas.

## Fluxo de expansão de um nó

```text
retirar melhor nó da fronteira
        |
        v
é objetivo? ---- sim ---> solução
        |
       não
        v
há domínio zero? -- sim --> podar
        |
       não
        v
MRV
        |
Degree em empate
        |
        v
LCV nos candidatos
        |
        v
gerar filhos válidos
        |
        v
calcular h(filho)
        |
        v
inserir filhos consistentes na fronteira
```

## Visitados

Em Sudoku, como cada transição preenche exatamente uma célula e nunca remove preenchimentos do estado em um mesmo ramo, ciclos tradicionais não são esperados. Ainda assim, pode ser útil manter uma serialização de estados já processados para evitar duplicações geradas por caminhos equivalentes, se a implementação produzir esse caso.

Não é obrigatório se os testes mostrarem que não há geração duplicada relevante, mas a decisão deve ser documentada.

## Importante sobre “greedy”

O GBFS escolhe o próximo estado apenas com base em `h(state)` e seus desempates. Ele não soma profundidade/custo ao score como em A*.

## Aceite

- [ ] Estado inicial entra na fronteira com `h` calculado.
- [ ] Sempre é retirado o nó prioritário.
- [ ] Cada expansão usa MRV + Degree.
- [ ] Valores são ordenados por LCV.
- [ ] Filhos inconsistentes são podados.
- [ ] Filhos consistentes recebem `h` e entram na fronteira.
- [ ] Estado objetivo encerra a busca.
- [ ] Fronteira vazia retorna `unsolvable`.
- [ ] Estado inicial não é modificado.
- [ ] O algoritmo não se comporta como DFS disfarçada.

<details>
<summary>Dica 1 — Observe a diferença para DFS</summary>

Depois de gerar filhos de um estado, o GBFS não precisa continuar no primeiro filho. Todos vão para a fronteira, e o próximo nó pode ser qualquer um deles ou até um nó gerado anteriormente, dependendo de `h`.

</details>

<details>
<summary>Dica 2 — O LCV ordena geração, não garante expansão imediata</summary>

O melhor valor segundo LCV tende a ser inserido primeiro, mas `h` ainda decide a prioridade global na fronteira.

</details>

<details>
<summary>Dica 3 — Pseudocódigo possível</summary>

```text
FUNÇÃO solveGBFS(initialState):
    frontier = nova fila de prioridade
    eval0 = evaluateState(initialState)
    inserir node(initialState, eval0)

    ENQUANTO frontier não vazia:
        node = retirar melhor
        incrementar exploredStates

        SE isGoal(node.state):
            RETORNAR solved

        SE isDeadEnd(node.state):
            incrementar prunedStates
            CONTINUAR

        cell = selectCellMRVDegree(node.state)
        values = orderValuesLCV(node.state, cell)

        PARA value EM values:
            incrementar candidateAttempts
            child = transition(node.state, {cell, value})
            incrementar generatedStates

            eval = evaluateState(child)
            incrementar heuristicEvaluations

            SE eval.inconsistent:
                incrementar prunedStates
                CONTINUAR

            inserir child na frontier com eval.h
            atualizar maxFrontier

    RETORNAR unsolvable
```

</details>

---

# P2-06 — Instrumentar GBFS com eventos e métricas comparáveis

## Dependências

- P2-05.
- Contratos de BASE-V1.

## Objetivo

Entregar dados suficientes para a interface demonstrar não apenas o preenchimento, mas também o raciocínio heurístico.

## Eventos úteis do GBFS

Além dos eventos comuns, registrar quando aplicável:

- célula escolhida;
- domínio da célula;
- valor de MRV;
- Degree usado no desempate;
- ordem dos candidatos após LCV;
- impacto de cada candidato;
- `h(state)` do nó expandido;
- tamanho atual da fronteira.

## Snapshot é particularmente importante no GBFS

O próximo nó expandido pode não ser filho visual direto do nó mostrado anteriormente. Portanto, `NODE_EXPANDED` deve carregar `stateSnapshot` suficiente para a interface trocar o tabuleiro para o estado correto.

## Métricas

Preencher corretamente:

```text
elapsedMs
exploredStates
generatedStates
candidateAttempts
deadEnds
prunedStates
solutionDepth
maxFrontier
heuristicEvaluations
backtracks = 0 ou não aplicável
```

## Aceite

- [ ] Eventos permitem visualizar MRV, Degree e LCV.
- [ ] `NODE_EXPANDED` permite restaurar o estado correto.
- [ ] `maxFrontier` representa o maior tamanho real da fila.
- [ ] `heuristicEvaluations` é incrementado de forma consistente.
- [ ] Tempo mede busca, não reprodução dos eventos.
- [ ] Há modo silencioso para benchmark.
- [ ] Resultado segue exatamente `SolverResult`.

<details>
<summary>Dica 1 — Separe evento de geração e expansão</summary>

Um filho pode ser gerado agora e expandido muito depois. Por isso `CHILD_GENERATED` e `NODE_EXPANDED` representam momentos diferentes.

</details>

<details>
<summary>Dica 2 — Informações heurísticas podem ficar em metadata</summary>

Se o contrato permitir um campo de metadados, ele pode transportar:

```text
mrvSize
degree
lcvOrdering
h
```

sem tornar todos obrigatórios para a DFS.

</details>

<details>
<summary>Dica 3 — Pseudocódigo de evento</summary>

```text
emit NODE_EXPANDED {
    stateSnapshot: node.state.board,
    heuristicScore: node.h,
    frontierSize: frontier.size,
    depth: node.depth
}

emit CELL_SELECTED {
    cell,
    candidates,
    metadata: {mrvSize, degree, lcvOrdering}
}
```

</details>

---

# P2-07 — Testar, estabilizar e entregar a trilha da Pessoa 2

## Dependências

- P2-01 a P2-06.

## Objetivo

Demonstrar isoladamente que cada heurística funciona e que o GBFS realmente usa a fronteira de forma informada.

## Testes obrigatórios

### MRV

- caso em que existe uma célula claramente com menor domínio;
- confirmação da coordenada escolhida.

### Degree

- duas células com mesmo MRV;
- uma possui mais vizinhos vazios;
- confirmar que ela vence.

### LCV

- célula com pelo menos dois candidatos;
- candidato A remove mais opções que B;
- confirmar B antes de A.

### `h(state)`

- estados com componentes `E`, `U`, `m` calculáveis manualmente;
- confirmar score.

### Fila

- nós artificiais em ordem misturada;
- confirmar desempates.

### GBFS

- puzzle solucionável;
- puzzle insolúvel;
- solução final válida;
- fronteira realmente pode escolher um estado diferente do último filho gerado;
- modo silencioso;
- métricas coerentes.

## Aceite final P2-DONE

- [ ] Todas as heurísticas passam testes isolados.
- [ ] O GBFS usa `h(state)` para prioridade global.
- [ ] MRV + Degree + LCV são usados na expansão local.
- [ ] `SolverResult` segue BASE-V1.
- [ ] Eventos reais podem substituir os mocks da Pessoa 3.
- [ ] A Pessoa 3 consegue iniciar o GBFS pela mesma interface de solver usada pela DFS.
- [ ] Um exemplo de integração está documentado.

<details>
<summary>Dica 1 — Teste as heurísticas antes do solver completo</summary>

Se o GBFS resolver um puzzle incorretamente, será muito mais difícil descobrir se o erro está no MRV, LCV, `h` ou na fila. Testes unitários reduzem esse espaço de investigação.

</details>

<details>
<summary>Dica 2 — Não avalie a qualidade só pelo tempo</summary>

Durante desenvolvimento, compare também sequência de expansões, estados explorados, tamanho da fronteira e scores. Um bug pode parecer “rápido” simplesmente porque está podando estados válidos.

</details>

<details>
<summary>Dica 3 — Pseudocódigo de teste de consistência</summary>

```text
result = solveGBFS(puzzle)

SE result.status == solved:
    assert isGoal(result.solution)
    assert result.metrics.exploredStates > 0
    assert result.metrics.heuristicEvaluations > 0

assert puzzle original não foi modificado
assert eventos NODE_EXPANDED possuem snapshots válidos
```

</details>

---

# 2. O que a Pessoa 2 deve saber explicar na apresentação

Ao terminar sua trilha, esta pessoa deve conseguir explicar sem ler código:

1. diferença entre heurística de variável e heurística de estado;
2. por que MRV reduz o fator de ramificação;
3. por que Degree só entra em empate;
4. o que o LCV tenta preservar;
5. como `h(state)` é calculada e por que menor score recebe prioridade;
6. diferença entre GBFS e A*;
7. por que uma fila de prioridade é necessária;
8. por que o próximo estado do GBFS pode não ser o filho do estado anteriormente mostrado.
