import SudokuEstado from "../models/SudokuEstado.js";
import { gerarChave } from "./ChavePuzzle.js";

const CAMPOS_TEMPO = ["tempo"];

const CAMPOS_CONTAGEM = [
    "estadosExplorados",
    "estadosGerados",
    "tentativasCandidatas",
    "estadosMortos",
    "estadosPodados",
    "profundidadeDaSolucao",
    "fronteiraMaxima",
    "avaliacoesDeHeuristicas",
    "backtracks",
];

const CAMPOS_METRICA = [...CAMPOS_TEMPO, ...CAMPOS_CONTAGEM, "ehMock"];

const COLUNAS_CSV = [
    "puzzleId",
    "chavePuzzle",
    "algoritmo",
    "repeticao",
    "status",
    ...CAMPOS_METRICA,
    "estadoInicialCorrompido",
];

const AVISO_MOCK =
    "# ATENCAO: este benchmark contem metricas ficticias (ehMock=true). Nao use no relatorio.";

export default class Benchmark {
    static get colunasCSV() {
        return [...COLUNAS_CSV];
    }

    static get camposContagem() {
        return [...CAMPOS_CONTAGEM];
    }

    static get avisoMock() {
        return AVISO_MOCK;
    }

    static validarEntrada(puzzles, solvers, repeticoes) {
        if (!Array.isArray(puzzles) || puzzles.length === 0) {
            throw new Error(
                "Benchmark: puzzles deve ser um array nao vazio de { id, matriz }.",
            );
        }

        puzzles.forEach((puzzle, index) => {
            if (!puzzle || typeof puzzle !== "object") {
                throw new Error(
                    `Benchmark: puzzle na posicao ${index} deve ser um objeto { id, matriz }.`,
                );
            }

            if (puzzle.id === undefined || puzzle.id === null || puzzle.id === "") {
                throw new Error(
                    `Benchmark: puzzle na posicao ${index} nao possui id.`,
                );
            }

            gerarChave(puzzle.matriz);
        });

        if (!solvers || typeof solvers !== "object") {
            throw new Error(
                "Benchmark: solvers deve ser um objeto { nomeDoAlgoritmo: funcao }.",
            );
        }

        const nomes = Object.keys(solvers);

        if (nomes.length === 0) {
            throw new Error("Benchmark: nenhum solver foi informado.");
        }

        nomes.forEach((nome) => {
            if (typeof solvers[nome] !== "function") {
                throw new Error(
                    `Benchmark: o solver "${nome}" nao e uma funcao (estado, opcoes) => ResultadoResolucao.`,
                );
            }
        });

        if (!Number.isInteger(repeticoes) || repeticoes < 1) {
            throw new Error(
                `Benchmark: repeticoes deve ser um inteiro maior ou igual a 1, recebeu ${repeticoes}.`,
            );
        }
    }

    static extrairMetricas(resultado) {
        const metricas =
            resultado && typeof resultado === "object" && resultado.metricas
                ? resultado.metricas
                : {};
        const extraidas = {};

        CAMPOS_TEMPO.forEach((campo) => {
            extraidas[campo] =
                typeof metricas[campo] === "number" ? metricas[campo] : 0;
        });

        CAMPOS_CONTAGEM.forEach((campo) => {
            extraidas[campo] =
                typeof metricas[campo] === "number" ? metricas[campo] : 0;
        });

        extraidas.ehMock = metricas.ehMock === true;

        return extraidas;
    }

