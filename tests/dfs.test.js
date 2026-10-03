import assert from "node:assert/strict";
import test from "node:test";

import DominioCelula from "../models/DominioCelula.js";
import Metrica from "../models/Metrica.js";
import ResultadoResolucao from "../models/ResultadoResolucao.js";
import SudokuEstado from "../models/SudokuEstado.js";
import DFS from "../resolvers/DFS.js";
import { casosBase } from "./casosBase.js";

function criarEstado(caso) {
    return SudokuEstado.gerarDeMatriz(caso.matriz);
}

function copiarMatriz(matriz) {
    return matriz.map((linha) => [...linha]);
}

function tabuleiroVazio() {
    return Array.from({ length: 9 }, () => Array(9).fill(0));
}

/** Números de um evento cujo quadro bate exatamente com a matriz informada. */
function indiceDoEventoComQuadro(eventos, matriz) {
    const alvo = JSON.stringify(matriz);

    return eventos.findIndex(
        (evento) => JSON.stringify(evento.estadoSnapshot) === alvo,
    );
}

// --------------------------------------------------------------------- P1-01

test("P1-01 a DFS resolve o puzzle fácil e devolve SolverResult completo", () => {
    const estado = criarEstado(casosBase.facil);
    const original = copiarMatriz(estado.quadro);
    const resultado = DFS.resolver(estado);

    assert.ok(resultado instanceof ResultadoResolucao);
    assert.equal(resultado.status, "solved");
    assert.ok(Array.isArray(resultado.solucao));
    assert.ok(resultado.solucao.every((linha) => linha.length === 9));
    assert.equal(SudokuEstado.gerarDeMatriz(resultado.solucao).ehObjetivo(), true);

    // Critério de aceite "não modifica o estado inicial". O benchmark verifica
    // isso a cada execução, e a fixture é compartilhada com as outras trilhas.
    assert.deepEqual(estado.quadro, original);
});

test("P1-01 a DFS resolve o intermediário, o dificil e o quadro já completo", () => {
    const completo = DFS.resolver(criarEstado(casosBase.completoValido));

    assert.equal(completo.status, "solved");
    assert.equal(completo.metricas.profundidadeDaSolucao, 0);
    assert.equal(completo.metricas.estadosExplorados, 1);
    assert.equal(completo.metricas.backtracks, 0);

    const intermediario = DFS.resolver(
        criarEstado(casosBase.intermediario),
        { silencioso: true },
    );

    assert.equal(intermediario.status, "solved");
    assert.equal(intermediario.metricas.profundidadeDaSolucao, 45);
    assert.equal(
        SudokuEstado.gerarDeMatriz(intermediario.solucao).ehObjetivo(),
        true,
    );

    // O dificil é o caso caro da base. Vai silencioso: com eventos ele estoura o
    // teto de eventos e volta "cancelled", o que é comportamento esperado e
    // tem teste próprio abaixo.
    const dificil = DFS.resolver(criarEstado(casosBase.dificil), {
        silencioso: true,
    });

    assert.equal(dificil.status, "solved");
    assert.equal(dificil.metricas.profundidadeDaSolucao, 60);
    assert.deepEqual(dificil.eventos, []);
});

