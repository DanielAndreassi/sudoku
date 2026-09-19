import assert from "node:assert/strict";
import test from "node:test";

import Acao from "../models/Acao.js";
import DominioCelula from "../models/DominioCelula.js";
import Regras from "../models/Regras.js";
import SudokuEstado from "../models/SudokuEstado.js";
import MockResolucao from "../mocks/MockResolucao.js";
import { casosBase } from "./casosBase.js";

function criarEstado(caso) {
    return SudokuEstado.gerarDeMatriz(caso.matriz);
}

test("B-02 clonar e transicionar nao alteram o estado pai", () => {
    const estado = criarEstado(casosBase.facil);
    const clone = estado.clonar();
    clone.quadro[0][2] = 4;

    assert.equal(estado.quadro[0][2], 0);

    const filho = estado.transicionar(new Acao(0, 2, 4));
    assert.equal(filho.quadro[0][2], 4);
    assert.equal(estado.quadro[0][2], 0);
});

test("B-02 gerarDeMatriz preserva a matriz recebida", () => {
    const matriz = casosBase.facil.matriz.map((linha) => [...linha]);
    const estado = SudokuEstado.gerarDeMatriz(matriz);

    matriz[0][2] = 9;

    assert.equal(estado.quadro[0][2], 0);
});

test("B-03 calcula o dominio de uma celula vazia", () => {
    const estado = criarEstado(casosBase.facil);
    const dominio = DominioCelula.calcularDominioCelula(estado, 2, 0);

    assert.deepEqual(dominio.valores, [1, 2, 4]);
    assert.equal(dominio.tamanho, 3);
});

test("B-03 nao cria dominio para celula preenchida", () => {
    const estado = criarEstado(casosBase.facil);
    const dominio = DominioCelula.calcularDominioCelula(estado, 0, 0);

    assert.equal(dominio, false);
});

test("B-03 detecta estado objetivo somente quando completo e valido", () => {
    const valido = criarEstado(casosBase.completoValido);
    assert.equal(valido.ehObjetivo(), true);

    const invalido = criarEstado(casosBase.completoValido);
    invalido.quadro[0][0] = invalido.quadro[0][1];
    assert.equal(invalido.ehObjetivo(), false);
});

test("B-03 detecta estado morto por dominio zero", () => {
    const estado = criarEstado(casosBase.dominioZero);
    const dominio = DominioCelula.calcularDominioCelula(estado, 0, 0);

    assert.deepEqual(dominio.valores, []);
    assert.equal(estado.estaMorto(), true);
});

test("B-03 valida regras de linha, coluna e bloco", () => {
    assert.equal(criarEstado(casosBase.facil).estaValido(), true);
    assert.equal(criarEstado(casosBase.duplicataLinha).estaValido(), false);
    assert.equal(criarEstado(casosBase.duplicataColuna).estaValido(), false);
    assert.equal(criarEstado(casosBase.duplicataBloco).estaValido(), false);
});

test("B-03 rejeita acao fora da celula vazia e aceita candidato legal", () => {
    const estado = criarEstado(casosBase.facil);

    assert.equal(new Acao(0, 0, 5).ehValida(estado), false);
    assert.equal(new Acao(0, 2, 4).ehValida(estado), true);
});

test("B-05 mocks respeitam o contrato comum", () => {
    const dfs = MockResolucao.criarResultadoSucesso("DFS");
    const gbfs = MockResolucao.criarResultadoSucesso("GBFS");
    const insoluvavel = MockResolucao.criarResultadoInsoluvel("DFS");

    assert.equal(dfs.status, "solved");
    assert.equal(gbfs.status, "solved");
    assert.equal(insoluvavel.status, "unsolvable");
    assert.equal(insoluvavel.solucao, null);
    assert.equal(dfs.metricas.ehMock, true);
    assert.equal(gbfs.metricas.ehMock, true);
    assert.ok(dfs.eventos.some((evento) => evento.tipo === "BACKTRACK"));
    assert.ok(gbfs.eventos.some((evento) => evento.scoreHeuristico !== null));
    assert.equal(
        insoluvavel.eventos.some((evento) => evento.tipo === "SOLUTION_FOUND"),
        false,
    );
});

test("B-06 todos os casos fixos possuem matriz 9x9", () => {
    for (const caso of Object.values(casosBase)) {
        assert.equal(caso.matriz.length, 9, caso.nome);

        for (const linha of caso.matriz) {
            assert.equal(linha.length, 9, caso.nome);
        }
    }
});

test("B-06 caso insolúvel nao tem duplicata nem dominio zero inicial", () => {
    const estado = criarEstado(casosBase.localmenteValidoInsoluvel);

    assert.equal(estado.estaValido(), true);
    assert.equal(estado.estaMorto(), false);
});

test("B-06 caso de LCV tem os candidatos previstos para a celula alvo", () => {
    const estado = criarEstado(casosBase.lcv);
    const esperado = casosBase.lcv.esperado;
    const dominio = DominioCelula.calcularDominioCelula(
        estado,
        esperado.coluna,
        esperado.linha,
    );

    assert.deepEqual(dominio.valores, esperado.candidatos);
});

function calcularGrauParaTeste(estado, linha, coluna) {
    const vizinhos = new Set();

    for (let x = 0; x < 9; x++) {
        if (x !== coluna && estado.quadro[linha][x] === 0) {
            vizinhos.add(`${linha}-${x}`);
        }
    }

    for (let y = 0; y < 9; y++) {
        if (y !== linha && estado.quadro[y][coluna] === 0) {
            vizinhos.add(`${y}-${coluna}`);
        }
    }

    const inicioLinha = Math.floor(linha / 3) * 3;
    const inicioColuna = Math.floor(coluna / 3) * 3;

    for (let y = inicioLinha; y < inicioLinha + 3; y++) {
        for (let x = inicioColuna; x < inicioColuna + 3; x++) {
            if ((y !== linha || x !== coluna) && estado.quadro[y][x] === 0) {
                vizinhos.add(`${y}-${x}`);
            }
        }
    }

    return vizinhos.size;
}

test("B-06 caso de MRV possui empate no menor dominio", () => {
    const estado = criarEstado(casosBase.empateMRV);
    const dominios = DominioCelula.calcularDominioTodasCelulas(estado);
    const menorTamanho = Math.min(
        ...dominios.map((dominio) => dominio.tamanho),
    );
    const empatados = dominios.filter(
        (dominio) => dominio.tamanho === menorTamanho,
    );

    assert.equal(menorTamanho, casosBase.empateMRV.esperado.menorTamanho);
    assert.ok(
        empatados.length >=
            casosBase.empateMRV.esperado.quantidadeMinimaDeEmpatados,
    );
});

test("B-06 caso de Degree possui maior grau previsto entre os empatados do MRV", () => {
    const estado = criarEstado(casosBase.empateDegree);
    const dominios = DominioCelula.calcularDominioTodasCelulas(estado);
    const menorTamanho = Math.min(
        ...dominios.map((dominio) => dominio.tamanho),
    );
    const empatados = dominios.filter(
        (dominio) => dominio.tamanho === menorTamanho,
    );
    const maiorGrau = Math.max(
        ...empatados.map((dominio) =>
            calcularGrauParaTeste(estado, dominio.linha, dominio.coluna),
        ),
    );

    assert.equal(maiorGrau, casosBase.empateDegree.esperado.maiorGrauEntreMRV);
});
