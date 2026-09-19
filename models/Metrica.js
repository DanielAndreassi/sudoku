export default class Metrica {
    constructor(
        tempo = 0,
        estadosExplorados = 0,
        estadosGerados = 0,
        tentativasCandidatas = 0,
        estadosMortos = 0,
        estadosPodados = 0,
        profundidadeDaSolucao = 0,
        fronteiraMaxima = 0,
        avaliacoesDeHeuristicas = 0,
        backtracks = 0,
        ehMock = false,
    ) {
        this.tempo = tempo;
        this.estadosExplorados = estadosExplorados;
        this.estadosGerados = estadosGerados;
        this.tentativasCandidatas = tentativasCandidatas;
        this.estadosMortos = estadosMortos;
        this.estadosPodados = estadosPodados;
        this.profundidadeDaSolucao = profundidadeDaSolucao;
        this.fronteiraMaxima = fronteiraMaxima;
        this.avaliacoesDeHeuristicas = avaliacoesDeHeuristicas;
        this.backtracks = backtracks;
        this.ehMock = ehMock;
    }

    static criarVazia() {
        return new Metrica();
    }
}
