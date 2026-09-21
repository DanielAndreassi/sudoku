import assert from "node:assert/strict";
import test from "node:test";

import DominioCelula from "../models/DominioCelula.js";
import ResultadoResolucao from "../models/ResultadoResolucao.js";
import SudokuEstado from "../models/SudokuEstado.js";
import { ListaEstadosOrdenados } from "../models/ListaEstadosOrdenados.js";
import GBFS from "../resolvers/GBFS.js";
import { casosBase } from "./casosBase.js";

function criarEstado(caso) {
    return SudokuEstado.gerarDeMatriz(caso.matriz);
}

function copiarMatriz(matriz) {
    return matriz.map((linha) => [...linha]);
}

test("P2-01 MRV e Degree selecionam a celula esperada", () => {
    const estado = criarEstado(casosBase.empateDegree);
    const selecionada = estado.selecionarCelula();

    assert.equal(selecionada.tamanho, 1);
    assert.equal(selecionada.grau, 11);
    assert.equal(selecionada.linha, 6);
    assert.equal(selecionada.coluna, 5);
});

test("P2-02 LCV ordena pelo menor impacto e preserva o estado", () => {
    const estado = criarEstado(casosBase.lcv);
    const original = copiarMatriz(estado.quadro);
    const esperado = casosBase.lcv.esperado;
    const dominio = DominioCelula.calcularDominioCelula(
        estado,
        esperado.coluna,
        esperado.linha,
    );

    const avaliacoes = dominio.avaliarCandidatos(estado);

    assert.deepEqual(
        avaliacoes.map((candidato) => candidato.valor),
        esperado.ordemLCV,
    );
    assert.equal(avaliacoes[0].impacto, esperado.impacto[6]);
    assert.equal(avaliacoes[1].impacto, esperado.impacto[2]);
    assert.deepEqual(estado.quadro, original);
});

test("P2-03 h(state) calcula E, U, m e score conhecidos", () => {
    const estado = criarEstado(casosBase.facil);
    const avaliacao = estado.avaliarHeuristica();

    assert.equal(avaliacao.dominiosCelulasVazias, 51);
    assert.equal(avaliacao.incerteza, 102);
    assert.equal(avaliacao.menorDominio, 1);
    assert.equal(avaliacao.inconsistente, false);
    assert.ok(
        Math.abs(avaliacao.avaliacaoHeuristica - 62.44444444444445) < 1e-12,
    );
});

test("P2-03 estado objetivo recebe avaliacao zero e dominio zero fica inconsistente", () => {
    const objetivo = criarEstado(casosBase.completoValido).avaliarHeuristica();
    const inconsistente = criarEstado(casosBase.dominioZero).avaliarHeuristica();

    assert.deepEqual(objetivo, {
        avaliacaoHeuristica: 0,
        dominiosCelulasVazias: 0,
        menorDominio: 0,
        incerteza: 0,
        inconsistente: false,
    });
    assert.equal(inconsistente.inconsistente, true);
});

test("P2-04 fronteira respeita h, vazias, incerteza e ordem de insercao", () => {
    const fronteira = new ListaEstadosOrdenados();
    const estadoA = { nome: "A" };
    const estadoB = { nome: "B" };
    const estadoC = { nome: "C" };
    const estadoD = { nome: "D" };
    const estadoE = { nome: "E" };

    function avaliacao(h, vazias, incerteza) {
        return {
            avaliacaoHeuristica: h,
            dominiosCelulasVazias: vazias,
            menorDominio: 1,
            incerteza,
            inconsistente: false,
        };
    }

    fronteira.inserir(estadoA, 0, null, null, avaliacao(10, 20, 10));
    fronteira.inserir(estadoB, 0, null, null, avaliacao(8, 30, 30));
    fronteira.inserir(estadoC, 0, null, null, avaliacao(10, 18, 10));
    fronteira.inserir(estadoD, 0, null, null, avaliacao(10, 18, 5));
    fronteira.inserir(estadoE, 0, null, null, avaliacao(10, 18, 5));

    assert.equal(fronteira.qte, 5);
    assert.deepEqual(
        [
            fronteira.remover().estado.nome,
            fronteira.remover().estado.nome,
            fronteira.remover().estado.nome,
            fronteira.remover().estado.nome,
            fronteira.remover().estado.nome,
        ],
        ["B", "D", "E", "C", "A"],
    );
    assert.equal(fronteira.estaVazia(), true);
});

