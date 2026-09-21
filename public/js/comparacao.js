/**
 * P3-04 — Painel de metricas e comparacao entre algoritmos (logica pura).
 *
 * Este modulo NAO toca o DOM. Ele existe para ser importavel tanto pelo
 * navegador (via public/js/painel.js) quanto pelo Node (`node --test`), de modo
 * que a regra central da comparacao possa ser testada sem simular uma pagina.
 *
 * DUPLICACAO DELIBERADA DE `gerarChave`
 * -------------------------------------
 * O arquivo irmao `servicos/ChavePuzzle.js` faz exatamente a mesma coisa, mas
 * roda no Node (servidor Express e runner de benchmark). O navegador nao tem
 * acesso a `servicos/`, que nunca e servido como estatico: so `public/` sai pela
 * rede. Por isso a implementacao e repetida aqui, de proposito.
 *
 * REGRA: as duas implementacoes precisam produzir SEMPRE o mesmo resultado para
 * a mesma matriz. `tests/comparacao.test.js` importa as duas e prova que elas
 * concordam; se voce mudar uma, mude a outra e o teste vai te cobrar.
 *
 * MOTIVO DE EXISTIR DESTE MODULO
 * ------------------------------
 * O doc 00, secao 14.1, proibe comparar `DFS -> puzzle A` com `GBFS -> puzzle
 * B`. Sem a checagem de chave, o usuario resolve o puzzle A com DFS, edita o
 * tabuleiro, resolve o puzzle B com GBFS e a tela mostra os dois lado a lado
 * como se fosse uma comparacao valida. `registrar` descarta a comparacao
 * anterior quando a chave muda, e avisa o chamador que isso aconteceu.
 */

const TAMANHO = 9;

export const ALGORITMOS = ["DFS", "GBFS"];

const NOTA_ESTADOS_MORTOS =
    "Nao comparavel entre os dois algoritmos. No GBFS o filho inconsistente e " +
    "podado antes de entrar na fronteira e por isso conta em estadosPodados, " +
    "nunca em estadosMortos (medicao real no sudoku dificil: estadosMortos=0, " +
    "estadosPodados=934). A DFS contabiliza de outra forma. Exibir " +
    "\"DFS: 87 / GBFS: 0\" sugeriria falsamente que o GBFS nunca erra. " +
    "Use a linha derivada \"Estados descartados\", que soma os dois campos e e " +
    "o numero honesto para o relatorio. Convencao aprovada pelo grupo: os dois " +
    "campos crus continuam visiveis e a comparacao usa a linha derivada.";

const NOTA_FRONTEIRA_MAXIMA =
    "Nao comparavel entre os dois algoritmos. No GBFS e o pico real da fila de " +
    "prioridade; na DFS o doc 02 deixa a definicao em aberto (tamanho da pilha " +
    "x profundidade atingida). Sao grandezas diferentes com o mesmo nome. " +
    "Convencao aprovada pelo grupo: na DFS este campo carrega a PROFUNDIDADE " +
    "MAXIMA DA PILHA DE RECURSAO. Cada coluna e rotulada com o que realmente " +
    "mede, em vez de fingir que os dois numeros sao a mesma grandeza.";

const NOTA_AVALIACOES_HEURISTICAS =
    "Nao se aplica a DFS, que e busca cega: o valor 0 significa \"nao usa\", " +
    "nao \"usou zero vezes\".";

const NOTA_BACKTRACKS =
    "Nao se aplica ao GBFS, que nao desfaz atribuicoes: ele abandona o ramo " +
    "trocando o no da fronteira. O valor 0 significa \"nao se aplica\".";

/**
 * Ordem de exibicao e rotulo legivel de cada campo.
 *
 * `derivada: true` marca a linha que nao existe em `models/Metrica.js` e e
 * calculada a partir de outros campos.
 */
