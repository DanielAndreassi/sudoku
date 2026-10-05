<!-- Gerado a partir de docs/relatorio/relatorio.html, a mesma fonte do docs/RELATORIO.pdf. Nao editar a mao: regenerar apos alterar o HTML. -->

nome da instituição

curso

nome completo do integrante 1 nome completo do integrante 2 nome completo do integrante 3

Sudoku como problema de busca: análise comparativa entre busca cega e busca heurística

cidade – UF

2026

nome completo do integrante 1 nome completo do integrante 2 nome completo do integrante 3

Sudoku como problema de busca: análise comparativa entre busca cega e busca heurística

Relatório técnico apresentado à disciplina de , do curso de da , como requisito parcial para avaliação. Professor:

cidade – UF

2026

# RESUMO

Este relatório apresenta a modelagem do Sudoku como problema de busca em espaço de estados e a implementação de dois resolvedores para compará-los experimentalmente: uma busca cega em profundidade com retrocesso e uma busca heurística gulosa pelo melhor primeiro. A busca cega adota política fixa de expansão, selecionando sempre a primeira célula vazia em ordem de linha e coluna e testando os valores de um a nove em ordem crescente. A busca heurística combina duas camadas de decisão: a escolha da variável, por mínimo de valores remanescentes com desempate por grau, a ordenação dos valores pelo valor menos restritivo, e uma função de prioridade de estado que ordena a fronteira. O sistema registra, para cada execução, dez métricas de esforço computacional e uma sequência de eventos que permite reproduzir visualmente o percurso de cada algoritmo. Foram medidas sessenta execuções de busca e noventa de validação sobre nove tabuleiros de referência. Os resultados mostram que a busca heurística reduz o número de estados explorados em até 42% no tabuleiro mais difícil e elimina completamente o retrocesso, mas não é a mais rápida em tempo absoluto nesse mesmo caso: a busca cega o resolve em aproximadamente metade do tempo, porque o custo por nó da avaliação heurística supera a economia obtida em número de nós. Discute-se também que duas das métricas usualmente comparadas entre algoritmos de busca não são diretamente comparáveis entre as duas implementações, e propõe-se uma métrica derivada que o é.

**Palavras-chave:** Inteligência artificial. Busca em espaço de estados. Heurística. Satisfação de restrições. Sudoku.

# LISTA DE FIGURAS

- Figura 1 Expansão de um nó na busca heurística — p. 8
- Figura 2 Pipeline de validação do tabuleiro de entrada — p. 12

# LISTA DE TABELAS

- Tabela 1 Parâmetros adotados nos dois resolvedores — p. 13
- Tabela 2 Desempenho por tabuleiro e algoritmo — p. 15
- Tabela 3 Custo da validação da entrada — p. 16
- Tabela 4 Métricas não comparáveis entre os algoritmos — p. 16

# SUMÁRIO

- **1 Introdução** — p. 6
- **2 Fundamentação teórica** — p. 7
    - 2.1 O Sudoku como problema de busca — p. 7
    - 2.2 Busca cega em profundidade com retrocesso — p. 7
    - 2.3 Busca heurística gulosa pelo melhor primeiro — p. 8
    - 2.4 Heurísticas de seleção de variável e de valor — p. 9
    - 2.5 Função de prioridade de estado — p. 10
- **3 Materiais e métodos** — p. 11
    - 3.1 Arquitetura do sistema — p. 11
    - 3.2 Contrato de métricas — p. 11
    - 3.3 Validação da entrada — p. 12
    - 3.4 Parâmetros adotados — p. 13
    - 3.5 Protocolo experimental — p. 14
- **4 Resultados** — p. 15
    - 4.1 Desempenho dos resolvedores — p. 15
    - 4.2 Custo da validação — p. 15
    - 4.3 Métricas não comparáveis — p. 16
- **5 Discussão** — p. 18
    - 5.1 A heurística reduz o espaço explorado, mas não garante menor tempo — p. 18
    - 5.2 O retrocesso como medida do custo da ignorância — p. 18
    - 5.3 O comportamento nos tabuleiros mais fáceis — p. 19
    - 5.4 Custo da validação e suas implicações — p. 19
    - 5.5 Limitações — p. 19
- **6 Considerações finais** — p. 21
- **Apêndice A – Protocolo de reprodução** — p. 22

# 1 Introdução

