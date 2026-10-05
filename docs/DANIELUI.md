# Trilha da Pessoa 3 — Interface, animação, métricas e benchmark

Registro do que foi implementado na trilha da Pessoa 3 (documento `docs/04_PESSOA_3_INTERFACE_ANIMACAO_E_EXPERIMENTOS.md`), com as decisões tomadas, as medições feitas e o que ficou bloqueado esperando as outras trilhas.

---

## 1. Como rodar

```bash
npm ci                 # instala dependências (o repositório não vinha com node_modules)
npm start              # sobe o servidor em http://localhost:8080
npm test               # 95 testes
npm run benchmark      # benchmark em terminal, gera benchmark.csv
```

O benchmark aceita flags:

```bash
node bin/benchmark.js --ajuda
node bin/benchmark.js --puzzles=facil,intermediario --repeticoes=10 --saida=/tmp/bench.csv
node bin/benchmark.js --algoritmos=gbfs
```

---

## 2. O que existe agora

| Etapa | Descrição | Situação |
| ----- | --------- | -------- |
| P3-01 | Tabuleiro 9×9, entrada manual, estados visuais | Concluída |
| P3-02 | Controlador de execução (máquina de estados) | Concluída |
| P3-03 | Player de eventos com pausa, passo, velocidade, progresso | Concluída |
| P3-04 | Painel de métricas e comparação DFS × GBFS | Concluída |
| P3-05 | Runner de benchmark (motor + CLI + rota) | Concluída |
| P3-06 | Integração real | Concluída — DFS e validação reais da Pessoa 1 conectadas |
| P3-07 | Testes ponta a ponta | 15/15 cenários cobertos — ver seção 7 |

---

## 3. Onde cada coisa mora

```
index.js                    servidor Express (reescrito: o original não subia)
views/index.ejs             template: casca, grade de 81 inputs, lista de puzzles
routes/resolver.js          POST /api/resolver, GET /api/puzzles
routes/utilidades.js        GET /api/gerar, POST /api/benchmark
servicos/PuzzlesFixos.js    expõe os puzzles fixos da BASE-V1 para a interface
servicos/ChavePuzzle.js     chave de 81 caracteres (lado Node)
servicos/Benchmark.js       motor de benchmark, lógica pura
bin/benchmark.js            CLI do benchmark
models/GeradorSudoku.js     gerador de puzzles (substitui o protótipo de script.js)
public/styles.css           estilo funcional, 7 estados visuais
public/js/tabuleiro.js      única camada que toca no DOM da grade
public/js/player.js         reprodução de eventos, lógica pura
public/js/comparacao.js     comparação entre algoritmos, lógica pura
public/js/painel.js         camada DOM do painel
public/js/controlador.js    máquina de estados, lógica pura
public/js/app.js            montagem: o único arquivo que conhece IDs do HTML
```

Testes adicionados nesta trilha:

| Arquivo | Testes |
| ------- | ------ |
| `tests/player.test.js` | 24 |
| `tests/comparacao.test.js` | 15 |
| `tests/controlador.test.js` | 13 |
| `tests/benchmark.test.js` | 11 |
| `tests/gerador.test.js` | 8 |
| **Total novo** | **71** |
| Pré-existentes (base + GBFS) | 24 |
| **`npm test`** | **95, todos passando** |

---

## 4. Decisões e por quê

### 4.1 Express com resposta completa, sem streaming

`docs/arquitetura_principal.txt` desenha `POST /api/resolver`, e foi o que se implementou. A busca termina inteira no servidor e a resposta sai pronta; a animação é reprodução de eventos já gravados, sem nova requisição.

A preocupação inicial era o tamanho: o sudoku difícil produz **43.067 eventos, 18,75 MB de JSON**. Mediu-se o caminho completo antes de otimizar:

```
busca = 255 ms | serialização = 50 ms | transporte + parse = 66 ms | total HTTP = 321 ms
```

Ou seja: o transporte custa 66 ms sobre uma busca de 255 ms. **O payload nunca foi o gargalo**, e qualquer filtro de eventos teria resolvido o problema errado. Testaram-se duas compressões e ambas renderam pouco:

