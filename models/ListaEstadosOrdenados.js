export class ListaEstadosOrdenados {
    constructor() {
        this.inicio = null;
        this.qte = 0;
        this.ordemInsercao = 0;
    }

    estaVazia() {
        return this.inicio === null;
    }

    inserir(estado, profundidade, acao, pai, avaliacao = null) {
        const dadosAvaliacao = avaliacao ?? estado.avaliarHeuristica();
        const {
            avaliacaoHeuristica,
            dominiosCelulasVazias,
            incerteza,
            inconsistente,
        } = dadosAvaliacao;
        if (inconsistente) {
            return false;
        }
        const novoNo = new NoListaEstado(
            estado,
            profundidade,
            acao,
            pai,
            avaliacaoHeuristica,
            dominiosCelulasVazias,
            incerteza,
            this.ordemInsercao,
        );

        function vemAntes(a, b) {
            if (a.avaliacaoHeuristica !== b.avaliacaoHeuristica) {
                return a.avaliacaoHeuristica < b.avaliacaoHeuristica;
            }
            if (a.qteDominiosCelulasVazias !== b.qteDominiosCelulasVazias) {
                return a.qteDominiosCelulasVazias < b.qteDominiosCelulasVazias;
            }
            if (a.incerteza !== b.incerteza) {
                return a.incerteza < b.incerteza;
            }
            return a.ordemInsercao < b.ordemInsercao;
        }

        if (this.inicio === null) {
            this.inicio = novoNo;
        } else if (vemAntes(novoNo, this.inicio)) {
            novoNo.prox = this.inicio;
            this.inicio.ant = novoNo;
            this.inicio = novoNo;
        } else {
            let atual = this.inicio;

            while (atual.prox !== null && !vemAntes(novoNo, atual.prox)) {
                atual = atual.prox;
            }

            novoNo.prox = atual.prox;
            novoNo.ant = atual;

            if (atual.prox !== null) {
                atual.prox.ant = novoNo;
            }

            atual.prox = novoNo;
        }

        this.qte++;
        this.ordemInsercao++;

        return true;
    }

    remover() {
        if (this.inicio === null) {
            return null;
        }
        const aux = this.inicio;
        this.inicio = this.inicio.prox;
        if (this.inicio !== null) {
            this.inicio.ant = null;
        }
        aux.prox = null;
        aux.ant = null;
        this.qte--;
        return aux;
    }
}

export class NoListaEstado {
    constructor(
        estado,
        profundidade,
        acao = null,
        pai = null,
        avaliacaoHeuristica,
        qteDominiosCelulasVazias,
        incerteza,
        ordemInsercao,
        ant = null,
        prox = null,
    ) {
        this.estado = estado;
        this.profundidade = profundidade;
        this.acao = acao;
        this.pai = pai;
        this.avaliacaoHeuristica = avaliacaoHeuristica;
        this.qteDominiosCelulasVazias = qteDominiosCelulasVazias;
        this.incerteza = incerteza;
        this.ordemInsercao = ordemInsercao;
        this.ant = ant;
        this.prox = prox;
    }
}
