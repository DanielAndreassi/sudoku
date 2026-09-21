# Sumário de nomes e contratos da implementação

Este documento relaciona os nomes conceituais usados nos documentos do projeto com os nomes em português adotados no código.

A regra principal é: os nomes podem mudar, mas o significado dos campos e dos contratos deve continuar o mesmo.

---

## 1. Estado do Sudoku

| Nome conceitual        | Nome no código       | Significado                                                      |
| ---------------------- | -------------------- | ---------------------------------------------------------------- |
| `SudokuState`          | `SudokuEstado`       | Representa uma configuração do Sudoku.                           |
| `board`                | `quadro`             | Matriz 9x9.`0` representa uma célula vazia.                      |
| `clone` / `cloneState` | `clonar()`           | Cria outro estado com outra matriz.                              |
| `transition`           | `transicionar(acao)` | Cria um novo estado aplicando uma ação sem alterar o estado pai. |
| `isGoal`               | `ehObjetivo()`       | Informa se o quadro está completo e válido.                      |
| `isDeadEnd`            | `estaMorto()`        | Informa se existe célula vazia sem nenhum valor possível.        |
| state rules validation | `estaValido()`       | Verifica se os valores preenchidos respeitam linha, coluna e quadrante. |

`SudokuEstado.gerarDeMatriz()` também copia a matriz recebida. Isso evita que uma alteração feita fora da entidade modifique o estado já criado.

---

## 2. Ação

| Nome conceitual | Nome no código | Significado                                       |
| --------------- | -------------- | ------------------------------------------------- |
| `Action`        | `Acao`         | Representa uma tentativa de preencher uma célula. |
| `x`             | `coluna`       | Índice horizontal, de`0` a `8`.                   |
| `y`             | `linha`        | Índice vertical, de`0` a `8`.                     |
| `value`         | `valor`        | Número de`1` a `9` que será colocado.             |
| `isValidMove`   | `ehValida(estado)` | Verifica se esta ação pode ser aplicada ao estado informado. |

Exemplo conceitual:

```text
Action { x: 2, y: 0, value: 4 }
```

No código atual:

```text
Acao { linha: 0, coluna: 2, valor: 4 }
```

A ordem usada pelo construtor é:

```text
new Acao(linha, coluna, valor)
```

---

## 3. Regras e responsabilidades de validação

A validação foi distribuída para as entidades que possuem a informação necessária:

- `Acao.ehValida(estado)` valida a própria ação dentro de um estado;
- `SudokuEstado.estaValido()` valida o próprio estado;
- `Regras` mantém somente verificações elementares reutilizadas pelas entidades.

### Métodos da classe `Regras`

| Nome conceitual | Nome no código              | Significado                                      |
| --------------- | --------------------------- | ------------------------------------------------ |
| row check       | `numeroExisteNaLinha()`     | Verifica se um número já existe na linha.        |
| column check    | `numeroExisteNaColuna()`    | Verifica se um número já existe na coluna.       |
| block check     | `numeroExisteNoQuadrante()` | Verifica se um número já existe no bloco 3x3.    |

### Validação da ação

O antigo conceito `isValidMove` corresponde agora a:

```text
Acao.ehValida(estado)
```

Esse método rejeita:

- célula já preenchida;
- linha ou coluna fora de `0..8`;
- valor que não seja inteiro de `1..9`;
- valor que já exista na linha;
- valor que já exista na coluna;
- valor que já exista no quadrante.

`DominioCelula.calcularDominioCelula()` reutiliza essa validação criando uma `Acao` para cada candidato de `1..9`.

### Validação do estado

O antigo conceito `state rules validation` corresponde agora a:

```text
SudokuEstado.estaValido()
```

Esse método verifica se os valores já preenchidos não possuem duplicatas em nenhuma linha, coluna ou quadrante. As células vazias (`0`) são ignoradas nessa validação.

`SudokuEstado.ehObjetivo()` depende de `estaValido()`: um quadro somente é objetivo quando está completo e também é válido.

---

## 4. Domínio de uma célula

