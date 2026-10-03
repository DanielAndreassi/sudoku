import DominioCelula from "../models/DominioCelula.js";
import ResultadoValidacao from "../models/ResultadoValidacao.js";
import SudokuEstado from "../models/SudokuEstado.js";
import DFS from "../resolvers/DFS.js";

/**
 * Validação completa do tabuleiro inicial (P1-03 a P1-05).
 *
 * É a única porta de entrada que a interface precisa: uma chamada
 * `Validacao.validarQuadroInicial(matriz)` responde se aquele tabuleiro pode
 * ser usado para iniciar uma resolução, e em que ponto da verificação ele
 * parou. Cada etapa encerra o pipeline ao encontrar erro, para não gastar uma
 * busca global com uma matriz que já tem duplicata.
 *
 * Entrada: matriz crua 9x9, e não `SudokuEstado`. A estrutura precisa ser
 * verificada antes de existir um estado válido — instanciar um estado com uma
 * matriz malformada é exatamente o que esta etapa existe para impedir.
 *
 * As métricas da busca interna de solucionabilidade (P1-04) são descartadas de
 * propósito: elas pertencem à validação, não à execução que o usuário escolheu
 * ver. Reutilizá-las contaminaria a comparação com o GBFS.
 */
const TAMANHO = 9;

export const CODIGOS = Object.freeze({
    VALIDO: "VALID",
    ESTRUTURA: "INVALID_STRUCTURE",
    DUPLICATA_LINHA: "DUPLICATE_ROW",
    DUPLICATA_COLUNA: "DUPLICATE_COLUMN",
    DUPLICATA_BLOCO: "DUPLICATE_BLOCK",
    DOMINIO_ZERO: "ZERO_DOMAIN",
    INSOLUVEL: "UNSOLVABLE",
    LIMITE_DE_BUSCA: "LIMITE_DE_BUSCA",
});

export default class Validacao {
    /**
     * Descreve o valor recebido para a mensagem de erro.
     *
     * `String()` sozinho esconderia o caso mais perigoso deste campo: a string
     * `"5"`, que é o que uma interface envia quando o usuário digita o número e
     * o valor não é convertido. Sem aspas na mensagem, ela pareceria válida.
     */
    static descreverValor(valor) {
        return typeof valor === "string" ? `"${valor}"` : String(valor);
    }

    /**
     * Validação estrutural (P1-03, camada "Estrutural").
     *
     * Rejeita matriz que não é 9x9, linha com número de colunas errado e
     * célula que não seja inteiro de 0 a 9 — o que cobre `NaN`, `null`,
     * `undefined` e string não normalizada, porque nenhum deles passa em
     * `Number.isInteger`.
     *
     * @param {unknown} matriz
     * @returns {ResultadoValidacao|null} null quando a estrutura está correta.
     */
    static validarEstrutura(matriz) {
        if (!Array.isArray(matriz) || matriz.length !== TAMANHO) {
            const recebido = Array.isArray(matriz) ? matriz.length : typeof matriz;

            return new ResultadoValidacao(
                false,
                CODIGOS.ESTRUTURA,
                `O tabuleiro precisa ser uma matriz com exatamente ${TAMANHO} linhas (recebeu ${recebido}).`,
            );
        }

        for (let linha = 0; linha < TAMANHO; linha++) {
            if (!Array.isArray(matriz[linha]) || matriz[linha].length !== TAMANHO) {
                const recebido = Array.isArray(matriz[linha])
                    ? matriz[linha].length
                    : typeof matriz[linha];

                return new ResultadoValidacao(
                    false,
                    CODIGOS.ESTRUTURA,
                    `A linha ${linha + 1} precisa ter exatamente ${TAMANHO} colunas (recebeu ${recebido}).`,
                );
            }

            for (let coluna = 0; coluna < TAMANHO; coluna++) {
                const valor = matriz[linha][coluna];

                if (!Number.isInteger(valor) || valor < 0 || valor > TAMANHO) {
                    return new ResultadoValidacao(
                        false,
                        CODIGOS.ESTRUTURA,
                        `A célula (linha ${linha + 1}, coluna ${coluna + 1}) precisa ser um inteiro de 0 a 9 (recebeu ${this.descreverValor(valor)}).`,
                        [{ linha, coluna }],
                    );
                }
            }
        }

        return null;
    }

