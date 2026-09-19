# Roteiro completo — Desenvolvimento por uma única pessoa

## 1. Objetivo

Este roteiro reorganiza o mesmo projeto para uma única pessoa implementar tudo em sequência, mantendo as mesmas decisões do trabalho em grupo:

- estado 9x9 com `0` para vazio;
- DFS com backtracking como busca cega;
- Greedy Best-First Search como busca informada;
- MRV + Degree + LCV;
- `h(state)` para priorizar a fronteira;
- validação estrutural, local e global;
- eventos para animação;
- métricas comparáveis;
- interface interativa;
- benchmark reproduzível.

Cada passo contém dependências, objetivo, aceite e três níveis progressivos de dicas.

---

# Visão geral

```text
S-01 Organização e estado
  |
S-02 Regras, domínios e transição
  |
S-03 Contratos, métricas e eventos
  |
S-04 Testes-base e puzzles fixos
  |
  +--> S-05 DFS
  |       |
  |       +--> S-06 validação completa
  |
  +--> S-07 MRV + Degree
          |
          v
        S-08 LCV
          |
          +--> S-09 h(state) + fila
                    |
                    v
                  S-10 GBFS

S-03 + S-04 --> S-11 interface e controlador
S-11 + S-05 + S-10 --> S-12 animação real
S-06 + S-12 --> S-13 integração e validação visual
S-05 + S-10 --> S-14 benchmark e comparação
S-13 + S-14 --> S-15 testes finais e relatório
```

---

# S-01 — Organizar o projeto e formalizar o estado

## Dependências

Nenhuma.

## Objetivo

Transformar o protótipo baseado em uma matriz global em uma base capaz de representar vários estados independentes.

## Fazer

- separar conceitualmente `core`, `search`, `heuristics`, `validation`, `ui` e `experiments`;
- manter matriz 9x9;
- manter `0` como vazio;
- criar cópia profunda;
- preservar estado inicial;
- definir `SudokuState` e `Action`.

## Estruturas

```text
SudokuState
- board

Action
- x
- y
- value
```

## Aceite

- [ ] Alterar uma cópia não altera o original.
- [ ] O estado inicial pode ser restaurado.
- [ ] Dois estados diferentes coexistem.
- [ ] A interface futura poderá receber/exibir a mesma matriz usada pela busca.

<details><summary>Dica 1</summary>

Imagine dois ramos simultâneos: em um, a célula vale 2; no outro, 7. Isso exige matrizes independentes.

</details>

<details><summary>Dica 2</summary>

Crie operações pequenas como `cloneBoard`, `createState` e `getEmptyCells`.

</details>

<details><summary>Dica 3 — Pseudocódigo</summary>

```text
FUNÇÃO cloneBoard(board):
    RETORNAR nova lista contendo cópia de cada linha

FUNÇÃO createState(board):
    RETORNAR { board: cloneBoard(board) }
```

</details>

---

# S-02 — Consolidar regras, domínios, transição, objetivo e estado morto

## Dependências

- S-01.

## Objetivo

Criar o núcleo comum usado por qualquer algoritmo.

## Fazer

- verificar linha;
- verificar coluna;
- verificar bloco 3x3;
- verificar ação válida;
- calcular domínio;
- calcular todos os domínios;
- aplicar transição sem mutar o pai;
- detectar objetivo;
- detectar domínio zero.

## Estrutura

```text
CellDomain
- x
- y
- values
- size
```

## Aceite

- [ ] Domínios possuem apenas valores legais.
- [ ] Transição não modifica o pai.
- [ ] Estado completo inválido não passa como objetivo.
- [ ] Estado completo válido passa.
- [ ] Domínio zero é detectado.

<details><summary>Dica 1</summary>

Seu código atual já possui quase toda a lógica de linha, coluna, quadrante e possibilidades; generalize para qualquer estado recebido.

</details>

<details><summary>Dica 2</summary>

`isGoal`, `isDeadEnd` e `transition` devem ser perguntas/operações diferentes.

</details>

<details><summary>Dica 3 — Pseudocódigo</summary>

```text
FUNÇÃO getDomain(state,x,y):
    candidatos = []
    PARA value 1..9:
        SE value respeita linha, coluna e bloco:
            adicionar value
    RETORNAR candidatos

FUNÇÃO isDeadEnd(state):
    RETORNAR existe célula vazia com domínio tamanho 0
```