| Nome conceitual  | Nome no código                  | Significado                                                                |
| ---------------- | ------------------------------- | -------------------------------------------------------------------------- |
| `CellDomain`     | `DominioCelula`                 | Informações dos valores possíveis de uma célula vazia.                     |
| `x`              | `coluna`                        | Coluna da célula.                                                          |
| `y`              | `linha`                         | Linha da célula.                                                           |
| `values`         | `valores`                       | Lista dos candidatos válidos.                                              |
| `size`           | `tamanho`                       | Quantidade de candidatos.                                                  |
| `degree`         | `grau`                          | Quantidade de vizinhos vazios afetados. Será usado pela heurística Degree. |
| `getDomain`      | `calcularDominioCelula()`       | Calcula o domínio de uma célula vazia.                                     |
| `getAllDomains`  | `calcularDominioTodasCelulas()` | Calcula os domínios de todas as células vazias.                            |
| domain size zero | `estaMorto()`                   | Indica que aquele domínio não possui candidato.                            |

Neste momento `grau` começa em `0`. O cálculo real do Degree será implementado na etapa da heurística.

---

## 5. Resultado do resolvedor

| Nome conceitual | Nome no código       | Significado                                       |
| --------------- | -------------------- | ------------------------------------------------- |
| `SolverResult`  | `ResultadoResolucao` | Contrato comum de retorno de DFS e GBFS.          |
| `status`        | `status`             | `solved`, `unsolvable`, `invalid` ou `cancelled`. |
| `solution`      | `solucao`            | Matriz final ou`null`.                            |
| `metrics`       | `metricas`           | Instância de`Metrica`.                            |
| `events`        | `eventos`            | Lista de`EventoBusca`.                            |
| `solutionPath`  | `caminhoDeSolucao`   | Caminho da solução, quando for utilizado.         |

Se não forem informados, `metricas`, `eventos` e `caminhoDeSolucao` já possuem valores vazios padrão.

---

## 6. Métricas

| Nome conceitual        | Nome no código            | Significado                                                                             |
| ---------------------- | ------------------------- | --------------------------------------------------------------------------------------- |
| `Metrics`              | `Metrica`                 | Agrupa as métricas de uma execução.                                                     |
| `elapsedMs`            | `tempo`                   | Tempo da busca em milissegundos.                                                        |
| `exploredStates`       | `estadosExplorados`       | Estados efetivamente processados.                                                       |
| `generatedStates`      | `estadosGerados`          | Estados filhos criados.                                                                 |
| `candidateAttempts`    | `tentativasCandidatas`    | Valores candidatos analisados/tentados.                                                 |
| `deadEnds`             | `estadosMortos`           | Estados onde não há continuação possível.                                               |
| `prunedStates`         | `estadosPodados`          | Estados descartados antes de expansão completa.                                         |
| `solutionDepth`        | `profundidadeDaSolucao`   | Quantidade de transições até a solução.                                                 |
| `maxFrontier`          | `fronteiraMaxima`         | Maior quantidade de nós aguardando exploração.                                          |
| `heuristicEvaluations` | `avaliacoesDeHeuristicas` | Quantidade de avaliações heurísticas.                                                   |
| `backtracks`           | `backtracks`              | Quantidade de retornos da DFS após um ramo falhar.                                      |
| mock marker            | `ehMock`                  | Campo adicional usado somente para deixar explícito que métricas de B-05 são fictícias. |

`Metrica.criarVazia()` cria todas as métricas com valor `0` e `ehMock = false`.

---

## 7. Eventos da busca

| Nome conceitual  | Nome no código     | Significado                                          |
| ---------------- | ------------------ | ---------------------------------------------------- |
| `SearchEvent`    | `EventoBusca`      | Um acontecimento reproduzível pela interface.        |
| `sequence`       | `sequencia`        | Ordem do evento.                                     |
| `algorithm`      | `algoritmo`        | `DFS` ou `GBFS`.                                     |
| `type`           | `tipo`             | Tipo do evento.                                      |
| `stateSnapshot`  | `estadoSnapshot`   | Estado que a interface pode mostrar naquele momento. |
| `cell`           | `celula`           | Objeto normalmente no formato`{ linha, coluna }`.    |
| `value`          | `valor`            | Valor relacionado ao evento.                         |
| `candidates`     | `candidatos`       | Candidatos da célula naquele momento.                |
| `heuristicScore` | `scoreHeuristico`  | Valor de`h(estado)` quando aplicável.                |
| `frontierSize`   | `tamanhoFronteira` | Quantidade de nós aguardando busca.                  |
| `depth`          | `profundidade`     | Profundidade do nó.                                  |
| `reason`         | `razao`            | Motivo de poda, backtracking ou encerramento.        |
| `metadata`       | `metadados`        | Informações extras do algoritmo, como MRV, Degree e impacto LCV. |

