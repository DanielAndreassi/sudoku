import Metrica from "./Metrica.js";

export default class ResultadoResolucao {
    constructor(
        status = null,
        solucao = null,
        metricas = Metrica.criarVazia(),
        eventos = [],
        caminhoDeSolucao = [],
    ) {
        this.status = status;
        this.solucao = solucao;
        this.metricas = metricas;
        this.eventos = eventos;
        this.caminhoDeSolucao = caminhoDeSolucao;
    }
}
