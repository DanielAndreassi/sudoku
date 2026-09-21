import assert from "node:assert/strict";
import test from "node:test";

import MockResolucao from "../mocks/MockResolucao.js";
import Player from "../public/js/player.js";

/**
 * Relogio falso: nenhum teste deste arquivo pode depender de tempo real, de
 * `setTimeout` de verdade ou de `await sleep`. O player recebe `agendar` e
 * `cancelar` deste objeto e os tiques sao disparados manualmente.
 */
function criarRelogio() {
    const pendentes = new Map();
    let proximoId = 1;
    let agendamentos = 0;

    return {
        agendar(callback, atrasoMs) {
            const id = proximoId++;
            pendentes.set(id, { callback, atrasoMs });
            agendamentos++;

            return id;
        },
        cancelar(id) {
            pendentes.delete(id);
        },
        /** Quantos timers estao pendentes agora. */
        get pendentes() {
            return pendentes.size;
        },
        /** Quantas vezes `agendar` foi chamado desde o inicio. */
        get agendamentos() {
            return agendamentos;
        },
        /** Atraso pedido no timer pendente mais antigo. */
        atrasoPendente() {
            const primeiro = pendentes.values().next();

            return primeiro.done ? null : primeiro.value.atrasoMs;
        },
        /** Dispara o timer pendente mais antigo. Retorna false se nao havia nenhum. */
        disparar() {
            const primeiro = pendentes.entries().next();

            if (primeiro.done) {
                return false;
            }

            const [id, tarefa] = primeiro.value;
            pendentes.delete(id);
            tarefa.callback();

            return true;
        },
        /** Dispara tiques ate nao sobrar timer pendente (com trava de seguranca). */
        dispararTudo(limite = 100000) {
            let contador = 0;

            while (this.disparar()) {
                contador++;

                if (contador > limite) {
                    throw new Error("Relogio falso entrou em laco infinito.");
                }
            }

            return contador;
        },
    };
}

/** Player com relogio falso e um registro de tudo que foi aplicado/notificado. */
function criarCenario(eventos = [], opcoes = {}) {
    const relogio = criarRelogio();
    const aplicados = [];
    const estados = [];
    let terminos = 0;

    const player = new Player({
        aoAplicarEvento: (evento, indice) => aplicados.push({ evento, indice }),
        aoMudarEstado: (estado) => estados.push(estado),
        aoTerminar: () => {
            terminos++;
        },
        agendar: relogio.agendar.bind(relogio),
        cancelar: relogio.cancelar.bind(relogio),
        ...opcoes,
    });

    player.definirEventos(eventos);

    return {
        relogio,
        player,
        aplicados,
        estados,
        get terminos() {
            return terminos;
        },
    };
}

function eventosSinteticos(quantidade) {
    return Array.from({ length: quantidade }, (_, i) => ({
        sequencia: i + 1,
        tipo: "SINTETICO",
    }));
}

function sequenciasAplicadas(aplicados) {
    return aplicados.map((registro) => registro.evento.sequencia);
}

test("P3-03 aplica os eventos na ordem de sequencia (DFS)", () => {
    const eventos = MockResolucao.criarEventosDFS();
    const cenario = criarCenario(eventos);

    cenario.player.irAoFim();

    assert.deepEqual(sequenciasAplicadas(cenario.aplicados), [1, 2, 3, 4, 5, 6, 7]);
    assert.deepEqual(
        cenario.aplicados.map((registro) => registro.indice),
        [0, 1, 2, 3, 4, 5, 6],
    );
    assert.deepEqual(
        cenario.aplicados.map((registro) => registro.evento.tipo),
        [
            "SEARCH_STARTED",
            "CELL_SELECTED",
            "VALUE_TRIED",
            "BACKTRACK",
            "VALUE_TRIED",
            "SOLUTION_FOUND",
            "SEARCH_FINISHED",
        ],
    );
});

test("P3-03 reproducao automatica do GBFS segue a mesma ordem e entrega os snapshots", () => {
    const eventos = MockResolucao.criarEventosGBFS();
    const cenario = criarCenario(eventos);

    cenario.player.iniciar();
    cenario.relogio.dispararTudo();

    assert.deepEqual(sequenciasAplicadas(cenario.aplicados), [1, 2, 3, 4, 5, 6]);
    assert.equal(cenario.aplicados[1].evento.tipo, "NODE_EXPANDED");

    // Doc 00, secao 13.2: o GBFS pode saltar entre ramos, entao todo evento
    // precisa chegar ao controlador com o snapshot do no.
    for (const { evento } of cenario.aplicados) {
        assert.ok(Array.isArray(evento.estadoSnapshot));
        assert.equal(evento.estadoSnapshot.length, 9);
    }

    assert.equal(cenario.player.terminou, true);
    assert.equal(cenario.player.estaTocando, false);
});

