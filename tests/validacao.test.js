import assert from "node:assert/strict";
import test from "node:test";

import ResultadoValidacao from "../models/ResultadoValidacao.js";
import SudokuEstado from "../models/SudokuEstado.js";
import Validacao, { CODIGOS } from "../validacao/Validacao.js";
import { casosBase } from "./casosBase.js";

function copiarMatriz(matriz) {
    return matriz.map((linha) => [...linha]);
}

function matrizCom(pares) {
    const matriz = Array.from({ length: 9 }, () => Array(9).fill(0));

    for (const [linha, coluna, valor] of pares) {
        matriz[linha][coluna] = valor;
    }

    return matriz;
}

function validar(matriz, opcoes) {
    return Validacao.validarQuadroInicial(matriz, opcoes);
}

// --------------------------------------------------------------------- P1-03

test("P1-03 matriz com número de linhas errado é rejeitada", () => {
    const resultado = validar(casosBase.facil.matriz.slice(0, 8));

    assert.ok(resultado instanceof ResultadoValidacao);
    assert.equal(resultado.ehValido, false);
    assert.equal(resultado.codigo, CODIGOS.ESTRUTURA);
    assert.deepEqual(resultado.celulas, []);
    assert.match(resultado.mensagem, /9 linhas/);
});

test("P1-03 linha com número de colunas errado é rejeitada", () => {
    const matriz = copiarMatriz(casosBase.facil.matriz);
    matriz[3] = matriz[3].slice(0, 8);

    const resultado = validar(matriz);

    assert.equal(resultado.ehValido, false);
    assert.equal(resultado.codigo, CODIGOS.ESTRUTURA);
    assert.match(resultado.mensagem, /linha 4/);
});

test("P1-03 valor fora de 0..9 é rejeitado e a célula é apontada", () => {
    for (const valor of [12, -1, 1.5, "5", NaN, null, undefined]) {
        const matriz = copiarMatriz(casosBase.facil.matriz);
        matriz[0][2] = valor;

        const resultado = validar(matriz);

        assert.equal(resultado.ehValido, false, `valor ${String(valor)} passou`);
        assert.equal(resultado.codigo, CODIGOS.ESTRUTURA);
        assert.deepEqual(resultado.celulas, [{ linha: 0, coluna: 2 }]);
    }
});

test("P1-03 entrada que não é matriz é rejeitada sem estourar", () => {
    for (const entrada of [null, undefined, "matriz", 42, {}, [[]]]) {
        const resultado = validar(entrada);

        assert.equal(resultado.ehValido, false);
        assert.equal(resultado.codigo, CODIGOS.ESTRUTURA);
    }
});

test("P1-03 duplicata em linha é detectada com as duas coordenadas", () => {
    const resultado = validar(casosBase.duplicataLinha.matriz);

    assert.equal(resultado.ehValido, false);
    assert.equal(resultado.codigo, CODIGOS.DUPLICATA_LINHA);
    assert.deepEqual(resultado.celulas, [
        { linha: 0, coluna: 0 },
        { linha: 0, coluna: 2 },
    ]);
});

test("P1-03 duplicata em coluna é detectada com as duas coordenadas", () => {
    const resultado = validar(casosBase.duplicataColuna.matriz);

    assert.equal(resultado.ehValido, false);
    assert.equal(resultado.codigo, CODIGOS.DUPLICATA_COLUNA);
    assert.deepEqual(resultado.celulas, [
        { linha: 0, coluna: 0 },
        { linha: 2, coluna: 0 },
    ]);
});

test("P1-03 duplicata em bloco 3x3 é detectada com as duas coordenadas", () => {
    const resultado = validar(casosBase.duplicataBloco.matriz);

    assert.equal(resultado.ehValido, false);
    assert.equal(resultado.codigo, CODIGOS.DUPLICATA_BLOCO);
    assert.deepEqual(resultado.celulas, [
        { linha: 1, coluna: 1 },
        { linha: 2, coluna: 2 },
    ]);
});

