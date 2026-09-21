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

    constructor({ tabuleiro, player, painel, api, gerarChave, aoMudar = () => {} }) {
        this.tabuleiro = tabuleiro;
        this.player = player;
        this.painel = painel;
        this.api = api;
        this.gerarChave = gerarChave;
        this.aoMudar = aoMudar;
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
    async resolver(algoritmo) {
        // Guarda contra duplo clique e contra iniciar busca durante reproducao.
        // Criterio de aceite explicito do doc 04 P3-02.
        if (this.ocupado) {
            return false;
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
            this.#transitar(ESTADOS.RESOLVENDO, `Resolvendo com ${algoritmo.toUpperCase()}...`);
            resposta = await this.api.resolver({ algoritmo, quadro });
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
        this.painel?.registrarParaComparacao(chave, algoritmo, resultado);
        this.painel?.renderizarComparacao();

        this.player?.definirEventos(resultado.eventos);

        if (resultado.status === "solved") {
            this.#transitar(
                ESTADOS.PRONTO,
                `Resolvido em ${resultado.metricas.tempo.toFixed(1)} ms. ` +
                `${resultado.eventos.length.toLocaleString("pt-BR")} eventos gravados.`,
            );
        } else {
            this.#transitar(ESTADOS.PRONTO, `Busca encerrada: ${resultado.status}.`);
        }

        return true;
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