test("P1-01 a DFS não usa MRV: escolhe a primeira vazia, não a de menor domínio", () => {
    const estado = criarEstado(casosBase.empateMRV);

    // A célula que a heurística do GBFS escolheria: domínio de tamanho 1.
    const escolhidaPelaHeuristica = estado.selecionarCelula();
    // A primeira vazia em ordem de linha/coluna: domínio de tamanho 3.
    const primeiraVazia = DFS.primeiraCelulaVazia(estado);

    assert.deepEqual(
        { linha: primeiraVazia.linha, coluna: primeiraVazia.coluna },
        { linha: 0, coluna: 2 },
    );
    assert.deepEqual(
        { linha: escolhidaPelaHeuristica.linha, coluna: escolhidaPelaHeuristica.coluna },
        { linha: 6, coluna: 5 },
    );
    assert.ok(
        DominioCelula.calcularDominioCelula(estado, 2, 0).tamanho >
            DominioCelula.calcularDominioCelula(estado, 5, 6).tamanho,
        "a primeira vazia tem MAIS candidatos que a de MRV: usar a heurística mudaria o passo",
    );

    const resultado = DFS.resolver(estado);
    const selecoes = resultado.eventos.filter(
        (evento) => evento.tipo === "CELL_SELECTED",
    );

    assert.ok(selecoes.length > 0);
    assert.deepEqual(selecoes[0].celula, { linha: 0, coluna: 2 });
    assert.equal(selecoes[0].razao, "PRIMEIRA_CELULA_VAZIA_LINHA_COLUNA");

    // A DFS não deve anexar metadados de heurística (MRV, Degree, LCV) em evento
    // nenhum: se aparecessem, o painel os mostraria como se a busca fosse
    // informada.
    assert.ok(
        resultado.eventos.every((evento) => evento.metadados === null),
        "a DFS não deve anexar metadados de heurística (MRV, Degree, LCV)",
    );
});

test("P1-01 os candidatos são testados sempre em ordem crescente de 1 a 9", () => {
    const resultado = DFS.resolver(criarEstado(casosBase.facil));
    const computados = resultado.eventos.filter(
        (evento) => evento.tipo === "CANDIDATES_COMPUTED",
    );

    assert.ok(computados.length > 0);

    for (const evento of computados) {
        const ordenado = [...evento.candidatos].sort((a, b) => a - b);

        assert.deepEqual(evento.candidatos, ordenado);
        assert.ok(evento.candidatos.every((valor) => valor >= 1 && valor <= 9));
    }

    // Dentro de um mesmo nó, os VALUE_TRIED crescem. A checagem é feita por
    // posição na sequência, agrupando pelo quadro do pai.
    const porNo = new Map();

    for (const evento of resultado.eventos) {
        if (evento.tipo !== "VALUE_TRIED") {
            continue;
        }

        const chave = `${evento.sequencia}|${evento.profundidade}|${evento.celula.linha},${evento.celula.coluna}`;

        if (!porNo.has(chave)) {
            porNo.set(chave, []);
        }

        porNo.get(chave).push(evento.valor);
    }

    assert.ok(porNo.size > 0);

    for (const valores of porNo.values()) {
        assert.deepEqual(valores, [...valores].sort((a, b) => a - b));
    }
});

test("P1-01 a mesma entrada produz o mesmo comportamento lógico em execuções repetidas", () => {
    const primeira = DFS.resolver(criarEstado(casosBase.facil), { silencioso: true });
    const segunda = DFS.resolver(criarEstado(casosBase.facil), { silencioso: true });

    assert.equal(primeira.status, segunda.status);
    assert.deepEqual(primeira.solucao, segunda.solucao);
    assert.deepEqual(primeira.caminhoDeSolucao, segunda.caminhoDeSolucao);

    for (const campo of [
        "estadosExplorados",
        "estadosGerados",
        "tentativasCandidatas",
        "estadosMortos",
        "estadosPodados",
        "profundidadeDaSolucao",
        "fronteiraMaxima",
        "backtracks",
    ]) {
        assert.equal(
            primeira.metricas[campo],
            segunda.metricas[campo],
            `métrica ${campo} variou entre execuções`,
        );
    }
});

test("P1-01 esgota a busca e devolve unsolvable sem solução", () => {
    const estado = criarEstado(casosBase.localmenteValidoInsoluvel);
    const original = copiarMatriz(estado.quadro);
    const resultado = DFS.resolver(estado, { silencioso: true });

    assert.equal(resultado.status, "unsolvable");
    assert.equal(resultado.solucao, null);
    assert.deepEqual(resultado.caminhoDeSolucao, []);
    assert.deepEqual(estado.quadro, original);
    assert.ok(resultado.metricas.estadosExplorados > 0);
    assert.ok(resultado.metricas.backtracks > 0);
});

