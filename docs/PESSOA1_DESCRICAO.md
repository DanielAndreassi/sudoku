# Descrição para a Pessoa 1 — o que a interface espera da DFS e da validação

Escrito pela Pessoa 3. Reúne, num lugar só, tudo que a trilha da Pessoa 1 (`docs/02_PESSOA_1_DFS_E_VALIDACAO.md`) precisa cumprir para encaixar na interface sem que nada do lado de cá precise ser reescrito.

Não substitui o documento da sua trilha. O `docs/02` diz **o que** implementar e por quê; este aqui diz **qual formato** entregar e **onde conectar**.

---

## 1. Convenção de métricas aprovada pelo grupo

Duas métricas de `models/Metrica.js` não eram comparáveis entre DFS e GBFS. O assunto foi levado ao grupo e a convenção abaixo foi **aprovada**. O item 1.2 muda diretamente o que você preenche.

### 1.1 `estadosMortos` e `estadosPodados` continuam separados

Medição real do GBFS no sudoku difícil:

```
explorados = 8238   gerados = 8242   estadosMortos = 0   estadosPodados = 934
```

O GBFS dá sempre `0` em `estadosMortos`. Não é bug: ele detecta o filho inconsistente em `avaliarHeuristica()` e poda **antes** de inserir na fronteira, então contabiliza em `estadosPodados`.

A DFS, seguindo o pseudocódigo do seu documento (P1-01, Dica 3), detecta o beco sem saída **depois** de gerar o filho (`SE isDeadEnd(child)`), e contabiliza em `estadosMortos`.

As duas definições estão corretas. O problema era só de apresentação: "DFS: 87 / GBFS: 0" lado a lado sugeriria que o GBFS nunca erra.

**O que foi decidido:** você preenche `estadosMortos` e `estadosPodados` do jeito que for natural na DFS, sem se preocupar em imitar o GBFS. O painel exibe os dois campos crus marcados como não comparáveis, e acrescenta uma linha derivada que ele mesmo calcula:

```
estadosDescartados = estadosMortos + estadosPodados
```

Essa soma é comparável entre os dois algoritmos porque não depende de qual contador cada um escolheu incrementar. **É o número que vai para a tabela do relatório.**

Nada a fazer da sua parte além de preencher os dois campos coerentemente.

### 1.2 `fronteiraMaxima` na DFS — isto muda o que você implementa

O `docs/02` (P1-02, "Regras importantes") deixou a definição em aberto: "o maior número de estados aguardando retorno na pilha **ou** a profundidade máxima da pilha, desde que o grupo use uma definição documentada e consistente".

**O grupo escolheu: profundidade máxima da pilha de recursão.**

Ou seja, em `metricas.fronteiraMaxima` você registra o maior valor que `depth` atingiu durante a busca:

```text
FUNCAO dfs(estado, profundidade):
    SE profundidade > metricas.fronteiraMaxima:
        metricas.fronteiraMaxima = profundidade
    ...
```

Razões da escolha: é o análogo honesto de "quantos estados existem simultaneamente vivos na busca", sai de graça da recursão, e torna a comparação interpretável — "o GBFS chegou a manter 11 estados alternativos na fronteira; a DFS chegou a 47 níveis de profundidade". No painel cada coluna é rotulada com o que realmente mede, em vez de fingir que os dois números são a mesma grandeza.

Para referência, o GBFS mede o pico real da fila de prioridade: `11` no difícil, e `1` no fácil e no intermediário (a heurística vai direto à solução, sem alternativa pendente).

### 1.3 Campos que não se aplicam

Convenção do `docs/04` (P3-04), já implementada no painel: `avaliacoesDeHeuristicas` na DFS fica em `0`, e `backtracks` no GBFS fica em `0`. O painel exibe `0` com legenda dizendo que ali significa "não se aplica", não "usou zero vezes". Não precisa inventar `null` nem `—`.

---

## 2. Assinaturas que a interface chama

São as mesmas que o GBFS já cumpre. Manter o padrão é o que permite o controlador escolher o resolvedor pelo nome, sem conhecer nada de dentro dele.

### 2.1 DFS

```js
// resolvers/DFS.js
export default class DFS {
    static resolver(estadoInicial, opcoes = {}) { /* ... */ }
}
```

| | |
| --- | --- |
| `estadoInicial` | instância de `SudokuEstado` |
| `opcoes.silencioso` | `true` → não acumula eventos, **mas continua preenchendo as métricas** |
| retorno | `ResultadoResolucao` |

O modo silencioso não é detalhe opcional: é o que o benchmark usa. Sem ele, medir tempo em 5 repetições × 3 puzzles acumularia centenas de milhares de eventos inúteis na memória.

`status` deve ser um de `"solved"`, `"unsolvable"`, `"invalid"` ou `"cancelled"`. O painel e o benchmark distinguem os quatro e nunca fingem sucesso.

### 2.2 Validação

```js
// validacao/Validacao.js — o caminho fica a seu critério
export default class Validacao {
    static validarQuadroInicial(matriz9x9) { /* ... */ }
}
```

| | |
| --- | --- |
| entrada | a **matriz crua** 9×9, não um `SudokuEstado` |
| retorno | `ResultadoValidacao` |

A entrada é matriz crua de propósito: você precisa validar a estrutura antes de existir estado válido. Instanciar `SudokuEstado` com uma matriz malformada é exatamente o que a validação estrutural existe para impedir.