export const CAMPOS_METRICA = [
    {
        campo: "tempo",
        rotulo: "Tempo da busca",
        unidade: "ms",
        comparavel: true,
        derivada: false,
        nota: "",
    },
    {
        campo: "estadosExplorados",
        rotulo: "Estados explorados",
        unidade: "",
        comparavel: true,
        derivada: false,
        nota: "",
    },
    {
        campo: "estadosGerados",
        rotulo: "Estados gerados",
        unidade: "",
        comparavel: true,
        derivada: false,
        nota: "",
    },
    {
        campo: "tentativasCandidatas",
        rotulo: "Tentativas de candidatos",
        unidade: "",
        comparavel: true,
        derivada: false,
        nota: "",
    },
    {
        campo: "estadosMortos",
        rotulo: "Estados mortos",
        unidade: "",
        comparavel: false,
        derivada: false,
        nota: NOTA_ESTADOS_MORTOS,
    },
    {
        campo: "estadosPodados",
        rotulo: "Estados podados",
        unidade: "",
        comparavel: true,
        derivada: false,
        nota: "",
    },
    {
        campo: "estadosDescartados",
        rotulo: "Estados descartados (mortos + podados)",
        unidade: "",
        comparavel: true,
        derivada: true,
        nota:
            "Soma de estadosMortos e estadosPodados. Esta soma E comparavel " +
            "entre DFS e GBFS, porque nao depende de qual dos dois contadores " +
            "cada algoritmo escolheu incrementar.",
    },
    {
        campo: "profundidadeDaSolucao",
        rotulo: "Profundidade da solucao",
        unidade: "",
        comparavel: true,
        derivada: false,
        nota: "",
    },
    {
        campo: "fronteiraMaxima",
        rotulo: "Fronteira maxima",
        unidade: "",
        comparavel: false,
        derivada: false,
        nota: NOTA_FRONTEIRA_MAXIMA,
    },
    {
        campo: "avaliacoesDeHeuristicas",
        rotulo: "Avaliacoes heuristicas",
        unidade: "",
        comparavel: true,
        derivada: false,
        nota: NOTA_AVALIACOES_HEURISTICAS,
    },
    {
        campo: "backtracks",
        rotulo: "Backtracks",
        unidade: "",
        comparavel: true,
        derivada: false,
        nota: NOTA_BACKTRACKS,
    },
];

export const AUSENTE = "—";

export const AVISO_MOCK =
    "Atencao: ha numeros de mock nesta tela. Metricas marcadas com ehMock nao " +
    "vieram de uma execucao real e nao podem ir para o relatorio.";

function validarMatriz(matriz) {
    if (!Array.isArray(matriz)) {
        throw new Error("Comparacao.gerarChave: a matriz deve ser um array 9x9.");
    }

    if (matriz.length !== TAMANHO) {
        throw new Error(
            `Comparacao.gerarChave: a matriz deve ter 9 linhas, recebeu ${matriz.length}.`,
        );
    }

    for (let linha = 0; linha < TAMANHO; linha++) {
        const valores = matriz[linha];

        if (!Array.isArray(valores) || valores.length !== TAMANHO) {
            throw new Error(
                `Comparacao.gerarChave: a linha ${linha} deve ter 9 colunas, recebeu ${
                    Array.isArray(valores) ? valores.length : "algo que nao e array"
                }.`,
            );
        }

        for (let coluna = 0; coluna < TAMANHO; coluna++) {
            const valor = valores[coluna];

            if (!Number.isInteger(valor) || valor < 0 || valor > 9) {
                throw new Error(
                    `Comparacao.gerarChave: valor invalido em [${linha}][${coluna}]: ${valor}. Esperado um inteiro de 0 a 9.`,
                );
            }
        }
    }
}

/**
 * Serializa a matriz 9x9 em 81 caracteres, um por celula, celula vazia como "0".
 *
 * Mesma convencao (e mesmo resultado) de `servicos/ChavePuzzle.js`.
 * Veja o comentario de duplicacao no topo do arquivo.
 */
export function gerarChave(matriz) {
    validarMatriz(matriz);

    return matriz.map((linha) => linha.join("")).join("");
}