test("P3-03 proximoPasso aplica um e apenas um evento", () => {
    const cenario = criarCenario(eventosSinteticos(5));

    const primeiro = cenario.player.proximoPasso();

    assert.equal(cenario.aplicados.length, 1);
    assert.equal(primeiro.sequencia, 1);
    assert.equal(cenario.player.indice, 1);
    assert.equal(cenario.relogio.agendamentos, 0);

    const segundo = cenario.player.proximoPasso();

    assert.equal(cenario.aplicados.length, 2);
    assert.equal(segundo.sequencia, 2);
    assert.equal(cenario.player.indice, 2);
});

test("P3-03 lista vazia: total 0, terminou true e proximoPasso devolve null", () => {
    const cenario = criarCenario([]);

    assert.equal(cenario.player.total, 0);
    assert.equal(cenario.player.indice, 0);
    assert.equal(cenario.player.terminou, true);
    assert.equal(cenario.player.proximoPasso(), null);
    assert.equal(cenario.aplicados.length, 0);

    cenario.player.iniciar();

    assert.equal(cenario.relogio.agendamentos, 0);
    assert.equal(cenario.player.estaTocando, false);
});

test("P3-03 lista de um evento: bordas de indice e terminou", () => {
    const cenario = criarCenario(eventosSinteticos(1));

    assert.equal(cenario.player.total, 1);
    assert.equal(cenario.player.terminou, false);

    const aplicado = cenario.player.proximoPasso();

    assert.equal(aplicado.sequencia, 1);
    assert.equal(cenario.player.indice, 1);
    assert.equal(cenario.player.terminou, true);

    assert.equal(cenario.player.proximoPasso(), null);
    assert.equal(cenario.player.indice, 1);
    assert.equal(cenario.aplicados.length, 1);
});

test("P3-03 ultimo evento encerra a reproducao sem agendar outro tique", () => {
    const cenario = criarCenario(eventosSinteticos(3));

    cenario.player.iniciar();
    cenario.relogio.disparar();
    cenario.relogio.disparar();

    assert.equal(cenario.player.indice, 2);
    assert.equal(cenario.relogio.pendentes, 1);

    cenario.relogio.disparar();

    assert.equal(cenario.player.indice, 3);
    assert.equal(cenario.player.terminou, true);
    assert.equal(cenario.player.estaTocando, false);
    assert.equal(cenario.relogio.pendentes, 0);
});

test("P3-03 pausar impede o avanco automatico mas nao o manual", () => {
    const cenario = criarCenario(eventosSinteticos(6));

    cenario.player.iniciar();
    cenario.relogio.disparar();
    cenario.player.pausar();

    assert.equal(cenario.player.estaTocando, false);
    assert.equal(cenario.relogio.pendentes, 0);
    assert.equal(cenario.relogio.disparar(), false);
    assert.equal(cenario.aplicados.length, 1);

    cenario.player.proximoPasso();
    cenario.player.proximoPasso();

    assert.equal(cenario.aplicados.length, 3);
    assert.equal(cenario.player.indice, 3);
    assert.equal(cenario.player.estaTocando, false);
    assert.equal(cenario.relogio.pendentes, 0);
});

test("P3-03 iniciar duas vezes nao cria um segundo timer", () => {
    const cenario = criarCenario(eventosSinteticos(4));

    cenario.player.iniciar();
    cenario.player.iniciar();
    cenario.player.continuar();

    assert.equal(cenario.relogio.pendentes, 1);
    assert.equal(cenario.relogio.agendamentos, 1);

    cenario.relogio.disparar();

    assert.equal(cenario.aplicados.length, 1);
    assert.equal(cenario.relogio.pendentes, 1);
});

test("P3-03 continuar retoma de onde pausou sem duplicar timer", () => {
    const cenario = criarCenario(eventosSinteticos(5));

    cenario.player.iniciar();
    cenario.relogio.disparar();
    cenario.player.pausar();
    cenario.player.continuar();
    cenario.player.continuar();

    assert.equal(cenario.relogio.pendentes, 1);

    cenario.relogio.disparar();

    assert.deepEqual(sequenciasAplicadas(cenario.aplicados), [1, 2]);
    assert.equal(cenario.player.estaTocando, true);
});

