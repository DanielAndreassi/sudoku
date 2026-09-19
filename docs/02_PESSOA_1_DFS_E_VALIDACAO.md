# Pessoa 1 — DFS, backtracking e validação completa do estado inicial

## 1. Papel da Pessoa 1

A Pessoa 1 começa **somente depois do marco BASE-V1**, construído pelos três integrantes em conjunto.

Sua trilha concentra duas responsabilidades de dificuldade comparável às demais:

1. implementar a busca cega DFS com backtracking, eventos e métricas;
2. implementar a validação completa do estado inicial, incluindo a prova de existência de solução por uma busca silenciosa.

Esta pessoa não implementa MRV, Degree ou LCV na DFS. A DFS deve permanecer propositalmente não informada para que a comparação experimental seja válida.

---

# Mapa de dependências

```text
BASE-V1
  |
  +--> P1-01 DFS básica -------------------+
  |                                        |
  +--> P1-03 validação estrutural/local ---+--> P1-04 solvabilidade global
  |                                        |          |
  |                                        |          v
  +--> P1-02 eventos e métricas DFS <-------+      P1-05 orquestrador de validação
                                                     |
                                                     v
                                                P1-06 testes e entrega
```

### Dependências externas

- P1-01 a P1-05 dependem apenas de **BASE-V1** e de passos anteriores da própria Pessoa 1.
- A Pessoa 3 só precisa esperar **P1-05** para integrar a validação real.
- A integração final deve usar a versão aprovada em **P1-06**.

---

# P1-01 — Implementar a DFS cega com política fixa de expansão

## Dependências

- BASE-V1.

## Objetivo

Criar o resolvedor de busca não informada do projeto.

A DFS deve explorar profundamente um ramo antes de tentar outro e deve usar uma política fixa que não dependa da quantidade de possibilidades de cada célula.

## Política obrigatória para manter a busca cega

Recomendação:

1. percorrer o tabuleiro em ordem de linha e coluna;
2. selecionar a primeira célula vazia encontrada;
3. testar valores `1..9` em ordem crescente;
4. ignorar valores que violem as regras;
5. aprofundar no primeiro filho válido;
6. retornar quando o ramo não puder continuar.

## Estruturas utilizadas

Entrada:

```text
SudokuState
```

Saída final:

```text
SolverResult
```

Durante a implementação, a busca pode ter uma função recursiva interna com parâmetros como:

```text
state
metrics
 events
 depth
```

## O que contar como exploração

Use a definição comum de BASE-V1:

- `exploredStates`: estado que efetivamente foi processado/expandido;
- `generatedStates`: filho válido que foi materializado;
- `candidateAttempts`: candidato analisado/tentado para a célula atual.

## Aceite

- [ ] Resolve um Sudoku simples conhecido.
- [ ] Não usa MRV, Degree ou LCV.
- [ ] Sempre escolhe a primeira célula vazia pela mesma ordem fixa.
- [ ] Sempre testa candidatos na mesma ordem fixa.
- [ ] Não modifica o estado inicial.
- [ ] Retorna `solved` quando encontra solução.
- [ ] Retorna `unsolvable` quando esgota a busca.
- [ ] Uma execução repetida sobre o mesmo estado produz o mesmo comportamento lógico.

<details>
<summary>Dica 1 — Pensando recursivamente</summary>

Cada chamada da DFS responde à pergunta:

> “A partir deste estado, consigo chegar a uma solução?”

Se o estado já é objetivo, a resposta é sim. Caso contrário, escolha a primeira célula vazia e teste os valores legais um por um.

</details>

<details>
<summary>Dica 2 — Onde entra o backtracking</summary>

Se um valor válido localmente leva a um estado que depois não consegue ser resolvido, a função retorna ao nível anterior e tenta o próximo valor.

A reversão pode ocorrer de duas formas:

- mutando temporariamente uma cópia local e desfazendo a célula;
- preferencialmente, usando a função de transição da base para gerar filhos independentes.

</details>

<details>
<summary>Dica 3 — Pseudocódigo possível</summary>