O Sudoku é um quebra-cabeça de preenchimento em uma grade de nove por nove células, subdividida em nove blocos de três por três. Parte das células vem preenchida com dígitos de um a nove, chamados pistas, e o objetivo é completar as demais de modo que nenhum dígito se repita em uma mesma linha, coluna ou bloco. Embora seja popularmente tratado como passatempo, o Sudoku é um problema de satisfação de restrições e, como tal, pode ser formalizado como busca em espaço de estados — o que o torna um objeto conveniente para comparar experimentalmente estratégias de busca.

Este trabalho implementa dois resolvedores sobre a mesma modelagem e os compara sob condições idênticas. O primeiro é uma busca cega em profundidade com retrocesso, que não utiliza qualquer informação sobre o estado além das regras do próprio jogo. O segundo é uma busca heurística gulosa pelo melhor primeiro, que emprega três heurísticas de expansão local e uma função de prioridade para ordenar a fronteira. A escolha desses dois algoritmos é deliberada: eles ocupam extremos opostos quanto ao uso de informação, e a diferença entre seus desempenhos isola o efeito da informação heurística.

Além dos resolvedores, foi construído um sistema completo que permite entrada manual do tabuleiro, validação da entrada, execução de qualquer um dos algoritmos, reprodução visual passo a passo do percurso da busca e comparação das métricas entre execuções. Essa camada não é acessória ao experimento: é ela que garante que os dois algoritmos recebam exatamente o mesmo tabuleiro inicial e que o tempo medido corresponda à busca, e não à animação.

O relatório está organizado em seis capítulos. O capítulo 2 apresenta a formalização adotada e descreve os dois algoritmos e as heurísticas implementadas. O capítulo 3 descreve a arquitetura do sistema, o contrato de métricas, os parâmetros adotados e o protocolo experimental. O capítulo 4 reúne os resultados em quatro tabelas. O capítulo 5 discute esses resultados, incluindo um achado contraintuitivo quanto ao tempo de execução, e expõe os limites do experimento. O capítulo 6 encerra com as considerações finais.

# 2 Fundamentação teórica

Este capítulo descreve a formalização e os algoritmos tal como foram implementados neste trabalho. Não se trata de uma revisão de literatura: as descrições abaixo correspondem ao comportamento efetivo do sistema construído, e os nomes das heurísticas são usados no sentido corrente da área de satisfação de restrições.

## 2.1 O Sudoku como problema de busca

Um estado é uma configuração da grade, representada por uma matriz nove por nove de inteiros, em que valores de um a nove indicam células preenchidas e o valor zero indica célula vazia. O estado inicial é o tabuleiro informado pelo usuário ou produzido pelo gerador. Um estado é objetivo quando não possui células vazias e nenhuma linha, coluna ou bloco contém repetição.

Uma ação consiste em atribuir um valor a uma célula vazia sem violar as restrições de linha, coluna e bloco. A função de transição recebe um estado e uma ação válida e produz um novo estado. Uma regra de implementação é obrigatória aqui: o novo estado não altera o estado pai. Em busca com fronteira, mutar uma matriz compartilhada corromperia nós ainda não explorados, e o defeito se manifestaria longe da causa.

O domínio de uma célula vazia é o conjunto de valores que podem ser nela inseridos sem violar restrição. O domínio é a base de todas as heurísticas implementadas e também do critério de poda: se alguma célula vazia tem domínio vazio, o estado não pode ser completado e é descartado. Esse descarte é poda por inconsistência, não detecção de solução.

## 2.2 Busca cega em profundidade com retrocesso

A busca em profundidade implementada percorre um ramo até o fim antes de tentar outro, e adota uma política fixa de expansão que não depende de qualquer propriedade do estado além da legalidade das jogadas:

1. percorrer a grade em ordem de linha e coluna;
2. selecionar a primeira célula vazia encontrada;
3. testar os valores de um a nove em ordem crescente;
4. descartar os valores que violem linha, coluna ou bloco;
5. aprofundar no primeiro filho válido;
6. ao retornar de um ramo sem solução, desfazer a atribuição e tentar o próximo valor.

Verificar se uma ação viola as regras não transforma esta busca em informada: isso apenas define quais ações são legais no problema. A busca permanece cega porque nenhuma decisão — nem qual célula preencher, nem em que ordem testar os valores — considera quão restrito está o estado. Essa restrição é deliberada e serve de linha de base: sem ela, a comparação com a busca heurística não isolaria o efeito da informação.