test("P2-05/P2-06 GBFS resolve e retorna SolverResult completo com eventos", () => {
    const estado = criarEstado(casosBase.facil);
    const original = copiarMatriz(estado.quadro);
    const resultado = GBFS.resolver(estado);

    assert.ok(resultado instanceof ResultadoResolucao);
    assert.equal(resultado.status, "solved");
    assert.equal(
        SudokuEstado.gerarDeMatriz(resultado.solucao).ehObjetivo(),
        true,
    );
    assert.deepEqual(estado.quadro, original);
    assert.equal(resultado.metricas.ehMock, false);
    assert.ok(resultado.metricas.tempo >= 0);
    assert.ok(resultado.metricas.estadosExplorados > 0);
    assert.ok(resultado.metricas.estadosGerados > 0);
    assert.ok(resultado.metricas.tentativasCandidatas > 0);
    assert.ok(resultado.metricas.fronteiraMaxima >= 1);
    assert.ok(resultado.metricas.avaliacoesDeHeuristicas > 0);
    assert.equal(resultado.metricas.backtracks, 0);
    assert.equal(resultado.metricas.profundidadeDaSolucao, 51);
    assert.equal(resultado.eventos[0].tipo, "SEARCH_STARTED");
    assert.equal(
        resultado.eventos[resultado.eventos.length - 1].tipo,
        "SEARCH_FINISHED",
    );

    resultado.eventos.forEach((evento, index) => {
        assert.equal(evento.sequencia, index + 1);
    });

    const expandido = resultado.eventos.find(
        (evento) => evento.tipo === "NODE_EXPANDED",
    );
    const selecionada = resultado.eventos.find(
        (evento) => evento.tipo === "CELL_SELECTED",
    );
    const candidatos = resultado.eventos.find(
        (evento) => evento.tipo === "CANDIDATES_COMPUTED",
    );

    assert.equal(expandido.estadoSnapshot.length, 9);
    assert.equal(expandido.estadoSnapshot[0].length, 9);
    assert.equal(typeof selecionada.metadados.mrv, "number");
    assert.equal(typeof selecionada.metadados.grau, "number");
    assert.ok(Array.isArray(candidatos.candidatos));
    assert.ok(Array.isArray(candidatos.metadados.avaliacoesLCV));
});

test("P2-05 GBFS retorna unsolvable quando esgota a fronteira", () => {
    const estado = criarEstado(casosBase.localmenteValidoInsoluvel);
    const original = copiarMatriz(estado.quadro);
    const resultado = GBFS.resolver(estado, { silencioso: true });

    assert.equal(resultado.status, "unsolvable");
    assert.equal(resultado.solucao, null);
    assert.deepEqual(estado.quadro, original);
    assert.ok(resultado.metricas.estadosExplorados > 0);
});

test("P2-06 modo silencioso mantem metricas sem acumular eventos", () => {
    const resultado = GBFS.resolver(criarEstado(casosBase.facil), {
        silencioso: true,
    });

    assert.equal(resultado.status, "solved");
    assert.deepEqual(resultado.eventos, []);
    assert.ok(resultado.metricas.tempo >= 0);
    assert.ok(resultado.metricas.avaliacoesDeHeuristicas > 0);
});

test("P2-05 fronteira global pode expandir estado diferente do ultimo filho gerado", () => {
    const matriz = copiarMatriz(casosBase.completoValido.matriz);

    for (const [linha, coluna] of [
        [0, 3],
        [0, 4],
        [3, 3],
        [3, 4],
    ]) {
        matriz[linha][coluna] = 0;
    }

    const resultado = GBFS.resolver(SudokuEstado.gerarDeMatriz(matriz));
    let ultimoFilho = null;
    let encontrouSaltoDeRamo = false;

    for (const evento of resultado.eventos) {
        if (evento.tipo === "CHILD_GENERATED") {
            ultimoFilho = JSON.stringify(evento.estadoSnapshot);
        }

        if (
            evento.tipo === "NODE_EXPANDED" &&
            ultimoFilho &&
            evento.tamanhoFronteira > 0 &&
            JSON.stringify(evento.estadoSnapshot) !== ultimoFilho
        ) {
            encontrouSaltoDeRamo = true;
            break;
        }
    }

    assert.equal(resultado.status, "solved");
    assert.ok(resultado.metricas.fronteiraMaxima > 1);
    assert.equal(encontrouSaltoDeRamo, true);
});

test("P2-06 ResultadoResolucao e eventos sao serializaveis para o frontend", () => {
    const resultado = GBFS.resolver(criarEstado(casosBase.facil));
    const json = JSON.stringify(resultado);
    const recebido = JSON.parse(json);

    assert.equal(recebido.status, "solved");
    assert.equal(recebido.solucao.length, 9);
    assert.ok(recebido.eventos.length > 0);
    assert.ok(Array.isArray(recebido.eventos[0].estadoSnapshot));
    assert.equal(typeof recebido.metricas.estadosExplorados, "number");
});