Tipos definidos pelo contrato:

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

`estadoSnapshot` é uma cópia simples da matriz 9x9. Mocks e eventos reais usam o mesmo formato para que o frontend possa renderizar o snapshot diretamente e para que o resultado seja serializável em JSON.

---

## 8. Resultado de validação

| Nome conceitual    | Nome no código       | Significado                                     |
| ------------------ | -------------------- | ----------------------------------------------- |
| `ValidationResult` | `ResultadoValidacao` | Resultado padronizado de uma validação.         |
| `valid`            | `ehValido`           | `true` ou `false`.                              |
| `code`             | `codigo`             | Código que identifica o resultado.              |
| `message`          | `mensagem`           | Texto para usuário/interface.                   |
| `cells`            | `celulas`            | Células relacionadas ao erro, quando aplicável. |

A validação completa será desenvolvida na trilha responsável pela validação. A entidade já está pronta para receber esse resultado.

---

## 9. Estruturas da busca implementadas após BASE-V1

### SearchNode -> NoListaEstado

O conceito `SearchNode` foi implementado em `models/ListaEstadosOrdenados.js` com o nome `NoListaEstado`. Ele guarda o estado, profundidade, ação, pai, avaliação heurística, quantidade de células vazias, incerteza e ordem de inserção usados pela fronteira do GBFS.

A correspondência adotada é:

```text
SearchNode -> NoListaEstado
```

| Conceitual            | Nome no código                    |
| --------------------- | --------------------------------- |
| `state`               | `estado`                          |
| `depth`               | `profundidade`                    |
| `parent`              | `pai`                             |
| `action`              | `acao`                            |
| `heuristicScore`      | `avaliacaoHeuristica`             |
| `emptyCount`          | `qteDominiosCelulasVazias`        |
| `uncertainty`         | `incerteza`                       |
| `insertionOrder`      | `ordemInsercao`                   |

`NoListaEstado` é usado internamente pela `ListaEstadosOrdenados`, que representa a fronteira prioritária do GBFS.

---

## 10. B-05 no código atual

Os dados simulados estão em:

```text
mocks/MockResolucao.js
```

A classe fornece:

```text
criarMetricasDFS()
criarMetricasGBFS()
criarEventosDFS()
criarEventosGBFS()
criarEventosInsoluvel()
criarResultadoSucesso()
criarResultadoInsoluvel()
```

Esses resultados são somente para desenvolvimento da interface.

Eles não devem ser usados como resultado de benchmark ou relatório.

---

## 11. Status da BASE-V1

A base comum está concluída e os testes automatizados atuais passam integralmente.

Validações realizadas sobre a versão atual:

- `npm test`: 14/14 testes aprovados;
- clonagem e transição preservam o estado pai;
- `Acao.ehValida(estado)` é usada para validar candidatos;
- `SudokuEstado.estaValido()` valida o estado;
- objetivo e estado morto estão cobertos por teste;
- o caso fixo marcado como insolúvel foi conferido e realmente não possui solução;
- o caso preparado para LCV foi conferido: impacto de `2 = 7` e impacto de `6 = 2`, portanto a ordem esperada é `[6, 2]`;
- mocks de DFS e GBFS respeitam os contratos compartilhados.

---

## 12. B-06 no código atual

Os casos fixos estão em:

```text
tests/casosBase.js
```

Existem casos para:

- Sudoku fácil;
- Sudoku intermediário;
- Sudoku difícil;
- Sudoku completo válido;
- duplicata em linha;
- duplicata em coluna;
- duplicata em bloco;
- estado localmente válido, sem domínio zero inicial, mas preparado como insolúvel;
- estado com domínio zero;
- empate de MRV;
- desempate futuro por Degree;
- verificação futura de LCV.

Os testes da base estão em:

```text
tests/base.test.js
```

Comandos:

```text
npm test
```

ou apenas a base:

```text
npm run test:base
```

---

## 13. Observação sobre o código antigo

O arquivo `script.js` ainda contém o protótipo inicial com variáveis globais como `matrizPrincipal`.

Ele pode continuar como referência histórica ou gerador provisório, mas a nova implementação dos algoritmos deve usar as entidades de `models/` e não voltar a depender dessas variáveis globais.
