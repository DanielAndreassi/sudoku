import Acao from "./Acao.js";
import Regras from "./Regras.js";

export default class DominioCelula {
    constructor(coluna, linha, valores, tamanho, grau) {
        this.coluna = coluna;
        this.linha = linha;
        this.valores = valores;
        this.tamanho = tamanho;
        this.grau = grau;
    }

    static calcularDominioCelula(estado, coluna, linha) {
        if (estado.quadro[linha][coluna] !== 0) {
            return false;
        }

        const possibilidades = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((valor) =>
            new Acao(linha, coluna, valor).ehValida(estado),
        );

        return new DominioCelula(
            coluna,
            linha,
            possibilidades,
            possibilidades.length,
            0,
        );
    }

    static calcularDominioTodasCelulas(estado) {
        const dominios = [];

        for (let linha = 0; linha < 9; linha++) {
            for (let coluna = 0; coluna < 9; coluna++) {
                const dominioCelula = this.calcularDominioCelula(
                    estado,
                    coluna,
                    linha,
                );

                if (dominioCelula) {
                    dominios.push(dominioCelula);
                }
            }
        }

        return dominios;
    }

    static ordenarDominiosPorTamanho(dominios) {
        return dominios.sort((a, b) => a.tamanho - b.tamanho);
    }

    estaMorto() {
        return this.tamanho === 0;
    }
}
