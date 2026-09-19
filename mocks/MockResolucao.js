import EventoBusca from "../models/EventoBusca.js";
import Metrica from "../models/Metrica.js";
import ResultadoResolucao from "../models/ResultadoResolucao.js";
import SudokuEstado from "../models/SudokuEstado.js";

const quadroInicial = [
    [5, 3, 0, 0, 7, 0, 0, 0, 0],
    [6, 0, 0, 1, 9, 5, 0, 0, 0],
    [0, 9, 8, 0, 0, 0, 0, 6, 0],
    [8, 0, 0, 0, 6, 0, 0, 0, 3],
    [4, 0, 0, 8, 0, 3, 0, 0, 1],
    [7, 0, 0, 0, 2, 0, 0, 0, 6],
    [0, 6, 0, 0, 0, 0, 2, 8, 0],
    [0, 0, 0, 4, 1, 9, 0, 0, 5],
    [0, 0, 0, 0, 8, 0, 0, 7, 9],
];

const quadroSolucao = [
    [5, 3, 4, 6, 7, 8, 9, 1, 2],
    [6, 7, 2, 1, 9, 5, 3, 4, 8],
    [1, 9, 8, 3, 4, 2, 5, 6, 7],
    [8, 5, 9, 7, 6, 1, 4, 2, 3],
    [4, 2, 6, 8, 5, 3, 7, 9, 1],
    [7, 1, 3, 9, 2, 4, 8, 5, 6],
    [9, 6, 1, 5, 3, 7, 2, 8, 4],
    [2, 8, 7, 4, 1, 9, 6, 3, 5],
    [3, 4, 5, 2, 8, 6, 1, 7, 9],
];

export default class MockResolucao {
    static criarMetricasDFS() {
        return new Metrica(12.4, 18, 22, 27, 2, 2, 51, 9, 0, 3, true);
    }

    static criarMetricasGBFS() {
        return new Metrica(7.8, 9, 15, 17, 1, 1, 51, 7, 21, 0, true);
    }

    static criarMetricasInsoluvel(algoritmo = "DFS") {
        if (algoritmo === "GBFS") {
            return new Metrica(9.1, 14, 20, 24, 3, 3, 0, 8, 29, 0, true);
        }

        return new Metrica(15.6, 25, 24, 31, 5, 5, 0, 10, 0, 6, true);
    }

    static criarEventosDFS() {
        const inicial = SudokuEstado.gerarDeMatriz(quadroInicial);
        const tentativa = inicial.clonar();
        tentativa.quadro[0][2] = 1;
        const tentativaCorreta = inicial.clonar();
        tentativaCorreta.quadro[0][2] = 4;
        const solucao = SudokuEstado.gerarDeMatriz(quadroSolucao);

        return [
            new EventoBusca(1, "DFS", "SEARCH_STARTED", inicial, null, null, [], null, 1, 0, null),
            new EventoBusca(2, "DFS", "CELL_SELECTED", inicial, { linha: 0, coluna: 2 }, null, [1, 2, 4], null, 1, 0, null),
            new EventoBusca(3, "DFS", "VALUE_TRIED", tentativa, { linha: 0, coluna: 2 }, 1, [1, 2, 4], null, 1, 1, null),
            new EventoBusca(4, "DFS", "BACKTRACK", inicial, { linha: 0, coluna: 2 }, 1, [1, 2, 4], null, 1, 0, "MOCK_SUBARVORE_SEM_SOLUCAO"),
            new EventoBusca(5, "DFS", "VALUE_TRIED", tentativaCorreta, { linha: 0, coluna: 2 }, 4, [1, 2, 4], null, 1, 1, null),
            new EventoBusca(6, "DFS", "SOLUTION_FOUND", solucao, null, null, [], null, 1, 51, null),
            new EventoBusca(7, "DFS", "SEARCH_FINISHED", solucao, null, null, [], null, 0, 51, null),
        ];
    }

    static criarEventosGBFS() {
        const inicial = SudokuEstado.gerarDeMatriz(quadroInicial);
        const filho = inicial.clonar();
        filho.quadro[6][5] = 7;
        const solucao = SudokuEstado.gerarDeMatriz(quadroSolucao);

        return [
            new EventoBusca(1, "GBFS", "SEARCH_STARTED", inicial, null, null, [], 52.3, 1, 0, null),
            new EventoBusca(2, "GBFS", "NODE_EXPANDED", inicial, null, null, [], 52.3, 1, 0, null),
            new EventoBusca(3, "GBFS", "CELL_SELECTED", inicial, { linha: 6, coluna: 5 }, null, [7], 52.3, 1, 0, "MRV"),
            new EventoBusca(4, "GBFS", "CHILD_GENERATED", filho, { linha: 6, coluna: 5 }, 7, [7], 50.1, 2, 1, null),
            new EventoBusca(5, "GBFS", "SOLUTION_FOUND", solucao, null, null, [], 0, 1, 51, null),
            new EventoBusca(6, "GBFS", "SEARCH_FINISHED", solucao, null, null, [], 0, 0, 51, null),
        ];
    }

    static criarResultadoSucesso(algoritmo = "DFS") {
        const eventos = algoritmo === "GBFS" ? this.criarEventosGBFS() : this.criarEventosDFS();
        const metricas = algoritmo === "GBFS" ? this.criarMetricasGBFS() : this.criarMetricasDFS();

        return new ResultadoResolucao(
            "solved",
            quadroSolucao.map((linha) => [...linha]),
            metricas,
            eventos,
            [],
        );
    }

    static criarEventosInsoluvel(algoritmo = "DFS") {
        const inicial = SudokuEstado.gerarDeMatriz(quadroInicial);

        return [
            new EventoBusca(1, algoritmo, "SEARCH_STARTED", inicial, null, null, [], null, 1, 0, null),
            new EventoBusca(2, algoritmo, "NODE_EXPANDED", inicial, null, null, [], algoritmo === "GBFS" ? 52.3 : null, 1, 0, null),
            new EventoBusca(3, algoritmo, "STATE_PRUNED", inicial, null, null, [], algoritmo === "GBFS" ? 52.3 : null, 0, 0, "MOCK_SEM_CONTINUACAO"),
            new EventoBusca(4, algoritmo, "SEARCH_FINISHED", inicial, null, null, [], null, 0, 0, "MOCK_UNSOLVABLE"),
        ];
    }

    static criarResultadoInsoluvel(algoritmo = "DFS") {
        const metricas = this.criarMetricasInsoluvel(algoritmo);
        const eventos = this.criarEventosInsoluvel(algoritmo);

        return new ResultadoResolucao("unsolvable", null, metricas, eventos, []);
    }
}