O retrocesso ocorre quando uma atribuição localmente válida conduz a um estado que não pode ser completado. A atribuição é desfeita, o contador de retrocessos é incrementado e o próximo valor é tentado. Quando todos os valores de uma célula se esgotam, o retrocesso propaga para o nível anterior.

## 2.3 Busca heurística gulosa pelo melhor primeiro

A busca gulosa pelo melhor primeiro mantém uma fronteira de estados aguardando expansão e retira sempre aquele de menor valor de uma função de prioridade. Diferentemente da busca em profundidade, o próximo estado expandido não é necessariamente descendente do estado anteriormente expandido: a busca pode saltar entre ramos distintos da árvore.

Uma observação conceitual importante orientou a implementação. Dizer apenas que o resolvedor usa a heurística de mínimo de valores remanescentes seria insuficiente, porque essa heurística responde à pergunta "qual célula preencher agora", que é uma decisão *interna* à expansão de um estado. A busca gulosa precisa responder também "entre todos os estados da fronteira, qual expandir primeiro", que é uma decisão *entre* estados. Por isso o resolvedor opera em duas camadas: três heurísticas de expansão local, descritas na seção 2.4, e uma função de prioridade de estado, descrita na seção 2.5.

A figura 1 apresenta a sequência completa de decisões na expansão de um nó.

**Figura 1 – Expansão de um nó na busca heurística**

![Fluxograma da expansão de um nó](figuras/fig1-expansao-gbfs.svg)

*Fonte: elaborado pelos autores.*

## 2.4 Heurísticas de seleção de variável e de valor

Escolhida a expansão de um estado, três heurísticas atuam em sequência.

**Mínimo de valores remanescentes.** Entre as células vazias, seleciona-se aquela de menor domínio. A intuição é que a célula mais restrita possui o menor fator de ramificação e tende a revelar contradições mais cedo, antes que a busca invista esforço em ramos condenados.

**Grau.** Quando duas ou mais células empatam no critério anterior, escolhe-se a que possui o maior número de vizinhos vazios distintos, considerando-se vizinhos as células que compartilham linha, coluna ou bloco. Uma célula que compartilha simultaneamente a linha e o bloco é contada uma única vez. Preencher a célula de maior grau propaga restrição para o maior número de células ainda indefinidas.

**Valor menos restritivo.** Definida a célula, resta ordenar seus candidatos. Para cada candidato simula-se a atribuição e recalculam-se os domínios dos vizinhos vazios; o impacto do candidato é a soma das reduções observadas. Os candidatos são tentados em ordem crescente de impacto, de modo que a busca experimente primeiro o valor que menos restringe o restante do tabuleiro. Candidatos que zeram o domínio de algum vizinho são descartados de imediato, por produzirem contradição direta. Empates são resolvidos por ordem numérica crescente, o que torna a busca reproduzível.

## 2.5 Função de prioridade de estado

Para ordenar a fronteira, define-se para um estado *s*: *E(s)* como o número de células vazias; *m(s)* como o menor tamanho de domínio entre as células vazias; e *U(s)* como a incerteza total, dada pela soma de *|D(c)| − 1* sobre todas as células vazias. Uma célula de domínio unitário, por estar forçada, contribui com zero para a incerteza. A função adotada é:

```
h(s) = E(s) + U(s)/9 + m(s)/9
```

Quanto menor *h(s)*, maior a prioridade do estado. A função favorece estados com menos células restantes, menor incerteza acumulada e ao menos uma célula bastante restrita. O termo dominante é *E(s)*; os dois termos divididos por nove funcionam como critérios de refinamento dentro de uma mesma contagem de células vazias.

Cabe registrar que a busca gulosa não exige heurística admissível, diferentemente das condições discutidas para algoritmos que garantem otimalidade. Aqui a função é uma estimativa da promessa do estado, não uma cota inferior de custo, e nenhum custo acumulado é somado ao score — o que distingue esta busca de uma busca A*.

Quando dois estados possuem o mesmo *h*, aplicam-se, nesta ordem: menor número de células vazias, menor incerteza e, por fim, ordem de inserção na fronteira. O último critério garante que a ordenação seja total e estável, condição para que execuções repetidas sobre o mesmo tabuleiro produzam exatamente a mesma sequência de expansões.

# 3 Materiais e métodos

## 3.1 Arquitetura do sistema

