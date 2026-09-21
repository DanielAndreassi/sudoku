import assert from "node:assert/strict";
import test from "node:test";

import SudokuEstado from "../models/SudokuEstado.js";
import GBFS from "../resolvers/GBFS.js";
import MockResolucao from "../mocks/MockResolucao.js";
import { gerarChave as gerarChaveServidor } from "../servicos/ChavePuzzle.js";
import Comparacao, {
    AUSENTE,
    CAMPOS_METRICA,
    formatarMetrica,
    gerarChave,
} from "../public/js/comparacao.js";
import { casosBase } from "./casosBase.js";

/**
 * P3-04 — testa SOMENTE `public/js/comparacao.js` (logica pura).
 *
 * `public/js/painel.js` toca o DOM e fica de fora de propósito: e coberto por
 * checklist manual, decisao ja tomada do projeto.
 *
 * Nunca use `casosBase.dificil` aqui: ele leva ~270 ms e gera 43 mil eventos.
 */

function copiarMatriz(matriz) {
    return matriz.map((linha) => [...linha]);
}

function resolverFacilComGBFS() {
    return GBFS.resolver(SudokuEstado.gerarDeMatriz(casosBase.facil.matriz), {
        silencioso: true,
    });
}

const matrizOutroPuzzle = casosBase.intermediario.matriz;

test("P3-04 gerarChave produz 81 caracteres na convencao do quadro", () => {
    const chave = gerarChave(casosBase.facil.matriz);

    assert.equal(typeof chave, "string");
    assert.equal(chave.length, 81);
    assert.equal(chave.slice(0, 9), "530070000");
    assert.ok(/^[0-9]{81}$/.test(chave));
});

test("P3-04 gerarChave do navegador concorda com servicos/ChavePuzzle.js", () => {
    for (const caso of [
        casosBase.facil,
        casosBase.intermediario,
        casosBase.completoValido,
        casosBase.dominioZero,
    ]) {
        assert.equal(
            gerarChave(caso.matriz),
            gerarChaveServidor(caso.matriz),
            `divergencia na duplicacao deliberada para "${caso.nome}"`,
        );
    }

    assert.notEqual(
        gerarChave(casosBase.facil.matriz),
        gerarChave(matrizOutroPuzzle),
    );
});

test("P3-04 gerarChave rejeita matriz fora do formato 9x9 de 0..9", () => {
    assert.throws(() => gerarChave(null), /array 9x9/);
    assert.throws(() => gerarChave([[0]]), /9 linhas/);

    const colunaCurta = copiarMatriz(casosBase.facil.matriz);
    colunaCurta[3] = [1, 2, 3];
    assert.throws(() => gerarChave(colunaCurta), /9 colunas/);

    const valorInvalido = copiarMatriz(casosBase.facil.matriz);
    valorInvalido[0][0] = 10;
    assert.throws(() => gerarChave(valorInvalido), /valor invalido/);
});

test("P3-04 registrar os dois algoritmos no MESMO puzzle mantem os dois", () => {
    const comparacao = new Comparacao();
    const chave = gerarChave(casosBase.facil.matriz);
    const dfs = MockResolucao.criarResultadoSucesso("DFS");
    const gbfs = resolverFacilComGBFS();

    const primeiro = comparacao.registrar(chave, "DFS", dfs);
    const segundo = comparacao.registrar(chave, "GBFS", gbfs);

    assert.equal(primeiro.comparacaoReiniciada, false);
    assert.equal(segundo.comparacaoReiniciada, false);
    assert.equal(comparacao.chaveAtual, chave);
    assert.deepEqual(comparacao.algoritmosRegistrados, ["DFS", "GBFS"]);
    assert.equal(comparacao.completa, true);
    assert.equal(comparacao.obter("DFS"), dfs);
    assert.equal(comparacao.obter("GBFS"), gbfs);
});

