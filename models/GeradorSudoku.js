import Regras from "./Regras.js";
import SudokuEstado from "./SudokuEstado.js";

export const AVISO_NIVEL =
    "A remoção aleatória de células não garante solução única. " +
    "O gerador garante apenas que existe ao menos uma solução: a matriz " +
    "completa produzida antes da remoção. A quantidade de células removidas " +
    "é apenas uma categoria experimental por quantidade de lacunas, não uma "
    "classificação formal da dificuldade humana do Sudoku."
;

/**
 * Quantidade de células removidas em cada nível experimental.
 */
export const CELULAS_REMOVIDAS_POR_NIVEL = {
    facil: 35,
    medio: 45,
    dificil: 55,
};

const TOTAL_LINHAS = 9;
const TOTAL_COLUNAS = 9;
const TOTAL_CELULAS = TOTAL_LINHAS * TOTAL_COLUNAS;
const VALORES = [1, 2, 3, 4, 5, 6, 7, 8, 9];

/**
 * Gerador de Sudoku sem estado global.
 *
 * Substitui o protótipo de `script.js`, que dependia das variáveis globais
 * `matrizPrincipal` e `matrizPossibilidades` (doc 06, seção 13). Todos os
 * métodos são estáticos, puros em relação aos parâmetros recebidos e
 * reaproveitam as entidades de `models/` (`Regras` e `SudokuEstado`).
 */
export default class GeradorSudoku {
    constructor() {}

    static AVISO_NIVEL = AVISO_NIVEL;

    static CELULAS_REMOVIDAS_POR_NIVEL = CELULAS_REMOVIDAS_POR_NIVEL;

    /**
     * Embaralhamento Fisher-Yates que NÃO modifica o array recebido.
     *
     * @param {Array} lista array de origem, preservado intacto
     * @param {Function} aleatorio fonte de aleatoriedade, deve retornar [0, 1)
     * @returns {Array} nova lista embaralhada
     */
    static embaralhar(lista, aleatorio = Math.random) {
        const copia = [...lista];

        for (let index = copia.length - 1; index > 0; index--) {
            const sorteado = Math.floor(aleatorio() * (index + 1));
            const guardado = copia[index];
            copia[index] = copia[sorteado];
            copia[sorteado] = guardado;
        }

        return copia;
    }

    /**
     * Cópia profunda de uma matriz 9x9 de inteiros.
     */
    static copiarMatriz(matriz) {
        return matriz.map((linha) => [...linha]);
    }

    /**
     * Verifica se um valor pode ocupar a célula sem violar linha, coluna ou
     * quadrante. Delega para `Regras`, que opera sobre `estado.quadro`.
     */
    static valorPermitido(estado, valor, linha, coluna) {
        return (
            !Regras.numeroExisteNaLinha(estado, valor, linha) &&
            !Regras.numeroExisteNaColuna(estado, valor, coluna) &&
            !Regras.numeroExisteNoQuadrante(estado, valor, coluna, linha)
        );
    }

    /**
     * Preenche o quadro do estado por backtracking, célula a célula, testando
     * os valores em ordem embaralhada. Mutação controlada: o estado é interno
     * ao gerador, nunca vem de fora.
     *
     * @returns {boolean} true quando o quadro ficou completo
     */
    static preencherComBacktracking(estado, indice, aleatorio) {
        if (indice >= TOTAL_CELULAS) {
            return true;
        }

        const linha = Math.floor(indice / TOTAL_COLUNAS);
        const coluna = indice % TOTAL_COLUNAS;

        if (estado.quadro[linha][coluna] !== 0) {
            return this.preencherComBacktracking(
                estado,
                indice + 1,
                aleatorio,
            );
        }

        const candidatos = this.embaralhar(VALORES, aleatorio);

        for (const valor of candidatos) {
            if (!this.valorPermitido(estado, valor, linha, coluna)) {
                continue;
            }

            estado.quadro[linha][coluna] = valor;

            if (this.preencherComBacktracking(estado, indice + 1, aleatorio)) {
                return true;
            }

            estado.quadro[linha][coluna] = 0;
        }

        return false;
    }

    /**
     * Gera uma solução completa 9x9, aleatória e válida.
     *
     * Garantia: a matriz devolvida sempre satisfaz
     * `new SudokuEstado(matriz).ehObjetivo() === true`.
     *
     * @param {Function} aleatorio fonte de aleatoriedade injetável; injetar
     *     uma fonte determinística torna a geração reproduzível nos testes
     * @returns {number[][]} matriz 9x9 completa
     */
    static gerarSolucaoCompleta(aleatorio = Math.random) {
        const matriz = Array.from({ length: TOTAL_LINHAS }, () =>
            Array(TOTAL_COLUNAS).fill(0),
        );
        const estado = new SudokuEstado(matriz);

        if (!this.preencherComBacktracking(estado, 0, aleatorio)) {
            throw new Error("Não foi possível gerar uma solução completa");
        }

        return matriz;
    }