test("P3-03 irAoFim aplica todos os eventos restantes sem agendar nada", () => {
    const cenario = criarCenario(eventosSinteticos(1000));

    cenario.player.proximoPasso();
    cenario.player.irAoFim();

    assert.equal(cenario.aplicados.length, 1000);
    assert.equal(cenario.player.indice, 1000);
    assert.equal(cenario.player.terminou, true);
    assert.equal(cenario.relogio.agendamentos, 0);
    assert.equal(cenario.relogio.pendentes, 0);
    assert.deepEqual(
        sequenciasAplicadas(cenario.aplicados).slice(0, 3),
        [1, 2, 3],
    );
});

test("P3-03 irAoFim durante a reproducao cancela o timer pendente", () => {
    const cenario = criarCenario(eventosSinteticos(10));

    cenario.player.iniciar();

    assert.equal(cenario.relogio.pendentes, 1);

    cenario.player.irAoFim();

    assert.equal(cenario.relogio.pendentes, 0);
    assert.equal(cenario.aplicados.length, 10);
    assert.equal(cenario.player.estaTocando, false);
});

test("P3-03 resetar volta o indice a 0 e cancela pendencias", () => {
    const cenario = criarCenario(eventosSinteticos(8));

    cenario.player.iniciar();
    cenario.relogio.disparar();
    cenario.relogio.disparar();

    assert.equal(cenario.player.indice, 2);
    assert.equal(cenario.relogio.pendentes, 1);

    cenario.player.resetar();

    assert.equal(cenario.player.indice, 0);
    assert.equal(cenario.player.terminou, false);
    assert.equal(cenario.player.estaTocando, false);
    assert.equal(cenario.relogio.pendentes, 0);
    assert.equal(cenario.relogio.disparar(), false);
    assert.equal(cenario.aplicados.length, 2);

    cenario.player.proximoPasso();

    assert.equal(cenario.aplicados.at(-1).evento.sequencia, 1);
});

test("P3-03 irParaIndice avanca para frente aplicando os eventos do intervalo", () => {
    const cenario = criarCenario(eventosSinteticos(10));

    cenario.player.irParaIndice(4);

    assert.deepEqual(sequenciasAplicadas(cenario.aplicados), [1, 2, 3, 4]);
    assert.equal(cenario.player.indice, 4);
    assert.equal(cenario.player.terminou, false);

    cenario.player.irParaIndice(6);

    assert.deepEqual(sequenciasAplicadas(cenario.aplicados), [1, 2, 3, 4, 5, 6]);
    assert.equal(cenario.player.indice, 6);
});

test("P3-03 irParaIndice para tras reaplica desde o comeco", () => {
    const cenario = criarCenario(eventosSinteticos(10));

    cenario.player.irParaIndice(5);
    cenario.aplicados.length = 0;

    cenario.player.irParaIndice(2);

    assert.deepEqual(sequenciasAplicadas(cenario.aplicados), [1, 2]);
    assert.equal(cenario.player.indice, 2);

    cenario.aplicados.length = 0;
    cenario.player.irParaIndice(0);

    assert.deepEqual(cenario.aplicados, []);
    assert.equal(cenario.player.indice, 0);
    assert.equal(cenario.player.terminou, false);
});

test("P3-03 irParaIndice limita valores fora da faixa", () => {
    const cenario = criarCenario(eventosSinteticos(3));

    cenario.player.irParaIndice(99);

    assert.equal(cenario.player.indice, 3);
    assert.equal(cenario.player.terminou, true);
    assert.equal(cenario.aplicados.length, 3);

    cenario.player.irParaIndice(-5);

    assert.equal(cenario.player.indice, 0);
    assert.equal(cenario.player.terminou, false);
    assert.equal(cenario.aplicados.length, 3);
});

test("P3-03 definirVelocidade no meio da reproducao vale do proximo passo em diante", () => {
    const cenario = criarCenario(eventosSinteticos(5), { velocidadeMs: 200 });

    cenario.player.iniciar();

    assert.equal(cenario.relogio.atrasoPendente(), 200);

    cenario.relogio.disparar();

    assert.equal(cenario.relogio.atrasoPendente(), 200);

    cenario.player.definirVelocidade(30);

    assert.equal(cenario.player.velocidadeMs, 30);
    assert.equal(cenario.player.estaTocando, true);
    assert.equal(cenario.relogio.pendentes, 1);

    cenario.relogio.disparar();

    assert.equal(cenario.relogio.atrasoPendente(), 30);
    assert.equal(cenario.aplicados.length, 2);
});