function agruparMilhares(inteiro) {
    return inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function formatarNumero(valor, casasDecimais) {
    const negativo = valor < 0;
    const fixo = Math.abs(valor).toFixed(casasDecimais);
    const [inteiro, decimal] = fixo.split(".");
    const corpo = decimal
        ? `${agruparMilhares(inteiro)},${decimal}`
        : agruparMilhares(inteiro);

    return negativo ? `-${corpo}` : corpo;
}

/**
 * Formata um valor de metrica para exibicao, no padrao pt-BR.
 *
 * - ausente (null/undefined/NaN) -> "—"
 * - tempo                        -> "4,60 ms"
 * - inteiro                      -> "1.240"
 * - fracionario                  -> "1.240,50"
 * - texto (ex.: status)          -> devolvido como veio
 */
export function formatarMetrica(nome, valor) {
    if (valor === null || valor === undefined) {
        return AUSENTE;
    }

    if (typeof valor === "boolean") {
        return valor ? "sim" : "nao";
    }

    if (typeof valor === "string") {
        return valor.trim() === "" ? AUSENTE : valor;
    }

    if (typeof valor !== "number" || !Number.isFinite(valor)) {
        return AUSENTE;
    }

    if (nome === "tempo") {
        return `${formatarNumero(valor, 2)} ms`;
    }

    if (Number.isInteger(valor)) {
        return formatarNumero(valor, 0);
    }

    return formatarNumero(valor, 2);
}

function normalizarAlgoritmo(algoritmo) {
    if (typeof algoritmo !== "string") {
        throw new Error(
            `Comparacao: algoritmo deve ser "DFS" ou "GBFS", recebeu ${algoritmo}.`,
        );
    }

    const normalizado = algoritmo.trim().toUpperCase();

    if (!ALGORITMOS.includes(normalizado)) {
        throw new Error(
            `Comparacao: algoritmo desconhecido "${algoritmo}". Esperado "DFS" ou "GBFS".`,
        );
    }

    return normalizado;
}

function normalizarChave(chavePuzzle) {
    if (Array.isArray(chavePuzzle)) {
        return gerarChave(chavePuzzle);
    }

    if (typeof chavePuzzle !== "string" || chavePuzzle.length !== 81) {
        throw new Error(
            "Comparacao: chavePuzzle deve ser a string de 81 caracteres de gerarChave() (ou a propria matriz 9x9).",
        );
    }

    return chavePuzzle;
}

function lerValor(resultado, campo) {
    if (!resultado || !resultado.metricas) {
        return null;
    }

    const metricas = resultado.metricas;

    if (campo === "estadosDescartados") {
        const mortos = Number(metricas.estadosMortos ?? 0);
        const podados = Number(metricas.estadosPodados ?? 0);

        return mortos + podados;
    }

    const valor = metricas[campo];

    return valor === undefined ? null : valor;
}

export default class Comparacao {
    constructor() {
        this.limpar();
    }

    /**
     * Guarda o resultado de um algoritmo para o puzzle identificado por
     * `chavePuzzle`.
     *
     * Se a chave for diferente da que ja estava guardada, a comparacao anterior
     * e DESCARTADA e uma nova comeca do zero. E a razao de existir da classe
     * (doc 00, secao 14.1).
     *
     * @returns {{comparacaoReiniciada: boolean, chavePuzzle: string,
     *            algoritmo: string, algoritmosRegistrados: string[],
     *            contemMock: boolean}}
     */
    registrar(chavePuzzle, algoritmo, resultado) {
        const chave = normalizarChave(chavePuzzle);
        const nome = normalizarAlgoritmo(algoritmo);

        const comparacaoReiniciada =
            this.chave !== null && this.chave !== chave;

        if (comparacaoReiniciada) {
            this.resultados = new Map();
        }

        this.chave = chave;
        this.resultados.set(nome, resultado);

        return {
            comparacaoReiniciada,
            chavePuzzle: chave,
            algoritmo: nome,
            algoritmosRegistrados: this.algoritmosRegistrados,
            contemMock: this.contemMock,
        };
    }

    get chaveAtual() {
        return this.chave;
    }

    /** @returns {object|null} o ResultadoResolucao guardado, ou null. */
    obter(algoritmo) {
        const nome = normalizarAlgoritmo(algoritmo);

        return this.resultados.get(nome) ?? null;
    }

    get algoritmosRegistrados() {
        return ALGORITMOS.filter((nome) => this.resultados.has(nome));
    }

    get completa() {
        return this.algoritmosRegistrados.length === ALGORITMOS.length;
    }

    /** Algoritmos cujo resultado guardado veio de mock (`metricas.ehMock`). */
    get algoritmosMock() {
        return this.algoritmosRegistrados.filter((nome) => {
            const resultado = this.resultados.get(nome);

            return resultado?.metricas?.ehMock === true;
        });
    }

    get contemMock() {
        return this.algoritmosMock.length > 0;
    }

    /** Texto pronto para o painel avisar, ou null quando tudo e real. */
    get avisoMock() {
        if (!this.contemMock) {
            return null;
        }

        return `${AVISO_MOCK} Origem mock: ${this.algoritmosMock.join(", ")}.`;
    }

    /**
     * Linhas da tabela DFS x GBFS.
     *
     * @returns {Array<{campo: string, rotulo: string, dfs: (number|null),
     *                  gbfs: (number|null), comparavel: boolean,
     *                  derivada: boolean, nota: string}>}
     */
    get linhas() {
        const dfs = this.resultados.get("DFS") ?? null;
        const gbfs = this.resultados.get("GBFS") ?? null;

        return CAMPOS_METRICA.map((descritor) => ({
            campo: descritor.campo,
            rotulo: descritor.rotulo,
            dfs: lerValor(dfs, descritor.campo),
            gbfs: lerValor(gbfs, descritor.campo),
            comparavel: descritor.comparavel,
            derivada: descritor.derivada,
            nota: descritor.nota,
        }));
    }

    limpar() {
        this.chave = null;
        this.resultados = new Map();

        return this;
    }
}
