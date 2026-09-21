# Sudoku como problema de busca — Referência geral do projeto

## 1. Objetivo deste documento

Este documento é a referência comum para o grupo. Ele fixa as regras conceituais, as estruturas mínimas, as definições das métricas, as heurísticas e o comportamento esperado do sistema para que as três partes sejam implementadas de forma compatível.

O projeto terá obrigatoriamente dois resolvedores:

1. **Busca cega:** DFS (Depth-First Search) com backtracking.
2. **Busca heurística:** Greedy Best-First Search (GBFS), usando:
    - MRV para escolher a célula mais restrita;
    - Degree Heuristic para desempatar células com o mesmo MRV;
    - LCV para ordenar os valores candidatos;
    - uma função de prioridade de estado para ordenar a fronteira do GBFS.

A interface deverá permitir entrada manual, seleção do algoritmo, visualização animada do processo, validação do estado inicial e comparação por métricas.

---

## 2. Formalização do problema

### 2.1 Estado

Um estado é uma configuração parcial ou completa do Sudoku, representada por uma matriz `9 x 9`.

- Valores de `1` a `9`: células preenchidas.
- Valor `0`: célula vazia.

A matriz é uma representação simples, visualmente compatível com a interface e suficiente para aplicar as restrições do Sudoku.

### 2.2 Estado inicial

É a matriz informada pelo usuário ou produzida pelo gerador antes do início da resolução.

O estado inicial precisa ser preservado separadamente do estado de trabalho, principalmente para:

- distinguir pistas originais de valores inseridos pela busca;
- permitir reset da animação;
- executar os dois algoritmos sobre exatamente o mesmo problema;
- garantir comparação justa.

### 2.3 Estado objetivo

Um estado é objetivo quando:

- não possui células vazias;
- nenhuma linha contém repetição de `1..9`;
- nenhuma coluna contém repetição de `1..9`;
- nenhum bloco `3 x 3` contém repetição de `1..9`.

Como cada linha possui 9 células e só pode conter números de `1..9` sem repetição, uma matriz completa sem violações representa uma solução válida.

### 2.4 Ação / operador

Uma ação consiste em:

> selecionar uma célula vazia e atribuir a ela um valor que não viole linha, coluna ou bloco 3x3.

Uma forma conceitual de representar uma ação é:

```text
{
  x: coluna,
  y: linha,
  valor: 1..9
}
```

### 2.5 Função de transição

A função de transição recebe:

```text
estado atual + ação válida
```

E produz:

```text
novo estado
```

**Regra obrigatória:** o novo estado não deve alterar o estado pai. Em busca com fronteira, mutar matrizes compartilhadas pode corromper outros nós que ainda serão explorados.

### 2.6 Custo de ação

Cada preenchimento pode ser considerado custo `1`.

Como o trabalho compara DFS e GBFS, esse custo não será usado para calcular uma função `g(n)` como ocorreria em A\*, mas é útil para definir profundidade e quantidade de passos da solução.

---

## 3. Regras do Sudoku

Para uma posição `(x, y)` e candidato `v`, o movimento é válido se:

1. `v` não aparece na linha `y`;
2. `v` não aparece na coluna `x`;
3. `v` não aparece no bloco 3x3 de `(x, y)`.

### 3.1 Domínio de uma célula

O domínio de uma célula vazia é o conjunto de valores que podem ser inseridos naquele momento sem violar uma restrição local.

Exemplo:

```text
D(4, 2) = {2, 5, 8}
```

Logo:

```text
|D(4, 2)| = 3
```

O domínio é a base para MRV, Degree, LCV, detecção de estados mortos e para a função heurística do GBFS.

### 3.2 Estado morto

Se existir uma célula vazia com domínio vazio:

```text
D(x, y) = {}
```

então aquele estado não pode ser completado.

Ele deve ser descartado imediatamente pela busca.

Isso é **poda por inconsistência**, não uma solução.

---

## 4. Estruturas de dados comuns

Os nomes exatos no código podem variar, mas os conceitos abaixo devem permanecer consistentes para que as partes do grupo possam ser integradas.

### 4.1 Estado do Sudoku

Campos conceituais mínimos:

```text
SudokuState
- board: matriz 9x9
```

Campos úteis, mas opcionais dentro do próprio estado:

```text
- depth: profundidade
- lastMove: última ação aplicada
```

É aceitável guardar esses metadados no nó de busca em vez do estado.

### 4.2 Nó de busca

