/**
 * Camada de tabuleiro: unica parte do cliente que toca no DOM da grade.
 *
 * Regra que o doc 04 (P3-01, Dica 1) exige e que este modulo respeita: o DOM nao
 * e a fonte da verdade. `pistas` guarda, em memoria, qual era o tabuleiro inicial,
 * para que reset e distincao entre pista e valor da busca nao dependam de ler a
 * tela de volta.
 */

const TOTAL = 9;

const MARCAS = [
    "pista",
    "valor-busca",
    "selecionada",
    "tentativa",
    "podada",
    "erro",
    "solucao",
];

export default class Tabuleiro {
    constructor(elementoRaiz) {
        this.raiz = elementoRaiz;
        this.celulas = [];
        this.pistas = null;

        for (let linha = 0; linha < TOTAL; linha++) {
            this.celulas.push(new Array(TOTAL).fill(null));
        }

        for (const celula of this.raiz.querySelectorAll(".celula")) {
            const linha = Number(celula.dataset.linha);
            const coluna = Number(celula.dataset.coluna);
            this.celulas[linha][coluna] = celula;
        }

        this.#instalarNormalizacaoDeEntrada();
    }

    /**
     * Aceita apenas 1..9. Vazio vira 0 na leitura. Qualquer outra tecla e
     * descartada na hora, em vez de virar erro de validacao la na frente.
     */
    #instalarNormalizacaoDeEntrada() {
        for (const celula of this.raiz.querySelectorAll(".celula")) {
            celula.addEventListener("input", () => {
                const apenasDigito = celula.value.replace(/[^1-9]/g, "");
                celula.value = apenasDigito.slice(-1);
            });
        }
    }

    lerQuadro() {
        const quadro = [];

        for (let linha = 0; linha < TOTAL; linha++) {
            const valores = [];

            for (let coluna = 0; coluna < TOTAL; coluna++) {
                const bruto = this.celulas[linha][coluna].value.trim();
                valores.push(bruto === "" ? 0 : Number(bruto));
            }

            quadro.push(valores);
        }

        return quadro;
    }

    escreverQuadro(matriz) {
        for (let linha = 0; linha < TOTAL; linha++) {
            for (let coluna = 0; coluna < TOTAL; coluna++) {
                const valor = matriz[linha][coluna];
                this.celulas[linha][coluna].value = valor === 0 ? "" : String(valor);
            }
        }
    }

    /**
     * Congela o tabuleiro atual como "estado inicial". A partir daqui, toda
     * celula preenchida agora e pista; o que a busca escrever depois recebe
     * marca diferente.
     */
    fixarPistas(matriz = this.lerQuadro()) {
        this.pistas = matriz.map((linha) => [...linha]);
        this.repintarPistas();
    }

    repintarPistas() {
        this.limparMarcas();

        if (this.pistas === null) {
            return;
        }

        for (let linha = 0; linha < TOTAL; linha++) {
            for (let coluna = 0; coluna < TOTAL; coluna++) {
                if (this.pistas[linha][coluna] !== 0) {
                    this.marcar(linha, coluna, "pista");
                }
            }
        }
    }

    ehPista(linha, coluna) {
        return this.pistas !== null && this.pistas[linha][coluna] !== 0;
    }

    /**
     * Pinta um snapshot vindo de um evento de busca: pistas mantem a marca de
     * pista, o resto que estiver preenchido e valor produzido pela busca.
     */
    renderizarSnapshot(matriz) {
        this.escreverQuadro(matriz);
        this.limparMarcas();

        for (let linha = 0; linha < TOTAL; linha++) {
            for (let coluna = 0; coluna < TOTAL; coluna++) {
                if (this.ehPista(linha, coluna)) {
                    this.marcar(linha, coluna, "pista");
                } else if (matriz[linha][coluna] !== 0) {
                    this.marcar(linha, coluna, "valor-busca");
                }
            }
        }
    }

    /** Escreve um unico valor sem repintar o tabuleiro inteiro. */
    definirValor(linha, coluna, valor) {
        this.celulas[linha][coluna].value = valor === 0 || valor === null ? "" : String(valor);
    }

    marcar(linha, coluna, marca) {
        this.celulas[linha][coluna].classList.add(marca);
    }

    desmarcar(linha, coluna, marca) {
        this.celulas[linha][coluna].classList.remove(marca);
    }

    limparMarcas(...marcas) {
        const alvo = marcas.length > 0 ? marcas : MARCAS;

        for (let linha = 0; linha < TOTAL; linha++) {
            for (let coluna = 0; coluna < TOTAL; coluna++) {
                this.celulas[linha][coluna].classList.remove(...alvo);
            }
        }
    }

    destacarErros(celulas = []) {
        this.limparMarcas("erro");

        for (const { linha, coluna } of celulas) {
            this.marcar(linha, coluna, "erro");
        }
    }

    bloquearEdicao(bloqueado) {
        for (let linha = 0; linha < TOTAL; linha++) {
            for (let coluna = 0; coluna < TOTAL; coluna++) {
                this.celulas[linha][coluna].readOnly = bloqueado;
            }
        }
    }

    limpar() {
        this.pistas = null;
        this.limparMarcas();
        this.escreverQuadro(Array.from({ length: TOTAL }, () => new Array(TOTAL).fill(0)));
    }

    /** Volta ao estado inicial congelado por `fixarPistas`. */
    resetar() {
        if (this.pistas === null) {
            this.limpar();
            return;
        }

        this.escreverQuadro(this.pistas);
        this.repintarPistas();
    }
}
