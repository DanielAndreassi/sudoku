import test from "node:test";
import assert from "node:assert/strict";

import Controlador, { ESTADOS } from "../public/js/controlador.js";
import MockResolucao from "../mocks/MockResolucao.js";

const QUADRO_VAZIO = Array.from({ length: 9 }, () => new Array(9).fill(0));

function criarTabuleiroFalso(quadro = QUADRO_VAZIO) {
    return {
        quadro: quadro.map((linha) => [...linha]),
        pistasFixadas: 0,
        bloqueado: false,
        errosDestacados: [],
        snapshotsRenderizados: [],
        limpou: 0,
        resetou: 0,
        lerQuadro() {
            return this.quadro.map((linha) => [...linha]);
        },
        escreverQuadro(matriz) {
            this.quadro = matriz.map((linha) => [...linha]);
        },
        pistas: null,
        fixarPistas(matriz) {
            this.pistasFixadas++;
            // Imita o real: congela o tabuleiro atual como estado inicial, para
            // que `resetar()` tenha a que voltar.
            this.pistas = (matriz ?? this.quadro).map((linha) => [...linha]);
        },
        bloquearEdicao(valor) {
            this.bloqueado = valor;
        },
        destacarErros(celulas) {
            this.errosDestacados = celulas;
        },
        renderizarSnapshot(matriz) {
            this.snapshotsRenderizados.push(matriz);
        },
        limpar() {
            this.limpou++;
            this.quadro = QUADRO_VAZIO.map((linha) => [...linha]);
        },
        resetar() {
            this.resetou++;

            if (this.pistas !== null) {
                this.quadro = this.pistas.map((linha) => [...linha]);
            }
        },
    };
}

function criarPlayerFalso() {
    return {
        eventos: [],
        indice: 0,
        iniciou: 0,
        pausou: 0,
        resetouCount: 0,
        foiAoFim: 0,
        get total() {
            return this.eventos.length;
        },
        definirEventos(eventos) {
            this.eventos = eventos;
            this.indice = 0;
        },
        proximoPasso() {
            if (this.indice >= this.eventos.length) {
                return null;
            }

            return this.eventos[this.indice++];
        },
        iniciar() {
            this.iniciou++;
        },
        pausar() {
            this.pausou++;
        },
        resetar() {
            this.resetouCount++;
            this.indice = 0;
        },
        irAoFim() {
            this.foiAoFim++;
            this.indice = this.eventos.length;
        },
    };
}

function criarPainelFalso() {
    return {
        execucoes: [],
        comparacoes: [],
        renderizou: 0,
        limpou: 0,
        mostrarExecucao(algoritmo, resultado) {
            this.execucoes.push({ algoritmo, resultado });
        },
        registrarParaComparacao(chave, algoritmo, resultado) {
            this.comparacoes.push({ chave, algoritmo, resultado });
        },
        renderizarComparacao() {
            this.renderizou++;
        },
        limpar() {
            this.limpou++;
        },
    };
}

const chaveFalsa = (matriz) => matriz.map((linha) => linha.join("")).join("");

function montar({ respostaApi, atrasoApi = null } = {}) {
    const tabuleiro = criarTabuleiroFalso();
    const player = criarPlayerFalso();
    const painel = criarPainelFalso();
    const chamadas = [];

    const api = {
        resolver(pedido) {
            chamadas.push(pedido);

            if (atrasoApi) {
                return atrasoApi;
            }

            return Promise.resolve(respostaApi);
        },
    };

    const mudancas = [];
    const controlador = new Controlador({
        tabuleiro,
        player,
        painel,
        api,
        gerarChave: chaveFalsa,
        aoMudar: (instantaneo) => mudancas.push(instantaneo.estado),
    });

    return { controlador, tabuleiro, player, painel, chamadas, mudancas };
}

const RESPOSTA_OK = {
    ok: true,
    resultado: MockResolucao.criarResultadoSucesso("GBFS"),
};

test("P3-02 comeca ocioso e vai a PRONTO apos resolver com sucesso", async () => {
    const { controlador, mudancas } = montar({ respostaApi: RESPOSTA_OK });

    assert.equal(controlador.estado, ESTADOS.OCIOSO);

    const ok = await controlador.resolver("gbfs");

    assert.equal(ok, true);
    assert.equal(controlador.estado, ESTADOS.PRONTO);
    assert.deepEqual(mudancas, [ESTADOS.VALIDANDO, ESTADOS.RESOLVENDO, ESTADOS.PRONTO]);
});

