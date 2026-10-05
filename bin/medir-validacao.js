#!/usr/bin/env node

/**
 * Mede o custo da validacao de entrada, por caso fixo.
 *
 * Existe porque `bin/benchmark.js` mede apenas a BUSCA. A validacao e uma etapa
 * separada e cara: ela roda uma DFS silenciosa para provar que existe solucao
 * (doc 00 §12.4), e esse custo e pago em toda requisicao, antes de a busca
 * principal comecar. Sem medi-lo, o relatorio nao consegue mostrar que recusar
 * uma entrada invalida e barato enquanto confirmar uma valida e caro.
 *
 * Uso: node bin/medir-validacao.js [--repeticoes=N] [--saida=arquivo.csv]
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import Validacao from "../validacao/Validacao.js";
import { gerarChave } from "../servicos/ChavePuzzle.js";
import { listarPuzzlesFixos } from "../servicos/PuzzlesFixos.js";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const PADROES = {
    repeticoes: 10,
    saida: "validacao.csv",
};

const COLUNAS = [
    "puzzleId",
    "chavePuzzle",
    "repeticao",
    "codigo",
    "ehValido",
    "celulasApontadas",
    "tempo",
];

function lerFlags(argv) {
    const opcoes = { ...PADROES };

    for (const bruto of argv) {
        if (bruto === "--ajuda" || bruto === "-h") {
            return { ajuda: true };
        }

        const par = /^--([a-z]+)=(.+)$/.exec(bruto);

        if (par === null) {
            throw new Error(`Flag invalida: "${bruto}". Use --ajuda.`);
        }

        const [, nome, valor] = par;

        if (!Object.hasOwn(PADROES, nome)) {
            throw new Error(`Flag desconhecida: "--${nome}". Use --ajuda.`);
        }

        opcoes[nome] = nome === "repeticoes" ? Number(valor) : valor;
    }

    if (!Number.isInteger(opcoes.repeticoes) || opcoes.repeticoes < 1) {
        throw new Error("--repeticoes precisa ser um inteiro maior que zero.");
    }

    return opcoes;
}

function mediana(valores) {
    const ordenados = [...valores].sort((a, b) => a - b);
    const meio = Math.floor(ordenados.length / 2);

    return ordenados.length % 2 === 0
        ? (ordenados[meio - 1] + ordenados[meio]) / 2
        : ordenados[meio];
}

function medir(puzzles, repeticoes) {
    const linhas = [];

    for (const puzzle of puzzles) {
        const chave = gerarChave(puzzle.matriz);

        for (let repeticao = 1; repeticao <= repeticoes; repeticao++) {
            // Copia independente a cada execucao: a validacao nao pode receber
            // a mesma referencia duas vezes e se beneficiar de algum efeito
            // colateral da anterior.
            const matriz = puzzle.matriz.map((linha) => [...linha]);

            const inicio = performance.now();
            const veredito = Validacao.validarQuadroInicial(matriz);
            const tempo = performance.now() - inicio;

            linhas.push({
                puzzleId: puzzle.id,
                chavePuzzle: chave,
                repeticao,
                codigo: veredito.codigo,
                ehValido: veredito.ehValido,
                celulasApontadas: veredito.celulas?.length ?? 0,
                tempo,
            });
        }
    }

    return linhas;
}

function resumir(linhas) {
    const grupos = new Map();

    for (const linha of linhas) {
        if (!grupos.has(linha.puzzleId)) {
            grupos.set(linha.puzzleId, []);
        }

        grupos.get(linha.puzzleId).push(linha);
    }

    return [...grupos.entries()].map(([puzzleId, doGrupo]) => {
        const tempos = doGrupo.map((l) => l.tempo);

        return {
            puzzleId,
            codigo: doGrupo[0].codigo,
            ehValido: doGrupo[0].ehValido,
            celulas: doGrupo[0].celulasApontadas,
            repeticoes: doGrupo.length,
            mediana: mediana(tempos),
            minimo: Math.min(...tempos),
            maximo: Math.max(...tempos),
        };
    });
}

function gerarCSV(linhas) {
    const corpo = linhas.map((linha) => COLUNAS.map((c) => linha[c]).join(","));

    return [COLUNAS.join(","), ...corpo].join("\n");
}

function imprimirTabela(resumo) {
    const col = (texto, largura, direita = false) =>
        direita ? String(texto).padStart(largura) : String(texto).padEnd(largura);

    const cabecalho =
        col("puzzle", 26) + col("codigo", 20) + col("valido", 8) +
        col("celulas", 9, true) + col("reps", 6, true) +
        col("mediana(ms)", 13, true) + col("min(ms)", 10, true) + col("max(ms)", 10, true);

    console.log();
    console.log(cabecalho);
    console.log("-".repeat(cabecalho.length));

    for (const linha of resumo) {
        console.log(
            col(linha.puzzleId, 26) +
            col(linha.codigo, 20) +
            col(linha.ehValido ? "sim" : "nao", 8) +
            col(linha.celulas, 9, true) +
            col(linha.repeticoes, 6, true) +
            col(linha.mediana.toFixed(3), 13, true) +
            col(linha.minimo.toFixed(3), 10, true) +
            col(linha.maximo.toFixed(3), 10, true),
        );
    }
}

function principal() {
    let opcoes;

    try {
        opcoes = lerFlags(process.argv.slice(2));
    } catch (erro) {
        console.error(erro.message);
        process.exitCode = 1;
        return;
    }

    if (opcoes.ajuda) {
        console.log("Mede o custo da validacao de entrada, por caso fixo.\n");
        console.log("USO\n    node bin/medir-validacao.js [--flags]\n");
        console.log("FLAGS");
        console.log(`    --repeticoes=N   Execucoes por caso. Padrao: ${PADROES.repeticoes}`);
        console.log(`    --saida=arquivo  CSV de saida. Padrao: ${PADROES.saida}`);
        console.log("    --ajuda          Mostra esta mensagem.");
        return;
    }

    const puzzles = listarPuzzlesFixos();

    console.log("Custo da validacao de entrada");
    console.log(`  casos.......: ${puzzles.length}`);
    console.log(`  repeticoes..: ${opcoes.repeticoes}`);

    const linhas = medir(puzzles, opcoes.repeticoes);
    const resumo = resumir(linhas);

    imprimirTabela(resumo);

    const caminho = isAbsolute(opcoes.saida) ? opcoes.saida : resolve(RAIZ, opcoes.saida);
    mkdirSync(dirname(caminho), { recursive: true });
    writeFileSync(caminho, gerarCSV(linhas), "utf8");

    console.log();
    console.log(`CSV gravado em: ${caminho}`);
    console.log(`Linhas no CSV.: ${linhas.length}`);
}

principal();