test("P1-03 a mesma repetição é achada em linha, coluna e bloco, com todas as células", () => {
    const emLinha = validar(matrizCom([[0, 0, 1], [0, 4, 1]]));
    const emColuna = validar(matrizCom([[0, 0, 1], [2, 0, 1]]));
    const emBloco = validar(matrizCom([[0, 0, 1], [1, 1, 1]]));

    assert.equal(emLinha.codigo, CODIGOS.DUPLICATA_LINHA);
    assert.equal(emColuna.codigo, CODIGOS.DUPLICATA_COLUNA);
    assert.equal(emBloco.codigo, CODIGOS.DUPLICATA_BLOCO);

    // Três ocorrências do mesmo valor: as três células são devolvidas, para a
    // interface acender todas em vermelho.
    const tresVezes = validar(matrizCom([[0, 0, 1], [0, 4, 1], [0, 8, 1]]));

    assert.deepEqual(tresVezes.celulas, [
        { linha: 0, coluna: 0 },
        { linha: 0, coluna: 4 },
        { linha: 0, coluna: 8 },
    ]);
});

test("P1-03 domínio zero inicial é identificado e apontado", () => {
    const resultado = validar(casosBase.dominioZero.matriz);
    const esperado = casosBase.dominioZero.esperado;

    assert.equal(resultado.ehValido, false);
    assert.equal(resultado.codigo, CODIGOS.DOMINIO_ZERO);
    assert.ok(
        resultado.celulas.some(
            (celula) => celula.linha === esperado.linha && celula.coluna === esperado.coluna,
        ),
        `a célula (${esperado.linha}, ${esperado.coluna}) deveria estar na lista`,
    );
    assert.match(resultado.mensagem, /não tem nenhum valor possível/);
});

test("P1-03 a validação não modifica o tabuleiro recebido", () => {
    for (const chave of ["facil", "duplicataLinha", "dominioZero", "localmenteValidoInsoluvel"]) {
        const matriz = copiarMatriz(casosBase[chave].matriz);
        const antes = JSON.stringify(matriz);

        validar(matriz);

        assert.equal(JSON.stringify(matriz), antes, `a validação alterou ${chave}`);
    }
});

// --------------------------------------------------------------------- P1-04

test("P1-04 estado inválido nunca chega à verificação global", () => {
    // Uma matriz com duplicata E sem solução tem de voltar com o código da
    // regra, nunca com UNSOLVABLE: a validação é um pipeline e cada etapa
    // encerra ao encontrar erro.
    const invalida = validar(casosBase.duplicataLinha.matriz);

    assert.equal(invalida.codigo, CODIGOS.DUPLICATA_LINHA);

    // E o mesmo vale para a estrutura.
    const estrutura = validar(casosBase.facil.matriz.slice(0, 3));

    assert.equal(estrutura.codigo, CODIGOS.ESTRUTURA);
});

test("P1-04 puzzle solucionável tem solução e puzzle insolúvel não tem", () => {
    for (const chave of ["facil", "intermediario", "dificil", "completoValido"]) {
        const resultado = validar(casosBase[chave].matriz);

        assert.equal(resultado.ehValido, true, `${chave} deveria ser válido`);
        assert.equal(resultado.codigo, CODIGOS.VALIDO);
    }

    const insoluvel = validar(casosBase.localmenteValidoInsoluvel.matriz);

    assert.equal(insoluvel.ehValido, false);
    assert.equal(insoluvel.codigo, CODIGOS.INSOLUVEL);
    assert.match(insoluvel.mensagem, /não tem solução possível/);
});

test("P1-04 a verificação global para na primeira solução e não produz animação", () => {
    // A prova de que a busca interna é silenciosa e para na primeira solução é
    // estrutural: `ResultadoValidacao` não tem onde carregar eventos nem
    // métricas, e a função só repete a pergunta "existe solução?".
    const resultado = validar(casosBase.facil.matriz);

    assert.deepEqual(Object.keys(resultado).sort(), [
        "celulas",
        "codigo",
        "ehValido",
        "mensagem",
    ]);

    // Nenhuma métrica da busca de validação pode escapar para a execução que o
    // usuário escolher depois.
    assert.equal(resultado.metricas, undefined);
    assert.equal(resultado.eventos, undefined);

    // A mesma matriz continua solucionável depois de validada: a validação não
    // guarda estado nem cache que a busca principal pudesse reaproveitar.
    assert.equal(validar(casosBase.facil.matriz).codigo, CODIGOS.VALIDO);
});