| variante | eventos | tamanho |
| -------- | ------- | ------- |
| cru | 43.067 | 18,75 MB |
| sem `CHILD_GENERATED` + `VALUE_TRIED` | 25.649 | 11,07 MB |
| snapshots repetidos removidos | 43.067 | 13,20 MB |

O problema real é outro: **43 mil eventos a 120 ms cada dão 86 minutos de animação**. Isso é problema de player, não de rede. Por isso existem velocidade ajustável, barra de progresso arrastável e botão "ir ao fim". A demonstração visual do raciocínio deve usar o puzzle fácil ou o intermediário (259 e 229 eventos); o difícil serve ao benchmark.

### 4.2 EJS como gerador de estrutura, não de estado

O EJS gera os 81 inputs com as bordas de bloco corretas e a lista de puzzles fixos — repetição estrutural que em HTML puro seriam 81 linhas copiadas. Estado dinâmico continua todo no cliente, porque o tabuleiro é redesenhado a cada evento. As dependências `dotenv` e `cookie-parser` estão declaradas no `package.json` mas não são usadas por esta trilha; não foram removidas para evitar conflito no arquivo compartilhado.

### 4.3 Lógica separada do DOM

`player.js`, `comparacao.js` e `controlador.js` não importam nada do navegador e não chamam `document`. Recebem colaboradores por injeção. É isso que permite testá-los com `node --test` sem jsdom nem Playwright, mantendo zero dependências novas. A camada que toca no DOM (`tabuleiro.js`, `painel.js`, `app.js`) fica fina o bastante para ser verificada pelo checklist manual da seção 7.

Consequência prática: o controlador recebe a camada de rede como parâmetro (`api`), então `tests/controlador.test.js` exercita a máquina de estados inteira — incluindo "duas execuções simultâneas são impossíveis" e "o tabuleiro é liberado mesmo quando a requisição falha" — sem servidor de pé.

### 4.4 Duas métricas que **não** são comparáveis entre os algoritmos

Esta é a decisão mais importante do painel. Foi levada ao grupo e **aprovada**; a descrição completa para a trilha da Pessoa 1 está em `PESSOA1_DESCRICAO.md`.

**`estadosMortos`** dá sempre `0` no GBFS. Não é bug: o filho inconsistente é detectado por `avaliarHeuristica()` e podado *antes* de entrar na fronteira, então contabiliza em `estadosPodados`. Medição real no difícil:

```
GBFS  explorados = 8238   gerados = 8242   estadosMortos = 0   estadosPodados = 934
```

A DFS, seguindo o pseudocódigo do doc 02 (P1-01), vai detectar o beco sem saída *depois* de gerar o filho, e contabilizar em `estadosMortos`. Mostrar "DFS: 87 / GBFS: 0" lado a lado sugeriria falsamente que o GBFS nunca erra. Ele erra 934 vezes, em outro campo.

**`fronteiraMaxima`** mede o pico real da fila de prioridade no GBFS. Para a DFS, o doc 02 (P1-02) deixa em aberto entre "estados na pilha" e "profundidade máxima da pilha". São grandezas diferentes com o mesmo nome.

**Convenção aprovada pelo grupo:**

1. os dois campos continuam na tabela com os valores reais, marcados como não comparáveis em três camadas (sufixo no rótulo, classe CSS com fundo distinto, nota explicativa) e com legenda no rodapé;
2. acrescenta-se a linha derivada **`estadosDescartados = estadosMortos + estadosPodados`**, que *é* comparável e é o número indicado para o relatório;
3. na DFS, `fronteiraMaxima` carrega a **profundidade máxima da pilha de recursão**. Cada coluna é rotulada com o que realmente mede.

`avaliacoesDeHeuristicas` (DFS) e `backtracks` (GBFS) seguem a convenção do doc 04: mostram `0`, com legenda dizendo que ali `0` significa "não se aplica", não "usou zero vezes".

### 4.5 Marcação de números fictícios

Enquanto a DFS não existia, o painel e o benchmark preenchiam a segunda coluna com `MockResolucao`, cujas métricas carregam `ehMock: true`. **Hoje nenhum caminho usa mock:** `routes/resolver.js`, `routes/utilidades.js` e `bin/benchmark.js` chamam as duas implementações reais.