Estrutura recomendada:

```text
SearchNode
- state
- depth
- parentId ou parent
- action que produziu o nó
- heuristicScore, quando aplicável
- insertionOrder, para desempate determinístico da fila
```

O `parent` só é obrigatório se a implementação quiser reconstruir explicitamente o caminho final. Caso a própria matriz final e os eventos sejam suficientes, ele pode ser substituído por identificadores ou omitido.

### 4.3 Informação de domínio

Estrutura recomendada:

```text
CellDomain
- x
- y
- values: lista de candidatos
- size: quantidade de candidatos
- degree: quantidade de vizinhos vazios afetados, quando calculado
```

### 4.4 Resultado de um resolvedor

Todos os resolvedores devem retornar a mesma forma conceitual:

```text
SolverResult
- status: solved | unsolvable | invalid | cancelled
- solution: matriz final ou null
- metrics
- events
- solutionPath, opcional
```

### 4.5 Evento de animação

Contrato recomendado:

```text
SearchEvent
- sequence
- algorithm
- type
- stateSnapshot, quando necessário
- cell, quando aplicável
- value, quando aplicável
- candidates, quando aplicável
- heuristicScore, quando aplicável
- frontierSize, quando aplicável
- depth, quando aplicável
- reason, para explicar poda/backtracking
- metadata, opcional para informações específicas do algoritmo
```

Tipos úteis:

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

Não é necessário usar exatamente todos esses nomes. O importante é permitir que a interface explique o processo. Para transporte entre backend e frontend, `stateSnapshot` deve ser uma cópia simples da matriz 9x9, sem depender de métodos da classe de estado.

### 4.6 Métricas

Use definições únicas para os dois algoritmos.

