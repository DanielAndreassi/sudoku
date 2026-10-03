# 07 — Entrega da Pessoa 1: DFS cega, eventos, métricas e validação completa

Documento de entrega das etapas **P1-01 a P1-06** de `docs/02_PESSOA_1_DFS_E_VALIDACAO.md`.
Ele existe para que a Pessoa 3 integre sem ler o código-fonte: aqui estão a API, o
catálogo de eventos, as convenções de métricas, um exemplo de uso e as medições
reais obtidas nesta máquina.

---

## 1. O que foi entregue

| Etapa | Onde | Testes |
|---|---|---|
| P1-01 DFS cega com backtracking | `resolvers/DFS.js` | `tests/dfs.test.js` |
| P1-02 eventos e métricas | `resolvers/DFS.js` | `tests/dfs.test.js` |
| P1-03 validação estrutural e de regras | `validacao/Validacao.js` | `tests/validacao.test.js` |
| P1-04 solvabilidade global | `validacao/Validacao.js` | `tests/validacao.test.js` |
| P1-05 orquestrador de validação | `validacao/Validacao.js` | `tests/validacao.test.js` |
| P1-06 testes e entrega | `tests/dfs.test.js`, `tests/validacao.test.js`, este documento | `npm test` |

```bash
npm test            # 130 testes: base, GBFS, interface, DFS e validação
npm run test:dfs    # só a trilha da DFS (16 testes)
npm run test:validacao   # só a trilha de validação (19 testes)
```

---

## 2. A DFS

### 2.1 Assinatura

```js
import SudokuEstado from "./models/SudokuEstado.js";
import DFS from "./resolvers/DFS.js";

const estado = SudokuEstado.gerarDeMatriz(matriz);   // matriz 9x9 crua
const resultado = DFS.resolver(estado, { silencioso: false });
```

`DFS.resolver(estadoInicial, opcoes = {})` devolve um `ResultadoResolucao` da
BASE-V1 — o mesmo objeto que o GBFS devolve, com os mesmos campos. É essa
igualdade de contrato que permite ao painel comparar os dois algoritmos sem
nenhum caso especial.

| Opção | Padrão | Efeito |
|---|---|---|
| `silencioso` | `false` | `true` não acumula eventos, mas preenche **todas** as métricas. |
| `orcamentoDeEventos` | `60000` | Teto de eventos gravados, só no modo instrumentado. |
| `orcamentoDeNos` | `250000` | Teto de estados explorados, nos dois modos. |

### 2.2 Política de expansão (a DFS continua cega)

1. percorre o tabuleiro em ordem de linha e coluna;
2. seleciona a **primeira** célula vazia;
3. testa `1..9` em ordem crescente;
4. descarta os valores que violem as regras;
5. desce no primeiro filho válido;
6. ao voltar de um ramo sem solução, desfaz a atribuição e tenta o próximo valor.

Não há MRV, Degree nem LCV. Isso é deliberado e está protegido por teste: a
seleção de célula **não** usa `SudokuEstado.selecionarCelula()`, que implementa
MRV com desempate por Degree. Se alguém trocar a chamada, `avaliacoesDeHeuristicas`
continua 0 no resultado, mas o teste de seleção de célula falha — e é para isso
que ele existe.

A única informação usada é a que sai de testar `1..9` e descartar os ilegais, ou
seja, o domínio legal da célula.

### 2.3 Status possíveis

| Status | Quando |
|---|---|
| `solved` | encontrou solução. `caminhoDeSolucao` e `solucao` estão preenchidos. |
| `unsolvable` | esgou todos os ramos. É uma **prova** de que não há solução. |
| `invalid` | o tabuleiro recebido já estava completo e violava as regras. |
| `cancelled` | estourou `orcamentoDeNos` ou `orcamentoDeEventos`. |

`cancelled` existe por uma razão concreta: sem teto, um tabuleiro quase vazio
digitado pelo usuário, ou um puzzle sem solução com poucas pistas, prenderiam
`POST /api/resolver` indefinidamente. Devolver `unsolvable` ali seria mentira.
Cortar a busca e dizer que ela foi interrompida é a única resposta honesta.

### 2.4 Por que existe um teto de eventos

A DFS cega no puzzle difícil expande 14.356 estados e analisa 128.951 candidatos.
Gravando um snapshot 9x9 por evento, isso passaria de 200 mil eventos. O GBFS,
bem mais barata, já produz 43.067 eventos e **18,74 MB** de JSON na mesma
resposta — o que já é demais para o navegador.