test("P3-02 entrada invalida nao chega ao solver e destaca as celulas do erro", async () => {
    const { controlador, tabuleiro } = montar({
        respostaApi: {
            ok: false,
            validacao: {
                ehValido: false,
                codigo: "INVALID_RULES",
                mensagem: "Duplicata na linha 1.",
                celulas: [{ linha: 0, coluna: 2 }, { linha: 0, coluna: 5 }],
            },
        },
    });

    const ok = await controlador.resolver("gbfs");

    assert.equal(ok, false);
    assert.equal(controlador.estado, ESTADOS.ERRO);
    assert.equal(controlador.mensagem, "Duplicata na linha 1.");
    assert.equal(tabuleiro.errosDestacados.length, 2);
    assert.equal(controlador.resultado, null);
});

test("P3-02 duas execucoes simultaneas sao impossiveis", async () => {
    let liberar;
    const pendente = new Promise((resolve) => {
        liberar = resolve;
    });

    const { controlador, chamadas } = montar({ atrasoApi: pendente });

    const primeira = controlador.resolver("gbfs");

    // Logo apos a chamada o controlador ainda esta em VALIDANDO: existe uma
    // cessao de controle antes de RESOLVENDO, para o navegador conseguir pintar
    // o estado intermediario. O que importa aqui e que ele ja esta OCUPADO.
    assert.equal(controlador.estado, ESTADOS.VALIDANDO);
    assert.equal(controlador.ocupado, true);

    await Promise.resolve();
    assert.equal(controlador.estado, ESTADOS.RESOLVENDO);

    // Segunda chamada durante a primeira: recusada, sem tocar na api.
    const segunda = await controlador.resolver("gbfs");
    assert.equal(segunda, false);
    assert.equal(chamadas.length, 1);

    liberar(RESPOSTA_OK);
    await primeira;

    assert.equal(controlador.estado, ESTADOS.PRONTO);
});

test("P3-02 tabuleiro fica bloqueado durante a busca e liberado depois", async () => {
    let liberar;
    const pendente = new Promise((resolve) => {
        liberar = resolve;
    });

    const { controlador, tabuleiro } = montar({ atrasoApi: pendente });

    const execucao = controlador.resolver("gbfs");
    assert.equal(tabuleiro.bloqueado, true);
    await Promise.resolve();

    liberar(RESPOSTA_OK);
    await execucao;

    assert.equal(tabuleiro.bloqueado, false);
});

test("P3-02 tabuleiro e liberado tambem quando a api falha", async () => {
    const { controlador, tabuleiro } = montar({
        atrasoApi: Promise.reject(new Error("rede caiu")),
    });

    const ok = await controlador.resolver("gbfs");

    assert.equal(ok, false);
    assert.equal(controlador.estado, ESTADOS.ERRO);
    assert.equal(tabuleiro.bloqueado, false);
    assert.match(controlador.mensagem, /rede caiu/);
});

test("P3-02 trocar de algoritmo chama o solver correspondente", async () => {
    const { controlador, chamadas } = montar({ respostaApi: RESPOSTA_OK });

    await controlador.resolver("gbfs");
    await controlador.resolver("dfs");

    assert.deepEqual(chamadas.map((c) => c.algoritmo), ["gbfs", "dfs"]);
    assert.equal(controlador.algoritmoAtual, "dfs");
});

test("P3-02 resultado alimenta player e painel", async () => {
    const { controlador, player, painel } = montar({ respostaApi: RESPOSTA_OK });

    await controlador.resolver("gbfs");

    assert.equal(player.total, RESPOSTA_OK.resultado.eventos.length);
    assert.equal(painel.execucoes.length, 1);
    assert.equal(painel.comparacoes.length, 1);
    assert.equal(painel.renderizou, 1);
});

