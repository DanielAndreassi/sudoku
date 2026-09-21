import assert from "node:assert/strict";
import test from "node:test";

import Metrica from "../models/Metrica.js";
import ResultadoResolucao from "../models/ResultadoResolucao.js";
import SudokuEstado from "../models/SudokuEstado.js";
import MockResolucao from "../mocks/MockResolucao.js";
import GBFS from "../resolvers/GBFS.js";
import Benchmark from "../servicos/Benchmark.js";
import { gerarChave } from "../servicos/ChavePuzzle.js";
import { casosBase } from "./casosBase.js";

function copiarMatriz(matriz) {
    return matriz.map((linha) => [...linha]);
}

function puzzle(id, caso) {
    return {
        id,
        matriz: copiarMatriz(caso.matriz),
    };
}

function solverGBFS(estadoInicial, opcoes) {
    return GBFS.resolver(estadoInicial, opcoes);
}

function solverMockDFS() {
    return MockResolucao.criarResultadoSucesso("DFS");
}

function solverMockInsoluvel() {
    return MockResolucao.criarResultadoInsoluvel("DFS");
}

function criarSolverDeterministico(tempos) {
    let chamada = 0;

    return () => {
        const tempo = tempos[chamada % tempos.length];
        chamada++;

        return new ResultadoResolucao(
            "solved",
            null,
            new Metrica(tempo, 10, 12, 14, 1, 1, 51, 4, 0, 2, false),
            [],
            [],
        );
    };
}

function criarSolverInstavel() {
    let chamada = 0;

    return () => {
        chamada++;

        return new ResultadoResolucao(
            "solved",
            null,
            new Metrica(1, 10 + chamada, 12, 14, 1, 1, 51, 4, 0, 2, false),
            [],
            [],
        );
    };
}

function solverMutante(estadoInicial) {
    estadoInicial.quadro[8][8] = 1;

    return new ResultadoResolucao(
        "solved",
        null,
        new Metrica(1, 1, 1, 1, 0, 0, 1, 1, 0, 0, false),
        [],
        [],
    );
}

test("P3-05 gerarChave achata a matriz em 81 caracteres estaveis", () => {
    const chave = gerarChave(casosBase.facil.matriz);

    assert.equal(chave.length, 81);
    assert.equal(chave.slice(0, 9), "530070000");
    assert.equal(chave, gerarChave(copiarMatriz(casosBase.facil.matriz)));
    assert.notEqual(chave, gerarChave(casosBase.intermediario.matriz));
    assert.equal(
        gerarChave(SudokuEstado.gerarDeMatriz(casosBase.facil.matriz).quadro),
        chave,
    );
});

test("P3-05 gerarChave rejeita matriz que nao e 9x9", () => {
    assert.throws(() => gerarChave(null), /9x9/);
    assert.throws(() => gerarChave(casosBase.facil.matriz.slice(0, 8)), /9 linhas/);

    const colunaFaltando = copiarMatriz(casosBase.facil.matriz);
    colunaFaltando[3] = colunaFaltando[3].slice(0, 8);
    assert.throws(() => gerarChave(colunaFaltando), /9 colunas/);

    const valorInvalido = copiarMatriz(casosBase.facil.matriz);
    valorInvalido[0][0] = 10;
    assert.throws(() => gerarChave(valorInvalido), /valor invalido/);
});

test("P3-05 cada execucao recebe copia independente e as contagens se repetem", () => {
    const caso = puzzle("facil", casosBase.facil);
    const original = copiarMatriz(caso.matriz);
    const linhas = Benchmark.executarBenchmark({
        puzzles: [caso],
        solvers: { gbfs: solverGBFS },
        repeticoes: 3,
    });

    assert.equal(linhas.length, 3);
    assert.deepEqual(caso.matriz, original);

    linhas.forEach((linha, index) => {
        assert.equal(linha.puzzleId, "facil");
        assert.equal(linha.algoritmo, "gbfs");
        assert.equal(linha.repeticao, index + 1);
        assert.equal(linha.status, "solved");
        assert.equal(linha.chavePuzzle, gerarChave(original));
        assert.equal(linha.ehMock, false);
        assert.equal(linha.estadoInicialCorrompido, false);
        assert.ok(linha.tempo >= 0);
        assert.equal(linha.estadosExplorados, linhas[0].estadosExplorados);
        assert.equal(linha.estadosGerados, linhas[0].estadosGerados);
        assert.equal(linha.tentativasCandidatas, linhas[0].tentativasCandidatas);
        assert.equal(linha.fronteiraMaxima, linhas[0].fronteiraMaxima);
        assert.equal(
            linha.avaliacoesDeHeuristicas,
            linhas[0].avaliacoesDeHeuristicas,
        );
        assert.equal(linha.profundidadeDaSolucao, 51);
    });

    const resumo = Benchmark.resumir(linhas);

    assert.equal(resumo.length, 1);
    assert.equal(resumo[0].repeticoes, 3);
    assert.equal(resumo[0].contagemInstavel, false);
    assert.deepEqual(resumo[0].camposInstaveis, []);
    assert.equal(resumo[0].status, "solved");
    assert.equal(resumo[0].estadosExplorados, linhas[0].estadosExplorados);
});