```text
FUNÇÃO dfs(state, depth):
    registrar estado explorado

    SE isGoal(state):
        RETORNAR solução

    cell = primeira célula vazia em ordem fixa

    PARA value DE 1 ATÉ 9:
        incrementar candidateAttempts

        SE movimento não é válido:
            CONTINUAR

        child = transition(state, {cell, value})
        incrementar generatedStates

        SE isDeadEnd(child):
            registrar poda
            CONTINUAR

        resposta = dfs(child, depth + 1)

        SE resposta encontrou solução:
            RETORNAR resposta

        incrementar backtracks

    RETORNAR sem solução neste ramo
```

</details>

---

# P1-02 — Instrumentar a DFS com eventos, tempo e métricas completas

## Dependências

- P1-01.
- Contratos de BASE-V1.

## Objetivo

Transformar a DFS funcional em um resolvedor observável pela interface e comparável com o GBFS.

## Eventos relevantes

A DFS deve produzir, quando fizer sentido:

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

## Regras importantes

- O modo normal pode registrar eventos completos para animação.
- Deve existir uma forma de executar a mesma lógica em **modo silencioso**, sem acumular milhares de eventos desnecessários.
- Medição de `elapsedMs` deve medir a busca, não a animação.
- `maxFrontier` para DFS pode ser interpretado como o maior número de estados/quadros aguardando retorno na pilha de busca, ou a profundidade máxima da pilha, desde que o grupo use uma definição documentada e consistente.

## Aceite

- [ ] `elapsedMs` é calculado.
- [ ] `backtracks` aumenta somente quando um ramo tentado precisa ser abandonado.
- [ ] `solutionDepth` corresponde à profundidade da solução encontrada.
- [ ] Eventos possuem sequência determinística.
- [ ] O evento de backtracking permite à UI explicar a reversão.
- [ ] Existe modo com eventos e modo silencioso.
- [ ] O resultado final respeita `SolverResult`.

<details>
<summary>Dica 1 — Não misture animação com busca</summary>

A DFS deve terminar sua execução independentemente de existir `setTimeout`, botão de pausa ou DOM. Ela apenas registra o que aconteceu.

</details>

<details>
<summary>Dica 2 — Snapshot versus evento pequeno</summary>

Nem todo evento precisa carregar a matriz inteira. Porém, eventos importantes podem ter `stateSnapshot` para tornar a reprodução robusta.

Para DFS, uma sequência de atribuição/backtracking pode ser reconstruída, mas snapshots periódicos simplificam a interface.

</details>

<details>
<summary>Dica 3 — Pseudocódigo de instrumentação</summary>

```text
início = relógioAtual()
metrics = createEmptyMetrics()
events = []

emitir SEARCH_STARTED
resultadoInterno = dfs(...)

SE resolveu:
    emitir SOLUTION_FOUND
SENÃO:
    marcar status unsolvable

metrics.elapsedMs = relógioAtual() - início
emitir SEARCH_FINISHED

RETORNAR SolverResult
```

</details>

---

# P1-03 — Implementar validação estrutural e validação local das regras

## Dependências

- BASE-V1.

## Objetivo

Recusar entradas evidentemente inválidas antes da busca principal.

## Camadas

### Estrutural

Verificar:

- exatamente 9 linhas;
- exatamente 9 colunas por linha;
- valores inteiros de `0..9`;
- ausência de valores estranhos, `NaN`, strings não normalizadas etc.

### Regras já preenchidas

Detectar duplicatas entre valores não zero em:

- cada linha;
- cada coluna;
- cada bloco 3x3.

### Contradição local imediata

Depois das duplicatas, verificar se alguma célula vazia já possui domínio zero.

## Resultado

Use `ValidationResult` com códigos como:

```text
VALID_LOCAL
INVALID_STRUCTURE
DUPLICATE_ROW
DUPLICATE_COLUMN
DUPLICATE_BLOCK
ZERO_DOMAIN
```

## Aceite

- [ ] Matriz com tamanho incorreto é rejeitada.
- [ ] Valor fora de `0..9` é rejeitado.
- [ ] Duplicata em linha é detectada.
- [ ] Duplicata em coluna é detectada.
- [ ] Duplicata em bloco é detectada.
- [ ] As coordenadas envolvidas podem ser retornadas.
- [ ] Domínio zero inicial é identificado.
- [ ] A função não modifica o tabuleiro.

<details>
<summary>Dica 1 — Retorne contexto do erro</summary>

Em vez de apenas `false`, retorne algo como:

```text
{
  valid: false,
  code: "DUPLICATE_ROW",
  message: "O valor 5 se repete na linha 3",
  cells: [{x:1,y:2}, {x:7,y:2}]
}
```

Isso permitirá à Pessoa 3 destacar as células corretas.

</details>

<details>
<summary>Dica 2 — Validação genérica de unidade</summary>

Linhas, colunas e blocos podem ser reduzidos à mesma ideia: receber uma lista de células, ignorar zeros e verificar se algum valor aparece duas vezes.

</details>

<details>
<summary>Dica 3 — Pseudocódigo possível</summary>

```text
FUNÇÃO validateUnit(cells, errorCode):
    vistos = mapa vazio

    PARA cada cell EM cells:
        value = cell.value
        SE value == 0:
            CONTINUAR

        SE vistos contém value:
            RETORNAR erro(errorCode, [vistos[value], cell])

        vistos[value] = cell

    RETORNAR válido
```

</details>

---

# P1-04 — Implementar verificação global de solucionabilidade

## Dependências

- P1-01.
- P1-03.

## Objetivo

Cumprir o requisito de distinguir:

- entrada inválida;
- entrada válida, mas sem solução;
- entrada válida e solucionável.

Uma entrada pode não ter duplicatas e mesmo assim não possuir nenhuma solução possível.

## Estratégia recomendada

Reutilizar a DFS como um **resolvedor de existência**:

- não animar;
- não acumular eventos;
- parar na primeira solução;
- não misturar suas métricas com a execução que o usuário posteriormente selecionar.

Essa busca é uma etapa interna de validação, não a demonstração principal.

## Importante

Se o usuário escolher DFS depois, a DFS principal ainda deve ser executada novamente para coletar as métricas reais da demonstração. Não reutilizar as métricas da pré-validação.

## Aceite

- [ ] Estado estruturalmente inválido não chega ao verificador global.
- [ ] Estado localmente inválido não chega ao verificador global.
- [ ] Um puzzle solucionável retorna existência de solução.
- [ ] Um puzzle insolúvel retorna ausência de solução.
- [ ] A verificação para na primeira solução.
- [ ] Não produz animação.
- [ ] Não altera o estado inicial.
- [ ] Suas métricas internas não aparecem como métricas do algoritmo escolhido.

<details>
<summary>Dica 1 — Reutilize a lógica, não copie o algoritmo inteiro</summary>

Idealmente a DFS aceita opções como:

```text
collectEvents: false
stopAtFirstSolution: true
purpose: validation
```

ou existe um invólucro que chama a mesma função interna.

</details>

<details>
<summary>Dica 2 — Por que não basta domínio zero inicial</summary>

Um Sudoku pode começar com todos os domínios não vazios e ainda assim todas as combinações futuras levarem a contradições. Só uma busca consegue confirmar globalmente a existência de solução.

</details>

<details>
<summary>Dica 3 — Pseudocódigo possível</summary>

```text
FUNÇÃO hasSolution(board):
    resultado = solveDFS(board, {
        collectEvents: false,
        silent: true,
        stopAtFirstSolution: true
    })

    RETORNAR resultado.status == "solved"
```

</details>

---

# P1-05 — Criar o orquestrador de validação completa

## Dependências

- P1-03.
- P1-04.

## Objetivo

Fornecer uma única entrada para a interface perguntar:

> “Este tabuleiro pode ser usado para iniciar a resolução?”

## Fluxo esperado

```text
Entrada
  |
  v
estrutura válida?
  | não -> INVALID_STRUCTURE
  v
regras iniciais válidas?
  | não -> erro específico
  v
há domínio zero?
  | sim -> UNSOLVABLE/contradição local
  v
existe pelo menos uma solução?
  | não -> UNSOLVABLE
  v
VALID
```

## Resultado recomendado

```text
ValidationResult
- valid: boolean
- code
- message
- cells
```

Possíveis códigos finais:

```text
VALID
INVALID_STRUCTURE
INVALID_RULES
UNSOLVABLE
```

Internamente podem existir códigos mais específicos para a UI.

## Aceite