    /**
     * Procura valor repetido em uma lista de células.
     *
     * Linhas, colunas e blocos 3x3 são a mesma ideia com listas de células
     * diferentes, então compartilham a mesma verificação (Dica 2 do P1-03).
     * Células vazias (`0`) são ignoradas: só valores preenchidos se repetem.
     *
     * @param {Array<{linha: number, coluna: number, valor: number}>} unidade
     * @returns {Array<{linha: number, coluna: number}>} todas as células
     *     envolvidas em alguma repetição; array vazio quando a unidade é válida.
     */
    static procurarDuplicatas(unidade) {
        const primeiraOcorrencia = new Map();
        const celulas = [];

        for (const { linha, coluna, valor } of unidade) {
            if (valor === 0) {
                continue;
            }

            if (!primeiraOcorrencia.has(valor)) {
                primeiraOcorrencia.set(valor, { linha, coluna });
                continue;
            }

            const anterior = primeiraOcorrencia.get(valor);

            if (!celulas.some((c) => c.linha === anterior.linha && c.coluna === anterior.coluna)) {
                celulas.push(anterior);
            }

            if (!celulas.some((c) => c.linha === linha && c.coluna === coluna)) {
                celulas.push({ linha, coluna });
            }
        }

        return celulas;
    }

    /**
     * Validação das regras já preenchidas (P1-03, camada "Regras já preenchidas").
     *
     * @returns {ResultadoValidacao|null} null quando não há repetição nenhuma.
     */
    static validarRegrasPreenchidas(matriz) {
        const celulas = [];

        for (let linha = 0; linha < TAMANHO; linha++) {
            const unidade = matriz[linha].map((valor, coluna) => ({ linha, coluna, valor }));

            celulas.push(...this.procurarDuplicatas(unidade));
        }

        if (celulas.length > 0) {
            return new ResultadoValidacao(
                false,
                CODIGOS.DUPLICATA_LINHA,
                `Há valor repetido em ${celulas.length} células da mesma linha.`,
                celulas,
            );
        }

        for (let coluna = 0; coluna < TAMANHO; coluna++) {
            // O nome do parâmetro NÃO pode ser `linha`: aqui `linha` seria a
            // linha inteira do tabuleiro, e não o índice dela.
            const unidade = matriz.map((valores, indiceLinha) => ({
                linha: indiceLinha,
                coluna,
                valor: valores[coluna],
            }));

            celulas.push(...this.procurarDuplicatas(unidade));
        }

        if (celulas.length > 0) {
            return new ResultadoValidacao(
                false,
                CODIGOS.DUPLICATA_COLUNA,
                `Há valor repetido em ${celulas.length} células da mesma coluna.`,
                celulas,
            );
        }

        for (let inicioLinha = 0; inicioLinha < TAMANHO; inicioLinha += 3) {
            for (let inicioColuna = 0; inicioColuna < TAMANHO; inicioColuna += 3) {
                const unidade = [];

                for (let linha = inicioLinha; linha < inicioLinha + 3; linha++) {
                    for (let coluna = inicioColuna; coluna < inicioColuna + 3; coluna++) {
                        unidade.push({ linha, coluna, valor: matriz[linha][coluna] });
                    }
                }

                celulas.push(...this.procurarDuplicatas(unidade));
            }
        }

        if (celulas.length > 0) {
            return new ResultadoValidacao(
                false,
                CODIGOS.DUPLICATA_BLOCO,
                `Há valor repetido em ${celulas.length} células do mesmo bloco 3x3.`,
                celulas,
            );
        }

        return null;
    }