</details>

---

# S-03 — Definir contratos, métricas e eventos

## Dependências

- S-02.

## Objetivo

Garantir que DFS e GBFS retornem dados compatíveis com a mesma interface.

## Estruturas

```text
SolverResult
- status
- solution
- metrics
- events

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

ValidationResult
- valid
- code
- message
- cells
```

## Aceite

- [ ] As definições das métricas estão escritas e não mudarão entre algoritmos.
- [ ] Há eventos suficientes para DFS e GBFS.
- [ ] Campos opcionais foram definidos.
- [ ] A interface poderá consumir um único tipo de resultado.

<details><summary>Dica 1</summary>

Defina agora o que significa “estado explorado” e “estado gerado”; mudar isso depois invalida comparações.

</details>

<details><summary>Dica 2</summary>

Campos que não se aplicam podem ficar em `0` ou `null`, mas escolha uma convenção única.

</details>

<details><summary>Dica 3 — Pseudocódigo</summary>

```text
FUNÇÃO createEmptyMetrics():
    RETORNAR todos os campos numéricos iniciados em zero
```

</details>

---

# S-04 — Criar puzzles fixos, mocks e testes da base

## Dependências

- S-03.

## Objetivo

Ter casos reproduzíveis antes de implementar os algoritmos completos.

## Casos mínimos

- válido fácil;
- válido médio;
- válido difícil;
- completo válido;
- duplicata em linha;
- duplicata em coluna;
- duplicata em bloco;
- domínio zero;
- insolúvel sem duplicata imediata;
- empate MRV;
- desempate Degree;
- exemplo LCV.

Também criar `SolverResult` e eventos mock para desenvolver UI depois.

## Aceite

- [ ] Casos são matrizes fixas.
- [ ] Regras e domínio foram testados.
- [ ] Clonagem foi testada.
- [ ] Há eventos mock de DFS e GBFS.

<details><summary>Dica 1</summary>

Não use apenas o gerador aleatório para testes; bugs precisam ser reproduzíveis.

</details>

<details><summary>Dica 2</summary>

Um bom teste de base verifica respostas pequenas, como “o domínio aqui é `{2,5}`”.

</details>

<details><summary>Dica 3 — Pseudocódigo</summary>

```text
casos = {
  easy: matriz,
  duplicateRow: matriz,
  degreeTie: matriz,
  ...
}

PARA cada teste básico:
    executar função
    comparar com resultado esperado
```

</details>

---

# S-05 — Implementar DFS cega com backtracking

## Dependências

- S-04.

## Objetivo

Implementar a busca não informada.

## Política fixa

- primeira célula vazia em ordem de linha/coluna;
- candidatos `1..9` em ordem crescente;
- sem MRV, Degree ou LCV.

## Fazer

- busca recursiva ou pilha explícita;
- backtracking;
- eventos;
- modo silencioso;
- métricas.

## Aceite

- [ ] Resolve puzzle conhecido.
- [ ] Retorna insolúvel corretamente.
- [ ] Não usa heurística.
- [ ] Conta backtracks.
- [ ] Produz `SolverResult`.
- [ ] Não altera entrada.

<details><summary>Dica 1</summary>

Cada chamada responde se aquele estado pode levar a uma solução.

</details>

<details><summary>Dica 2</summary>

Ao falhar um filho, volte ao nível anterior e tente o próximo valor válido.

</details>

<details><summary>Dica 3 — Pseudocódigo</summary>

```text
FUNÇÃO dfs(state, depth):
    SE isGoal: retornar solução
    cell = primeira vazia

    PARA value 1..9:
        contar tentativa
        SE inválido: continuar
        child = transition(...)
        SE deadEnd: continuar
        result = dfs(child, depth+1)
        SE solucionou: retornar result
        contar backtrack

    retornar falha
```

</details>

---

# S-06 — Implementar validação completa do estado inicial

## Dependências

- S-05.

## Objetivo

Distinguir entrada inválida, insolúvel e válida.

## Fluxo

1. estrutura 9x9 e valores `0..9`;
2. duplicatas em linha, coluna e bloco;
3. domínio zero inicial;
4. DFS silenciosa para provar existência de pelo menos uma solução.

## Aceite

- [ ] Cada tipo de duplicata é detectado.
- [ ] Erros retornam coordenadas quando possível.
- [ ] Puzzle localmente válido mas insolúvel é detectado.
- [ ] Pré-validação não contamina métricas da execução principal.