test("P3-05 o mesmo puzzle e entregue a todos os algoritmos", () => {
    const linhas = Benchmark.executarBenchmark({
        puzzles: [
            puzzle("facil", casosBase.facil),
            puzzle("intermediario", casosBase.intermediario),
        ],
        solvers: { dfs: solverMockDFS, gbfs: solverGBFS },
        repeticoes: 1,
    });

    assert.equal(linhas.length, 4);

    const porPuzzle = new Map();

    linhas.forEach((linha) => {
        if (!porPuzzle.has(linha.puzzleId)) {
            porPuzzle.set(linha.puzzleId, new Set());
        }

        porPuzzle.get(linha.puzzleId).add(linha.chavePuzzle);
    });

    assert.equal(porPuzzle.get("facil").size, 1);
    assert.equal(porPuzzle.get("intermediario").size, 1);
    assert.notEqual(
        [...porPuzzle.get("facil")][0],
        [...porPuzzle.get("intermediario")][0],
    );
    assert.deepEqual(
        [...new Set(linhas.map((linha) => linha.algoritmo))],
        ["dfs", "gbfs"],
    );
});

test("P3-05 mediana de tempo com numero impar e par de repeticoes", () => {
    assert.equal(Benchmark.calcularMediana([5, 1, 3]), 3);
    assert.equal(Benchmark.calcularMediana([4, 1, 3, 2]), 2.5);
    assert.equal(Benchmark.calcularMediana([7]), 7);
    assert.equal(Benchmark.calcularMediana([]), null);

    const impar = Benchmark.resumir(
        Benchmark.executarBenchmark({
            puzzles: [puzzle("facil", casosBase.facil)],
            solvers: { dfs: criarSolverDeterministico([10, 2, 90]) },
            repeticoes: 3,
        }),
    );
    const par = Benchmark.resumir(
        Benchmark.executarBenchmark({
            puzzles: [puzzle("facil", casosBase.facil)],
            solvers: { dfs: criarSolverDeterministico([10, 2, 6, 4]) },
            repeticoes: 4,
        }),
    );

    assert.equal(impar[0].tempoMediana, 10);
    assert.equal(impar[0].tempoMinimo, 2);
    assert.equal(impar[0].tempoMaximo, 90);
    assert.equal(par[0].tempoMediana, 5);
    assert.equal(par[0].contagemInstavel, false);
});

test("P3-05 contagemInstavel sinaliza divergencia entre repeticoes", () => {
    const resumo = Benchmark.resumir(
        Benchmark.executarBenchmark({
            puzzles: [puzzle("facil", casosBase.facil)],
            solvers: { dfs: criarSolverInstavel() },
            repeticoes: 3,
        }),
    );

    assert.equal(resumo.length, 1);
    assert.equal(resumo[0].contagemInstavel, true);
    assert.deepEqual(resumo[0].camposInstaveis, ["estadosExplorados"]);
    assert.equal(resumo[0].estadosExplorados, 11);
});

test("P3-05 CSV tem cabecalho e uma linha por execucao", () => {
    const linhas = Benchmark.executarBenchmark({
        puzzles: [
            puzzle("facil", casosBase.facil),
            puzzle("intermediario", casosBase.intermediario),
        ],
        solvers: {
            dfs: criarSolverDeterministico([1, 2]),
            gbfs: solverGBFS,
        },
        repeticoes: 2,
    });
    const csv = Benchmark.gerarCSV(linhas);
    const conteudo = csv.split("\n");

    assert.equal(linhas.length, 8);
    assert.equal(conteudo.length, 9);
    assert.equal(conteudo[0], Benchmark.colunasCSV.join(","));
    assert.ok(conteudo[0].includes("ehMock"));
    assert.ok(conteudo[0].includes("chavePuzzle"));

    conteudo.slice(1).forEach((linha) => {
        assert.equal(linha.split(",").length, Benchmark.colunasCSV.length);
    });

    assert.equal(conteudo[1].startsWith("facil,"), true);
    assert.equal(Benchmark.gerarCSV([]).split("\n").length, 1);
});