- [ ] A Pessoa 3 precisa chamar somente uma função de validação de alto nível.
- [ ] Entradas inválidas retornam mensagem clara.
- [ ] Insolubilidade retorna código distinto de violação de regra inicial.
- [ ] Tabuleiro válido e solucionável retorna `VALID`.
- [ ] Nenhuma busca principal é disparada automaticamente por esta função.
- [ ] O mesmo estado pode ser validado repetidamente sem efeitos colaterais.

<details>
<summary>Dica 1 — Faça a função ser um pipeline</summary>

Cada etapa deve terminar cedo ao detectar erro. Assim, não se gasta tempo executando busca global para uma matriz que já contém duplicatas.

</details>

<details>
<summary>Dica 2 — Mensagem técnica versus mensagem de interface</summary>

Pode ser útil retornar um `code` estável e uma `message` pronta. A UI usa o código para decidir destaque visual e a mensagem para explicar ao usuário.

</details>

<details>
<summary>Dica 3 — Pseudocódigo possível</summary>

```text
FUNÇÃO validateInitialBoard(board):
    resultado = validateStructure(board)
    SE inválido: RETORNAR resultado

    resultado = validateRules(board)
    SE inválido: RETORNAR resultado

    SE isDeadEnd(board):
        RETORNAR UNSOLVABLE

    SE NÃO hasSolution(board):
        RETORNAR UNSOLVABLE

    RETORNAR VALID
```

</details>

---

# P1-06 — Testar, estabilizar e entregar a trilha da Pessoa 1

## Dependências

- P1-01 a P1-05.

## Objetivo

Entregar DFS e validação como componentes confiáveis para a integração.

## Casos obrigatórios

### DFS

- puzzle fácil;
- puzzle intermediário;
- puzzle difícil que seja viável para demonstração;
- estado completo válido;
- estado insolúvel;
- confirmação de que a primeira célula vazia é usada, mesmo quando outra teria MRV menor;
- confirmação de ordem crescente dos candidatos.

### Validação

- estrutura incorreta;
- valor inválido;
- duplicata em linha;
- duplicata em coluna;
- duplicata em bloco;
- domínio zero;
- localmente válido mas globalmente insolúvel;
- válido e solucionável.

### Instrumentação

- `backtracks > 0` em caso preparado;
- eventos em ordem crescente de sequência;
- solução final realmente válida;
- métricas não negativas;
- modo silencioso sem lista extensa de eventos.

## Aceite final P1-DONE

- [ ] Todos os casos acima passam.
- [ ] DFS não usa heurísticas da Pessoa 2.
- [ ] `SolverResult` segue BASE-V1.
- [ ] `ValidationResult` segue BASE-V1.
- [ ] A Pessoa 3 consegue validar uma matriz chamando a API acordada.
- [ ] A Pessoa 3 consegue executar a DFS e receber eventos/métricas.
- [ ] Um exemplo de uso está documentado para integração.

<details>
<summary>Dica 1 — Teste propriedades, não apenas “deu solução”</summary>

Uma DFS poderia resolver o puzzle e ainda estar usando MRV sem querer. Verifique explicitamente a célula selecionada nos primeiros eventos de um caso preparado.

</details>

<details>
<summary>Dica 2 — Use os casos fixos da BASE-V1</summary>

Evite depender do gerador aleatório para testes de regressão. Um teste bom deve falhar e repetir exatamente o mesmo erro na próxima execução.

</details>

<details>
<summary>Dica 3 — Pseudocódigo de teste conceitual</summary>

```text
PARA cada puzzle conhecido:
    original = cloneBoard(puzzle)
    result = solveDFS(puzzle)

    verificar que puzzle == original
    verificar status esperado

    SE solved:
        verificar isGoal(result.solution)

executar validateInitialBoard nos casos inválidos
comparar code retornado com o esperado
```

</details>

---

# 2. O que a Pessoa 1 deve saber explicar na apresentação

Ao terminar sua trilha, esta pessoa deve conseguir explicar sem ler código:

1. por que a DFS é considerada busca cega neste projeto;
2. como a ordem fixa de célula e valores influencia a árvore de busca;
3. o que significa backtracking;
4. diferença entre movimento inválido, estado morto e puzzle globalmente insolúvel;
5. por que a verificação de solucionabilidade precisa de uma busca interna;
6. como as métricas da DFS são coletadas;
7. por que a pré-validação não pode contaminar as métricas comparativas.