test("P3-04 mudar de puzzle descarta a comparacao anterior e sinaliza (doc 00 §14.1)", () => {
    const comparacao = new Comparacao();
    const chaveA = gerarChave(casosBase.facil.matriz);
    const chaveB = gerarChave(matrizOutroPuzzle);

    comparacao.registrar(chaveA, "DFS", MockResolucao.criarResultadoSucesso("DFS"));

    const retorno = comparacao.registrar(
        chaveB,
        "GBFS",
        MockResolucao.criarResultadoSucesso("GBFS"),
    );

    assert.equal(retorno.comparacaoReiniciada, true);
    assert.equal(retorno.chavePuzzle, chaveB);
    assert.equal(comparacao.chaveAtual, chaveB);
    assert.equal(comparacao.obter("DFS"), null, "o resultado do puzzle A tinha que sumir");
    assert.deepEqual(comparacao.algoritmosRegistrados, ["GBFS"]);
    assert.equal(comparacao.completa, false);

    for (const linha of comparacao.linhas) {
        assert.equal(linha.dfs, null);
    }
});

test("P3-04 registrar aceita a matriz direto e normaliza o nome do algoritmo", () => {
    const comparacao = new Comparacao();
    const retorno = comparacao.registrar(
        casosBase.facil.matriz,
        "gbfs",
        resolverFacilComGBFS(),
    );

    assert.equal(retorno.chavePuzzle, gerarChave(casosBase.facil.matriz));
    assert.equal(retorno.algoritmo, "GBFS");
    assert.notEqual(comparacao.obter("gbfs"), null);
    assert.throws(() => comparacao.registrar(casosBase.facil.matriz, "bfs", {}), /desconhecido/);
    assert.throws(() => comparacao.registrar("chave-curta", "DFS", {}), /81 caracteres/);
});

test("P3-04 obter de algoritmo nao registrado devolve null", () => {
    const comparacao = new Comparacao();

    assert.equal(comparacao.obter("DFS"), null);
    assert.equal(comparacao.obter("GBFS"), null);
    assert.equal(comparacao.chaveAtual, null);
    assert.deepEqual(comparacao.algoritmosRegistrados, []);

    comparacao.registrar(casosBase.facil.matriz, "GBFS", resolverFacilComGBFS());

    assert.equal(comparacao.obter("DFS"), null);
});

test("P3-04 linhas marca estadosMortos e fronteiraMaxima como nao comparaveis com nota", () => {
    const comparacao = new Comparacao();
    const chave = gerarChave(casosBase.facil.matriz);

    comparacao.registrar(chave, "DFS", MockResolucao.criarResultadoSucesso("DFS"));
    comparacao.registrar(chave, "GBFS", resolverFacilComGBFS());

    const porCampo = new Map(comparacao.linhas.map((linha) => [linha.campo, linha]));
    const naoComparaveis = comparacao.linhas
        .filter((linha) => linha.comparavel === false)
        .map((linha) => linha.campo);

    assert.deepEqual(naoComparaveis, ["estadosMortos", "fronteiraMaxima"]);

    for (const campo of naoComparaveis) {
        assert.equal(porCampo.get(campo).comparavel, false);
        assert.ok(
            porCampo.get(campo).nota.trim().length > 0,
            `${campo} precisa de nota explicando por que nao e comparavel`,
        );
    }

    assert.match(porCampo.get("estadosMortos").nota, /estadosPodados/);
    assert.match(porCampo.get("fronteiraMaxima").nota, /fila de prioridade/);
});

test("P3-04 a linha derivada estadosDescartados soma corretamente e e comparavel", () => {
    const comparacao = new Comparacao();
    const chave = gerarChave(casosBase.facil.matriz);
    const dfs = MockResolucao.criarResultadoSucesso("DFS");
    const gbfs = resolverFacilComGBFS();

    comparacao.registrar(chave, "DFS", dfs);
    comparacao.registrar(chave, "GBFS", gbfs);

    const linha = comparacao.linhas.find(
        (candidata) => candidata.campo === "estadosDescartados",
    );

    assert.ok(linha, "a linha derivada precisa existir");
    assert.equal(linha.comparavel, true);
    assert.equal(linha.derivada, true);
    assert.equal(
        linha.dfs,
        dfs.metricas.estadosMortos + dfs.metricas.estadosPodados,
    );
    assert.equal(
        linha.gbfs,
        gbfs.metricas.estadosMortos + gbfs.metricas.estadosPodados,
    );

    // O caso real que motiva a linha: no GBFS os descartes caem todos em
    // estadosPodados, entao estadosMortos sozinho nao conta a historia.
    assert.equal(gbfs.metricas.estadosMortos, 0);
    assert.equal(linha.gbfs, gbfs.metricas.estadosPodados);
});