O teto de eventos existe para o servidor nunca responder com centenas de MB.
Quando estoura, a busca para e devolve `cancelled`. Ele **não** limita a busca em
si: em modo silencioso nenhum evento é gerado, e o benchmark mede a busca
completa. Na prática, entre os casos da base, só o puzzle difícil estoura o teto
na execução instrumentada: ele bate 60.000 eventos e 24,11 MB depois de apenas
7.818 nós explorados, cerca de um terço do caminho. Os demais passam folgados — o
fácil produz 2.500 eventos e 0,7 MB.

### 2.5 Catálogo de eventos

Todos gravam `estadoSnapshot` (matriz 9x9 no instante), `sequencia` (1, 2, 3…),
`algoritmo` (`"DFS"`) e `profundidade`.

| Evento | Quando | `celula` | `valor` | `razao` |
|---|---|---|---|---|
| `SEARCH_STARTED` | uma vez, no início | `null` | `null` | `null` |
| `NODE_EXPANDED` | entrou em um nó e vai escolher a próxima célula | `null` | `null` | `null` |
| `CELL_SELECTED` | escolheu a célula a preencher | sim | `null` | `PRIMEIRA_CELULA_VAZIA_LINHA_COLUNA` |
| `CANDIDATES_COMPUTED` | calculou o domínio legal | sim | `null` | `null` |
| `VALUE_TRIED` | vai testar um candidato **legal** | sim | sim | `null` |
| `CHILD_GENERATED` | gerou o filho e desceu nele | sim | sim | `null` |
| `SOLUTION_FOUND` | o nó atual é solução | `null` | `null` | `null` |
| `BACKTRACK` | abandonou um ramo e desfez a atribuição | sim | sim | `RAMA_SEM_SOLUCAO` |
| `STATE_PRUNED` | beco sem saída: alguma célula ficou sem candidato | a célula morta | `null` | `ZERO_DOMAIN` |
| `SEARCH_FINISHED` | uma vez, no fim | `null` | `null` | status em maiúsculas |

Dois detalhes que a interface precisa conhecer:

- **`VALUE_TRIED` só é emitido para candidatos legais.** Testar `7` numa célula
  onde `7` já está na coluna não chega a ser uma "tentativa": não houve decisão.
  Ainda assim, `tentativasCandidatas` conta **todos** os `9` valores analisados,
  porque é isso que a CPU faz.
- **O `estadoSnapshot` do `BACKTRACK` é o do pai, já desfeito.** A célula
  A célula está de volta em `0` naquele snapshot. É o que permite ao painel
  desenhar a reversão sem recalcular nada.

`SEARCH_FINISHED` é a única exceção à regra `tamanhoFronteira = profundidade + 1`
que vale durante a busca: ele carrega `tamanhoFronteira: 0` porque a pilha já
esvaziou, enquanto `profundidade` continua sendo a profundidade da solução. É a
mesma convenção do GBFS e dos mocks da base.

### 2.6 Convenções de métricas

| Métrica | O que a DFS registra |
|---|---|
| `estadosExplorados` | nós efetivamente percorridos. |
| `estadosGerados` | filhos criados, incluindo os que já nasceram mortos. |
| `tentativasCandidatas` | valores `1..9` analisados, legais ou não. |
| `estadosMortos` | becos detectados depois de gerar o filho. |
| `estadosPodados` | **sempre 0**. Podar é privilege de busca informada. |
| `backtracks` | ramos abandonados por falta de solução. |
| `profundidadeDaSolucao` | quantas atribuições a solução exigiu. `0` se já estava completo. |
| `fronteiraMaxima` | profundidade máxima da pilha. **Não** é tamanho de fila de prioridade. |
| `avaliacoesDeHeuristicas` | **sempre 0**. |
| `ehMock` | `false`. |

`estadosMortos` e `backtracks` não são a mesma coisa, e a distinção aparece nos
números: um beco detectado logo após gerar o filho conta como morto **sem**
contar backtrack, porque nenhum ramo foi percorrido e abandonado.

---

## 3. A validação

### 3.1 Assinatura

```js
import Validacao, { CODIGOS } from "./validacao/Validacao.js";

const veredito = Validacao.validarQuadroInicial(matriz);
```

Uma chamada, matriz 9x9 crua dentro, `ResultadoValidacao` fora. A entrada é
matriz crua de propósito: validar a estrutura é justamente o que impede
instanciar um `SudokuEstado` com uma matriz malformada.

### 3.2 Pipeline

```text
estrutura ─▶ duplicatas ─▶ domínio zero ─▶ solubilidade global ─▶ VALID
   │              │             │                │
   ▼              ▼             ▼                ▼
INVALID_      DUPLICATE_     ZERO_DOMAIN     UNSOLVABLE
STRUCTURE     ROW/COLUMN/                   LIMITE_DE_BUSCA
              BLOCK
```