Campos recomendados:

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
- backtracks, especialmente para DFS
```

#### Definições

**exploredStates**
Quantidade de estados efetivamente processados/expandidos.

**generatedStates**
Quantidade de estados filhos válidos efetivamente criados.

**candidateAttempts**
Quantidade de valores candidatos que o algoritmo analisou/tentou durante a busca.

**deadEnds**
Quantidade de estados nos quais a continuação se mostrou impossível.

**prunedStates**
Estados descartados antes de expansão completa, por exemplo por domínio zero.

**solutionDepth**
Quantidade de ações entre o estado inicial e a solução encontrada.

Em Sudoku, se cada transição preencher exatamente uma célula, normalmente essa profundidade será igual ao número de células vazias iniciais. Ela ainda deve ser exibida porque faz parte das métricas solicitadas, embora não seja a métrica mais discriminativa.

**maxFrontier**
Maior quantidade de nós aguardando exploração simultaneamente.

**heuristicEvaluations**
Quantidade de avaliações heurísticas realizadas. Para DFS pode permanecer `0`.

**backtracks**
Quantidade de vezes que uma atribuição válida feita pelo DFS precisou ser desfeita porque o ramo não levou à solução.

---

## 5. Busca cega: DFS com backtracking

### 5.1 Regra principal

A DFS não pode usar MRV, Degree ou LCV.

Para manter a comparação limpa, ela deve usar uma política fixa, por exemplo:

- encontrar a primeira célula vazia em ordem de linha e coluna;
- testar os números em ordem crescente `1..9`;
- aceitar somente movimentos válidos.

Verificar se uma ação viola as regras **não transforma a DFS em busca informada**. Isso apenas define quais ações são legais no problema.

### 5.2 Backtracking

Quando uma escolha conduz a um estado que não pode produzir solução:

1. desfaz-se conceitualmente a escolha;
2. incrementa-se a métrica de backtracking;
3. tenta-se o próximo valor disponível para aquela célula.

### 5.3 Propriedade importante

A DFS é usada como referência de busca não informada. Portanto, não deve receber nenhuma otimização baseada na quantidade de candidatos das células.

---

## 6. Busca heurística: Greedy Best-First Search

### 6.1 Por que não basta dizer “GBFS + MRV”

MRV é principalmente uma heurística de **seleção de variável** em problemas de satisfação de restrições. Ela responde:

> Qual célula vazia devo preencher agora?

Já o Greedy Best-First Search precisa também de uma regra para decidir:

> Entre todos os estados que estão na fronteira, qual estado devo expandir primeiro?

Por isso, o projeto terá dois níveis de heurística:

1. **Heurísticas de expansão do estado:** MRV + Degree + LCV.
2. **Heurística de prioridade do estado:** uma função `h(state)` usada pela fila de prioridade do GBFS.

Isso deixa a implementação conceitualmente correta e facilita a explicação na apresentação.

---

## 7. MRV — Minimum Remaining Values

### 7.1 Objetivo

Escolher a célula vazia com menor número de candidatos disponíveis.

Exemplo:

```text
A -> {1, 2, 7, 8}
B -> {3, 6}
C -> {5}
```

MRV escolhe `C`, pois:

```text
|D(C)| = 1
```

### 7.2 Intuição

A célula mais restrita tem menor fator de ramificação e tende a revelar contradições mais cedo.

### 7.3 Regra

Considere apenas células vazias com domínio não vazio.

Selecione aquela que minimize:

```text
|D(c)|
```

Se houver empate, aplique Degree Heuristic.

---

## 8. Degree Heuristic

### 8.1 Objetivo

Desempatar células com o mesmo MRV.

Entre duas células com igual quantidade de candidatos, escolha aquela que influencia a maior quantidade de outras células vazias.

### 8.2 Quem são os vizinhos

Os vizinhos de uma célula são as células que compartilham:

- mesma linha;
- mesma coluna;
- mesmo bloco 3x3.

Uma célula que aparece simultaneamente na mesma linha e no mesmo bloco deve ser contada apenas uma vez.

### 8.3 Grau

Defina:

```text
degree(c) = quantidade de vizinhos vazios únicos de c
```

O desempate escolhe:

```text
maior degree(c)
```

### 8.4 Desempate final determinístico

Se ainda houver empate:

- escolha a menor linha;
- depois a menor coluna.

Esse desempate torna testes e demonstrações reproduzíveis.

---

## 9. LCV — Least Constraining Value

### 9.1 Objetivo

Depois que MRV + Degree escolheram a célula, LCV decide em que ordem tentar seus valores.

Escolhe primeiro o valor que remove menos possibilidades das células vizinhas.

### 9.2 Impacto de um valor

Para cada candidato `v`:

1. simule a atribuição de `v` à célula escolhida;
2. recalcule os domínios dos vizinhos vazios;
3. conte quantos candidatos foram eliminados nesses vizinhos.

Defina conceitualmente:

```text
impact(v) = soma das reduções dos domínios dos vizinhos
```

Ordene os valores em ordem crescente de `impact(v)`.

### 9.3 Contradição imediata

Se a simulação de `v` fizer algum vizinho ficar com domínio vazio, esse candidato:

- pode ser descartado imediatamente; ou
- pode receber impacto infinito e ficar no fim da ordenação.

A primeira alternativa é mais simples e eficiente.

### 9.4 Desempate

Se dois valores tiverem o mesmo impacto, use ordem numérica crescente para manter determinismo.

---

## 10. Heurística de estado para o GBFS

### 10.1 Grandezas

Para um estado `s`, defina:

**E(s)**
Número de células vazias.

**m(s)**
Menor tamanho de domínio entre as células vazias.

No estado objetivo, defina `m(s) = 0`.

**U(s)**
Incerteza total dos domínios:

```text
U(s) = soma de (|D(c)| - 1) para todas as células vazias c
```

Uma célula forçada com domínio de tamanho 1 contribui `0` para a incerteza.

### 10.2 Função sugerida

Use como função inicial do projeto:

```text
h(s) = E(s) + U(s) / 9 + m(s) / 9
```

Quanto menor `h(s)`, maior a prioridade do estado.

Se o estado possuir uma célula vazia com domínio zero, ele é inconsistente e deve ser podado antes de entrar ou permanecer na fronteira.

### 10.3 Interpretação

A função favorece estados que:

- possuem menos células restantes;
- possuem menor incerteza total;
- possuem pelo menos uma célula bastante restrita.

O GBFS **não precisa de heurística admissível**, diferentemente das condições normalmente discutidas para A\*. Aqui a função é uma estimativa de “promessa” do estado, não uma prova de custo ótimo.

### 10.4 Critérios de desempate da fila

Se dois estados tiverem o mesmo `h`, recomenda-se:

1. menor quantidade de células vazias;
2. menor `U`;
3. ordem de inserção na fronteira.

O critério final deve ser estável e documentado.

---

## 11. Como MRV, Degree e LCV trabalham juntos

Fluxo conceitual de expansão de um estado pelo GBFS:

```text
Estado retirado da fronteira
        |
        v
Calcular domínios
        |
        +--> domínio zero? --> podar
        |
        v