test("P3-05 CSV avisa sobre metricas ficticias apenas quando ha mock", () => {
    const comMock = Benchmark.gerarCSV(
        Benchmark.executarBenchmark({
            puzzles: [puzzle("facil", casosBase.facil)],
            solvers: { dfs: solverMockDFS, gbfs: solverGBFS },
            repeticoes: 2,
        }),
    );
    const semMock = Benchmark.gerarCSV(
        Benchmark.executarBenchmark({
            puzzles: [puzzle("facil", casosBase.facil)],
            solvers: { gbfs: solverGBFS },
            repeticoes: 2,
        }),
    );

    assert.equal(
        comMock.split("\n")[0],
        "# ATENCAO: este benchmark contem metricas ficticias (ehMock=true). Nao use no relatorio.",
    );
    assert.equal(comMock.split("\n")[1], Benchmark.colunasCSV.join(","));
    assert.equal(comMock.split("\n").length, 6);
    assert.equal(semMock.split("\n")[0], Benchmark.colunasCSV.join(","));
    assert.equal(semMock.includes("ATENCAO"), false);
    assert.equal(semMock.split("\n").length, 3);
});

test("P3-05 status unsolvable e registrado sem virar falso sucesso", () => {
    const linhas = Benchmark.executarBenchmark({
        puzzles: [puzzle("insoluvel", casosBase.localmenteValidoInsoluvel)],
        solvers: { dfs: solverMockInsoluvel, gbfs: solverGBFS },
        repeticoes: 2,
    });
    const resumo = Benchmark.resumir(linhas);

    assert.equal(linhas.length, 4);
    linhas.forEach((linha) => {
        assert.equal(linha.status, "unsolvable");
        assert.notEqual(linha.status, "solved");
        assert.equal(linha.profundidadeDaSolucao, 0);
    });

    assert.equal(resumo.length, 2);
    resumo.forEach((grupo) => {
        assert.equal(grupo.status, "unsolvable");
        assert.equal(grupo.statusInstavel, false);
    });
    assert.equal(
        resumo.find((grupo) => grupo.algoritmo === "dfs").ehMock,
        true,
    );
    assert.equal(
        resumo.find((grupo) => grupo.algoritmo === "gbfs").ehMock,
        false,
    );
});

test("P3-05 solver que muta o estado recebido e marcado como corrompido", () => {
    const caso = puzzle("facil", casosBase.facil);
    const original = copiarMatriz(caso.matriz);
    const linhas = Benchmark.executarBenchmark({
        puzzles: [caso],
        solvers: { mutante: solverMutante, gbfs: solverGBFS },
        repeticoes: 1,
    });
    const resumo = Benchmark.resumir(linhas);

    assert.deepEqual(caso.matriz, original);
    assert.equal(
        linhas.find((linha) => linha.algoritmo === "mutante")
            .estadoInicialCorrompido,
        true,
    );
    assert.equal(
        linhas.find((linha) => linha.algoritmo === "gbfs")
            .estadoInicialCorrompido,
        false,
    );
    assert.equal(
        resumo.find((grupo) => grupo.algoritmo === "mutante")
            .estadoInicialCorrompido,
        true,
    );
});

test("P3-05 entradas invalidas do runner falham com mensagem clara", () => {
    assert.throws(
        () => Benchmark.executarBenchmark({ puzzles: [], solvers: { gbfs: solverGBFS } }),
        /array nao vazio/,
    );
    assert.throws(
        () =>
            Benchmark.executarBenchmark({
                puzzles: [{ matriz: casosBase.facil.matriz }],
                solvers: { gbfs: solverGBFS },
            }),
        /nao possui id/,
    );
    assert.throws(
        () =>
            Benchmark.executarBenchmark({
                puzzles: [puzzle("facil", casosBase.facil)],
                solvers: {},
            }),
        /nenhum solver/,
    );
    assert.throws(
        () =>
            Benchmark.executarBenchmark({
                puzzles: [puzzle("facil", casosBase.facil)],
                solvers: { gbfs: "nao e funcao" },
            }),
        /nao e uma funcao/,
    );
    assert.throws(
        () =>
            Benchmark.executarBenchmark({
                puzzles: [puzzle("facil", casosBase.facil)],
                solvers: { gbfs: solverGBFS },
                repeticoes: 0,
            }),
        /repeticoes deve ser/,
    );
});