    /**
     * Contradição local imediata (P1-03): alguma célula vazia sem candidato.
     *
     * @returns {ResultadoValidacao|null} null quando todo vazio tem candidato.
     */
    static validarDominioZero(matriz) {
        const estado = SudokuEstado.gerarDeMatriz(matriz);
        const celulas = [];

        for (let linha = 0; linha < TAMANHO; linha++) {
            for (let coluna = 0; coluna < TAMANHO; coluna++) {
                if (estado.quadro[linha][coluna] !== 0) {
                    continue;
                }

                // Atenção aos argumentos: a base usa (estado, COLUNA, LINHA).
                const dominio = DominioCelula.calcularDominioCelula(
                    estado,
                    coluna,
                    linha,
                );

                if (dominio.tamanho === 0) {
                    celulas.push({ linha, coluna });
                }
            }
        }

        if (celulas.length > 0) {
            const primeira = celulas[0];
            const outras = celulas.length - 1;

            return new ResultadoValidacao(
                false,
                CODIGOS.DOMINIO_ZERO,
                `A célula (linha ${primeira.linha + 1}, coluna ${primeira.coluna + 1}) não tem nenhum valor possível` +
                    (outras > 0 ? `, e mais ${outras} célula(s) no mesmo estado.` : "."),
                celulas,
            );
        }

        return null;
    }

    /**
     * Prova global de existência de solução (P1-04).
     *
     * Reaproveita a DFS como resolvedor de existência: silenciosa, sem eventos,
     * parando na primeira solução. As métricas são descartadas — ver o comentário
     * de classe.
     *
     * @param {number[][]} matriz
     * @param {object} [opcoes] Encaminhado à DFS. `orcamentoDeNos` existe para
     *     que o teste do caminho `LIMITE_DE_BUSCA` seja possível sem esperar uma
     *     busca de minutos.
     * @returns {ResultadoValidacao|null} `UNSOLVABLE` quando a busca esgota sem
     *     solução, `LIMITE_DE_BUSCA` quando o orçamento de nós estourou, e null
     *     quando existe solução.
     */
    static verificarExistenciaDeSolucao(matriz, opcoes = {}) {
        const resultado = DFS.resolver(SudokuEstado.gerarDeMatriz(matriz), {
            silencioso: true,
            ...opcoes,
        });

        if (resultado.status === "solved") {
            return null;
        }

        if (resultado.status === "cancelled") {
            return new ResultadoValidacao(
                false,
                CODIGOS.LIMITE_DE_BUSCA,
                "A verificação de solucionabilidade bateu o limite de busca e não conseguiu " +
                    "provar que existe solução. Este tabuleiro é válido, mas está acima do " +
                    "limite que o servidor aceita verificar.",
            );
        }

        return new ResultadoValidacao(
            false,
            CODIGOS.INSOLUVEL,
            resultado.status === "invalid"
                ? "O tabuleiro está completo, mas é inválido: não há como resolvê-lo."
                : "O tabuleiro respeita as regras, mas não tem solução possível.",
        );
    }

    /**
     * Ponto de entrada único da validação (P1-05).
     *
     * @param {unknown} matriz Matriz crua 9x9.
     * @param {object} [opcoes] Encaminhado à busca de solucionabilidade.
     * @returns {ResultadoValidacao} `VALID` apenas quando a matriz é
     *     estruturalmente correta, não tem repetição, não tem domínio zero e
     *     tem pelo menos uma solução.
     */
    static validarQuadroInicial(matriz, opcoes = {}) {
        const estrutura = this.validarEstrutura(matriz);

        if (estrutura !== null) {
            return estrutura;
        }

        const regras = this.validarRegrasPreenchidas(matriz);

        if (regras !== null) {
            return regras;
        }

        const dominioZero = this.validarDominioZero(matriz);

        if (dominioZero !== null) {
            return dominioZero;
        }

        const solucionabilidade = this.verificarExistenciaDeSolucao(matriz, opcoes);

        if (solucionabilidade !== null) {
            return solucionabilidade;
        }

        return new ResultadoValidacao(
            true,
            CODIGOS.VALIDO,
            "Tabuleiro válido, sem repetições e com solução.",
        );
    }
}