A marcação ficou no lugar de propósito, como rede permanente. Ela não pergunta quem preencheu a métrica, só olha a flag — então se alguém reintroduzir um mock em qualquer catálogo de solvers, o aviso reaparece sozinho:

- no painel, destaque acima da tabela nomeando quais algoritmos vieram de mock;
- no CLI, dois blocos de moldura (antes e depois da tabela), sufixo ` [MOCK]` no nome do algoritmo e coluna `alertas` com `FICTICIO`;
- no CSV, uma linha de comentário no topo do arquivo, antes do cabeçalho.

O motivo de ter sido construído assim: tabela de benchmark é exatamente o artefato que alguém copia para o relatório sem conferir a procedência.

### 4.6 Redesign visual — tema escuro de painel de dados

A primeira versão da interface era deliberadamente funcional. Numa segunda passada o grupo pediu acabamento, e as decisões foram estas:

| Dimensão | Escolha |
| --- | --- |
| Tema | Escuro único, paleta slate (`#0F172A` fundo, `#1B2336` cartão, `#475569` borda) |
| Tipografia | Fira Code nos dados, Fira Sans na interface, via Google Fonts |
| Layout | Barra de controle no topo; tabuleiro + transporte à esquerda; painel com abas à direita |
| Animações | Nenhuma |
| Grade | Célula de 48px, blocos 3×3 separados por vão de 4px |

**Por que nenhuma transição.** A animação do player *é* o conteúdo. A 120 ms por evento, um fade de 200 ms borraria dois eventos consecutivos e ninguém conseguiria dizer qual célula acabou de mudar. Fora da grade também não há transição, para o arquivo não ter duas regras concorrentes.

**Por que vão em vez de borda nos blocos.** No escuro, uma borda clara de 2px separando os nove blocos vira nove caixas com contorno brilhante competindo com o conteúdo. O vão deixa os blocos óbvios sem desenhar nada. Isso exigiu aninhar as células em nove `<div class="bloco">` no EJS; `tabuleiro.js` não notou, porque consulta `.celula` por `data-linha`/`data-coluna` e não depende da hierarquia.

**Por que azul durante a busca e verde só na solução.** A versão anterior usava verde para os dois. O momento narrativo da demonstração é o tabuleiro inteiro acendendo no `SOLUTION_FOUND`; se a busca já vinha escrevendo em verde o caminho todo, esse momento deixa de existir. As sete classes de estado não mudaram de nome — só de cor —, então nenhum JavaScript foi afetado.

**Por que mono nos dígitos.** Não é estética: `6` e `8` a 20px precisam ser inconfundíveis, e a largura fixa mantém as 81 células opticamente alinhadas. Nas tabelas, `font-variant-numeric: tabular-nums` impede que as casas decimais dancem de linha em linha.

**Densidade.** O painel direito tinha 36 linhas de tabela empilhadas. Agora: quatro números grandes (tempo, explorados, gerados, descartados — as quatro que a convenção da seção 4.4 torna comparáveis), as outras oito num `<details>` recolhido, e Execução/Comparação em abas, já que nunca precisam ser lidas ao mesmo tempo. O painel explicativo esconde as linhas que não se aplicam ao evento atual, em vez de exibir dez `—`.

**Métricas não comparáveis saíram da tabela.** Marcá-las dentro dela ainda convidava a leitura horizontal: o olho varre a linha e compara os dois números antes de processar o aviso. Foram para um bloco próprio, "Medem coisas diferentes em cada algoritmo", onde a leitura errada deixa de ser fisicamente possível. A linha derivada `Estados descartados` continua na tabela principal.

**Risco assumido.** As fontes vêm do Google Fonts por `<link>`. Sem internet, a página cai no fallback (`system-ui` / `ui-monospace`) e a largura muda; `display=swap` evita texto invisível, mas não o pulo. Baixar os dois `.woff2` para `public/` elimina isso sem alterar mais nada.

---

### 4.7 Chave de puzzle de 81 caracteres

Cada resultado é guardado junto com um identificador do tabuleiro **inicial**: a matriz 9×9 achatada em 81 caracteres. Quando chega um resultado com chave diferente da guardada, a comparação anterior é descartada e recomeça.

Sem isso, o usuário resolve o puzzle A com DFS, edita uma célula, resolve com GBFS, e a tela exibe os dois lado a lado como se fosse comparação — exatamente o que o doc 00 §14.1 proíbe. Nada na interface impediria isso sozinho.