test("P3-03 reproduzir, pausar e passo manual respeitam a maquina de estados", async () => {
    const { controlador, player } = montar({ respostaApi: RESPOSTA_OK });
    await controlador.resolver("gbfs");

    assert.equal(controlador.reproduzir(), true);
    assert.equal(controlador.estado, ESTADOS.REPRODUZINDO);
    assert.equal(player.iniciou, 1);

    // Reproduzir de novo enquanto ja reproduz nao pode criar segunda reproducao.
    assert.equal(controlador.reproduzir(), false);
    assert.equal(player.iniciou, 1);

    // Passo manual durante reproducao automatica e recusado.
    assert.equal(controlador.proximoPasso(), false);

    assert.equal(controlador.pausar(), true);
    assert.equal(controlador.estado, ESTADOS.PAUSADO);

    assert.equal(controlador.proximoPasso(), true);
    assert.equal(player.indice, 1);
});

test("P3-03 proximoPasso avanca exatamente um evento", async () => {
    const { controlador, player } = montar({ respostaApi: RESPOSTA_OK });
    await controlador.resolver("gbfs");

    controlador.proximoPasso();
    controlador.proximoPasso();
    controlador.proximoPasso();

    assert.equal(player.indice, 3);
});

test("P3-03 irAoFim e resetarAnimacao mudam o estado corretamente", async () => {
    const { controlador, player, tabuleiro } = montar({ respostaApi: RESPOSTA_OK });
    await controlador.resolver("gbfs");

    assert.equal(controlador.irAoFim(), true);
    assert.equal(controlador.estado, ESTADOS.FINALIZADO);
    assert.equal(player.foiAoFim, 1);

    assert.equal(controlador.resetarAnimacao(), true);
    assert.equal(controlador.estado, ESTADOS.PRONTO);
    assert.equal(player.indice, 0);
    assert.equal(tabuleiro.resetou, 1);
});

test("P3-02 nao permite limpar nem carregar puzzle durante execucao", async () => {
    let liberar;
    const pendente = new Promise((resolve) => {
        liberar = resolve;
    });

    const { controlador, tabuleiro } = montar({ atrasoApi: pendente });
    const execucao = controlador.resolver("gbfs");

    assert.equal(controlador.limpar(), false);
    assert.equal(controlador.carregarPuzzle(QUADRO_VAZIO), false);
    assert.equal(tabuleiro.limpou, 0);

    liberar(RESPOSTA_OK);
    await execucao;

    assert.equal(controlador.limpar(), true);
});

test("P3-04 a chave do puzzle acompanha o resultado registrado", async () => {
    const matriz = QUADRO_VAZIO.map((linha) => [...linha]);
    matriz[0][0] = 5;

    const { controlador, painel } = montar({ respostaApi: RESPOSTA_OK });
    controlador.carregarPuzzle(matriz);
    await controlador.resolver("gbfs");

    assert.equal(controlador.chavePuzzle, chaveFalsa(matriz));
    assert.equal(painel.comparacoes[0].chave, chaveFalsa(matriz));
});

test("P3-02 instantaneo descreve quais controles podem ficar ativos", async () => {
    const { controlador } = montar({ respostaApi: RESPOSTA_OK });

    let foto = controlador.instantaneo();
    assert.equal(foto.podeResolver, true);
    assert.equal(foto.podeReproduzir, false);
    assert.equal(foto.podePausar, false);

    await controlador.resolver("gbfs");

    foto = controlador.instantaneo();
    assert.equal(foto.podeReproduzir, true);
    assert.equal(foto.podePausar, false);
    assert.equal(foto.totalEventos, RESPOSTA_OK.resultado.eventos.length);

    controlador.reproduzir();
    foto = controlador.instantaneo();
    assert.equal(foto.podePausar, true);
    assert.equal(foto.podeResolver, false);
    assert.equal(foto.podeEditar, false);
});

test("P3-02 modo silencioso chega na api e e refletido na mensagem", async () => {
    const semEventos = {
        status: "solved",
        solucao: Array.from({ length: 9 }, () => new Array(9).fill(1)),
        metricas: { tempo: 3.2, ehMock: false },
        eventos: [],
    };

    const { controlador, chamadas, player } = montar({
        respostaApi: { ok: true, resultado: semEventos },
    });

    await controlador.resolver("dfs", { silencioso: true });

    assert.equal(chamadas[0].silencioso, true);
    assert.equal(controlador.estado, ESTADOS.PRONTO);
    assert.match(controlador.mensagem, /sem animacao/);
    assert.equal(player.total, 0);
    assert.equal(controlador.temAnimacao, false);
    assert.equal(controlador.temSolucao, true);
});

