import Acao from "../models/Acao.js";
import DominioCelula from "../models/DominioCelula.js";
import EventoBusca from "../models/EventoBusca.js";
import Metrica from "../models/Metrica.js";
import ResultadoResolucao from "../models/ResultadoResolucao.js";

const ALGORITMO = "DFS";

/**
 * Teto de eventos da execucao instrumentada.
 *
 * A DFS e a busca cega: no sudoku dificil ela expande 14.356 estados e analisa
 * 128.951 candidatos. Como cada no da tres eventos e cada candidato legal mais
 * dois, a mesma busca passaria de 300 mil eventos se todos fossem gravados com
 * o snapshot do tabuleiro. O GBFS, bem mais barata, ja produz 43.067 eventos e
 * 18,74 MB de JSON na mesma resposta.
 *
 * Esse teto existe para o servidor nunca responder com centenas de MB. Quando
 * estoura, a busca para e devolve `status: "cancelled"`, que e um dos quatro
 * status do contrato: e a unica forma de recusar continuar produzindo animacao
 * sem que o resultado minta sobre o que foi medido.
 *
 * Ele NAO limita a busca em si. Em modo silencioso nenhum evento e gerado, e o
 * benchmark mede a busca completa. Entre os casos da base, so o dificil estoura
 * este teto: 60.000 eventos e 24,11 MB depois de 7.818 nos explorados.
 */
const ORCAMENTO_DE_EVENTOS_PADRAO = 60000;

/**
 * Teto de estados explorados, nos dois modos.
 *
 * Protege o servidor de dois casos patologicos, ambos alcancaveis pela interface:
 * um tabuleiro quase vazio digitado pelo usuario e um puzzle sem solucao com
 * poucas pistas. Sem esse teto, `POST /api/resolver` ficaria preso. Estourando,
 * o status e "cancelled".
 */
const ORCAMENTO_DE_NOS_PADRAO = 250000;

export default class DFS {
    constructor() {}

    static copiarQuadro(estado) {
        return estado.quadro.map((linha) => [...linha]);
    }

    /**
     * Primeira celula vazia em ordem de linha e, dentro da linha, de coluna.
     *
     * NAO usa `SudokuEstado.selecionarCelula()`: aquele metodo implementa MRV com
     * desempate por Degree, e usa-lo transformaria esta busca cega em busca
     * informada, invalidando a comparacao experimental com o GBFS (docs/02,
     * "Politica obrigatoria para manter a busca cega").
     *
     * @returns {{linha: number, coluna: number}|null} null quando nao ha
     *     nenhuma celula vazia.
     */
    static primeiraCelulaVazia(estado) {
        for (let linha = 0; linha < 9; linha++) {
            for (let coluna = 0; coluna < 9; coluna++) {
                if (estado.quadro[linha][coluna] === 0) {
                    return { linha, coluna };
                }
            }
        }

        return null;
    }

    /**
     * Candidatos legais da celula, em ordem crescente de 1 a 9.
     *
     * Reusa `DominioCelula.calcularDominioCelula` da BASE-V1, que valida cada
     * valor com `Acao.ehValida`. Nao e heuristica: e exatamente a informacao que
     * resulta de testar 1..9 e descartar os invalidos.
     *
     * Atencao aos argumentos: a base usa (estado, COLUNA, LINHA), enquanto `Acao`
     * usa (linha, coluna, valor).
     */
    static calcularCandidatos(estado, celula) {
        const dominio = DominioCelula.calcularDominioCelula(
            estado,
            celula.coluna,
            celula.linha,
        );

        return [...dominio.valores];
    }