A função está duplicada de propósito em `servicos/ChavePuzzle.js` (Node) e `public/js/comparacao.js` (navegador), porque só `public/` é servido ao cliente. `tests/comparacao.test.js` importa as duas e prova que concordam.

### 4.8 "Próximo passo" avança exatamente um evento

Um `NODE_EXPANDED` seguido de `CELL_SELECTED` e `CANDIDATES_COMPUTED` descreve uma única decisão em três eventos, e houve a tentação de agrupá-los. Não se agrupou: o doc 04 (P3-03) exige "avança exatamente um evento lógico", e é justamente nessa sequência que se enxerga MRV → candidatos → LCV acontecendo. Agrupar esconderia o que a matéria quer demonstrar.

Observado passo a passo no puzzle fácil:

```
1  SEARCH_STARTED        h = 62.444
2  NODE_EXPANDED         h = 62.444
3  CELL_SELECTED         linha 7, coluna 6   candidatos [7]   MRV = 1   Degree = 11
4  CANDIDATES_COMPUTED   ordem LCV: 7 (impacto 3)
5  VALUE_TRIED           valor 7
```

### 4.9 `script.js` intocado, gerador novo

O protótipo antigo continua como referência histórica, conforme o doc 06 §13. O gerador foi reescrito em `models/GeradorSudoku.js` sem variáveis globais e sem mutar parâmetros, aceitando injeção de fonte de aleatoriedade para ser testável de forma determinística.

Os níveis (35/45/55 células removidas) vêm acompanhados de um aviso que viaja **junto com o dado**, na resposta da API e no retorno do módulo: a remoção aleatória não garante solução única, e "nível" aqui é contagem de lacunas, não classificação formal de dificuldade (doc 00 §16.2 e §16.3). Acoplar o texto ao dado impede que a interface esqueça de exibi-lo.

---

### 4.10 Execução interrompida e o botão "Sem animação"

A DFS instrumentada no puzzle difícil estoura o teto de 60.000 eventos da Pessoa 1 e devolve `status: "cancelled"` — sem esse teto, a resposta passaria de 200 MB. Medido:

| Modo | Status | Eventos | Explorados | Backtracks |
| --- | --- | --- | --- | --- |
| instrumentado | `cancelled` | 60.000 | 7.818 | 7.786 |
| silencioso | `solved` | 0 | 14.356 | 14.295 |

A interface não podia simplesmente dizer "cancelled" e mostrar um tabuleiro pela metade. Duas respostas:

1. **Botão "Sem animação"**, ao lado de Resolver, sempre disponível — manda `silencioso: true`, a busca roda inteira sem gravar evento, e as métricas reais chegam. É o que o doc 04 (P3-05) chama de medição honesta, e serve para qualquer caso em que se quer o número sem esperar a animação, não só como conserto do `cancelled`.
2. **Execução `cancelled` não entra na comparação.** Ela mediu "os primeiros 60 mil eventos", não o problema inteiro; colocá-la ao lado de uma busca concluída convida a mesma leitura errada que a convenção da seção 4.4 existe para impedir. A mensagem diz isso e aponta o botão.

"Ver solução" passou a depender de existir `solucao`, não de existir animação: uma busca `cancelled` tem eventos e não tem solução, uma silenciosa tem solução e não tem eventos. São condições diferentes.

### 4.11 Dois tons para recusa de entrada

A validação da Pessoa 1 devolve cinco códigos, e eles não são a mesma coisa:

| Código | Natureza | Tratamento |
| --- | --- | --- |
| `DUPLICATE_ROW` / `_COLUMN` / `_BLOCK` | erro de digitação | vermelho, células acesas |
| `ZERO_DOMAIN` | erro de digitação | vermelho, células acesas |
| `UNSOLVABLE` | propriedade do puzzle | âmbar, sem célula acesa |
| `LIMITE_DE_BUSCA` | não deu para provar | âmbar, sem célula acesa |
| `INVALID_STRUCTURE` | matriz malformada | vermelho (não ocorre pela UI) |

