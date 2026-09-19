import Regras from "./Regras.js";

export default class Acao {
    constructor(linha, coluna, valor) {
        this.linha = linha;
        this.coluna = coluna;
        this.valor = valor;
    }
    ehValida(estado) {
        const { linha, coluna, valor } = this;

        if (
            linha < 0 ||
            linha > 8 ||
            coluna < 0 ||
            coluna > 8 ||
            !Number.isInteger(valor) ||
            valor < 1 ||
            valor > 9
        ) {
            return false;
        }

        if (estado.quadro[linha][coluna] !== 0) {
            return false;
        }

        return (
            !Regras.numeroExisteNaLinha(estado, valor, linha) &&
            !Regras.numeroExisteNaColuna(estado, valor, coluna) &&
            !Regras.numeroExisteNoQuadrante(estado, valor, coluna, linha)
        );
    }
}