test("P3-02 sem a opcao, silencioso vai false para a api", async () => {
    const { controlador, chamadas } = montar({ respostaApi: RESPOSTA_OK });

    await controlador.resolver("gbfs");

    assert.equal(chamadas[0].silencioso, false);
});

test("P3-04 execucao cancelled NAO entra na comparacao", async () => {
    const cancelada = {
        status: "cancelled",
        solucao: null,
        metricas: { tempo: 544, ehMock: false },
        eventos: MockResolucao.criarEventosDFS(),
    };

    const { controlador, painel } = montar({
        respostaApi: { ok: true, resultado: cancelada },
    });

    await controlador.resolver("dfs");

    // metricas da execucao aparecem...
    assert.equal(painel.execucoes.length, 1);
    // ...mas a comparacao nao recebe nada: ela mediu so os primeiros eventos.
    assert.equal(painel.comparacoes.length, 0);
    assert.equal(painel.renderizou, 0);
    assert.match(controlador.mensagem, /interrompida/);
    assert.match(controlador.mensagem, /nao entra na comparacao/);
});

test("P3-02 cancelled tem animacao mas nao tem solucao para exibir", async () => {
    const cancelada = {
        status: "cancelled",
        solucao: null,
        metricas: { tempo: 544, ehMock: false },
        eventos: MockResolucao.criarEventosDFS(),
    };

    const { controlador, tabuleiro } = montar({
        respostaApi: { ok: true, resultado: cancelada },
    });

    await controlador.resolver("dfs");

    assert.equal(controlador.temAnimacao, true);
    assert.equal(controlador.temSolucao, false);
    assert.equal(controlador.instantaneo().temSolucao, false);

    // "Ver solucao" nao tem o que mostrar e nao pode fingir que tem.
    assert.equal(controlador.mostrarSolucao(), false);
    assert.equal(tabuleiro.snapshotsRenderizados.length, 0);
});

test("P3-02 cede o controle entre VALIDANDO e RESOLVENDO", async () => {
    const cessoes = [];
    const tabuleiro = criarTabuleiroFalso();
    const controlador = new Controlador({
        tabuleiro,
        player: criarPlayerFalso(),
        painel: criarPainelFalso(),
        api: { resolver: () => Promise.resolve(RESPOSTA_OK) },
        gerarChave: chaveFalsa,
        cederControle: () => {
            cessoes.push(controlador.estado);
            return Promise.resolve();
        },
    });

    await controlador.resolver("gbfs");

    // Cedeu exatamente uma vez, e ainda em VALIDANDO — e isso que da ao
    // navegador a chance de pintar antes dos ~540 ms de validacao do dificil.
    assert.deepEqual(cessoes, [ESTADOS.VALIDANDO]);
});

test("P3-02 unsolvable recebe mensagem propria, nao o status cru", async () => {
    const insoluvel = {
        status: "unsolvable",
        solucao: null,
        metricas: { tempo: 2.1, ehMock: false },
        eventos: [],
    };

    const { controlador, painel } = montar({
        respostaApi: { ok: true, resultado: insoluvel },
    });

    await controlador.resolver("dfs");

    assert.match(controlador.mensagem, /nao tem solucao/);
    assert.equal(painel.comparacoes.length, 0);
});

test("P3-04 animar e depois resolver de novo NAO usa o tabuleiro animado", async () => {
    const matriz = QUADRO_VAZIO.map((linha) => [...linha]);
    matriz[0][0] = 5;

    const { controlador, tabuleiro, chamadas } = montar({ respostaApi: RESPOSTA_OK });

    controlador.carregarPuzzle(matriz);
    await controlador.resolver("dfs");

    const chaveOriginal = chaveFalsa(matriz);
    assert.equal(chamadas[0].quadro[0][0], 5);

    // A animacao suja o tabuleiro com um estado intermediario da busca.
    tabuleiro.escreverQuadro(
        matriz.map((linha, l) => linha.map((v, c) => (l === 4 && c === 4 ? 9 : v))),
    );

    await controlador.resolver("gbfs");

    // A segunda execucao tem de receber o PUZZLE, nao o que estava na tela.
    assert.deepEqual(chamadas[1].quadro, matriz);
    assert.equal(controlador.chavePuzzle, chaveOriginal);
    assert.equal(tabuleiro.resetou, 1);
});