A distinção que importa para quem olha é "eu errei" contra "esse tabuleiro é assim". Pintar `UNSOLVABLE` de vermelho junto com as duplicatas faria o usuário procurar um erro de digitação que não existe. O texto exato continua vindo da `mensagem` da Pessoa 1; a interface só escolhe o tom.

### 4.12 Validar custa caro, e a tela precisa dizer isso

`Validacao.validarQuadroInicial` roda uma DFS silenciosa para provar que existe solução — é o requisito do doc 00 §12.4. No puzzle difícil isso custa cerca de 540 ms, pagos em **toda** requisição, antes de a busca principal começar.

O controlador já passava por `VALIDANDO` antes de `RESOLVENDO`, mas as duas transições aconteciam no mesmo tick, então o navegador nunca pintava a primeira: o usuário via "Resolvendo…" e meio segundo de tela imóvel. Entrou um ponto de cessão de controle entre os dois estados, **injetado no construtor** (`cederControle`), com padrão de um frame no navegador e resolução imediata nos testes — caso contrário `tests/controlador.test.js` passaria a depender de `requestAnimationFrame`, que não existe no Node.

## 5. Medições

Todas com os casos fixos de `tests/casosBase.js`, GBFS real.

| Puzzle | Status | Tempo da busca | Eventos | Explorados | Gerados | Fronteira máx. | Podados | Payload JSON |
| ------ | ------ | -------------- | ------- | ---------- | ------- | -------------- | ------- | ------------ |
| fácil | solved | 6,0 ms | 259 | 52 | 51 | **1** | 0 | 0,12 MB |
| intermediário | solved | 2,4 ms | 229 | 46 | 45 | **1** | 0 | 0,11 MB |
| difícil | solved | 255 ms | 43.067 | 8.238 | 8.242 | 11 | 934 | 18,75 MB |

Fronteira máxima igual a 1 no fácil e no intermediário significa que a heurística vai direto à solução, sem manter nenhuma alternativa pendente. É um dado forte para a apresentação e um bom contraste com o que a DFS deve produzir.

Distribuição dos 43.067 eventos do difícil:

```
NODE_EXPANDED 8238 | CELL_SELECTED 8237 | CANDIDATES_COMPUTED 8237
VALUE_TRIED 9176   | CHILD_GENERATED 8242 | STATE_PRUNED 934
SEARCH_STARTED 1   | SOLUTION_FOUND 1     | SEARCH_FINISHED 1
```

Benchmark completo (3 puzzles × 2 algoritmos × 5 repetições, um deles mock): **1,12 s**.

---

## 6. Contrato com a Pessoa 1 — cumprido

A trilha da Pessoa 1 foi entregue (`docs/07_ENTREGA_PESSOA_1_DFS_E_VALIDACAO.md`) e respeita o contrato combinado em `docs/PESSOA1_DESCRICAO.md`:

```js
DFS.resolver(estadoInicial, opcoes)        -> ResultadoResolucao
Validacao.validarQuadroInicial(matriz9x9)  -> ResultadoValidacao
```

Os quatro pontos de conexão estão ligados, e foi a própria Pessoa 1 que os trocou:

| Arquivo | Estado |
| ------- | ------ |
| `routes/resolver.js` → `RESOLVEDORES.dfs` | `DFS.resolver` real |
| `routes/resolver.js` → validação | `Validacao.validarQuadroInicial`; a guarda provisória foi removida |
| `routes/utilidades.js` → `todosSolvers.dfs` | `DFS.resolver` real |
| `bin/benchmark.js` → catálogo | `DFS.resolver` real |

Duas coisas que ela entregou além do combinado e que a interface precisou absorver:

- **`status: "cancelled"`** e um teto de eventos — tratados na seção 4.10.
- **`LIMITE_DE_BUSCA`**, um quinto código de validação que não estava no contrato original — tratado na seção 4.11.

A convenção de métricas aprovada pelo grupo (seção 4.4) foi respeitada: `fronteiraMaxima` na DFS carrega a profundidade máxima da pilha de recursão, e `estadosPodados` fica sempre em 0, por construção de uma busca cega.

O `erro`, sétimo estado visual da grade, deixou de ser inalcançável: a validação devolve `celulas` para `DUPLICATE_*` e `ZERO_DOMAIN`, e as coordenadas acendem sem nenhuma alteração adicional no cliente.