    /**
     * Devolve uma NOVA matriz igual à recebida, com `quantidadeRemover`
     * células zeradas em posições sorteadas. A matriz recebida não é alterada.
     *
     * @param {number[][]} matriz matriz de origem, preservada intacta
     * @param {number} quantidadeRemover inteiro entre 0 e 81
     * @param {Function} aleatorio fonte de aleatoriedade injetável
     * @returns {number[][]} nova matriz com as lacunas
     */
    static removerCelulas(matriz, quantidadeRemover, aleatorio = Math.random) {
        this.validarQuantidadeRemover(quantidadeRemover);

        const copia = this.copiarMatriz(matriz);
        const posicoes = [];

        for (let linha = 0; linha < TOTAL_LINHAS; linha++) {
            for (let coluna = 0; coluna < TOTAL_COLUNAS; coluna++) {
                posicoes.push({ linha, coluna });
            }
        }

        const sorteadas = this.embaralhar(posicoes, aleatorio);

        for (let index = 0; index < quantidadeRemover; index++) {
            const { linha, coluna } = sorteadas[index];
            copia[linha][coluna] = 0;
        }

        return copia;
    }

    static validarQuantidadeRemover(quantidadeRemover) {
        if (
            !Number.isInteger(quantidadeRemover) ||
            quantidadeRemover < 0 ||
            quantidadeRemover > TOTAL_CELULAS
        ) {
            throw new Error(
                "quantidadeRemover deve ser um inteiro entre 0 e 81",
            );
        }
    }

    /**
     * Gera um puzzle a partir de uma solução completa recém-criada.
     *
     * Devolve as DUAS matrizes porque o chamador precisa da solução de
     * referência: o puzzle sozinho não permite conferir o resultado de um
     * resolvedor nem comparar DFS e GBFS sobre a mesma instância.
     *
     * AVISO (doc 00 §16.2 e §16.3): a remoção é aleatória, portanto o puzzle
     * pode admitir mais de uma solução. O gerador garante apenas que existe AO
     * MENOS uma solução — justamente a devolvida em `solucao`. Ver
     * `GeradorSudoku.AVISO_NIVEL`.
     *
     * @param {number} quantidadeRemover inteiro entre 0 e 81
     * @param {Function} aleatorio fonte de aleatoriedade injetável
     * @returns {{ puzzle: number[][], solucao: number[][] }}
     */
    static gerarPuzzle(quantidadeRemover, aleatorio = Math.random) {
        this.validarQuantidadeRemover(quantidadeRemover);

        const solucao = this.gerarSolucaoCompleta(aleatorio);
        const puzzle = this.removerCelulas(
            solucao,
            quantidadeRemover,
            aleatorio,
        );

        return { puzzle, solucao };
    }

    /**
     * Gera um puzzle por nível experimental.
     *
     * Mapeamento: "facil" -> 35, "medio" -> 45, "dificil" -> 55 células
     * removidas.
     *
     * AVISO (doc 00 §16.3): isto é uma classificação por QUANTIDADE DE
     * LACUNAS, não uma classificação formal da dificuldade humana do Sudoku.
     * Além disso, a remoção aleatória não garante solução única (§16.2). O
     * texto completo do aviso está em `GeradorSudoku.AVISO_NIVEL` e vem
     * repetido no campo `aviso` do retorno, para que o relatório e a interface
     * não possam omiti-lo por descuido.
     *
     * @param {"facil"|"medio"|"dificil"} nivel
     * @param {Function} aleatorio fonte de aleatoriedade injetável
     * @returns {{ puzzle: number[][], solucao: number[][], nivel: string,
     *     quantidadeRemovida: number, aviso: string }}
     */
    static gerarPorNivel(nivel, aleatorio = Math.random) {
        const quantidadeRemover = CELULAS_REMOVIDAS_POR_NIVEL[nivel];

        if (quantidadeRemover === undefined) {
            throw new Error(
                'nivel deve ser "facil", "medio" ou "dificil"',
            );
        }

        const { puzzle, solucao } = this.gerarPuzzle(
            quantidadeRemover,
            aleatorio,
        );

        return {
            puzzle,
            solucao,
            nivel,
            quantidadeRemovida: quantidadeRemover,
            aviso: AVISO_NIVEL,
        };
    }
}
