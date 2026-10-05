/**
 * Controlador de execucao (P3-02).
 *
 * Maquina de estados que coordena tabuleiro, player e painel. Ele NAO conhece
 * MRV, LCV, recursao, nem qualquer detalhe interno dos resolvedores: escolhe um
 * algoritmo pelo nome e consome `ResultadoResolucao`.
 *
 * Todos os colaboradores entram por injecao, inclusive a camada de rede (`api`).
 * E isso que permite testar a maquina de estados com `node --test`, sem DOM e sem
 * servidor de pe.
 */

export const ESTADOS = Object.freeze({
    OCIOSO: "OCIOSO",
    VALIDANDO: "VALIDANDO",
    RESOLVENDO: "RESOLVENDO",
    PRONTO: "PRONTO",
    REPRODUZINDO: "REPRODUZINDO",
    PAUSADO: "PAUSADO",
    FINALIZADO: "FINALIZADO",
    ERRO: "ERRO",
});

/** Estados em que o tabuleiro nao pode ser editado nem uma nova busca iniciada. */
const ESTADOS_OCUPADOS = new Set([
    ESTADOS.VALIDANDO,
    ESTADOS.RESOLVENDO,
    ESTADOS.REPRODUZINDO,
]);

export default class Controlador {
    #estado = ESTADOS.OCIOSO;
    #resultado = null;
    #chavePuzzle = null;
    #algoritmoAtual = null;
    #mensagem = "";

    constructor({
        tabuleiro,
        player,
        painel,
        api,
        gerarChave,
        aoMudar = () => {},
        // Devolve o controle ao navegador para ele pintar antes de a thread
        // congelar. Injetado porque `requestAnimationFrame` nao existe no Node,
        // e `tests/controlador.test.js` roda sem DOM.
        cederControle = () => Promise.resolve(),
    }) {
        this.tabuleiro = tabuleiro;
        this.player = player;
        this.painel = painel;
        this.api = api;
        this.gerarChave = gerarChave;
        this.aoMudar = aoMudar;
        this.cederControle = cederControle;
    }

    get estado() {
        return this.#estado;
    }

    get mensagem() {
        return this.#mensagem;
    }

    get resultado() {
        return this.#resultado;
    }

    get chavePuzzle() {
        return this.#chavePuzzle;
    }

    get algoritmoAtual() {
        return this.#algoritmoAtual;
    }

    get ocupado() {
        return ESTADOS_OCUPADOS.has(this.#estado);
    }

    /** Ha um resultado carregado cujos eventos podem ser reproduzidos. */
    get temAnimacao() {
        return this.#resultado !== null && this.#resultado.eventos.length > 0;
    }

    /**
     * Ha solucao final para exibir.
     *
     * Separado de `temAnimacao` de proposito: uma busca `cancelled` tem eventos
     * mas nao tem solucao, e uma busca silenciosa tem solucao mas nao tem
     * eventos. Os dois botoes dependem de coisas diferentes.
     */
    get temSolucao() {
        return Boolean(this.#resultado?.solucao);
    }

    #transitar(estado, mensagem = "") {
        this.#estado = estado;
        this.#mensagem = mensagem;
        this.aoMudar(this.instantaneo());
    }

    /** Fotografia do controlador, para a camada de UI pintar botoes sem adivinhar. */
    instantaneo() {
        return {
            estado: this.#estado,
            mensagem: this.#mensagem,
            algoritmo: this.#algoritmoAtual,
            chavePuzzle: this.#chavePuzzle,
            ocupado: this.ocupado,
            temAnimacao: this.temAnimacao,
            temSolucao: this.temSolucao,
            podeResolver: !this.ocupado,
            podeEditar: !this.ocupado,
            podeReproduzir: this.temAnimacao && this.#estado !== ESTADOS.REPRODUZINDO,
            podePausar: this.#estado === ESTADOS.REPRODUZINDO,
            podePassar: this.temAnimacao && this.#estado !== ESTADOS.REPRODUZINDO,
            indiceEvento: this.player?.indice ?? 0,
            totalEventos: this.player?.total ?? 0,
        };
    }

    carregarPuzzle(matriz) {
        if (this.ocupado) {
            return false;
        }

        this.tabuleiro.escreverQuadro(matriz);
        this.tabuleiro.fixarPistas(matriz);
        this.#descartarResultado();
        this.#transitar(ESTADOS.OCIOSO, "Puzzle carregado.");
        return true;
    }

    limpar() {
        if (this.ocupado) {
            return false;
        }

        this.tabuleiro.limpar();
        this.#descartarResultado();
        this.#chavePuzzle = null;
        this.painel?.limpar();
        this.#transitar(ESTADOS.OCIOSO, "Tabuleiro limpo.");
        return true;
    }

    #descartarResultado() {
        this.player?.resetar();
        this.player?.definirEventos([]);
        this.#resultado = null;
        this.#algoritmoAtual = null;
    }