---

## 7. Checklist ponta a ponta (doc 04, P3-07)

Verificado no navegador, em `http://localhost:8080`, com o console aberto.

| # | Cenário | Situação |
| - | ------- | -------- |
| 1 | Digitar puzzle válido e resolver com DFS | OK — `solved`, 334 explorados, 2.500 eventos no fácil |
| 2 | Resolver o mesmo puzzle com GBFS | OK — solved, 259 eventos, 52 explorados |
| 3 | Pausar animação | OK — índice congela e não avança sozinho |
| 4 | Avançar passo a passo | OK — um evento por clique, confirmado nos 5 primeiros |
| 5 | Mudar velocidade | OK — controle aplica sem parar a reprodução |
| 6 | Verificar backtracking da DFS | OK — 282 eventos `BACKTRACK` no fácil, com `razao: RAMA_SEM_SOLUCAO` |
| 7 | Ver MRV / Degree / LCV / h no GBFS | OK — MRV = 1, Degree = 11, LCV com impacto, h = 62.444 |
| 8 | Duplicata em linha | OK — HTTP 422, `DUPLICATE_ROW`, 2 células acesas em vermelho |
| 9 | Duplicata em coluna | OK — HTTP 422, `DUPLICATE_COLUMN` |
| 10 | Duplicata em bloco 3×3 | OK — HTTP 422, `DUPLICATE_BLOCK` |
| 11 | Puzzle insolúvel | OK — HTTP 422, `UNSOLVABLE`, em âmbar e sem célula acesa |
| 12 | Limpar tabuleiro | OK |
| 13 | Benchmark silencioso | OK — CLI roda, imprime tabela, grava CSV |
| 14 | Comparação usa o mesmo estado inicial | OK — trocar de puzzle reinicia a comparação |
| 15 | Solução final válida | OK — DFS e GBFS resolvem o fácil, as duas soluções são válidas e idênticas |

Refeito integralmente no navegador **depois** do redesign visual (seção 4.6), com o console aberto: zero erros de JavaScript em todo o percurso. Também conferido: troca de abas; o painel explicativo passou a mostrar 5 linhas em `SEARCH_STARTED` (era 12, com 7 traços) e 10 em `CELL_SELECTED`; a barra de progresso salta corretamente dentro dos 43.067 eventos do difícil; `completoValido` devolve `solved`; o gerador produz 45 lacunas no nível médio com o aviso de unicidade.

### Os sete estados visuais da grade

Seis foram exercitados ao vivo durante a animação: `pista` (30 células no fácil), `valor-busca`, `selecionada` (passo 3), `tentativa` (passo 5), `podada` (passo 700 do difícil, que tem 934 podas) e `solucao` (51 células ao fim).

O sétimo, `erro`, **não é alcançável hoje**. A validação provisória de `routes/resolver.js` detecta a duplicata via `SudokuEstado.estaValido()` e devolve a mensagem, mas não as coordenadas — extrair quais células colidem é o P1-03. O caminho de renderização existe e está ligado (`Tabuleiro#destacarErros`); falta a origem do dado. Quando `validarQuadroInicial` devolver `celulas`, as células acendem sem nenhuma alteração adicional.

Conferido que as sete assinaturas visuais são mutuamente distintas e que nenhuma depende só de cor:

| Estado | Fundo | Borda | Decoração | Peso |
| --- | --- | --- | --- | --- |
| `pista` | `#0F172A` | sólida | — | 600 |
| `valor-busca` | `#0F172A` | sólida | — | 400 |
| `selecionada` | `#1E3A8A` | sólida | — | 400 |
| `tentativa` | `#78350F` | sólida | itálico | 400 |
| `podada` | `#7F1D1D` | sólida | riscado | 400 |
| `erro` | `#7F1D1D` | **tracejada** | — | 600 |
| `solucao` | `#14532D` | sólida | — | 400 |

`podada` e `erro` compartilham o fundo vermelho, mas diferem em borda, decoração e peso — e nunca aparecem ao mesmo tempo, já que `erro` é pré-busca e `podada` é durante.

**Limitação ambiental observada:** com a aba do navegador em segundo plano, o Chrome estrangula `setTimeout` para uma execução por segundo, então a animação anda a ~1 evento/s independentemente da velocidade escolhida. Não é defeito da aplicação; com a aba em primeiro plano respeita o valor configurado.