test("P3-03 aoTerminar dispara uma unica vez por reproducao", () => {
    const cenario = criarCenario(eventosSinteticos(3));

    cenario.player.iniciar();
    cenario.relogio.dispararTudo();

    assert.equal(cenario.terminos, 1);

    cenario.player.proximoPasso();
    cenario.player.irAoFim();
    cenario.player.irParaIndice(3);

    assert.equal(cenario.terminos, 1);

    cenario.player.resetar();
    cenario.player.irAoFim();

    assert.equal(cenario.terminos, 2);
});

test("P3-03 aoMudarEstado reporta indice, total, tocando e terminou", () => {
    const cenario = criarCenario(eventosSinteticos(2));

    assert.deepEqual(cenario.estados.at(-1), {
        indice: 0,
        total: 2,
        tocando: false,
        terminou: false,
    });

    cenario.player.proximoPasso();

    assert.deepEqual(cenario.estados.at(-1), {
        indice: 1,
        total: 2,
        tocando: false,
        terminou: false,
    });

    cenario.player.iniciar();

    assert.deepEqual(cenario.estados.at(-1), {
        indice: 1,
        total: 2,
        tocando: true,
        terminou: false,
    });

    cenario.relogio.disparar();

    assert.deepEqual(cenario.estados.at(-1), {
        indice: 2,
        total: 2,
        tocando: false,
        terminou: true,
    });
});

test("P3-03 irAoFim notifica estado uma unica vez, nao um por evento", () => {
    const cenario = criarCenario(eventosSinteticos(500));

    cenario.estados.length = 0;
    cenario.player.irAoFim();

    assert.equal(cenario.estados.length, 1);
    assert.equal(cenario.aplicados.length, 500);
});

test("P3-03 definirEventos troca a lista, reseta o indice e cancela timer", () => {
    const cenario = criarCenario(MockResolucao.criarEventosDFS());

    cenario.player.iniciar();
    cenario.relogio.disparar();

    assert.equal(cenario.player.indice, 1);

    cenario.player.definirEventos(MockResolucao.criarEventosGBFS());

    assert.equal(cenario.player.total, 6);
    assert.equal(cenario.player.indice, 0);
    assert.equal(cenario.player.estaTocando, false);
    assert.equal(cenario.relogio.pendentes, 0);

    cenario.aplicados.length = 0;
    cenario.player.irAoFim();

    assert.deepEqual(sequenciasAplicadas(cenario.aplicados), [1, 2, 3, 4, 5, 6]);
    assert.equal(cenario.aplicados[0].evento.algoritmo, "GBFS");
});

test("P3-03 alterar o array original depois nao muda a reproducao", () => {
    const eventos = eventosSinteticos(3);
    const cenario = criarCenario(eventos);

    eventos.push({ sequencia: 99, tipo: "INTRUSO" });
    cenario.player.irAoFim();

    assert.equal(cenario.player.total, 3);
    assert.deepEqual(sequenciasAplicadas(cenario.aplicados), [1, 2, 3]);
});

test("P3-03 o player nunca muta os eventos recebidos", () => {
    const eventos = [
        ...MockResolucao.criarEventosDFS(),
        ...MockResolucao.criarEventosGBFS(),
    ];
    const antes = JSON.stringify(eventos);
    const cenario = criarCenario(eventos);

    cenario.player.iniciar();
    cenario.relogio.dispararTudo();
    cenario.player.resetar();
    cenario.player.irParaIndice(5);
    cenario.player.irParaIndice(2);
    cenario.player.irAoFim();

    assert.equal(JSON.stringify(eventos), antes);
    assert.equal(cenario.aplicados[0].evento, eventos[0]);
});

test("P3-03 aoAplicarEvento e obrigatorio e os callbacks opcionais podem faltar", () => {
    assert.throws(() => new Player({}), TypeError);
    assert.throws(() => new Player({ aoAplicarEvento: null }), TypeError);

    const relogio = criarRelogio();
    const aplicados = [];
    const player = new Player({
        aoAplicarEvento: (evento) => aplicados.push(evento),
        agendar: relogio.agendar.bind(relogio),
        cancelar: relogio.cancelar.bind(relogio),
    });

    player.definirEventos(eventosSinteticos(2));
    player.iniciar();
    relogio.dispararTudo();

    assert.equal(aplicados.length, 2);
    assert.equal(player.terminou, true);
});

test("P3-03 velocidade invalida e rejeitada", () => {
    assert.throws(() => new Player({ aoAplicarEvento: () => {}, velocidadeMs: -1 }), RangeError);

    const cenario = criarCenario(eventosSinteticos(1));

    assert.throws(() => cenario.player.definirVelocidade(Number.NaN), RangeError);
    assert.throws(() => cenario.player.irParaIndice(Number.NaN), RangeError);
    assert.throws(() => cenario.player.definirEventos("nao e array"), TypeError);
});