<details><summary>Dica 1</summary>

Use um `ValidationResult`, não apenas booleano.

</details>

<details><summary>Dica 2</summary>

A busca silenciosa deve parar na primeira solução e não gerar eventos de animação.

</details>

<details><summary>Dica 3 — Pseudocódigo</summary>

```text
FUNÇÃO validateInitialBoard(board):
    validar estrutura
    validar unidades
    verificar domínio zero
    SE solveDFS(board, silent=true) não encontra solução:
        retornar UNSOLVABLE
    retornar VALID
```

</details>

---

# S-07 — Implementar MRV e Degree

## Dependências

- S-04.

## Objetivo

Escolher a célula mais restrita e desempatar pela influência sobre vizinhos vazios.

## Regras

- menor domínio vence;
- em empate, maior Degree vence;
- novo empate: menor linha, depois menor coluna.

## Aceite

- [ ] MRV correto em caso preparado.
- [ ] Degree correto em empate.
- [ ] Vizinhos únicos sem duplicação.
- [ ] Estado com domínio zero é sinalizado como inconsistente.

<details><summary>Dica 1</summary>

MRV e Degree não são somados; Degree só entra depois do empate de MRV.

</details>

<details><summary>Dica 2</summary>

Use um `Set` de coordenadas para não contar o mesmo vizinho pela linha e pelo bloco.

</details>

<details><summary>Dica 3 — Pseudocódigo</summary>

```text
domains = todos domínios vazios
min = menor size
empatadas = domains com size == min
calcular degree das empatadas
ordenar degree desc, y asc, x asc
retornar primeira
```

</details>

---

# S-08 — Implementar LCV

## Dependências

- S-07.

## Objetivo

Ordenar candidatos da célula selecionada pelo menor impacto sobre os vizinhos.

## Fazer

- calcular domínios dos vizinhos antes;
- simular cada candidato;
- medir reduções;
- descartar contradição imediata;
- ordenar por impacto e depois valor.

## Aceite

- [ ] Menor impacto vem primeiro.
- [ ] Empate usa valor crescente.
- [ ] Simulações não alteram o pai.
- [ ] Domínio zero produzido pelo candidato é reconhecido.

<details><summary>Dica 1</summary>

LCV escolhe valor, não célula.

</details>

<details><summary>Dica 2</summary>

Impacto é a soma de `tamanhoAntes - tamanhoDepois` nos vizinhos vazios.

</details>

<details><summary>Dica 3 — Pseudocódigo</summary>

```text
PARA value em candidatos:
    child = transition(state, value)
    SE gera domínio zero: descartar
    impact = soma das reduções nos vizinhos
ordenar por impact crescente e value crescente
```

</details>

---

# S-09 — Implementar `h(state)` e a fila de prioridade

## Dependências

- S-07.

## Objetivo

Preparar a prioridade global do GBFS.

## Função

```text
E = células vazias
m = menor domínio
U = soma(|D(c)| - 1)
h = E + U/9 + m/9
```

## Fila

Ordenar nós por:

1. menor `h`;
2. menor `E`;
3. menor `U`;
4. ordem de inserção.

## Aceite

- [ ] `E`, `m`, `U` batem com cálculo manual.
- [ ] Estado inconsistente é marcado.
- [ ] Fila retira menor prioridade corretamente.
- [ ] Empate é determinístico.

<details><summary>Dica 1</summary>

Retorne os componentes de `h` durante desenvolvimento para facilitar depuração.

</details>

<details><summary>Dica 2</summary>

Uma lista ordenada pode ser suficiente; heap é opcional.

</details>

<details><summary>Dica 3 — Pseudocódigo</summary>

```text
evaluate(state):
    calcular E, U, m
    h = E + U/9 + m/9
    retornar componentes

compare(a,b):
    comparar h, E, U, insertionOrder nessa ordem
```

</details>

---

# S-10 — Implementar o Greedy Best-First Search

## Dependências

- S-08.
- S-09.

## Objetivo

Combinar fronteira global com expansão local heurística.

## Fluxo

- inserir estado inicial com `h`;
- retirar melhor nó;
- testar objetivo;
- podar inconsistência;
- selecionar célula por MRV + Degree;
- ordenar valores por LCV;
- gerar filhos;
- calcular `h` dos filhos;
- inserir filhos consistentes;
- repetir.