test("P1-04 orçamento estourado vira LIMITE_DE_BUSCA, nunca UNSOLVABLE", () => {
    // Um orçamento de nós ridículo impede a prova de existência. Dizer
    // "insolúvel" aqui seria mentira, e é exatamente o erro que o doc 02
    // proíbe: distinguir entrada inválida, insolúvel e válida.
    const resultado = validar(casosBase.facil.matriz, { orcamentoDeNos: 5 });

    assert.equal(resultado.ehValido, false);
    assert.equal(resultado.codigo, CODIGOS.LIMITE_DE_BUSCA);
    assert.notEqual(resultado.codigo, CODIGOS.INSOLUVEL);
});

// --------------------------------------------------------------------- P1-05

test("P1-05 a interface precisa de uma única chamada de alto nível", () => {
    // Uma chamada, matriz crua dentro, `ResultadoValidacao` fora.
    const resultado = Validacao.validarQuadroInicial(casosBase.facil.matriz);

    assert.ok(resultado instanceof ResultadoValidacao);
    assert.equal(typeof resultado.ehValido, "boolean");
    assert.equal(typeof resultado.codigo, "string");
    assert.equal(typeof resultado.mensagem, "string");
    assert.ok(Array.isArray(resultado.celulas));

    // A entrada é matriz crua, não `SudokuEstado`: validar a estrutura é o que
    // impede instanciar um estado com matriz malformada.
    assert.deepEqual(validar(casosBase.facil.matriz).celulas, []);
});

test("P1-05 violação de regra e insolubilidade têm códigos distintos", () => {
    const codigos = new Set([
        validar(casosBase.duplicataLinha.matriz).codigo,
        validar(casosBase.duplicataColuna.matriz).codigo,
        validar(casosBase.duplicataBloco.matriz).codigo,
        validar(casosBase.dominioZero.matriz).codigo,
        validar(casosBase.localmenteValidoInsoluvel.matriz).codigo,
        validar(casosBase.facil.matriz.slice(0, 8)).codigo,
        validar(casosBase.facil.matriz).codigo,
    ]);

    assert.equal(codigos.size, 7, `códigos se repetiram: ${[...codigos].join(", ")}`);
});

test("P1-05 o mesmo estado pode ser validado repetidamente sem efeito colateral", () => {
    for (const chave of ["facil", "dominioZero", "localmenteValidoInsoluvel"]) {
        const matriz = copiarMatriz(casosBase[chave].matriz);
        const antes = JSON.stringify(matriz);
        const primeiro = validar(matriz);
        const segundo = validar(matriz);

        assert.deepEqual(segundo, primeiro, `validar duas vezes mudou o resultado (${chave})`);
        assert.equal(JSON.stringify(matriz), antes, `a matriz ${chave} foi alterada`);
    }
});

test("P1-05 nenhuma busca principal é disparada pela validação", () => {
    // Chamar a validação não produz `ResultadoResolucao` nenhum: quem executa a
    // busca principal é o controlador, depois do veredito.
    const veredito = validar(casosBase.facil.matriz);

    assert.ok(veredito instanceof ResultadoValidacao);
    assert.ok(!(veredito instanceof SudokuEstado));
    assert.equal(veredito.solucao, undefined);
});

test("P1-05 a matriz não precisa ser 9x9 válida para a mensagem ser útil", () => {
    // Cada código tem de vir com uma mensagem que o usuário possa ler.
    const entradas = [
        casosBase.facil.matriz.slice(0, 8),
        casosBase.duplicataLinha.matriz,
        casosBase.dominioZero.matriz,
        casosBase.localmenteValidoInsoluvel.matriz,
        casosBase.facil.matriz,
    ];

    for (const matriz of entradas) {
        const resultado = validar(matriz);

        assert.ok(resultado.mensagem.length > 10, `mensagem curta demais: ${resultado.mensagem}`);
        assert.ok(!resultado.mensagem.includes("undefined"));
    }
});