test("P3-04 linhas seguem a ordem e os rotulos de CAMPOS_METRICA", () => {
    const comparacao = new Comparacao();

    assert.deepEqual(
        comparacao.linhas.map((linha) => linha.campo),
        CAMPOS_METRICA.map((descritor) => descritor.campo),
    );
    assert.deepEqual(
        comparacao.linhas.map((linha) => linha.rotulo),
        CAMPOS_METRICA.map((descritor) => descritor.rotulo),
    );
    assert.ok(CAMPOS_METRICA.every((descritor) => descritor.rotulo.trim().length > 0));
});

test("P3-04 ehMock e detectado quando presente e ausente quando os dados sao reais", () => {
    const real = new Comparacao();
    const chave = gerarChave(casosBase.facil.matriz);
    const resultadoReal = resolverFacilComGBFS();

    assert.equal(resultadoReal.metricas.ehMock, false);
    real.registrar(chave, "GBFS", resultadoReal);

    assert.equal(real.contemMock, false);
    assert.deepEqual(real.algoritmosMock, []);
    assert.equal(real.avisoMock, null);

    const comMock = new Comparacao();
    comMock.registrar(chave, "GBFS", resultadoReal);
    comMock.registrar(chave, "DFS", MockResolucao.criarResultadoSucesso("DFS"));

    assert.equal(comMock.contemMock, true);
    assert.deepEqual(comMock.algoritmosMock, ["DFS"]);
    assert.match(comMock.avisoMock, /mock/i);
    assert.match(comMock.avisoMock, /DFS/);
});

test("P3-04 limpar zera chave, resultados, linhas e aviso de mock", () => {
    const comparacao = new Comparacao();
    const chave = gerarChave(casosBase.facil.matriz);

    comparacao.registrar(chave, "DFS", MockResolucao.criarResultadoSucesso("DFS"));
    comparacao.registrar(chave, "GBFS", MockResolucao.criarResultadoSucesso("GBFS"));

    comparacao.limpar();

    assert.equal(comparacao.chaveAtual, null);
    assert.deepEqual(comparacao.algoritmosRegistrados, []);
    assert.equal(comparacao.obter("DFS"), null);
    assert.equal(comparacao.obter("GBFS"), null);
    assert.equal(comparacao.contemMock, false);
    assert.equal(comparacao.avisoMock, null);
    assert.equal(comparacao.completa, false);

    for (const linha of comparacao.linhas) {
        assert.equal(linha.dfs, null);
        assert.equal(linha.gbfs, null);
    }
});

test("P3-04 formatarMetrica cobre inteiro, tempo, texto e ausente", () => {
    assert.equal(formatarMetrica("estadosExplorados", 1240), "1.240");
    assert.equal(formatarMetrica("estadosExplorados", 0), "0");
    assert.equal(formatarMetrica("estadosPodados", 934), "934");
    assert.equal(formatarMetrica("estadosGerados", 1234567), "1.234.567");
    assert.equal(formatarMetrica("tempo", 4.6), "4,60 ms");
    assert.equal(formatarMetrica("tempo", 0), "0,00 ms");
    assert.equal(formatarMetrica("tempo", 1234.5678), "1.234,57 ms");
    assert.equal(formatarMetrica("status", "solved"), "solved");
    assert.equal(formatarMetrica("avaliacoesDeHeuristicas", 12.5), "12,50");
});

test("P3-04 formatarMetrica devolve o traco para valor ausente", () => {
    assert.equal(AUSENTE, "—");
    assert.equal(formatarMetrica("estadosExplorados", null), AUSENTE);
    assert.equal(formatarMetrica("estadosExplorados", undefined), AUSENTE);
    assert.equal(formatarMetrica("tempo", null), AUSENTE);
    assert.equal(formatarMetrica("tempo", Number.NaN), AUSENTE);
    assert.equal(formatarMetrica("status", ""), AUSENTE);
    assert.equal(formatarMetrica("backtracks", 0), "0", "zero medido nao e ausente");
});

test("P3-04 comparacao com so um algoritmo mostra o outro lado como ausente", () => {
    const comparacao = new Comparacao();

    comparacao.registrar(casosBase.facil.matriz, "GBFS", resolverFacilComGBFS());

    for (const linha of comparacao.linhas) {
        assert.equal(linha.dfs, null);
        assert.equal(formatarMetrica(linha.campo, linha.dfs), AUSENTE);
        assert.notEqual(linha.gbfs, null);
    }
});