Preencher `celulas` com as coordenadas envolvidas quando houver erro localizado — a interface já sabe destacá-las em vermelho no tabuleiro. O formato é `[{ linha, coluna }]`, com índices de `0` a `8`. Isso já está implementado e testado do lado de cá; assim que você devolver as coordenadas, elas acendem sozinhas.

---

## 3. Onde conectar — quatro linhas

A interface nunca importa um resolvedor diretamente; recebe tudo por injeção. Quando a sua entrega estiver pronta, são quatro trocas de uma linha cada:

| Arquivo | O que está lá hoje | O que vira |
| --- | --- | --- |
| `routes/resolver.js` | `RESOLVEDORES.dfs` → `null` | `(estado, opcoes) => DFS.resolver(estado, opcoes)` |
| `routes/resolver.js` | `validarEntradaProvisoria(quadro)` | `Validacao.validarQuadroInicial(quadro)` |
| `routes/utilidades.js` | `todosSolvers.dfs` → `MockResolucao` | o DFS real |
| `bin/benchmark.js` | `CATALOGO_DE_SOLVERS.dfs` → `MockResolucao` | o DFS real |

Enquanto isso não acontece, selecionar "DFS" na interface devolve **HTTP 501** com mensagem explicando que a trilha ainda não foi entregue. Nada quebra, nada finge funcionar.

---

## 4. A guarda provisória que o seu código substitui

`routes/resolver.js` tem hoje uma função `validarEntradaProvisoria`. Ela **não** é a validação da sua trilha e não tenta ser. Faz só o que a BASE-V1 já oferece:

- matriz tem 9 linhas de 9 colunas;
- cada célula é inteiro de `0` a `9`;
- `SudokuEstado.estaValido()` — sem duplicatas em linha, coluna ou quadrante.

Não detecta domínio zero (P1-03) nem insolubilidade global (P1-04), porque isso exige a busca silenciosa que só existe na sua trilha.

Consequência observável hoje, para você saber o que vai mudar: o caso fixo `dominioZero` **passa** pela guarda e devolve HTTP 200 com `status: "unsolvable"` — quem descobre é a própria busca, não a validação. Quando `validarQuadroInicial` entrar, esse caso passa a ser barrado antes, com código e mensagem próprios, e a busca principal não chega a ser disparada.

A guarda existe apenas para o servidor recusar lixo com mensagem clara em vez de estourar dentro do solver. Apague-a sem cerimônia.

---

## 5. O que já está pronto esperando você

Nada disso precisa ser construído; é só plugar.

- **Animação**: o player reproduz qualquer lista de `EventoBusca` sem saber de qual algoritmo veio. Se a DFS emitir `BACKTRACK`, a interface já pinta a célula com marca de reversão e mostra a `razao` no painel explicativo.
- **Painel explicativo**: exibe célula selecionada, candidatos, valor tentado, profundidade, fronteira e razão. Os campos específicos do GBFS (MRV, Degree, LCV, `h`) simplesmente ficam em `—` quando o evento não os traz. Não há lógica por algoritmo espalhada pela aplicação.
- **Comparação**: guarda um resultado por algoritmo e só compara execuções sobre o mesmo tabuleiro inicial, identificado por uma chave de 81 caracteres. Trocou o tabuleiro, a comparação reinicia sozinha.
- **Benchmark**: motor testado, CLI (`npm run benchmark`) e rota. Roda cópias independentes, calcula mediana de tempo, detecta se as contagens divergem entre repetições (sintoma de solver mutando estado compartilhado) e grava CSV.

---

## 6. Uma armadilha que já custou tempo aqui

O benchmark verifica, a cada execução, se a matriz de entrada foi modificada. Vale saber por quê: `servicos/PuzzlesFixos.js` chegou a devolver as matrizes de `tests/casosBase.js` **por referência**. Um solver que mutasse a entrada teria corrompido a fixture compartilhada, e o sintoma apareceria num teste de outra trilha, muito longe da causa. Já foi corrigido para devolver cópias, e a verificação ficou como rede de segurança.

Vale para você: o `docs/02` (P1-01) permite fazer backtracking "mutando temporariamente uma cópia local e desfazendo a célula". Se escolher esse caminho em vez da função de transição da base, garanta que a cópia é realmente local — `matriz.map((linha) => [...linha])`, não `[...matriz]`, que copia só o array externo e deixa as nove linhas compartilhadas.

O critério de aceite "não modifica o estado inicial" está na sua lista de testes obrigatórios (P1-06), e o benchmark vai acusar se escapar.

---

## 7. Como verificar que encaixou

```bash
npm test          # a suíte inteira, incluindo os testes das outras trilhas
npm start         # http://localhost:8080
npm run benchmark # a coluna DFS deixa de vir marcada como fictícia
```

Sinais de que deu certo:

1. selecionar "DFS" na interface resolve e anima, em vez de devolver HTTP 501;
2. o benchmark para de imprimir os blocos de aviso de números fictícios (eles só aparecem quando alguma métrica tem `ehMock: true`);
3. o painel de comparação preenche as duas colunas para o mesmo puzzle;
4. um tabuleiro com duplicata acende as células erradas em vermelho a partir das coordenadas que a sua validação devolveu.

Detalhes da trilha da Pessoa 3, medições e decisões de interface estão em `DANIELUI.md`.