---

## 8. Bugs encontrados e corrigidos

**`index.js` não subia.** Duas falhas no arquivo original:

```js
console.log(`Servidor ativo rodando na porta ${port}`);  // ReferenceError: port is not defined
process.exit(1);                                         // matava o processo logo após o listen
```

Reescrito.

**`setTimeout` sem binding no player.** O `Player` recebia `agendar = setTimeout` como valor padrão. Chamado como `this.agendar(...)`, o `this` vira a instância do Player, e a implementação do navegador exige `this === window` — resultado: `Uncaught TypeError: Illegal invocation` e a reprodução automática travada em zero. O Node não faz essa exigência, então **os 24 testes do player passavam**. Só apareceu ao abrir a página. Corrigido envolvendo os padrões em funções seta.

Vale registrar como argumento a favor do checklist manual: nenhum dos 95 testes automatizados pegaria isso, porque a diferença está entre dois runtimes.

**Marca de solução apagada no último evento.** `SEARCH_FINISHED` chega depois de `SOLUTION_FOUND` carregando o mesmo snapshot; ao renderizá-lo, as marcas de solução recém-pintadas eram limpas e a animação terminava sem destaque. Corrigido tratando os dois eventos juntos.

**Deadlock em aba oculta.** A cessão de controle da seção 4.12 usava `requestAnimationFrame` sozinho. Em aba de segundo plano o navegador não agenda frames, então o `await` nunca resolvia e o controlador ficava preso em `VALIDANDO` para sempre — botão Resolver desabilitado, sem recuperação possível. Bastava trocar de aba ao clicar em Resolver. Medido na página: `visibilityState: "hidden"`, `rAF` não dispara em 2 s, estado congelado. Corrigido fazendo o `rAF` correr contra um `setTimeout` de 50 ms; em aba oculta não há nada para pintar, então perder o frame é o comportamento certo.

**Tabuleiro animado reusado como entrada.** `resolver()` lê o tabuleiro da tela. Depois de reproduzir uma animação, a tela mostra um estado *intermediário* da busca, não o puzzle — e a próxima execução recebia isso como entrada. Observado na prática: animar a DFS até o primeiro `BACKTRACK` e então rodar o GBFS devolvia "não tem solução possível" num puzzle fácil, porque o estado congelado no meio de um retrocesso é de fato insolúvel.

Isso quebrava a garantia central da comparação, o doc 00 §14.2: os dois algoritmos precisam receber cópias do **mesmo** estado inicial. A chave de 81 caracteres (seção 4.7) detectava a divergência e reiniciava a comparação, mas o comportamento de origem estava errado. Corrigido restaurando as pistas congeladas antes de reler o tabuleiro, quando há animação carregada. Coberto por `P3-04 animar e depois resolver de novo NAO usa o tabuleiro animado`.

**Fixture de teste compartilhada por referência.** `servicos/PuzzlesFixos.js` devolvia as matrizes de `tests/casosBase.js` por referência. Um solver que mutasse a entrada corromperia a fixture usada pelos testes das outras trilhas, e o sintoma apareceria muito longe da causa. Passou a devolver cópias.

---

## 9. O que falta

Nada bloqueado, nada pendente de verificação. A passagem completa foi refeita no navegador após a integração com a Pessoa 1: **137 testes automatizados** e os 15 cenários do checklist, com zero erros de console.

Confirmado na tela nesta última rodada: os dois tons de recusa (duplicata em vermelho com 2 células acesas; insolúvel em âmbar `rgb(251,191,36)` sem célula acesa); o `cancelled` do difícil com mensagem explicativa, "Ver solução" desabilitado e comparação não registrada; o botão "Sem animação" convertendo esse mesmo caso em `solved` com 14.356 estados explorados; o primeiro `BACKTRACK` da DFS no passo 62 do fácil; e a comparação DFS × GBFS completa sobre o mesmo puzzle.

Melhorias possíveis, não exigidas pelo documento:

- reexibir o caminho de solução (`caminhoDeSolucao`) como modo alternativo de animação;
- exportar o CSV do benchmark direto pela interface (o dado já vai na resposta de `POST /api/benchmark`).
