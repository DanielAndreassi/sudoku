/**
 * Player de animacao da busca (P3-03).
 *
 * LOGICA PURA. Este modulo nao conhece DOM: nao importa `tabuleiro.js`, nao
 * toca em `document` e nao usa `setTimeout` global diretamente. Tudo o que ele
 * sabe fazer e percorrer a lista de `EventoBusca` ja produzida pelo resolvedor
 * e avisar quem o criou, por callback, qual evento deve ser aplicado agora.
 *
 * Isso segue a separacao exigida pelo doc 00, secao 13.1 (busca != apresentacao)
 * e e o que permite testar o player com `node --test` sem jsdom.
 *
 * Quem desenha e o controlador: ele recebe `aoAplicarEvento(evento, indice)` e
 * decide o que fazer com `evento.estadoSnapshot`, `evento.celula`, etc. Para o
 * GBFS isso e obrigatorio (doc 00, secao 13.2): em `NODE_EXPANDED` a fronteira
 * pode saltar para outro ramo, entao o tabuleiro precisa ser substituido pelo
 * `estadoSnapshot` daquele no em vez de ser editado incrementalmente.
 *
 * Granularidade: um passo = exatamente UM evento, nunca um agrupamento. O doc 04
 * (P3-03, criterio de aceite) exige "avanca exatamente um evento logico", e e
 * justamente entre CELL_SELECTED -> CANDIDATES_COMPUTED -> VALUE_TRIED que se
 * enxerga MRV -> candidatos -> LCV acontecendo.
 */

/** Velocidade padrao de reproducao, em milissegundos entre eventos. */
const VELOCIDADE_PADRAO_MS = 120;

export default class Player {
    #eventos;
    #indice;
    #tocando;
    #timer;
    #velocidadeMs;
    #aoAplicarEvento;
    #aoMudarEstado;
    #aoTerminar;
    #agendar;
    #cancelar;
    #terminoNotificado;

    /**
     * @param {object} opcoes
     * @param {(evento: object, indice: number) => void} opcoes.aoAplicarEvento
     *     Obrigatorio. Chamado uma vez por evento aplicado, com o indice 0-based
     *     da posicao do evento na lista.
     * @param {(estado: {indice: number, total: number, tocando: boolean, terminou: boolean}) => void} [opcoes.aoMudarEstado]
     *     Opcional. Chamado quando o indice ou o estado de reproducao muda. Em
     *     operacoes em lote (`irAoFim`, `irParaIndice`) e chamado UMA vez, no
     *     fim, e nao uma vez por evento.
     * @param {() => void} [opcoes.aoTerminar]
     *     Opcional. Dispara uma unica vez ao chegar ao fim da lista; so volta a
     *     poder disparar depois de `resetar`, `definirEventos` ou de um salto
     *     para tras.
     * @param {(callback: Function, atrasoMs: number) => any} [opcoes.agendar]
     *     Injetavel para teste deterministico. Padrao: `setTimeout`.
     * @param {(id: any) => void} [opcoes.cancelar] Padrao: `clearTimeout`.
     * @param {number} [opcoes.velocidadeMs] Intervalo entre eventos na
     *     reproducao automatica. Padrao: 120.
     */
    constructor({
        aoAplicarEvento,
        aoMudarEstado = null,
        aoTerminar = null,
        // Envolvidos de proposito. Passar `setTimeout`/`clearTimeout` crus faz o
        // navegador lancar "Illegal invocation": chamados como `this.agendar(...)`,
        // o `this` vira a instancia do Player, e a implementacao do browser exige
        // `this === window`. O Node nao exige, entao o bug passa por todos os
        // testes e so aparece na pagina de verdade.
        agendar = (fn, ms) => setTimeout(fn, ms),
        cancelar = (id) => clearTimeout(id),
        velocidadeMs = VELOCIDADE_PADRAO_MS,
    } = {}) {
        if (typeof aoAplicarEvento !== "function") {
            throw new TypeError(
                "Player exige aoAplicarEvento(evento, indice) como funcao.",
            );
        }

        if (aoMudarEstado !== null && typeof aoMudarEstado !== "function") {
            throw new TypeError("aoMudarEstado, se informado, deve ser funcao.");
        }

        if (aoTerminar !== null && typeof aoTerminar !== "function") {
            throw new TypeError("aoTerminar, se informado, deve ser funcao.");
        }

        if (typeof agendar !== "function" || typeof cancelar !== "function") {
            throw new TypeError("agendar e cancelar devem ser funcoes.");
        }

        this.#eventos = [];
        this.#indice = 0;
        this.#tocando = false;
        this.#timer = null;
        this.#velocidadeMs = Player.#validarVelocidade(velocidadeMs);
        this.#aoAplicarEvento = aoAplicarEvento;
        this.#aoMudarEstado = aoMudarEstado;
        this.#aoTerminar = aoTerminar;
        this.#agendar = agendar;
        this.#cancelar = cancelar;
        this.#terminoNotificado = false;
    }