test("P1-01 devolve invalid para quadro completo e inconsistente", () => {
    const matriz = copiarMatriz(casosBase.completoValido.matriz);
    matriz[0][8] = matriz[0][0];

    const resultado = DFS.resolver(SudokuEstado.gerarDeMatriz(matriz), {
        silencioso: true,
    });

    assert.equal(resultado.status, "invalid");
    assert.equal(resultado.solucao, null);
});

test("P1-01 orçamento estourado devolve cancelled em vez de fingir que resolveu", () => {
    const porNos = DFS.resolver(criarEstado(casosBase.dificil), {
        silencioso: true,
        orcamentoDeNos: 1000,
    });

    assert.equal(porNos.status, "cancelled");
    assert.equal(porNos.solucao, null);
    assert.ok(porNos.metricas.estadosExplorados >= 1000);

    const orcamentoDeEventos = 500;
    const porEventos = DFS.resolver(criarEstado(casosBase.dificil), {
        orcamentoDeEventos,
    });

    assert.equal(porEventos.status, "cancelled");
    assert.ok(porEventos.eventos.length <= orcamentoDeEventos);
    assert.ok(porEventos.metricas.estadosExplorados > 0);
});

test("P1-01 o tabuleiro vazio é resolvido sem MRV, Degree ou LCV", () => {
    const resultado = DFS.resolver(
        SudokuEstado.gerarDeMatriz(tabuleiroVazio()),
        { silencioso: true },
    );

    assert.equal(resultado.status, "solved");
    assert.equal(resultado.metricas.profundidadeDaSolucao, 81);
    assert.equal(SudokuEstado.gerarDeMatriz(resultado.solucao).ehObjetivo(), true);
});

// --------------------------------------------------------------------- P1-02

test("P1-02 as métricas têm os valores medidos e nunca ficam negativas", () => {
    const resultado = DFS.resolver(criarEstado(casosBase.facil));
    const metricas = resultado.metricas;

    assert.ok(metricas instanceof Metrica);
    assert.equal(metricas.ehMock, false);
    assert.ok(metricas.tempo >= 0);
    assert.ok(metricas.estadosExplorados > 0);
    assert.ok(metricas.estadosGerados > 0);
    assert.ok(metricas.tentativasCandidatas > metricas.estadosGerados);
    assert.ok(metricas.estadosMortos > 0);
    assert.ok(metricas.backtracks > 0);

    // Convenção do grupo (PESSOA1_DESCRICAO, seções 1.1 a 1.3).
    assert.equal(metricas.estadosPodados, 0);
    assert.equal(metricas.avaliacoesDeHeuristicas, 0);
    assert.equal(metricas.profundidadeDaSolucao, 51);

    // `fronteiraMaxima` é a profundidade máxima da pilha, não o tamanho de uma
    // fila de prioridade.
    assert.equal(metricas.fronteiraMaxima, 51);

    for (const [campo, valor] of Object.entries(metricas)) {
        if (campo === "ehMock") {
            assert.equal(valor, false, "métrica real não pode vir marcada como mock");
            continue;
        }

        assert.ok(typeof valor === "number", `${campo} não é número`);
        assert.ok(Number.isFinite(valor), `${campo} não é finito`);
        assert.ok(valor >= 0, `${campo} ficou negativo: ${valor}`);
    }
});

