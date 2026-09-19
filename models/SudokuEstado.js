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
}