O sistema foi implementado em JavaScript, sobre o ambiente de execução Node.js, e está organizado em camadas com dependências unidirecionais. O núcleo de domínio reúne a representação do estado, as regras do jogo, o cálculo de domínios e a função de transição. Os resolvedores dependem apenas desse núcleo. A validação da entrada depende do núcleo e da busca cega. A camada de apresentação depende dos contratos, nunca das implementações.

Essa separação atende a uma exigência do experimento: a lógica de busca não pode depender de interface, temporizadores ou elementos de tela. Um resolvedor recebe um estado, executa a busca inteira e devolve um resultado contendo o estado final, as métricas e uma sequência de eventos. A interface apenas reproduz os eventos já gravados. Em consequência, o tempo medido corresponde exclusivamente à busca, nunca à velocidade escolhida para a animação.

Os dois resolvedores expõem a mesma assinatura e devolvem o mesmo tipo de resultado. É essa igualdade de contrato que permite ao sistema trocar de algoritmo sem qualquer tratamento especial e, principalmente, que torna as métricas comparáveis por construção.

## 3.2 Contrato de métricas

Cada execução registra dez métricas, com definição única para os dois algoritmos:

- **tempo** – duração da busca, em milissegundos;
- **estados explorados** – nós efetivamente processados;
- **estados gerados** – estados filhos criados;
- **tentativas de candidatos** – valores analisados durante a busca;
- **estados mortos** – estados cuja continuação se mostrou impossível;
- **estados podados** – estados descartados antes da expansão completa;
- **profundidade da solução** – número de atribuições até a solução;
- **fronteira máxima** – maior quantidade de nós simultaneamente pendentes;
- **avaliações heurísticas** – quantidade de cálculos de *h(s)*;
- **retrocessos** – atribuições desfeitas por esgotamento do ramo.

Duas dessas métricas exigem convenção explícita, por medirem objetos distintos em cada algoritmo. Na busca heurística, a fronteira máxima é o pico real da fila de prioridade. Na busca cega não existe fila: adotou-se, por convenção documentada, a profundidade máxima atingida pela pilha de recursão, que é o análogo direto de quantos estados permanecem simultaneamente vivos. Quanto aos estados mortos, as duas buscas detectam inconsistência em momentos distintos do ciclo, e o efeito disso sobre a comparação é tratado na seção 4.3.

Além das métricas, cada execução instrumentada grava uma sequência de eventos — início da busca, expansão de nó, seleção de célula, cálculo de candidatos, tentativa de valor, geração de filho, poda, retrocesso, solução encontrada e fim da busca. Cada evento carrega uma cópia da grade no instante em que ocorreu. Essa cópia é indispensável na busca heurística: como a fronteira pode saltar entre ramos, sem ela a reprodução visual exibiria transições que não aconteceram.

## 3.3 Validação da entrada

Antes de qualquer busca, o tabuleiro informado passa por um pipeline de validação em quatro etapas sucessivas, cada uma encerrando no primeiro erro encontrado. A ordem importa: um tabuleiro com duplicata *e* sem solução é reportado como duplicata, nunca como insolúvel, porque corrigir a duplicata altera o conjunto de soluções possíveis e afirmar insolubilidade antes disso seria falso.

**Figura 2 – Pipeline de validação do tabuleiro de entrada**

![Pipeline de validação em quatro etapas](figuras/fig2-pipeline-validacao.svg)

*Fonte: elaborado pelos autores.*

A quarta etapa merece destaque. Um tabuleiro pode respeitar todas as regras, não conter nenhuma célula de domínio vazio, e ainda assim não possuir solução. Comprovar a inexistência de solução é, por natureza, um problema de busca: a única forma de responder é executar internamente um resolvedor que pare na primeira solução encontrada. O sistema reutiliza a busca cega em modo silencioso para isso, descartando suas métricas e eventos, de modo que o custo dessa prova não se confunda com o custo da execução escolhida pelo usuário.

## 3.4 Parâmetros adotados

A tabela 1 reúne os parâmetros que governam o comportamento dos dois resolvedores e do experimento. Eles foram fixados antes das medições e não variaram entre execuções.

**Tabela 1 – Parâmetros adotados nos dois resolvedores**