## Aceite

- [ ] Usa fila de prioridade.
- [ ] Usa MRV + Degree + LCV.
- [ ] Usa `h(state)` para escolher expansão global.
- [ ] Resolve puzzle conhecido.
- [ ] Retorna insolúvel quando fronteira acaba.
- [ ] Produz eventos, métricas e modo silencioso.

<details><summary>Dica 1</summary>

O próximo nó pode vir de outro ramo; não continue automaticamente no primeiro filho como a DFS.

</details>

<details><summary>Dica 2</summary>

LCV organiza a geração local, mas `h` ainda decide a próxima expansão global.

</details>

<details><summary>Dica 3 — Pseudocódigo</summary>

```text
frontier.add(initial)
ENQUANTO frontier não vazia:
    node = frontier.popBest()
    SE goal: retornar solved
    cell = MRV+Degree(node)
    values = LCV(node,cell)
    PARA value em values:
        child = transition(...)
        eval = h(child)
        SE consistente:
            frontier.add(child, eval)
retornar unsolvable
```

</details>

---

# S-11 — Implementar interface 9x9 e controlador de execução

## Dependências

- S-03.
- S-04.

## Objetivo

Criar uma UI funcional antes de integrar algoritmos reais, usando mocks inicialmente.

## Fazer

- grade 9x9;
- blocos 3x3 visíveis;
- entrada manual;
- limpar/resetar;
- selecionar DFS/GBFS;
- estados `IDLE`, `VALIDATING`, `SOLVING`, `PLAYING`, `PAUSED`, `FINISHED`, `ERROR`;
- chamar validator e solver por interface comum.

## Aceite

- [ ] UI converte para/de matriz 9x9.
- [ ] Pistas originais são distinguíveis.
- [ ] Algoritmo pode ser selecionado.
- [ ] Fluxo funciona com mocks.
- [ ] Não há duas execuções simultâneas.

<details><summary>Dica 1</summary>

Não deixe o HTML ser a única fonte de dados; mantenha representação estruturada.

</details>

<details><summary>Dica 2</summary>

O controlador deve conhecer apenas `validate` e `solvers[algorithm]`.

</details>

<details><summary>Dica 3 — Pseudocódigo</summary>

```text
board = readBoard()
validation = validate(board)
SE inválido: mostrar erro
SENÃO:
    result = solvers[selected](board)
    guardar result
```

</details>

---

# S-12 — Implementar player de eventos e animação

## Dependências

- S-05.
- S-10.
- S-11.

## Objetivo

Reproduzir o processo de busca sem acoplar o algoritmo ao tempo da interface.

## Fazer

- índice do evento atual;
- play;
- pause;
- next step;
- velocidade;
- reset;
- aplicação de `stateSnapshot`;
- destaque de backtracking, poda, célula e valor;
- painel de MRV/Degree/LCV/h para GBFS.

## Aceite

- [ ] DFS mostra backtracking.
- [ ] GBFS troca corretamente entre snapshots.
- [ ] Pausa funciona.
- [ ] Um passo avança um evento.
- [ ] Velocidade não muda métricas.

<details><summary>Dica 1</summary>

Trate a sequência de eventos como um vídeo já gravado.

</details>

<details><summary>Dica 2</summary>

`NODE_EXPANDED` do GBFS deve poder substituir o tabuleiro inteiro.

</details>

<details><summary>Dica 3 — Pseudocódigo</summary>

```text
nextStep():
    event = events[index]
    applyEvent(event)
    index++

applyEvent(event):
    SE snapshot: renderBoard(snapshot)
    aplicar destaque conforme type
```

</details>

---

# S-13 — Integrar validação real, mensagens e estados visuais

## Dependências

- S-06.
- S-12.

## Objetivo

Fechar o fluxo solicitado no enunciado: entrada manual -> validação -> busca -> animação -> resultado.

## Fazer

- destacar células inválidas;
- informar estrutura inválida;
- informar regra violada;
- informar insolubilidade;
- impedir solver principal em caso inválido/insolúvel;
- habilitar reset/limpar corretamente.

## Aceite

- [ ] Todos os erros exigidos aparecem de forma clara.
- [ ] Células relacionadas são destacadas quando possível.
- [ ] Puzzle válido inicia o algoritmo escolhido.
- [ ] Puzzle insolúvel não inicia animação de resolução.

<details><summary>Dica 1</summary>