Cada etapa encerra no primeiro erro encontrado, na ordem acima. É por isso que um
tabuleiro com duplicata **e** sem solução volta com `DUPLICATE_ROW`, nunca com
`UNSOLVABLE`: corrigir a duplicata muda o conjunto de puzzles possíveis, então
afirmar insolubilidade antes disso seria falso.

### 3.3 Códigos

| Código | Significado |
|---|---|
| `VALID` | respeita as regras e tem solução. |
| `INVALID_STRUCTURE` | não é 9x9, ou tem valor fora de `0..9` (inclusive não inteiro). |
| `DUPLICATE_ROW` / `_COLUMN` / `_BLOCK` | valor repetido. `celulas` traz **todas** as posições repetidas. |
| `ZERO_DOMAIN` | alguma célula não tem nenhum valor possível. `celulas` aponta as mortas. |
| `UNSOLVABLE` | respeita as regras, mas não tem solução. |
| `LIMITE_DE_BUSCA` | não deu para provar nem refutar; orçamento estourado. |

`celulas` vazio significa "o problema não é de célula" — erro de estrutura ou
insolubilidade global.

### 3.4 A prova de existência é silenciosa

`Validacao` chama `DFS.resolver(..., { silencioso: true })` e descarta métricas e
eventos. A validação responde uma pergunta — "existe solução?" — e para na
primeira. Ela não é a busca principal do usuário e não pode custar o que a
busca instrumentada custa.

Por isso `ResultadoValidacao` não tem onde carregar eventos nem métricas: a
estrutura do tipo garante que a animação não possa ser confundida com a validação.

### 3.5 `LIMITE_DE_BUSCA` é uma resposta honesta

Se o orçamento estourar, o código é `LIMITE_DE_BUSCA`, nunca `UNSOLVABLE`. Um
`UNSOLVABLE` aqui seria uma afirmação que ninguém checou.

---

## 4. Integração

### 4.1 HTTP

`POST /api/resolver`

```jsonc
// requisição
{ "algoritmo": "dfs", "quadro": [[...9], ...9], "silencioso": false }

// 200 — busca executada
{ "algoritmo": "dfs", "resultado": { "status": "solved", "metricas": {...}, "eventos": [...] } }

// 422 — entrada recusada antes de qualquer busca
{ "erro": "VALIDACAO", "validacao": { "ehValido": false, "codigo": "UNSOLVABLE", "mensagem": "...", "celulas": [] } }
```

A guarda provisória de entrada que existia antes foi removida: a rota agora chama
`Validacao.validarQuadroInicial(quadro)` antes de qualquer busca, e o campo
`avisoValidacao` saiu da resposta porque não há mais o que avisar.

### 4.2 Benchmark

`npm run benchmark` usa as duas implementações reais, ambas em modo silencioso —
medir a busca, e não a construção de milhares de snapshots.

```bash
node bin/benchmark.js --puzzles=facil,intermediario --repeticoes=3
node bin/benchmark.js --algoritmos=gbfs --repeticoes=10
```

O aviso de métricas fictícias continua no CLI. Ele não distingue quem preencheu a
métrica: se algum catálogo voltar a injetar um mock, o aviso aparece no terminal
e no CSV. Com os solvers reais ele nunca aparece — e é por isso que ele ficou.

---

## 5. Medições reais

Cinco repetições por caso, `npm run benchmark`, Node 22 em máquina local. Os
números são de execução: reproduza com o comando acima antes de citar em slide.

| Puzzle | Algoritmo | mediana (ms) | explorados | gerados | tentativas | mortos | backtracks | profundidade |
|---|---|---|---|---|---|---|---|---|
| fácil | GBFS | 11,7 | 52 | 51 | 51 | 0 | 0 | 51 |
| fácil | DFS | 14,0 | 334 | 516 | 2.777 | 183 | 282 | 51 |
| intermediário | GBFS | 7,2 | 46 | 45 | 45 | 0 | 0 | 45 |
| intermediário | DFS | 0,8 | 46 | 50 | 226 | 5 | 0 | 45 |
| difícil | GBFS | 879,0 | 8.238 | 8.242 | 9.176 | 0 | 0 | 60 |
| difícil | DFS | 416,6 | 14.356 | 22.067 | 128.951 | 7.712 | 14.295 | 60 |

Leitura honesta desses números:

- **A DFS é mais barata em tempo no difícil, apesar de explorar mais estados.**
  Ela Expande 14.356 nós contra 8.238 do GBFS, mas o GBFS paga por heurística,
  contagem e poda em cada nó. No intermediário a diferença é de 9x em favor da
  DFS. No fácil, quase empatado.
- **Isso não significa que a DFS seja melhor.** Os três puzzles têm a mesma
  taxa de acerto por segundo justamente porque a DFS é cega: ela gasta o mesmo
  esforço nos ramos que já estavam perdidos. O ganho real do GBFS apareceria em
  puzzles com pouco ou nenhum beco, onde o MRV evita o retrocesso por completo.