| Parâmetro | Valor adotado | Aplica-se a |
| --- | --- | --- |
| Seleção de célula | Primeira vazia, ordem de linha e coluna | Busca cega |
| Ordem dos valores | Crescente, de 1 a 9 | Busca cega |
| Seleção de célula | Mínimo de valores remanescentes | Busca heurística |
| Desempate de célula | Maior grau; depois menor linha, menor coluna | Busca heurística |
| Ordem dos valores | Menor impacto; empate por valor crescente | Busca heurística |
| Função de prioridade | h(s) = E(s) + U(s)/9 + m(s)/9 | Busca heurística |
| Desempate na fronteira | Menor E; menor U; ordem de inserção | Busca heurística |
| Estrutura da fronteira | Lista ordenada na inserção | Busca heurística |
| Teto de eventos | 60.000 eventos por execução instrumentada | Ambos |
| Teto de nós | 250.000 estados explorados | Ambos |
| Modo de medição | Silencioso, sem gravação de eventos | Ambos |
| Repetições por caso | 10 | Experimento |
| Estatística de tempo | Mediana | Experimento |

*Fonte: elaborado pelos autores.*

Dois parâmetros requerem justificativa. O **teto de eventos** existe porque a instrumentação grava uma cópia da grade por evento: no tabuleiro difícil, a busca cega ultrapassaria duzentos mil eventos, o que corresponde a centenas de megabytes de dados trafegados até a interface. Ao atingir o teto, a execução é interrompida e reportada como cancelada — reportá-la como insolúvel seria afirmar algo que não foi verificado. O teto não limita a busca em si: no modo silencioso nenhum evento é gravado, e foi nesse modo que todas as medições deste relatório foram feitas.

A escolha da **mediana** sobre a média decorre de os tempos sofrerem efeito de aquecimento do motor de execução: as primeiras repetições são sistematicamente mais lentas, e a mediana é menos sensível a esses valores extremos do que a média.

## 3.5 Protocolo experimental

As medições foram realizadas em um computador com processador Apple M4, sistema macOS 26.6.2 e Node.js versão 26.8.1. Todas as execuções ocorreram em modo silencioso, de modo que o tempo registrado corresponda à busca e não à construção de eventos.

Foram usados nove tabuleiros de referência, fixos e versionados junto ao código, divididos em dois conjuntos. O primeiro, com três tabuleiros solucionáveis de dificuldade crescente, alimenta a comparação de desempenho. O segundo, com seis casos adicionais, exercita o pipeline de validação: um tabuleiro já completo e válido, três com duplicata em linha, coluna e bloco, um localmente válido porém insolúvel, e um contendo célula de domínio vazio.

Para cada combinação de tabuleiro e algoritmo foram executadas dez repetições, cada uma recebendo uma cópia independente do estado inicial, totalizando sessenta execuções de busca. O procedimento verifica, ao final de cada execução, se a matriz de entrada permaneceu inalterada, o que detectaria um resolvedor que mutasse o estado compartilhado. Nenhuma violação foi registrada. A validação foi medida separadamente, com dez repetições sobre cada um dos nove tabuleiros, totalizando noventa execuções.

Os dados brutos de ambas as medições estão disponíveis nos arquivos `benchmark-2026-10-05.csv` e `validacao-2026-10-05.csv`, com uma linha por execução. Cada linha carrega uma chave de oitenta e um caracteres que identifica univocamente o tabuleiro medido, de modo que qualquer número deste relatório possa ser rastreado até sua origem. O apêndice A descreve os comandos que reproduzem as duas medições.

# 4 Resultados

## 4.1 Desempenho dos resolvedores

A tabela 2 reúne as sessenta execuções de busca, agregadas por tabuleiro e algoritmo. Os tempos são apresentados como mediana de dez repetições; as contagens são idênticas em todas as repetições, por serem os dois algoritmos determinísticos.

**Tabela 2 – Desempenho por tabuleiro e algoritmo**

| Tabuleiro | Algoritmo | Tempo (ms) | Explorados | Gerados | Tentativas | Mortos | Podados | Retrocessos | Aval. h(s) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Fácil | Heurística | 1,77 | 52 | 51 | 51 | 0 | 0 | 0 | 52 |
| Fácil | Cega | 2,58 | 334 | 516 | 2.777 | 183 | 0 | 282 | 0 |
| Intermediário | Heurística | 0,84 | 46 | 45 | 45 | 0 | 0 | 0 | 46 |
| Intermediário | Cega | 0,16 | 46 | 50 | 226 | 5 | 0 | 0 | 0 |
| Difícil | Heurística | 194,90 | 8.238 | 8.242 | 9.176 | 0 | 934 | 0 | 8.243 |
| Difícil | Cega | 100,30 | 14.356 | 22.067 | 128.951 | 7.712 | 0 | 14.295 | 0 |

