export default class EventoBusca {
    constructor(
        sequencia = 0,
        algoritmo = null,
        tipo = null,
        estadoSnapshot = null,
        celula = null,
        valor = null,
        candidatos = [],
        scoreHeuristico = null,
        tamanhoFronteira = 0,
        profundidade = 0,
        razao = null,
        metadados = null,
    ) {
        this.sequencia = sequencia;
        this.algoritmo = algoritmo;
        this.tipo = tipo;
        this.estadoSnapshot = estadoSnapshot;
        this.celula = celula;
        this.valor = valor;
        this.candidatos = candidatos;
        this.scoreHeuristico = scoreHeuristico;
        this.tamanhoFronteira = tamanhoFronteira;
        this.profundidade = profundidade;
        this.razao = razao;
        this.metadados = metadados;
    }
}
