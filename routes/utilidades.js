import { Router } from "express";

import GeradorSudoku from "../models/GeradorSudoku.js";
import SudokuEstado from "../models/SudokuEstado.js";
import GBFS from "../resolvers/GBFS.js";
import Benchmark from "../servicos/Benchmark.js";
import MockResolucao from "../mocks/MockResolucao.js";
import { listarPuzzlesFixos } from "../servicos/PuzzlesFixos.js";

const rotas = Router();

/**
 * Gerador de puzzle para demonstracao.
 *
 * O aviso vai junto na resposta de proposito: o doc 00 §16.2/§16.3 exige deixar
 * explicito que a remocao aleatoria nao garante solucao unica e que "nivel" aqui
 * e so contagem de lacunas, nao dificuldade formal. Mandar o texto acoplado ao
 * dado impede que a interface esqueca de exibi-lo.
 */
rotas.get("/gerar", (requisicao, resposta) => {
    const nivel = String(requisicao.query.nivel ?? "medio");

    try {
        const gerado = GeradorSudoku.gerarPorNivel(nivel);
        return resposta.json(gerado);
    } catch (erro) {
        return resposta.status(400).json({
            erro: "NIVEL_INVALIDO",
            mensagem: erro.message,
        });
    }
});

/**
 * Benchmark silencioso (P3-05), versao vitrine para a interface.
 *
 * A versao de linha de comando (`bin/benchmark.js`) e a que gera os dados do
 * relatorio. Esta rota existe para demonstrar na tela e compartilha exatamente o
 * mesmo motor (`servicos/Benchmark.js`), entao nao ha risco de divergirem.
 *
 * ATENCAO: a DFS ainda nao existe (Pessoa 1 nao entregou P1-01/P1-02). No lugar
 * dela vai `MockResolucao`, cujas metricas carregam `ehMock: true`. O motor
 * propaga essa marca e o cliente precisa exibi-la. Numero ficticio em tabela de
 * benchmark e exatamente o que acaba copiado para o relatorio sem conferencia.
 */
rotas.post("/benchmark", (requisicao, resposta) => {
    const { puzzles: idsPedidos, repeticoes = 3, algoritmos = ["gbfs", "dfs"] } = requisicao.body ?? {};

    const disponiveis = listarPuzzlesFixos();
    const idsValidos = new Set(disponiveis.map((p) => p.id));

    const ids = Array.isArray(idsPedidos) && idsPedidos.length > 0
        ? idsPedidos.filter((id) => idsValidos.has(id))
        : ["facil", "intermediario"];

    if (ids.length === 0) {
        return resposta.status(400).json({
            erro: "PUZZLES_INVALIDOS",
            mensagem: `Nenhum puzzle valido. Disponiveis: ${[...idsValidos].join(", ")}.`,
        });
    }

    const todosSolvers = {
        gbfs: (estado, opcoes) => GBFS.resolver(estado, opcoes),
        // Substituto temporario da DFS. Ignora o estado de proposito: e um mock.
        dfs: () => MockResolucao.criarResultadoSucesso("DFS"),
    };

    const solvers = {};

    for (const nome of algoritmos) {
        if (Object.hasOwn(todosSolvers, nome)) {
            solvers[nome] = todosSolvers[nome];
        }
    }

    if (Object.keys(solvers).length === 0) {
        return resposta.status(400).json({
            erro: "ALGORITMOS_INVALIDOS",
            mensagem: "Informe ao menos um algoritmo entre: gbfs, dfs.",
        });
    }

    const puzzles = ids.map((id) => disponiveis.find((p) => p.id === id));

    try {
        const linhas = Benchmark.executarBenchmark({
            puzzles,
            solvers,
            repeticoes: Number(repeticoes),
        });

        const resumo = Benchmark.resumir(linhas);
        const contemMock = linhas.some((linha) => linha.ehMock === true);

        return resposta.json({
            linhas,
            resumo,
            contemMock,
            avisoMock: contemMock
                ? "Contem metricas ficticias: a DFS ainda nao foi implementada e foi " +
                  "substituida por MockResolucao. Nao use estes numeros no relatorio."
                : null,
            csv: Benchmark.gerarCSV(linhas),
        });
    } catch (erro) {
        return resposta.status(400).json({
            erro: "BENCHMARK_FALHOU",
            mensagem: erro.message,
        });
    }
});

export default rotas;