test("P1-02 backtracks só aumenta quando um ramo é abandonado", () => {
    // No intermediário a política fixa acerta o primeiro caminho: nenhum ramo
    // precisa ser desfeito, então o contador tem de ser zero.
    const semBacktrack = DFS.resolver(criarEstado(casosBase.intermediario), {
        silencioso: true,
    });

    assert.equal(semBacktrack.metricas.backtracks, 0);
    assert.equal(semBacktrack.status, "solved");

    // No fácil o primeiro caminho falha e a busca volta: existe backtrack, e
    // ele corresponde a ramos realmente explorados até o fim.
    const comBacktrack = DFS.resolver(criarEstado(casosBase.facil), {
        silencioso: true,
    });

    assert.ok(comBacktrack.metricas.backtracks > 0);
    assert.ok(
        comBacktrack.metricas.backtracks <=
            comBacktrack.metricas.estadosExplorados - 1,
        "não pode haver mais backtracks que ramos explorados",
    );
});

test("P1-02 eventos têm sequência determinística e estado completo", () => {
    const resultado = DFS.resolver(criarEstado(casosBase.facil));
    const eventos = resultado.eventos;

    assert.ok(eventos.length > 0);
    assert.equal(eventos[0].tipo, "SEARCH_STARTED");
    assert.equal(eventos[eventos.length - 1].tipo, "SEARCH_FINISHED");
    assert.equal(eventos[eventos.length - 1].razao, "SOLVED");

    eventos.forEach((evento, indice) => {
        assert.equal(evento.sequencia, indice + 1);
        assert.equal(evento.algoritmo, "DFS");
        assert.ok(Array.isArray(evento.estadoSnapshot));
        assert.equal(evento.estadoSnapshot.length, 9);
        assert.ok(evento.estadoSnapshot.every((linha) => linha.length === 9));
        assert.ok(Number.isInteger(evento.profundidade));
        assert.ok(evento.profundidade >= 0);
        assert.ok(Number.isInteger(evento.tamanhoFronteira));
        assert.equal(evento.scoreHeuristico, null);

        // Durante a busca, os estados vivos na pilha são a profundidade mais o
        // estado atual. O `SEARCH_FINISHED` é a exceção: a pilha já esvaziou,
        // e é por isso que ele carrega 0.
        if (evento.tipo === "SEARCH_FINISHED") {
            assert.equal(evento.tamanhoFronteira, 0);
        } else {
            assert.equal(evento.tamanhoFronteira, evento.profundidade + 1);
        }
    });

    // Reprodução determinística: a mesma busca gera a mesma lista.
    const repetida = DFS.resolver(criarEstado(casosBase.facil)).eventos;

    assert.equal(repetida.length, eventos.length);
    assert.deepEqual(
        repetida.map((evento) => `${evento.tipo}:${evento.sequencia}`),
        eventos.map((evento) => `${evento.tipo}:${evento.sequencia}`),
    );
});