Escolher célula com MRV
        |
   empate?
        |
        v
Degree Heuristic
        |
        v
Obter candidatos da célula
        |
        v
Ordenar candidatos por LCV
        |
        v
Gerar estados filhos
        |
        v
Calcular h(filho)
        |
        v
Inserir filhos na fila de prioridade
```

---

## 12. Validação do estado inicial

A validação deve ocorrer em camadas.

### 12.1 Validação estrutural

Verificar:

- matriz possui 9 linhas;
- cada linha possui 9 colunas;
- cada célula contém inteiro de `0..9`;
- não há valores inválidos ou estruturas incompletas.

### 12.2 Validação local das regras

Detectar duplicatas entre valores já preenchidos em:

- linhas;
- colunas;
- blocos 3x3.

A mensagem de erro deve identificar a natureza da violação e, idealmente, as células envolvidas.

### 12.3 Detecção imediata de inconsistência

Mesmo sem duplicatas, um estado pode conter uma célula vazia com domínio zero.

Nesse caso, informar que o estado não possui continuação válida.

### 12.4 Verificação global de solucionabilidade

Um tabuleiro pode passar pelas validações locais e ainda assim não possuir solução.

Para comprovar se existe solução, é necessário executar internamente um resolvedor de existência que pare ao encontrar a primeira solução.

Recomendação do projeto:

- reutilizar a DFS em modo silencioso;
- não gerar animação;
- não misturar suas métricas com as métricas da execução escolhida pelo usuário;
- encerrar na primeira solução encontrada.

Observação conceitual importante para o relatório: verificar globalmente a existência de uma solução é, por natureza, um problema de busca. O requisito “não tentar executar a busca” deve ser interpretado como não iniciar a **execução principal/animada escolhida pelo usuário** quando o tabuleiro já foi classificado como insolúvel. A verificação interna de existência é necessária para saber isso.

### 12.5 Resultado da validação

Possíveis resultados:

```text
VALID
INVALID_STRUCTURE
INVALID_RULES
UNSOLVABLE
```

A interface pode traduzir os códigos em mensagens amigáveis.

---

## 13. Processo de resolução e animação

### 13.1 Separar busca de apresentação

A lógica de busca não deve depender diretamente de HTML, DOM, botões ou temporizadores.

O resolvedor produz:

- resultado;
- métricas;
- sequência de eventos.

A interface apenas reproduz os eventos.

### 13.2 Por que eventos são importantes

DFS e GBFS percorrem o espaço de estados de formas diferentes.

A DFS naturalmente produz uma sequência de atribuições e backtracks.

O GBFS pode retirar da fronteira um estado que não é descendente direto do estado anteriormente exibido. Portanto, eventos de `NODE_EXPANDED` devem permitir que a interface substitua o tabuleiro pelo `stateSnapshot` daquele nó antes de mostrar sua expansão.

### 13.3 Controles esperados

A interface deverá possuir:

- iniciar/resolver;
- pausar;
- continuar;
- próximo passo;
- resetar para estado inicial;
- limpar tabuleiro;
- escolher algoritmo;
- controlar velocidade;
- opcionalmente gerar um puzzle para teste.

### 13.4 Informações visuais úteis

Distinguir visualmente:

- pistas originais;
- célula selecionada;
- valor sendo tentado;
- estado podado;
- backtracking;
- solução final.

Também exibir durante a execução:

- célula selecionada;
- candidatos;
- MRV;
- degree, no GBFS;
- ordem LCV, no GBFS;
- `h(state)`, no GBFS;
- tamanho atual da fronteira.

---

## 14. Comparação justa entre algoritmos

### 14.1 Mesmo puzzle

Nunca comparar:

```text
DFS -> puzzle A
GBFS -> puzzle B
```

A comparação correta é:

```text
puzzle A -> DFS
puzzle A -> GBFS
```

### 14.2 Estado inicial imutável

Cada algoritmo deve receber uma cópia independente do mesmo estado inicial.

### 14.3 Sem animação durante benchmark de tempo

A animação introduz atrasos artificiais.

Para medir tempo de busca:

- executar em modo rápido/silencioso;
- medir somente a resolução;
- reproduzir animação separadamente.

### 14.4 Repetições

Para resultados mais confiáveis, cada puzzle pode ser executado várias vezes e o relatório pode apresentar:

- mediana ou média do tempo;
- estados explorados;
- estados gerados;
- tentativas;
- backtracks/dead ends;
- pico da fronteira.

Como JavaScript sofre efeitos de aquecimento do motor e pequenas variações do ambiente, a mediana costuma ser útil.

---

## 15. Conjunto de testes recomendado

O projeto deverá possuir pelo menos casos para:

1. tabuleiro válido e fácil;
2. tabuleiro válido médio;
3. tabuleiro válido difícil;
4. tabuleiro completo e válido;
5. tabuleiro com duplicata na linha;
6. tabuleiro com duplicata na coluna;
7. tabuleiro com duplicata em bloco;
8. tabuleiro estruturalmente válido, sem duplicatas imediatas, mas insolúvel;
9. estado que gera domínio zero durante a busca;
10. empate de MRV resolvido por Degree;
11. candidatos reordenados por LCV;
12. comparação DFS x GBFS no mesmo puzzle.

---

## 16. Gerador de Sudoku existente

O gerador atual pode continuar existindo como recurso de apoio.

### 16.1 O que ele já garante

Ao gerar primeiro uma solução completa e depois remover valores, o puzzle gerado possui pelo menos uma solução: a matriz completa original.

### 16.2 O que ele não garante

Remover posições aleatoriamente não garante solução única.

A atividade não exige explicitamente unicidade. Portanto, a unicidade pode ser tratada como melhoria adicional, não como requisito básico do resolvedor.

### 16.3 Categorias experimentais

Pode-se oferecer níveis baseados em quantidade de células removidas, por exemplo:

```text
Fácil experimental  -> menos vazios
Médio experimental  -> quantidade intermediária
Difícil experimental -> mais vazios
```

No relatório, deixar explícito que isso é uma classificação por quantidade de lacunas, não uma classificação formal da dificuldade humana do Sudoku.

---

## 17. Arquitetura conceitual do projeto

```text
Sudoku App
|
+-- Core
|   +-- estado
|   +-- regras
|   +-- domínios
|   +-- transição
|   +-- objetivo
|
+-- Validation
|   +-- estrutura
|   +-- regras iniciais
|   +-- domínio zero
|   +-- existência de solução
|
+-- Search
|   +-- DFS
|   +-- GBFS
|
+-- Heuristics
|   +-- MRV
|   +-- Degree
|   +-- LCV
|   +-- h(state)
|
+-- Instrumentation
|   +-- métricas
|   +-- eventos
|
+-- UI
|   +-- tabuleiro
|   +-- entrada manual
|   +-- controles
|   +-- animação
|   +-- métricas
|
+-- Experiments
    +-- puzzles fixos
    +-- runner silencioso
    +-- tabela comparativa