    /**
     * Resolucao completa do Sudoku, aceita pelo controlador e pelo benchmark.
     *
     * Contrato, identico ao do GBFS:
     *     DFS.resolver(estadoInicial, opcoes) -> ResultadoResolucao
     *
     * @param {object} estadoInicial Instancia de `SudokuEstado`. Nao e alterado.
     * @param {object} [opcoes]
     * @param {boolean} [opcoes.silencioso] Nao acumula eventos, mas continua
     *     preenchendo todas as metricas. E o que o benchmark usa: medir 5
     *     repeticoes x 3 puzzles com eventos acumularia centenas de milhares de
     *     objetos inuteis.
     * @param {number} [opcoes.orcamentoDeEventos] Teto de eventos gravados.
     * @param {number} [opcoes.orcamentoDeNos] Teto de estados explorados.
     * @returns {ResultadoResolucao} `status` e `solved`, `unsolvable`, `invalid`
     *     (quadro completo e invalido) ou `cancelled` (orcamento estourado).
     */
    static resolver(estadoInicial, opcoes = {}) {
        const silencioso = opcoes.silencioso === true;
        const orcamentoDeEventos =
            opcoes.orcamentoDeEventos ?? ORCAMENTO_DE_EVENTOS_PADRAO;
        const orcamentoDeNos = opcoes.orcamentoDeNos ?? ORCAMENTO_DE_NOS_PADRAO;

        const eventos = [];
        const metricas = Metrica.criarVazia();
        const estadoRaiz = estadoInicial.clonar();
        const inicio = performance.now();

        // Estados vivos na pilha de recursao, do mais antigo para o mais novo.
        // Evita que cada nivel devolva a lista de ancestrais ao chamador.
        const pilha = [];

        let interrompidaPorOrcamento = false;
        let estadoInvalido = false;
        let estadoSolucao = null;
        let solucao = null;
        let caminhoDeSolucao = [];

        const orcamentoDeNosEstourado = () => {
            if (interrompidaPorOrcamento) {
                return true;
            }

            if (metricas.estadosExplorados >= orcamentoDeNos) {
                interrompidaPorOrcamento = true;
                return true;
            }

            return false;
        };

        /**
         * Grava um evento, respeitando o modo silencioso e o teto de eventos.
         *
         * @returns {boolean} false quando o evento nao coube no teto.
         */
        const registrarEvento = (
            tipo,
            estado,
            celula = null,
            valor = null,
            candidatos = [],
            tamanhoFronteira = 1,
            profundidade = 0,
            razao = null,
        ) => {
            if (silencioso) {
                return true;
            }

            if (eventos.length >= orcamentoDeEventos) {
                interrompidaPorOrcamento = true;
                return false;
            }

            eventos.push(
                new EventoBusca(
                    eventos.length + 1,
                    ALGORITMO,
                    tipo,
                    this.copiarQuadro(estado),
                    celula,
                    valor,
                    candidatos,
                    null,
                    tamanhoFronteira,
                    profundidade,
                    razao,
                ),
            );

            return true;
        };

        const concluir = (estado, profundidade) => {
            metricas.profundidadeDaSolucao = profundidade;
            estadoSolucao = estado;
            solucao = this.copiarQuadro(estado);
            caminhoDeSolucao = pilha.map((daPilha) => this.copiarQuadro(daPilha));
            caminhoDeSolucao.push(this.copiarQuadro(estado));

            registrarEvento(
                "SOLUTION_FOUND",
                estado,
                null,
                null,
                [],
                profundidade + 1,
                profundidade,
            );

            return true;
        };

        /**
         * Chamada recursiva da busca.
         *
         * O `tamanhoFronteira` dos eventos e `profundidade + 1`, isto e, quantos
         * estados estao vivos na pilha aguardando retorno naquele instante: e o
         * analogo honesto da fila de prioridade do GBFS, que aqui nao existe.
         *
         * @returns {boolean} true quando encontrou solucao.
         */
        const buscar = (estado, profundidade) => {
            if (orcamentoDeNosEstourado()) {
                return false;
            }

            metricas.estadosExplorados++;

            // Convencao aprovada pelo grupo (PESSOA1_DESCRICAO, secao 1.2): na
            // DFS `fronteiraMaxima` carrega a PROFUNDIDADE MAXIMA da pilha de
            // recursao, e nao o tamanho de uma fila de prioridade.
            if (profundidade > metricas.fronteiraMaxima) {
                metricas.fronteiraMaxima = profundidade;
            }

            registrarEvento(
                "NODE_EXPANDED",
                estado,
                null,
                null,
                [],
                profundidade + 1,
                profundidade,
            );

            if (estado.ehObjetivo()) {
                return concluir(estado, profundidade);
            }

            const celula = this.primeiraCelulaVazia(estado);

            if (celula === null) {
                // Quadro completo que nao passou em `ehObjetivo()`: esta
                // preenchido e invalido. Nao ha celula a buscar, e a entrada
                // jamais deveria ter chegado ate aqui, porque a validacao barra
                // antes (P1-05).
                estadoInvalido = true;
                return false;
            }

            const candidatos = this.calcularCandidatos(estado, celula);

            registrarEvento(
                "CELL_SELECTED",
                estado,
                celula,
                null,
                candidatos,
                profundidade + 1,
                profundidade,
                "PRIMEIRA_CELULA_VAZIA_LINHA_COLUNA",
            );
            registrarEvento(
                "CANDIDATES_COMPUTED",
                estado,
                celula,
                null,
                candidatos,
                profundidade + 1,
                profundidade,
                "ORDEM_CRESCENTE_1_A_9",
            );

            // Politica fixa da busca cega: 1 a 9 em ordem crescente.
            for (let valor = 1; valor <= 9; valor++) {
                metricas.tentativasCandidatas++;

                const acao = new Acao(celula.linha, celula.coluna, valor);
                const movimentoValido = acao.ehValida(estado);

                // Movimento invalido nunca chega a ser estado, portanto nao
                // entra em nenhuma contagem de estado. O `VALUE_TRIED` so e
                // gravado para candidatos legais: a celula selecionada ja lista
                // os candidatos no `CANDIDATES_COMPUTED`, e um evento por valor
                // descartado custaria 107 mil eventos a mais no puzzle dificil
                // sem acrescentar nada a explicacao na interface.
                if (!movimentoValido) {
                    continue;
                }

                if (orcamentoDeNosEstourado()) {
                    return false;
                }

                registrarEvento(
                    "VALUE_TRIED",
                    estado,
                    celula,
                    valor,
                    candidatos,
                    profundidade + 1,
                    profundidade,
                );

                // `transicionar` clona o estado: o pai nunca e alterado e o
                // estado inicial permanece intacto.
                const filho = estado.transicionar(acao);
                metricas.estadosGerados++;

                registrarEvento(
                    "CHILD_GENERATED",
                    filho,
                    celula,
                    valor,
                    candidatos,
                    profundidade + 2,
                    profundidade + 1,
                );

                // Beco sem saida detectado DEPOIS de gerar o filho, como manda o
                // pseudocodo do docs/02 (P1-01, Dica 3). E por isso que a DFS
                // contabiliza aqui, e o GBFS, que poda antes de inserir na
                // fronteira, contabiliza em `estadosPodados`.
                if (filho.estaMorto()) {
                    metricas.estadosMortos++;

                    registrarEvento(
                        "STATE_PRUNED",
                        filho,
                        celula,
                        valor,
                        candidatos,
                        profundidade + 2,
                        profundidade + 1,
                        "ZERO_DOMAIN",
                    );

                    continue;
                }

                pilha.push(estado);

                if (buscar(filho, profundidade + 1)) {
                    return true;
                }

                pilha.pop();

                if (orcamentoDeNosEstourado()) {
                    return false;
                }

                // O ramo foi explorado por inteiro e nao deu solucao. E agora
                // que a atribuicao e desfeita, em termos de contagem.
                metricas.backtracks++;

                registrarEvento(
                    "BACKTRACK",
                    estado,
                    celula,
                    valor,
                    candidatos,
                    profundidade + 1,
                    profundidade,
                    "RAMA_SEM_SOLUCAO",
                );
            }

            return false;
        };

        registrarEvento("SEARCH_STARTED", estadoRaiz, null, null, [], 1, 0);

        if (estadoRaiz.ehObjetivo()) {
            // Ja e solucao: nenhum ramo a explorar, mas continua sendo um estado
            // processado pela busca.
            metricas.estadosExplorados++;
            concluir(estadoRaiz, 0);
        } else if (estadoRaiz.estaMorto()) {
            // Dominio zero no tabuleiro inicial (P1-03). A validacao barra antes,
            // mas o resolvedor nao pode fingir que resolve.
            metricas.estadosExplorados++;
            metricas.estadosMortos++;

            registrarEvento(
                "STATE_PRUNED",
                estadoRaiz,
                null,
                null,
                [],
                1,
                0,
                "ZERO_DOMAIN",
            );
        } else {
            // A raiz entra na pilha dentro de `buscar`, junto com o push do pai
            // que precede cada chamada recursiva. Sem este push aqui, a raiz
            // entraria duas vezes e `caminhoDeSolucao` viria com um elemento a
            // mais que `profundidadeDaSolucao + 1`.
            buscar(estadoRaiz, 0);
        }

        metricas.tempo = performance.now() - inicio;

        const status = solucao !== null
            ? "solved"
            : interrompidaPorOrcamento
              ? "cancelled"
              : estadoInvalido
                ? "invalid"
                : "unsolvable";

        // `tamanhoFronteira` e 0 aqui porque a busca acabou e a pilha esta
        // vazia, enquanto `profundidade` continua sendo a profundidade da
        // solucao encontrada. E a mesma convencao do GBFS e dos mocks.
        registrarEvento(
            "SEARCH_FINISHED",
            estadoSolucao ?? estadoRaiz,
            null,
            null,
            [],
            0,
            metricas.profundidadeDaSolucao,
            status.toUpperCase(),
        );

        return new ResultadoResolucao(
            status,
            solucao,
            metricas,
            eventos,
            caminhoDeSolucao,
        );
    }
}