    static executarBenchmark({ puzzles, solvers, repeticoes = 5 } = {}) {
        this.validarEntrada(puzzles, solvers, repeticoes);

        const algoritmos = Object.keys(solvers);
        const linhas = [];

        for (const puzzle of puzzles) {
            const chavePuzzle = gerarChave(puzzle.matriz);

            for (const algoritmo of algoritmos) {
                const solver = solvers[algoritmo];

                for (let repeticao = 1; repeticao <= repeticoes; repeticao++) {
                    const estadoInicial = SudokuEstado.gerarDeMatriz(
                        puzzle.matriz,
                    );
                    const chaveAntes = gerarChave(estadoInicial.quadro);
                    const resultado = solver(estadoInicial, {
                        silencioso: true,
                    });
                    const matrizIntacta =
                        gerarChave(puzzle.matriz) === chavePuzzle;
                    const estadoIntacto =
                        gerarChave(estadoInicial.quadro) === chaveAntes;

                    linhas.push({
                        puzzleId: puzzle.id,
                        chavePuzzle,
                        algoritmo,
                        repeticao,
                        status:
                            resultado && typeof resultado === "object"
                                ? resultado.status
                                : "erro",
                        ...this.extrairMetricas(resultado),
                        estadoInicialCorrompido:
                            !matrizIntacta || !estadoIntacto,
                    });
                }
            }
        }

        return linhas;
    }

    static calcularMediana(valores) {
        if (!Array.isArray(valores) || valores.length === 0) {
            return null;
        }

        const ordenados = [...valores].sort((a, b) => a - b);
        const meio = Math.floor(ordenados.length / 2);

        if (ordenados.length % 2 === 1) {
            return ordenados[meio];
        }

        return (ordenados[meio - 1] + ordenados[meio]) / 2;
    }

    static resumir(linhas) {
        if (!Array.isArray(linhas)) {
            throw new Error("Benchmark: resumir espera um array de linhas.");
        }

        const grupos = new Map();

        for (const linha of linhas) {
            const chave = `${linha.puzzleId}||${linha.algoritmo}`;

            if (!grupos.has(chave)) {
                grupos.set(chave, []);
            }

            grupos.get(chave).push(linha);
        }

        const resumo = [];

        for (const execucoes of grupos.values()) {
            const primeira = execucoes[0];
            const tempos = execucoes.map((linha) => linha.tempo);
            const statusUnicos = [
                ...new Set(execucoes.map((linha) => linha.status)),
            ];
            const camposInstaveis = [];
            const contagens = {};

            CAMPOS_CONTAGEM.forEach((campo) => {
                const valores = [
                    ...new Set(execucoes.map((linha) => linha[campo])),
                ];

                contagens[campo] = primeira[campo];

                if (valores.length > 1) {
                    camposInstaveis.push(campo);
                }
            });

            resumo.push({
                puzzleId: primeira.puzzleId,
                chavePuzzle: primeira.chavePuzzle,
                algoritmo: primeira.algoritmo,
                repeticoes: execucoes.length,
                status: statusUnicos.length === 1 ? statusUnicos[0] : "misto",
                statusInstavel: statusUnicos.length > 1,
                statusObservados: statusUnicos,
                tempoMediana: this.calcularMediana(tempos),
                tempoMinimo: Math.min(...tempos),
                tempoMaximo: Math.max(...tempos),
                ...contagens,
                contagemInstavel: camposInstaveis.length > 0,
                camposInstaveis,
                ehMock: execucoes.some((linha) => linha.ehMock === true),
                estadoInicialCorrompido: execucoes.some(
                    (linha) => linha.estadoInicialCorrompido === true,
                ),
            });
        }

        return resumo;
    }

    static formatarValorCSV(valor) {
        if (valor === null || valor === undefined) {
            return "";
        }

        const texto = String(valor);

        if (/[",\n\r]/.test(texto)) {
            return `"${texto.replace(/"/g, '""')}"`;
        }

        return texto;
    }

    static gerarCSV(linhas) {
        if (!Array.isArray(linhas)) {
            throw new Error("Benchmark: gerarCSV espera um array de linhas.");
        }

        const conteudo = [];

        if (linhas.some((linha) => linha.ehMock === true)) {
            conteudo.push(AVISO_MOCK);
        }

        conteudo.push(COLUNAS_CSV.join(","));

        for (const linha of linhas) {
            conteudo.push(
                COLUNAS_CSV.map((coluna) =>
                    this.formatarValorCSV(linha[coluna]),
                ).join(","),
            );
        }

        return conteudo.join("\n");
    }
}