*Fonte: elaborado pelos autores, a partir de `benchmark-2026-10-05.csv`. Tempo como mediana de 10 repetições. Todas as execuções concluíram com status resolvido.*

Três observações decorrem diretamente dos números. Primeiro, a busca heurística reduz o número de estados explorados em todos os casos em que há retrocesso: de 334 para 52 no fácil, uma redução de 84%, e de 14.356 para 8.238 no difícil, uma redução de 43%. Segundo, a busca heurística elimina por completo o retrocesso — zero em todos os tabuleiros, contra 282 e 14.295 da busca cega. Terceiro, e contrariando a expectativa, a busca cega é mais rápida em tempo absoluto no tabuleiro difícil: 100,30 contra 194,90 milissegundos, praticamente o dobro em favor da busca sem informação.

A diferença entre tentativas de candidatos é o indicador mais expressivo da economia heurística: 128.951 contra 9.176 no difícil, uma razão de quatorze para um. A fronteira máxima também contrasta: a busca heurística manteve no máximo onze estados alternativos pendentes no difícil e apenas um nos dois primeiros tabuleiros, o que significa que, nestes, ela caminhou em linha reta até a solução, sem jamais precisar considerar alternativa.

## 4.2 Custo da validação

A tabela 3 reúne as noventa execuções de validação. Os nove tabuleiros cobrem os cinco códigos de recusa previstos e o caso de aceitação.

**Tabela 3 – Custo da validação da entrada**

| Tabuleiro | Resultado | Tempo (ms) | Células apontadas |
| --- | --- | --- | --- |
| Duplicata em linha | Recusado | 0,006 | 2 |
| Duplicata em coluna | Recusado | 0,010 | 2 |
| Célula sem valor possível | Recusado | 0,013 | 2 |
| Duplicata em bloco | Recusado | 0,016 | 2 |
| Sem solução | Recusado | 0,775 | 0 |
| Completo e válido | Aceito | 0,023 | 0 |
| Intermediário | Aceito | 0,219 | 0 |
| Fácil | Aceito | 3,102 | 0 |
| Difícil | Aceito | 100,395 | 0 |

*Fonte: elaborado pelos autores, a partir de `validacao-2026-10-05.csv`. Tempo como mediana de 10 repetições, em ordem crescente.*

Os dados revelam uma assimetria de quatro ordens de grandeza entre os extremos: recusar uma duplicata em linha custa 0,006 milissegundo, enquanto aceitar o tabuleiro difícil custa 100,395 milissegundos. A separação é nítida entre as duas categorias de recusa: as que dependem apenas de inspeção local do tabuleiro ficam abaixo de 0,02 milissegundo, enquanto a recusa por insolubilidade custa 0,775 milissegundo, por exigir execução de busca.

O tempo de aceitação do tabuleiro difícil, 100,395 milissegundos, é praticamente idêntico ao tempo da busca cega sobre o mesmo tabuleiro, 100,30 milissegundos da tabela 2. A coincidência não é acidental: provar que existe solução é executar a própria busca cega até a primeira solução.

## 4.3 Métricas não comparáveis

Duas das métricas coletadas não podem ser comparadas diretamente entre os algoritmos, por medirem objetos distintos. A tabela 4 explicita o que cada uma representa em cada caso.

**Tabela 4 – Métricas não comparáveis entre os algoritmos**

| Métrica | Na busca cega | Na busca heurística | Valores no difícil |
| --- | --- | --- | --- |
| Estados mortos | Becos detectados após gerar o filho | Sempre zero: a inconsistência é detectada antes da inserção na fronteira | 7.712 contra 0 |
| Estados podados | Sempre zero: podar exige informação que a busca cega não possui | Filhos descartados antes de entrar na fronteira | 0 contra 934 |
| Fronteira máxima | Profundidade máxima da pilha de recursão | Pico de ocupação da fila de prioridade | 60 contra 11 |
| **Estados descartados** | **Soma de mortos e podados. Independe de qual contador cada algoritmo incrementa, e por isso é comparável.** | **7.712 contra 934** |  |

*Fonte: elaborado pelos autores.*