    static #validarVelocidade(velocidadeMs) {
        if (!Number.isFinite(velocidadeMs) || velocidadeMs < 0) {
            throw new RangeError(
                "velocidadeMs deve ser um numero finito maior ou igual a zero.",
            );
        }

        return velocidadeMs;
    }

    /**
     * Troca a lista de eventos e volta o indice para 0, parando qualquer
     * reproducao em andamento.
     *
     * A lista e copiada (copia rasa) para que mudancas posteriores no array do
     * chamador nao alterem a reproducao. Os eventos em si nunca sao clonados nem
     * modificados: sao repassados por referencia para `aoAplicarEvento`.
     *
     * A ordem de aplicacao e a ordem do array recebido. Os resolvedores ja
     * emitem `sequencia` crescente (ver `resolvers/DFS.js` e `resolvers/GBFS.js`),
     * entao o player nao reordena nada por conta propria.
     *
     * @param {Array<object>} eventos
     */
    definirEventos(eventos = []) {
        if (!Array.isArray(eventos)) {
            throw new TypeError("definirEventos espera um array de eventos.");
        }

        this.#pararTimer();
        this.#eventos = [...eventos];
        this.#indice = 0;
        this.#tocando = false;
        this.#terminoNotificado = false;
        this.#notificarEstado();
    }

    /** Quantidade total de eventos carregados. */
    get total() {
        return this.#eventos.length;
    }

    /** Quantos eventos ja foram aplicados (0..total). */
    get indice() {
        return this.#indice;
    }

    /** Verdadeiro quando todos os eventos ja foram aplicados. Lista vazia = true. */
    get terminou() {
        return this.#indice >= this.#eventos.length;
    }

    /** Verdadeiro enquanto a reproducao automatica estiver ativa. */
    get estaTocando() {
        return this.#tocando;
    }

    /** Intervalo atual entre eventos na reproducao automatica, em ms. */
    get velocidadeMs() {
        return this.#velocidadeMs;
    }

    /**
     * Aplica exatamente UM evento, mesmo com a reproducao pausada.
     *
     * @returns {object|null} o evento aplicado, ou null se a lista ja acabou.
     */
    proximoPasso() {
        const evento = this.#aplicarUm();
        this.#sincronizar();

        return evento;
    }

    /**
     * Inicia a reproducao automatica a partir do indice atual.
     *
     * Chamar em um player que ja esta tocando e no-op: nao cria um segundo timer
     * (evita o bug classico de duplo clique no botao "iniciar").
     */
    iniciar() {
        if (this.#tocando) {
            return;
        }

        if (this.terminou) {
            this.#sincronizar();
            return;
        }

        this.#tocando = true;
        this.#notificarEstado();
        this.#agendarProximo();
    }

    /** Impede o avanco automatico. `proximoPasso()` continua funcionando. */
    pausar() {
        if (!this.#tocando && this.#timer === null) {
            return;
        }

        this.#pararTimer();
        this.#tocando = false;
        this.#notificarEstado();
    }

    /** Retoma a reproducao de onde parou. Igual a `iniciar()`, sem duplicar timer. */
    continuar() {
        this.iniciar();
    }

    /**
     * Volta o indice para 0 e para a reproducao, cancelando qualquer timer
     * pendente.
     *
     * Nao reaplica eventos nem chama `aoAplicarEvento`: quem cuida de repintar o
     * tabuleiro no estado inicial e o controlador (`Tabuleiro#resetar`).
     */
    resetar() {
        this.#pararTimer();
        this.#tocando = false;
        this.#indice = 0;
        this.#terminoNotificado = false;
        this.#notificarEstado();
    }

    /**
     * Aplica de uma vez todos os eventos restantes, em laco sincrono.
     *
     * Deliberadamente NAO agenda timers: o sudoku dificil do projeto produz
     * 43.067 eventos, e agendar um timer por evento travaria o navegador.
     */
    irAoFim() {
        this.#pararTimer();
        this.#tocando = false;

        while (this.#indice < this.#eventos.length) {
            this.#aplicarUm();
        }

        this.#sincronizar();
    }

    /**
     * Salta para um indice (uso tipico: barra de progresso).
     *
     * `n` e a quantidade de eventos aplicados depois do salto, ou seja, o evento
     * da posicao `n - 1` e o ultimo aplicado. `n` fora da faixa e limitado a
     * [0, total].
     *
     * Para FRENTE: aplica os eventos de `indice` ate `n - 1`, em ordem.
     *
     * Para TRAS: nao existe "desfazer" de evento, entao o player volta o indice
     * a 0 e REAPLICA desde o comeco ate `n - 1`. O estado visual e sempre
     * reconstruido aplicando eventos em ordem. Ou seja, `aoAplicarEvento` sera
     * chamado n vezes nesse caso, e o controlador deve repintar o estado inicial
     * antes de confiar no resultado (ou simplesmente deixar cada snapshot
     * sobrescrever o tabuleiro, que e o que a camada de DOM ja faz).
     *
     * @param {number} n
     */
    irParaIndice(n) {
        if (!Number.isFinite(n)) {
            throw new RangeError("irParaIndice espera um numero finito.");
        }

        const alvo = Math.min(Math.max(Math.trunc(n), 0), this.#eventos.length);

        if (alvo < this.#indice) {
            this.#indice = 0;
            this.#terminoNotificado = false;
        }

        while (this.#indice < alvo) {
            this.#aplicarUm();
        }

        this.#sincronizar();
    }

    /**
     * Ajusta o intervalo entre eventos.
     *
     * Vale a partir do proximo passo agendado, sem precisar pausar e reiniciar,
     * porque cada tique reagenda o seguinte lendo a velocidade atual. Nao afeta
     * nenhuma metrica da busca: a busca ja terminou quando a animacao comeca.
     *
     * @param {number} ms
     */
    definirVelocidade(ms) {
        this.#velocidadeMs = Player.#validarVelocidade(ms);
    }

    /** Aplica o evento da posicao atual e avanca o indice. Nao notifica estado. */
    #aplicarUm() {
        if (this.#indice >= this.#eventos.length) {
            return null;
        }

        const posicao = this.#indice;
        const evento = this.#eventos[posicao];
        this.#indice = posicao + 1;
        this.#aoAplicarEvento(evento, posicao);

        return evento;
    }

    #agendarProximo() {
        this.#timer = this.#agendar(() => this.#tique(), this.#velocidadeMs);
    }

    #tique() {
        this.#timer = null;

        if (!this.#tocando) {
            return;
        }

        this.#aplicarUm();

        if (this.terminou) {
            this.#sincronizar();
            return;
        }

        this.#notificarEstado();
        this.#agendarProximo();
    }

    /** Notifica estado e, se a lista acabou agora, dispara `aoTerminar` uma vez. */
    #sincronizar() {
        if (this.terminou && !this.#terminoNotificado) {
            this.#terminoNotificado = true;
            this.#pararTimer();
            this.#tocando = false;
            this.#notificarEstado();

            if (this.#aoTerminar !== null) {
                this.#aoTerminar();
            }

            return;
        }

        this.#notificarEstado();
    }

    #notificarEstado() {
        if (this.#aoMudarEstado === null) {
            return;
        }

        this.#aoMudarEstado({
            indice: this.#indice,
            total: this.#eventos.length,
            tocando: this.#tocando,
            terminou: this.terminou,
        });
    }

    #pararTimer() {
        if (this.#timer !== null) {
            this.#cancelar(this.#timer);
            this.#timer = null;
        }
    }
}
