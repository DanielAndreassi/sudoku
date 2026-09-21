import assert from "node:assert/strict";
import test from "node:test";

import GeradorSudoku, {
    AVISO_NIVEL,
    CELULAS_REMOVIDAS_POR_NIVEL,
} from "../models/GeradorSudoku.js";
import SudokuEstado from "../models/SudokuEstado.js";
import GBFS from "../resolvers/GBFS.js";
import { casosBase } from "./casosBase.js";

/**
 * Fonte de aleatoriedade determinística (LCG simples) usada para tornar a
 * geração reproduzível. Não é criptográfica e existe só para os testes.
 */
function criarAleatorioDeterministico(semente) {
    let estado = semente;

    return function aleatorio() {
        estado = (estado * 1664525 + 1013904223) % 4294967296;
        return estado / 4294967296;
    };
}

function contarZeros(matriz) {
    return matriz.reduce(
        (total, linha) =>
            total + linha.filter((valor) => valor === 0).length,
        0,
    );
}

function copiarMatriz(matriz) {
    return matriz.map((linha) => [...linha]);
}

test("P3-GERADOR solucao completa gerada e sempre um estado objetivo", () => {
    for (let iteracao = 0; iteracao < 20; iteracao++) {
        const matriz = GeradorSudoku.gerarSolucaoCompleta();

        assert.equal(matriz.length, 9);

        for (const linha of matriz) {
            assert.equal(linha.length, 9);
        }

        assert.equal(contarZeros(matriz), 0);
        assert.equal(new SudokuEstado(matriz).ehObjetivo(), true);
    }
});

test("P3-GERADOR gerarPuzzle produz exatamente a quantidade pedida de zeros", () => {
    for (const quantidadeRemover of [0, 1, 35, 45, 55]) {
        const { puzzle, solucao } =
            GeradorSudoku.gerarPuzzle(quantidadeRemover);

        assert.equal(contarZeros(puzzle), quantidadeRemover);
        assert.equal(contarZeros(solucao), 0);
    }
});

test("P3-GERADOR gerarPorNivel mapeia os niveis e carrega o aviso", () => {
    assert.deepEqual(CELULAS_REMOVIDAS_POR_NIVEL, {
        facil: 35,
        medio: 45,
        dificil: 55,
    });

    for (const nivel of ["facil", "medio", "dificil"]) {
        const resultado = GeradorSudoku.gerarPorNivel(nivel);

        assert.equal(resultado.nivel, nivel);
        assert.equal(
            resultado.quantidadeRemovida,
            CELULAS_REMOVIDAS_POR_NIVEL[nivel],
        );
        assert.equal(
            contarZeros(resultado.puzzle),
            CELULAS_REMOVIDAS_POR_NIVEL[nivel],
        );
        assert.equal(resultado.aviso, AVISO_NIVEL);
    }

    assert.throws(() => GeradorSudoku.gerarPorNivel("impossivel"));
});

test("P3-GERADOR AVISO_NIVEL registra a falta de unicidade e a natureza informal do nivel", () => {
    assert.equal(typeof AVISO_NIVEL, "string");
    assert.equal(GeradorSudoku.AVISO_NIVEL, AVISO_NIVEL);
    assert.ok(AVISO_NIVEL.includes("não garante solução única"));
    assert.ok(AVISO_NIVEL.includes("ao menos uma solução"));
    assert.ok(AVISO_NIVEL.includes("não uma"));
});

test("P3-GERADOR a solucao devolvida e consistente com o puzzle", () => {
    for (let iteracao = 0; iteracao < 10; iteracao++) {
        const { puzzle, solucao } = GeradorSudoku.gerarPuzzle(45);

        assert.equal(new SudokuEstado(solucao).ehObjetivo(), true);

        for (let linha = 0; linha < 9; linha++) {
            for (let coluna = 0; coluna < 9; coluna++) {
                if (puzzle[linha][coluna] !== 0) {
                    assert.equal(
                        puzzle[linha][coluna],
                        solucao[linha][coluna],
                        `divergencia em ${linha},${coluna}`,
                    );
                }
            }
        }
    }
});

test("P3-GERADOR fonte de aleatoriedade deterministica reproduz a mesma matriz", () => {
    const primeira = GeradorSudoku.gerarSolucaoCompleta(
        criarAleatorioDeterministico(20260921),
    );
    const segunda = GeradorSudoku.gerarSolucaoCompleta(
        criarAleatorioDeterministico(20260921),
    );

    assert.deepEqual(primeira, segunda);
    assert.equal(new SudokuEstado(primeira).ehObjetivo(), true);

    const outra = GeradorSudoku.gerarSolucaoCompleta(
        criarAleatorioDeterministico(7),
    );
    assert.notDeepEqual(primeira, outra);

    const puzzleA = GeradorSudoku.gerarPuzzle(
        45,
        criarAleatorioDeterministico(123),
    );
    const puzzleB = GeradorSudoku.gerarPuzzle(
        45,
        criarAleatorioDeterministico(123),
    );

    assert.deepEqual(puzzleA.puzzle, puzzleB.puzzle);
    assert.deepEqual(puzzleA.solucao, puzzleB.solucao);
});

test("P3-GERADOR nao modifica nada recebido por parametro", () => {
    const matriz = copiarMatriz(casosBase.completoValido.matriz);
    const antes = copiarMatriz(matriz);

    const comLacunas = GeradorSudoku.removerCelulas(matriz, 30);

    assert.deepEqual(matriz, antes);
    assert.equal(contarZeros(comLacunas), 30);
    assert.notEqual(comLacunas, matriz);
    assert.notEqual(comLacunas[0], matriz[0]);

    const lista = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    const listaAntes = [...lista];
    const embaralhada = GeradorSudoku.embaralhar(lista);

    assert.deepEqual(lista, listaAntes);
    assert.equal(embaralhada.length, lista.length);
    assert.deepEqual([...embaralhada].sort((a, b) => a - b), listaAntes);

    const puzzleGerado = GeradorSudoku.gerarPuzzle(20);
    const solucaoAntes = copiarMatriz(puzzleGerado.solucao);
    puzzleGerado.puzzle[0][0] = 0;

    assert.deepEqual(puzzleGerado.solucao, solucaoAntes);
});

test("P3-GERADOR puzzle gerado e resolvivel pelo GBFS", () => {
    for (const quantidadeRemover of [35, 45]) {
        for (let iteracao = 0; iteracao < 2; iteracao++) {
            const { puzzle } = GeradorSudoku.gerarPuzzle(quantidadeRemover);
            const estado = SudokuEstado.gerarDeMatriz(puzzle);
            const resultado = GBFS.resolver(estado, { silencioso: true });

            assert.equal(
                resultado.status,
                "solved",
                `puzzle com ${quantidadeRemover} lacunas nao foi resolvido`,
            );
            assert.equal(
                new SudokuEstado(resultado.solucao).ehObjetivo(),
                true,
            );
        }
    }
});
