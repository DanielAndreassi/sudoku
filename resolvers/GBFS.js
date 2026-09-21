import Acao from "../models/Acao.js";
import EventoBusca from "../models/EventoBusca.js";
import Metrica from "../models/Metrica.js";
import ResultadoResolucao from "../models/ResultadoResolucao.js";
import { ListaEstadosOrdenados } from "../models/ListaEstadosOrdenados.js";

export default class GBFS {
    constructor() {}

    static copiarQuadro(estado) {
        return estado.quadro.map((linha) => [...linha]);
    }

    static reconstruirCaminho(no) {
        const caminho = [];
        let atual = no;

        while (atual) {
            caminho.push(this.copiarQuadro(atual.estado));
            atual = atual.pai;
        }

        return caminho.reverse();
    }

    static resolver(estadoInicial, opcoes = {}) {
        const silencioso = opcoes.silencioso === true;
        const eventos = [];
        const metricas = Metrica.criarVazia();
        const listaEstados = new ListaEstadosOrdenados();
        const estadoRaiz = estadoInicial.clonar();
        const inicio = performance.now();
        let ultimoEstadoExpandido = estadoRaiz;

        function registrarEvento(
            tipo,
            estadoSnapshot,
            celula = null,
            valor = null,
            candidatos = [],
            scoreHeuristico = null,
            tamanhoFronteira = 0,
            profundidade = 0,
            razao = null,
            metadados = null,
        ) {
            if (silencioso) {
                return;
            }

            eventos.push(
                new EventoBusca(
                    eventos.length + 1,
                    "GBFS",
                    tipo,
                    estadoSnapshot,
                    celula,
                    valor,
                    candidatos,
                    scoreHeuristico,
                    tamanhoFronteira,
                    profundidade,
                    razao,
                    metadados,
                ),
            );
        }

        const avaliacaoInicial = estadoRaiz.avaliarHeuristica();
        metricas.avaliacoesDeHeuristicas++;

        if (avaliacaoInicial.inconsistente) {
            metricas.estadosPodados++;
            metricas.estadosMortos++;
            metricas.tempo = performance.now() - inicio;

            registrarEvento(
                "SEARCH_STARTED",
                this.copiarQuadro(estadoRaiz),
                null,
                null,
                [],
                null,
                0,
                0,
                null,
            );
            registrarEvento(
                "STATE_PRUNED",
                this.copiarQuadro(estadoRaiz),
                null,
                null,
                [],
                null,
                0,
                0,
                "ZERO_DOMAIN",
            );
            registrarEvento(
                "SEARCH_FINISHED",
                this.copiarQuadro(estadoRaiz),
                null,
                null,
                [],
                null,
                0,
                0,
                "UNSOLVABLE",
            );

            return new ResultadoResolucao(
                "unsolvable",
                null,
                metricas,
                eventos,
                [],
            );
        }

        listaEstados.inserir(estadoRaiz, 0, null, null, avaliacaoInicial);
        metricas.fronteiraMaxima = listaEstados.qte;

        registrarEvento(
            "SEARCH_STARTED",
            this.copiarQuadro(estadoRaiz),
            null,
            null,
            [],
            avaliacaoInicial.avaliacaoHeuristica,
            listaEstados.qte,
            0,
            null,
            {
                menorDominio: avaliacaoInicial.menorDominio,
                incerteza: avaliacaoInicial.incerteza,
            },
        );

        while (!listaEstados.estaVazia()) {
            const no = listaEstados.remover();
            ultimoEstadoExpandido = no.estado;
            metricas.estadosExplorados++;

            registrarEvento(
                "NODE_EXPANDED",
                this.copiarQuadro(no.estado),
                null,
                null,
                [],
                no.avaliacaoHeuristica,
                listaEstados.qte,
                no.profundidade,
            );

            if (no.estado.ehObjetivo()) {
                metricas.profundidadeDaSolucao = no.profundidade;
                metricas.tempo = performance.now() - inicio;
                const solucao = this.copiarQuadro(no.estado);

                registrarEvento(
                    "SOLUTION_FOUND",
                    solucao.map((linha) => [...linha]),
                    null,
                    null,
                    [],
                    no.avaliacaoHeuristica,
                    listaEstados.qte,
                    no.profundidade,
                );
                registrarEvento(
                    "SEARCH_FINISHED",
                    solucao.map((linha) => [...linha]),
                    null,
                    null,
                    [],
                    no.avaliacaoHeuristica,
                    listaEstados.qte,
                    no.profundidade,
                    "SOLVED",
                );

                return new ResultadoResolucao(
                    "solved",
                    solucao,
                    metricas,
                    eventos,
                    this.reconstruirCaminho(no),
                );
            }

            if (no.estado.estaMorto()) {
                metricas.estadosMortos++;
                metricas.estadosPodados++;

                registrarEvento(
                    "STATE_PRUNED",
                    this.copiarQuadro(no.estado),
                    null,
                    null,
                    [],
                    no.avaliacaoHeuristica,
                    listaEstados.qte,
                    no.profundidade,
                    "ZERO_DOMAIN",
                );
                continue;
            }

            const melhorCelula = no.estado.selecionarCelula();
            const avaliacoesCandidatos = melhorCelula.avaliarCandidatos(
                no.estado,
            );
            const candidatosOrdenados = avaliacoesCandidatos
                .filter((candidato) => !candidato.contraditorio)
                .map((candidato) => candidato.valor);
            const celula = {
                linha: melhorCelula.linha,
                coluna: melhorCelula.coluna,
            };

            registrarEvento(
                "CELL_SELECTED",
                this.copiarQuadro(no.estado),
                celula,
                null,
                [...melhorCelula.valores],
                no.avaliacaoHeuristica,
                listaEstados.qte,
                no.profundidade,
                "MRV_DEGREE",
                {
                    mrv: melhorCelula.tamanho,
                    grau: melhorCelula.grau,
                },
            );

            registrarEvento(
                "CANDIDATES_COMPUTED",
                this.copiarQuadro(no.estado),
                celula,
                null,
                candidatosOrdenados,
                no.avaliacaoHeuristica,
                listaEstados.qte,
                no.profundidade,
                "LCV",
                {
                    avaliacoesLCV: avaliacoesCandidatos.map((candidato) => ({
                        valor: candidato.valor,
                        impacto: candidato.impacto,
                        contraditorio: candidato.contraditorio,
                    })),
                },
            );

            for (const candidato of avaliacoesCandidatos) {
                metricas.tentativasCandidatas++;

                registrarEvento(
                    "VALUE_TRIED",
                    this.copiarQuadro(no.estado),
                    celula,
                    candidato.valor,
                    candidatosOrdenados,
                    no.avaliacaoHeuristica,
                    listaEstados.qte,
                    no.profundidade,
                    null,
                    {
                        impactoLCV: candidato.impacto,
                        contraditorio: candidato.contraditorio,
                    },
                );

                if (candidato.contraditorio) {
                    metricas.estadosPodados++;

                    registrarEvento(
                        "STATE_PRUNED",
                        this.copiarQuadro(no.estado),
                        celula,
                        candidato.valor,
                        candidatosOrdenados,
                        no.avaliacaoHeuristica,
                        listaEstados.qte,
                        no.profundidade + 1,
                        "LCV_ZERO_DOMAIN",
                        {
                            impactoLCV: null,
                        },
                    );
                    continue;
                }

                const acao = new Acao(
                    melhorCelula.linha,
                    melhorCelula.coluna,
                    candidato.valor,
                );
                const estadoFilho = no.estado.transicionar(acao);
                metricas.estadosGerados++;

                const avaliacaoFilho = estadoFilho.avaliarHeuristica();
                metricas.avaliacoesDeHeuristicas++;

                if (avaliacaoFilho.inconsistente) {
                    metricas.estadosPodados++;

                    registrarEvento(
                        "STATE_PRUNED",
                        this.copiarQuadro(estadoFilho),
                        celula,
                        candidato.valor,
                        candidatosOrdenados,
                        null,
                        listaEstados.qte,
                        no.profundidade + 1,
                        "ZERO_DOMAIN",
                    );
                    continue;
                }

                const inseriu = listaEstados.inserir(
                    estadoFilho,
                    no.profundidade + 1,
                    acao,
                    no,
                    avaliacaoFilho,
                );

                if (!inseriu) {
                    metricas.estadosPodados++;
                    continue;
                }

                if (listaEstados.qte > metricas.fronteiraMaxima) {
                    metricas.fronteiraMaxima = listaEstados.qte;
                }

                registrarEvento(
                    "CHILD_GENERATED",
                    this.copiarQuadro(estadoFilho),
                    celula,
                    candidato.valor,
                    candidatosOrdenados,
                    avaliacaoFilho.avaliacaoHeuristica,
                    listaEstados.qte,
                    no.profundidade + 1,
                    null,
                    {
                        impactoLCV: candidato.impacto,
                        menorDominio: avaliacaoFilho.menorDominio,
                        incerteza: avaliacaoFilho.incerteza,
                    },
                );
            }
        }

        metricas.tempo = performance.now() - inicio;

        registrarEvento(
            "SEARCH_FINISHED",
            this.copiarQuadro(ultimoEstadoExpandido),
            null,
            null,
            [],
            null,
            0,
            0,
            "UNSOLVABLE",
        );

        return new ResultadoResolucao(
            "unsolvable",
            null,
            metricas,
            eventos,
            [],
        );
    }
}