    /**
     * Fluxo do P3-02: le o tabuleiro, trava a edicao, valida, e so entao chama o
     * resolvedor. Entrada invalida NUNCA chega ao solver.
     */
    async resolver(algoritmo, { silencioso = false } = {}) {
        // Guarda contra duplo clique e contra iniciar busca durante reproducao.
        // Criterio de aceite explicito do doc 04 P3-02.
        if (this.ocupado) {
            return false;
        }

        // A animacao escreve os valores da busca nas celulas. Se uma execucao
        // anterior foi reproduzida, o que esta na tela e um estado INTERMEDIARIO
        // da busca, nao o puzzle — e ler isso como entrada daria ao proximo
        // algoritmo um problema diferente, quebrando a garantia do doc 00 §14.2
        // (os dois recebem copias do mesmo estado inicial). Observado na pratica:
        // animar a DFS e depois rodar o GBFS devolvia "sem solucao" num puzzle
        // facil, porque o estado congelado no meio de um backtrack e de fato
        // insoluvel.
        //
        // `resetar()` devolve o tabuleiro as pistas congeladas no inicio da
        // execucao anterior, que e o puzzle de verdade.
        if (this.temAnimacao) {
            this.tabuleiro.resetar();
        }

        const quadro = this.tabuleiro.lerQuadro();
        const chave = this.gerarChave(quadro);

        this.tabuleiro.fixarPistas(quadro);
        this.tabuleiro.bloquearEdicao(true);
        this.tabuleiro.destacarErros([]);
        this.#descartarResultado();
        this.#algoritmoAtual = algoritmo;
        this.#transitar(ESTADOS.VALIDANDO, "Validando entrada...");

        let resposta;

        try {
            // Sem esta cessao, VALIDANDO e RESOLVENDO acontecem no mesmo tick e o
            // navegador nunca pinta o primeiro. Importa de verdade: validar o
            // puzzle dificil custa ~540 ms (a validacao roda uma DFS silenciosa
            // para provar que existe solucao), e sem isso o usuario encara meio
            // segundo de tela parada sem saber que algo esta acontecendo.
            await this.cederControle();

            this.#transitar(
                ESTADOS.RESOLVENDO,
                silencioso
                    ? `Resolvendo com ${algoritmo.toUpperCase()} sem animacao...`
                    : `Resolvendo com ${algoritmo.toUpperCase()}...`,
            );
            resposta = await this.api.resolver({ algoritmo, quadro, silencioso });
        } catch (erro) {
            this.tabuleiro.bloquearEdicao(false);
            this.#transitar(ESTADOS.ERRO, `Falha de comunicacao: ${erro.message}`);
            return false;
        }

        this.tabuleiro.bloquearEdicao(false);

