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

    static recuperarVizinhos(estado, coluna, linha) {
        /**
         * coluna: 0-8
         * linha: 0-8
         * valores: 1-9
         */
        let vizinhos = [];

        function colocaSeNaoExistir(col, lin, valor) {
            const found = vizinhos.find(
                (v) => v.coluna === col && v.linha === lin,
            );
            if (!found) {
                vizinhos.push({ coluna: col, linha: lin, valor: valor });
            }
        }

        for (let i = 0; i < 9; i++) {
            if (i !== coluna) {
                colocaSeNaoExistir(i, linha, estado.quadro[linha][i]);
            }

            if (i !== linha) {
                colocaSeNaoExistir(coluna, i, estado.quadro[i][coluna]);
            }
        }

        const boxLinha = Math.floor(linha / 3) * 3;
        const boxColuna = Math.floor(coluna / 3) * 3;

        for (let i = boxLinha; i < boxLinha + 3; i++) {
            for (let j = boxColuna; j < boxColuna + 3; j++) {
                if (i !== linha || j !== coluna) {
                    colocaSeNaoExistir(j, i, estado.quadro[i][j]);
                }
            }
        }

        return vizinhos;
    }

    calcularGrau(estado) {
        const vizinhos = DominioCelula.recuperarVizinhos(
            estado,
            this.coluna,
            this.linha,
        );
        const vizinhosvazios = vizinhos.filter(
            (vizinho) => vizinho.valor === 0,
        );
        this.grau = vizinhosvazios.length;
        return this;
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

    static gerarMapPorTamanho(dominios) {
        const map = new Map();

        for (const dominio of dominios) {
            if (!map.has(dominio.tamanho)) {
                map.set(dominio.tamanho, []);
            }

            map.get(dominio.tamanho).push(dominio);
        }

        return map;
    }

    estaMorto() {
        return this.tamanho === 0;
    }

    avaliarCandidatos(estado) {
        const vizinhosVazios = DominioCelula.recuperarVizinhos(
            estado,
            this.coluna,
            this.linha,
        ).filter((vizinho) => vizinho.valor === 0);

        const dominiosAntes = vizinhosVazios.map((vizinho) => {
            return {
                coluna: vizinho.coluna,
                linha: vizinho.linha,
                dominio: DominioCelula.calcularDominioCelula(
                    estado,
                    vizinho.coluna,
                    vizinho.linha,
                ),
            };
        });

        const candidatosAvaliados = [];

        for (const candidato of this.valores) {
            const acao = new Acao(this.linha, this.coluna, candidato);
            const estadoSimulado = estado.transicionar(acao);

            let impacto = 0;
            let contraditorio = false;

            for (const vizinho of dominiosAntes) {
                const dominioDepois = DominioCelula.calcularDominioCelula(
                    estadoSimulado,
                    vizinho.coluna,
                    vizinho.linha,
                );

                if (dominioDepois.tamanho === 0) {
                    contraditorio = true;
                    break;
                }

                impacto += vizinho.dominio.tamanho - dominioDepois.tamanho;
            }

            candidatosAvaliados.push({
                valor: candidato,
                impacto: contraditorio ? null : impacto,
                contraditorio,
            });
        }

        candidatosAvaliados.sort((a, b) => {
            if (a.contraditorio !== b.contraditorio) {
                return a.contraditorio ? 1 : -1;
            }

            if (!a.contraditorio && a.impacto !== b.impacto) {
                return a.impacto - b.impacto;
            }

            return a.valor - b.valor;
        });

        return candidatosAvaliados;
    }

    ordenarCandidatos(estado) {
        return this.avaliarCandidatos(estado)
            .filter((candidato) => !candidato.contraditorio)
            .map((candidato) => candidato.valor);
    }
}