- **O que a DFS paga é retrocesso explícito:** 14.295 backtracks no difícil, contra
  0 do GBFS. Esse é o dado que a animação precisa mostrar.
- `podados` é 0 na DFS em todos os casos, por construção.

Validação (mediana de 5 chamadas, já aquecida):

| Puzzle | Código | mediana (ms) |
|---|---|---|
| fácil | `VALID` | 12,3 |
| intermediário | `VALID` | 1,0 |
| difícil | `VALID` | 540 |
| completo válido | `VALID` | 0,2 |
| duplicata em linha | `DUPLICATE_ROW` | 0,03 |
| duplicata em coluna | `DUPLICATE_COLUMN` | 0,04 |
| duplicata em bloco | `DUPLICATE_BLOCK` | 0,08 |
| domínio zero | `ZERO_DOMAIN` | 0,10 |
| localmente válido, insolúvel | `UNSOLVABLE` | 3,7 |

Duas leituras que esses números pedem:

- **A recusa é sempre barata; a confirmação é cara.** Toda entrada inválida é
  recusada nas três primeiras etapas do pipeline, antes de qualquer busca. O
  `UNSOLVABLE` custa 3,7 ms porque o beco `STATE_PRUNED` aparece logo no começo,
  e não porque os ramos foram esgotados.
- **Validar o difícil custa meio segundo**, e esse tempo é pago em *toda*
  requisição, antes de a busca principal começar. Para a interface interativa, a
  ordem "validar, depois executar" é a do contrato da Pessoa 1 e o certo é
  mostrá-la como um passo visível — ou validar apenas a estrutura e deixar o
  `UNSOLVABLE` para a busca. Mudar isso é decisão da Pessoa 3, não uma
  otimização escondida aqui.

---

## 6. Exemplo de uso

```js
import SudokuEstado from "./models/SudokuEstado.js";
import DFS from "./resolvers/DFS.js";
import Validacao from "./validacao/Validacao.js";

const matriz = [
    [5, 3, 0, 0, 7, 0, 0, 0, 0],
    [6, 0, 0, 1, 9, 5, 0, 0, 0],
    [0, 9, 8, 0, 0, 0, 0, 6, 0],
    [8, 0, 0, 0, 6, 0, 0, 0, 3],
    [4, 0, 0, 8, 0, 3, 0, 0, 1],
    [7, 0, 0, 0, 2, 0, 0, 0, 6],
    [0, 6, 0, 0, 0, 0, 2, 8, 0],
    [0, 0, 0, 4, 1, 9, 0, 0, 5],
    [0, 0, 0, 0, 8, 0, 0, 7, 9],
];

// 1. Valida antes de gastar qualquer busca.
const veredito = Validacao.validarQuadroInicial(matriz);

if (!veredito.ehValido) {
    console.error(veredito.codigo, veredito.mensagem, veredito.celulas);
    process.exit(1);
}

// 2. Executa a DFS instrumentada para a animação.
const estado = SudokuEstado.gerarDeMatriz(matriz);
const resultado = DFS.resolver(estado);

console.log(resultado.status);                       // "solved"
console.log(resultado.metricas.profundidadeDaSolucao); // 51
console.log(resultado.metricas.backtracks);            // > 0
console.log(resultado.caminhoDeSolucao.length);        // 52 estados: 51 preenchimentos + o inicial
console.log(resultado.eventos.at(-1).tipo);            // "SEARCH_FINISHED"

// 3. Só o benchmark e a validação rodam em modo silencioso.
const semAnimacao = DFS.resolver(SudokuEstado.gerarDeMatriz(matriz), {
    silencioso: true,
});

console.log(semAnimacao.eventos.length);                 // 0
console.log(semAnimacao.metricas.backtracks);            // mesma métrica
```

---

## 7. Estado do `SolverResult` e do `ValidationResult`

Nenhum campo da BASE-V1 foi alterado. As únicas decisões que a trilha tomou
foram sobre valores, não sobre forma:

- `status` ganhou um quarto valor possível, `cancelled`, para distinguir busca
  interrompida de busca sem solução.
- `eventos` distingue `VALUE_TRIED` (candidato legal) de `tentativasCandidatas`
  (candidatos analisados). Quem anima deve contar `VALUE_TRIED`; quem mede CPU
  deve ler `tentativasCandidatas`.
- `caminhoDeSolucao` tem `profundidadeDaSolucao + 1` elementos: o estado inicial
  mais um estado por atribuição.
- `metadados` é sempre `null` e `scoreHeuristico` é sempre `null` na DFS, porque
  a busca é cega. Se algum dia aparecer valor aí, a comparação experimental
  quebrou.