A leitura isolada das duas primeiras linhas induziria à conclusão falsa de que a busca heurística nunca encontra becos sem saída, já que registra zero estados mortos. Ela encontra 934 no tabuleiro difícil — apenas os contabiliza em outro campo, porque detecta a inconsistência em momento distinto do ciclo de expansão. A métrica derivada apresentada na última linha soma os dois contadores e é a que deve ser usada em comparação.

# 5 Discussão

## 5.1 A heurística reduz o espaço explorado, mas não garante menor tempo

O resultado mais relevante do experimento é a divergência entre duas medidas que habitualmente caminham juntas. No tabuleiro difícil, a busca heurística explora 43% menos estados e analisa quatorze vezes menos candidatos que a busca cega, e ainda assim leva praticamente o dobro do tempo para concluir.

A explicação está no custo por nó. A busca cega faz pouquíssimo trabalho em cada estado: localiza a primeira célula vazia e testa valores em ordem, descartando os ilegais. A busca heurística, a cada expansão, calcula o domínio de todas as células vazias, ordena-as pelo tamanho do domínio, desempata por grau, simula a atribuição de cada candidato para medir seu impacto sobre os vizinhos, e por fim calcula a função de prioridade de cada filho gerado. As 8.243 avaliações da função de prioridade registradas na tabela 2 representam apenas a última dessas etapas.

Há ainda um custo estrutural: a fronteira foi implementada como lista ordenada na inserção, cujo custo de inserção é linear no número de elementos. Com pico de onze elementos, esse custo é irrelevante neste experimento, mas a decisão está documentada porque deixaria de sê-lo em problemas de fronteira maior.

A conclusão que os números sustentam é que a informação heurística comprou redução de espaço de busca ao preço de trabalho por nó, e que nesse tabuleiro o preço superou o ganho. Isso não desqualifica a busca heurística — qualifica a métrica. Tempo de parede mede o custo conjunto de algoritmo e implementação; estados explorados mede o algoritmo. Para avaliar a qualidade da heurística, a segunda medida é a pertinente; para decidir o que usar em produção, a primeira também importa.

## 5.2 O retrocesso como medida do custo da ignorância

A diferença mais limpa entre os dois algoritmos não está no tempo, e sim nos retrocessos: 14.295 contra zero no tabuleiro difícil, 282 contra zero no fácil. A busca heurística não desfez uma única atribuição em nenhum dos três tabuleiros.

Isso decorre diretamente da combinação das heurísticas. Escolher sempre a célula de menor domínio faz com que contradições se manifestem na própria escolha — uma célula de domínio vazio é detectada e o estado é descartado antes de qualquer atribuição — em vez de só aparecerem vários níveis adiante. Ordenar os valores pelo menos restritivo reduz a chance de que o primeiro valor tentado conduza a um beco.

Vale notar que ausência de retrocesso não significa ausência de erro. A busca heurística descartou 934 estados no tabuleiro difícil. A diferença é que ela os descartou antes de investir esforço neles, enquanto a busca cega só descobriu seus 7.712 becos depois de construir os estados correspondentes.

## 5.3 O comportamento nos tabuleiros mais fáceis

Nos tabuleiros fácil e intermediário, a fronteira máxima da busca heurística foi um. Isso significa que, após cada expansão, exatamente um filho sobreviveu à poda, e a busca caminhou em linha reta da entrada até a solução, sem nunca manter alternativa pendente. Em termos práticos, as heurísticas resolveram esses tabuleiros por propagação de restrição, e a camada de busca propriamente dita não precisou escolher nada.

No tabuleiro intermediário, a busca cega foi mais rápida por um fator de cinco, e com apenas cinco becos e nenhum retrocesso. Esse caso mostra o limite do ganho heurístico: quando o tabuleiro é suficientemente restrito para que a ordem natural de varredura já encontre poucos becos, o trabalho extra da heurística não se paga.

## 5.4 Custo da validação e suas implicações

A tabela 3 mostra que recusar é barato e aceitar é caro, e a razão é estrutural: as três primeiras etapas do pipeline inspecionam o tabuleiro diretamente, enquanto a quarta precisa executar uma busca completa até a primeira solução. Provar que não existe solução, no limite, exige esgotar o espaço de estados.

Isso tem uma consequência prática que o sistema precisou absorver: no tabuleiro difícil, os 100 milissegundos da validação são pagos *antes* de a busca principal começar, em toda requisição. Do ponto de vista do usuário, o sistema demora o dobro do que a métrica de busca informa. A alternativa — dispensar a prova de solubilidade — foi descartada por tornar impossível distinguir um tabuleiro insolúvel de um erro de digitação.