Use `ValidationResult.code` para decidir o comportamento visual.

</details>

<details><summary>Dica 2</summary>

Limpe destaques antigos antes de exibir uma nova validação.

</details>

<details><summary>Dica 3 — Pseudocódigo</summary>

```text
validation = validateInitialBoard(board)
SE !valid:
    clearOldErrors()
    highlight(validation.cells)
    showMessage(validation.message)
    RETORNAR
runSelectedSolver()
```

</details>

---

# S-14 — Implementar benchmark e comparação DFS x GBFS

## Dependências

- S-05.
- S-10.

## Objetivo

Produzir dados experimentais justos para o relatório.

## Fazer

Para cada puzzle fixo:

- validar;
- executar DFS silenciosa;
- executar GBFS silencioso;
- usar cópias independentes do mesmo estado;
- repetir N vezes se quiser medir tempo com mais robustez;
- registrar todas as métricas;
- calcular mediana/média de tempo;
- mostrar tabela comparativa.

## Aceite

- [ ] Mesmo puzzle em ambos os algoritmos.
- [ ] Sem animação durante benchmark.
- [ ] Resultados são reproduzíveis.
- [ ] Métricas ficam armazenadas por puzzle e algoritmo.
- [ ] Soluções finais são validadas.

<details><summary>Dica 1</summary>

Tempo pode variar; contagens de estados devem ser determinísticas se os desempates também forem.

</details>

<details><summary>Dica 2</summary>

Use `puzzleId` e uma chave/serialização do estado para impedir comparações acidentais entre entradas diferentes.

</details>

<details><summary>Dica 3 — Pseudocódigo</summary>

```text
PARA puzzle em conjunto:
    PARA solver em [DFS,GBFS]:
        PARA run 1..N:
            result = solver(cloneBoard(puzzle), silent=true)
            registrar result.metrics
resumir tempos e contagens
```

</details>

---

# S-15 — Testes finais, relatório e preparação da apresentação

## Dependências

- S-13.
- S-14.

## Objetivo

Transformar o projeto implementado em uma entrega demonstrável e argumentada.

## Testes finais mínimos

1. entrada válida fácil;
2. entrada válida média;
3. entrada válida difícil;
4. completo válido;
5. duplicata em linha;
6. duplicata em coluna;
7. duplicata em bloco;
8. insolúvel sem duplicata inicial;
9. domínio zero;
10. MRV correto;
11. Degree correto;
12. LCV correto;
13. `h(state)` correto;
14. DFS e GBFS no mesmo puzzle;
15. pausa/passo/reset;
16. benchmark silencioso.

## Conteúdo mínimo do relatório

- definição de estado, inicial, objetivo, ações e transição;
- justificativa da matriz 9x9;
- DFS e política fixa;
- GBFS;
- MRV;
- Degree;
- LCV;
- `h(state)`;
- estruturas de fronteira;
- validação;
- métricas e suas definições;
- metodologia experimental;
- tabelas de resultados;
- análise das diferenças observadas;
- limitações, como o gerador não garantir solução única.

## Aceite final

- [ ] Sistema atende todos os itens do enunciado.
- [ ] Há pelo menos alguns puzzles fixos demonstráveis.
- [ ] Tabela DFS x GBFS usa o mesmo estado inicial.
- [ ] O relatório explica as heurísticas sem depender do código.
- [ ] A apresentação pode demonstrar um erro de entrada e uma resolução válida.
- [ ] Todos os conceitos podem ser explicados verbalmente.

<details><summary>Dica 1</summary>

Não deixe a apresentação depender de um Sudoku aleatório. Escolha puzzles conhecidos que tenham comportamento interessante e tempo seguro.

</details>

<details><summary>Dica 2</summary>

No relatório, diferencie claramente fato medido de interpretação. Exemplo: “GBFS explorou 420 estados contra 8.200 da DFS neste puzzle” é medida; “as heurísticas reduziram a ramificação neste caso” é interpretação apoiada pelos dados.

</details>

<details><summary>Dica 3 — Roteiro possível da demonstração</summary>

```text
1. explicar representação
2. inserir erro proposital e mostrar validação
3. carregar puzzle fixo
4. executar DFS e mostrar backtracking
5. executar GBFS e mostrar MRV/Degree/LCV/h
6. abrir tabela de métricas
7. explicar por que os resultados diferiram
```

</details>
