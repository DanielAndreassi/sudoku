import DominioCelula from "./DominioCelula.js";
import Regras from "./Regras.js";

export default class SudokuEstado {
    constructor(quadro) {
        this.quadro = quadro;
    }

    static gerarDeMatriz(matriz) {
        const copia = matriz.map((linha) => [...linha]);
        return new SudokuEstado(copia);
    }

    clonar() {
        const copia = this.quadro.map((linha) => [...linha]);
        return new SudokuEstado(copia);
    }

    transicionar(acao) {
        const novoEstado = this.clonar();
        novoEstado.quadro[acao.linha][acao.coluna] = acao.valor;
        return novoEstado;
    }

    ehObjetivo() {
        for (let linha = 0; linha < 9; linha++) {
            for (let coluna = 0; coluna < 9; coluna++) {
                if (this.quadro[linha][coluna] === 0) {
                    return false;
                }
            }
        }

        return this.estaValido();
    }

    estaMorto() {
        const dominios = DominioCelula.calcularDominioTodasCelulas(this);

        for (let index = 0; index < dominios.length; index++) {
            if (dominios[index].estaMorto()) {
                return true;
            }
        }

        return false;
    }

    estaValido() {
        for (let linha = 0; linha < 9; linha++) {
            const valores = new Set();

            for (let coluna = 0; coluna < 9; coluna++) {
                const valor = this.quadro[linha][coluna];

                if (valor === 0) {
                    continue;
                }

                if (valores.has(valor)) {
                    return false;
                }

                valores.add(valor);
            }
        }

        for (let coluna = 0; coluna < 9; coluna++) {
            const valores = new Set();

            for (let linha = 0; linha < 9; linha++) {
                const valor = this.quadro[linha][coluna];

                if (valor === 0) {
                    continue;
                }

                if (valores.has(valor)) {
                    return false;
                }

                valores.add(valor);
            }
        }

        for (let inicioLinha = 0; inicioLinha < 9; inicioLinha += 3) {
            for (let inicioColuna = 0; inicioColuna < 9; inicioColuna += 3) {
                const valores = new Set();

                for (
                    let linha = inicioLinha;
                    linha < inicioLinha + 3;
                    linha++
                ) {
                    for (
                        let coluna = inicioColuna;
                        coluna < inicioColuna + 3;
                        coluna++
                    ) {
                        const valor = this.quadro[linha][coluna];

                        if (valor === 0) {
                            continue;
                        }

                        if (valores.has(valor)) {
                            return false;
                        }

                        valores.add(valor);
                    }
                }
            }
        }

        return true;
    }

    selecionarCelula() {
        const dominios = DominioCelula.calcularDominioTodasCelulas(this);
        if (dominios.length === 0) {
            throw new Error("Sem domínios disponíveis");
        }
        const mapDominios = DominioCelula.gerarMapPorTamanho(dominios);
        if (mapDominios.get(0)?.length > 0) {
            throw new Error("Estado inválido, domínio de alguma célula é zero");
        }
        let arrDominios;
        for (let index = 1; index <= 9; index++) {
            const aux = mapDominios.get(index);
            if (aux && aux.length > 0) {
                arrDominios = aux;
                break;
            }
        }
        if (!arrDominios) {
            throw new Error("Sem domínios disponíveis, estado inválido");
        }
        if (arrDominios.length === 1) {
            return arrDominios[0];
        }
        /**
         * Desenpate por grau:
         * grau decrescente
            linha crescente
            coluna crescente
         */
        arrDominios = arrDominios
            .map((dominio) => dominio.calcularGrau(this))
            .sort((a, b) => {
                if (a.grau !== b.grau) {
                    return b.grau - a.grau;
                }
                if (a.linha !== b.linha) {
                    return a.linha - b.linha;
                }
                return a.coluna - b.coluna;
            });

        return arrDominios[0];
    }

    /**
     * Deve retornar o h(estado)
     *  que será usado para dedicir qual estado, entre os varios gerados,
     *  expandir primeiro
     *  E(s) = número de células vazias
        m(s) = menor tamanho de domínio entre células vazias
        U(s) = soma de (|D(c)| - 1) para todas as células vazias (INCERTEZA TOTAL DO ESTADO)
        Sendo que h(s) = E(s) + U(s) / 9 + m(s) / 9
     */
    avaliarHeuristica() {
        const celulasVazias = [];
        for (let linha = 0; linha < 9; linha++) {
            for (let coluna = 0; coluna < 9; coluna++) {
                if (this.quadro[linha][coluna] === 0) {
                    celulasVazias.push(
                        DominioCelula.calcularDominioCelula(
                            this,
                            coluna,
                            linha,
                        ),
                    );
                }
            }
        }
        if (celulasVazias.length === 0) {
            return {
                avaliacaoHeuristica: 0,
                dominiosCelulasVazias: 0,
                menorDominio: 0,
                incerteza: 0,
                inconsistente: false,
            };
        }

        if (celulasVazias.find((celula) => celula.tamanho === 0)) {
            return {
                avaliacaoHeuristica: null,
                dominiosCelulasVazias: celulasVazias.length,
                menorDominio: 0,
                incerteza: null,
                inconsistente: true,
            };
        }
        const menortamanho = Math.min(
            ...celulasVazias.map((celula) => celula.tamanho),
        );
        const usoma = celulasVazias.reduce(
            (acc, celula) => acc + (celula.tamanho - 1),
            0,
        );
        const avalizacao = celulasVazias.length + usoma / 9 + menortamanho / 9;
        return {
            avaliacaoHeuristica: avalizacao,
            dominiosCelulasVazias: celulasVazias.length,
            menorDominio: menortamanho,
            incerteza: usoma,
            inconsistente: false,
        };
    }
}