## 5.5 Limitações

Os resultados deste relatório devem ser lidos com quatro ressalvas.

As medições foram feitas em uma única máquina, com um único motor de execução. Os tempos absolutos não são transferíveis para outro ambiente; as contagens de estados, por serem determinísticas, são.

Foram usados três tabuleiros solucionáveis. Três pontos não caracterizam uma curva, e a inversão de desempenho observada no difícil pode não se manter em tabuleiros de outras características. Em particular, os três casos têm o mesmo número de células vazias a preencher em dois deles, o que limita a variação controlada.

O gerador de tabuleiros implementado produz instâncias com ao menos uma solução, por construção, mas não garante solução única. Os tabuleiros de referência usados nas medições são fixos e versionados, de modo que o experimento é reproduzível; a ressalva vale para tabuleiros gerados em demonstração.

Por fim, a comparação mede duas implementações, não dois algoritmos em abstrato. Escolhas como a estrutura de dados da fronteira e o recálculo integral de domínios a cada expansão afetam o tempo medido e poderiam ser otimizadas sem alterar o algoritmo.

# 6 Considerações finais

Este trabalho modelou o Sudoku como problema de busca em espaço de estados e implementou dois resolvedores sobre a mesma base, permitindo compará-los sob condições controladas. Os dois objetivos propostos foram atendidos: os algoritmos e seus parâmetros estão especificados, e as medições cobrem sessenta execuções de busca e noventa de validação sobre nove tabuleiros de referência.

A comparação confirmou a expectativa quanto ao espaço de busca: a estratégia informada explora menos estados, analisa muito menos candidatos e elimina o retrocesso por completo. Contrariou, porém, a expectativa quanto ao tempo, ao perder para a busca cega no tabuleiro mais difícil. Esse resultado foi mantido no relatório em vez de omitido, por ser o achado mais instrutivo do experimento: ele separa a qualidade de um algoritmo do custo de sua implementação, e mostra que a escolha da métrica determina a conclusão.

Duas contribuições metodológicas merecem registro. A primeira é a identificação de que duas métricas de uso corrente não são comparáveis entre as duas estratégias, e a proposição de uma métrica derivada que o é. A segunda é a separação estrita entre busca e apresentação, que garantiu que o tempo medido correspondesse exclusivamente à busca.

Como continuidade, três caminhos se apresentam. Substituir a lista ordenada por uma fila de prioridade em heap reduziria o custo por inserção e permitiria avaliar se a inversão de desempenho observada persiste. Ampliar o conjunto de tabuleiros, variando sistematicamente o número de pistas, permitiria caracterizar em que faixa cada estratégia predomina. E incorporar propagação de restrição entre expansões poderia reduzir o número de avaliações heurísticas sem abrir mão da qualidade da ordenação.

# Apêndice A – Protocolo de reprodução

Os comandos abaixo reproduzem integralmente as medições apresentadas nos capítulos 4 e 5. Requerem apenas o ambiente Node.js instalado.

**Preparação do ambiente:**

```
npm ci
```

**Verificação da suíte de testes automatizados:**

```
npm test
```

A suíte contém 137 testes, cobrindo o núcleo de domínio, os dois resolvedores, as heurísticas isoladamente, a fronteira ordenada, a validação, o gerador, o motor de benchmark e a máquina de estados da interface.

**Medição de desempenho (tabela 2):**

```
node bin/benchmark.js --puzzles=facil,intermediario,dificil \
                      --repeticoes=10 \
                      --saida=docs/benchmark-2026-10-05.csv
```

**Medição do custo de validação (tabela 3):**

```
node bin/medir-validacao.js --repeticoes=10 \
                            --saida=docs/validacao-2026-10-05.csv
```

Ambos imprimem no terminal a tabela já agregada por mediana e gravam um arquivo com os dados brutos, uma linha por execução. Cada linha contém a chave de oitenta e um caracteres do tabuleiro medido, obtida concatenando as nove linhas da grade, o que permite rastrear qualquer valor deste relatório até a execução que o originou.

**Execução do sistema completo:**

```
npm start
```

A interface fica disponível em `http://localhost:8080` e permite entrada manual do tabuleiro, carregamento dos casos de referência, geração de tabuleiros, escolha do algoritmo, reprodução passo a passo da busca e comparação das métricas entre execuções sobre o mesmo tabuleiro inicial.