```

---

## 18. Contrato de integração entre os três integrantes

Antes do trabalho paralelo, **os três integrantes em conjunto** devem concluir a fundação comum descrita em `01_BASE_COMUM_GRUPO.md`.

Nenhuma pessoa é proprietária exclusiva da base. Durante essa etapa, recomenda-se alternar entre driver, revisor e testador para que todos compreendam estado, regras, domínios, transição, métricas e eventos.

Marco compartilhado **BASE-V1**:

- representação de estado definida;
- cópia segura do estado;
- regras de linha/coluna/bloco;
- cálculo de domínio;
- teste de estado objetivo;
- função de transição;
- detecção de domínio zero;
- contratos de `SolverResult`, `Metrics`, `SearchEvent` e `ValidationResult` definidos;
- mocks mínimos para desenvolvimento independente da interface;
- casos de teste fixos da base.

Somente depois de **BASE-V1**, o trabalho se divide:

```text
                             BASE-V1
                                |
        +-----------------------+-----------------------+
        |                       |                       |
        v                       v                       v
     PESSOA 1                PESSOA 2                PESSOA 3
 DFS + backtracking       GBFS + heurísticas      UI + controlador
 validação completa       MRV/Degree/LCV/h        animação + benchmark
        |                       |                       |
        +-----------------------+-----------------------+
                                |
                                v
                         integração final
```

A divisão foi planejada para reduzir dependências cruzadas:

- Pessoa 1 depende apenas da BASE-V1 para desenvolver quase toda sua trilha;
- Pessoa 2 depende apenas da BASE-V1 para desenvolver toda a busca heurística;
- Pessoa 3 usa os mocks da BASE-V1 e consegue desenvolver interface, player e benchmark antes de os algoritmos reais terminarem;
- somente a integração final da Pessoa 3 aguarda as APIs reais de validação, DFS e GBFS.