test("P1-02 o evento de backtracking permite à interface explicar a reversão", () => {
    const resultado = DFS.resolver(criarEstado(casosBase.facil));
    const retrocessos = resultado.eventos.filter(
        (evento) => evento.tipo === "BACKTRACK",
    );

    assert.ok(retrocessos.length > 0);

    for (const retrocesso of retrocessos) {
        // `razao` é o que o painel mostra para explicar a volta, e `celula`/
        // `valor` dizem qual atribuição foi desfeita.
        assert.equal(retrocesso.razao, "RAMA_SEM_SOLUCAO");
        assert.notEqual(retrocesso.celula, null);
        assert.ok(retrocesso.valor >= 1 && retrocesso.valor <= 9);
    }

    // O primeiro retrocesso acontece no ponto mais fundo da busca que falhou,
    // não na raiz: o primeiro valor tentado desce o ramo inteiro antes de
    // falhar. O que importa é que o snapshot do BACKTRACK é o estado do PAI,
    // com a tentativa desfeita.
    const retrocesso = retrocessos[0];

    const filhoAbandonado = resultado.eventos.find(
        (evento) =>
            evento.tipo === "CHILD_GENERATED" &&
            evento.profundidade === retrocesso.profundidade + 1 &&
            evento.valor === retrocesso.valor &&
            evento.celula.linha === retrocesso.celula.linha &&
            evento.celula.coluna === retrocesso.celula.coluna,
    );

    assert.ok(filhoAbandonado, "o filho do retrocesso tem que ter sido gerado");

    const pai = resultado.eventos.find(
        (evento) =>
            evento.tipo === "NODE_EXPANDED" &&
            evento.profundidade === retrocesso.profundidade,
    );

    assert.ok(pai, "o pai do retrocesso precisa ter sido expandido");
    assert.notDeepEqual(retrocesso.estadoSnapshot, filhoAbandonado.estadoSnapshot);
    assert.deepEqual(retrocesso.estadoSnapshot, pai.estadoSnapshot);

    // E a célula desfeita volta a 0 no snapshot do retrocesso.
    assert.equal(
        retrocesso.estadoSnapshot[retrocesso.celula.linha][retrocesso.celula.coluna],
        0,
    );
    assert.equal(
        filhoAbandonado.estadoSnapshot[filhoAbandonado.celula.linha][
            filhoAbandonado.celula.coluna
        ],
        retrocesso.valor,
    );

    assert.equal(
        indiceDoEventoComQuadro(resultado.eventos, casosBase.facil.matriz),
        0,
        "o snapshot do estado inicial precisa ser o primeiro da reprodução",
    );
});

test("P1-02 existe modo com eventos e modo silencioso com as mesmas métricas", () => {
    const comEventos = DFS.resolver(criarEstado(casosBase.facil));
    const silencioso = DFS.resolver(criarEstado(casosBase.facil), {
        silencioso: true,
    });

    assert.ok(comEventos.eventos.length > 0);
    assert.deepEqual(silencioso.eventos, []);
    assert.equal(silencioso.status, "solved");
    assert.deepEqual(silencioso.solucao, comEventos.solucao);

    for (const campo of [
        "estadosExplorados",
        "estadosGerados",
        "tentativasCandidatas",
        "estadosMortos",
        "estadosPodados",
        "profundidadeDaSolucao",
        "fronteiraMaxima",
        "backtracks",
    ]) {
        assert.equal(
            silencioso.metricas[campo],
            comEventos.metricas[campo],
            `modo silencioso alterou a métrica ${campo}`,
        );
    }

    assert.ok(silencioso.metricas.tempo >= 0);
});

test("P1-02 caminhoDeSolucao vai do estado inicial até a solução", () => {
    const resultado = DFS.resolver(criarEstado(casosBase.facil), {
        silencioso: true,
    });
    const caminho = resultado.caminhoDeSolucao;

    assert.equal(caminho.length, resultado.metricas.profundidadeDaSolucao + 1);
    assert.deepEqual(caminho[0], casosBase.facil.matriz);
    assert.deepEqual(caminho[caminho.length - 1], resultado.solucao);

    // Cada passo do caminho muda exatamente uma célula.
    for (let passo = 1; passo < caminho.length; passo++) {
        const mudancas = [];

        for (let linha = 0; linha < 9; linha++) {
            for (let coluna = 0; coluna < 9; coluna++) {
                if (caminho[passo - 1][linha][coluna] !== caminho[passo][linha][coluna]) {
                    mudancas.push({ linha, coluna });
                }
            }
        }

        assert.equal(mudancas.length, 1);
    }
});

test("P1-02 o resultado é serializável para o frontend", () => {
    const recebido = JSON.parse(JSON.stringify(DFS.resolver(criarEstado(casosBase.facil))));

    assert.equal(recebido.status, "solved");
    assert.equal(recebido.solucao.length, 9);
    assert.ok(recebido.eventos.length > 0);
    assert.ok(Array.isArray(recebido.eventos[0].estadoSnapshot));
    assert.equal(typeof recebido.metricas.estadosExplorados, "number");
    assert.equal(typeof recebido.metricas.ehMock, "boolean");
});