        if (!resposta.ok) {
            if (resposta.validacao?.celulas?.length) {
                this.tabuleiro.destacarErros(resposta.validacao.celulas);
            }

            this.#transitar(
                ESTADOS.ERRO,
                resposta.validacao?.mensagem ?? resposta.mensagem ?? "Entrada recusada.",
            );
            return false;
        }

        const { resultado } = resposta;

        this.#resultado = resultado;
        this.#chavePuzzle = chave;

        this.painel?.mostrarExecucao(algoritmo, resultado);

        // So execucao concluida entra na comparacao.
        //
        // Uma busca `cancelled` parou no teto de eventos: ela mediu "os
        // primeiros 60 mil eventos", nao o problema inteiro. Coloca-la ao lado
        // de uma busca `solved` na mesma tabela convida exatamente a leitura
        // errada que a convencao de metricas existe para impedir. Mesma regra
        // que ja descarta a comparacao quando o tabuleiro muda.
        if (resultado.status === "solved") {
            this.painel?.registrarParaComparacao(chave, algoritmo, resultado);
            this.painel?.renderizarComparacao();
        }

        this.player?.definirEventos(resultado.eventos);

        this.#transitar(ESTADOS.PRONTO, this.#descreverResultado(resultado, silencioso));

        return true;
    }

    #descreverResultado(resultado, silencioso) {
        const ms = resultado.metricas?.tempo?.toFixed(1) ?? "?";
        const eventos = resultado.eventos.length;

        if (resultado.status === "solved") {
            return silencioso || eventos === 0
                ? `Resolvido em ${ms} ms, sem animacao. Metricas abaixo.`
                : `Resolvido em ${ms} ms. ${eventos.toLocaleString("pt-BR")} eventos gravados.`;
        }

        if (resultado.status === "cancelled") {
            return (
                `Busca interrompida apos ${eventos.toLocaleString("pt-BR")} eventos ` +
                "(teto de instrumentacao). O tabuleiro mostra ate onde ela chegou. " +
                "Use \"Resolver sem animacao\" para medir a busca completa; " +
                "esta execucao nao entra na comparacao."
            );
        }

        if (resultado.status === "unsolvable") {
            return "A busca esgotou todos os ramos: este tabuleiro nao tem solucao.";
        }

        return `Busca encerrada: ${resultado.status}.`;
    }

    /** Mostra a solucao final sem reproduzir a animacao. */
    mostrarSolucao() {
        if (this.#resultado?.solucao) {
            this.tabuleiro.renderizarSnapshot(this.#resultado.solucao);
            return true;
        }

        return false;
    }

    reproduzir() {
        if (!this.temAnimacao || this.#estado === ESTADOS.REPRODUZINDO) {
            return false;
        }

        this.player.iniciar();
        this.#transitar(ESTADOS.REPRODUZINDO, "Reproduzindo...");
        return true;
    }

    pausar() {
        if (this.#estado !== ESTADOS.REPRODUZINDO) {
            return false;
        }

        this.player.pausar();
        this.#transitar(ESTADOS.PAUSADO, "Pausado.");
        return true;
    }

    proximoPasso() {
        if (!this.temAnimacao || this.#estado === ESTADOS.REPRODUZINDO) {
            return false;
        }

        const evento = this.player.proximoPasso();

        if (evento === null) {
            this.#transitar(ESTADOS.FINALIZADO, "Fim dos eventos.");
            return false;
        }

        this.#transitar(
            ESTADOS.PAUSADO,
            `Passo ${this.player.indice} de ${this.player.total}: ${evento.tipo}`,
        );
        return true;
    }

    irAoFim() {
        if (!this.temAnimacao) {
            return false;
        }

        this.player.irAoFim();
        this.#transitar(ESTADOS.FINALIZADO, "Animacao adiantada ate o fim.");
        return true;
    }

    resetarAnimacao() {
        if (!this.temAnimacao) {
            return false;
        }

        this.player.resetar();
        this.tabuleiro.resetar();
        this.#transitar(ESTADOS.PRONTO, "Animacao reiniciada.");
        return true;
    }

    /** Chamado pelo player quando ele consome o ultimo evento. */
    aoTerminarAnimacao() {
        this.#transitar(ESTADOS.FINALIZADO, "Animacao concluida.");
    }
}
