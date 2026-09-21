#!/usr/bin/env node

/**
 * Executavel de linha de comando do benchmark (P3-05).
 *
 * Este arquivo e apenas o INVOLUCRO. Toda a logica de medicao, agrupamento e
 * geracao de CSV mora em `servicos/Benchmark.js`, que ja e coberto por testes.
 * Aqui so acontece: parsing de flags, injecao dos solvers, impressao da tabela
 * e escrita do arquivo.
 *
 * Uso: node bin/benchmark.js [--flags]
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import MockResolucao from "../mocks/MockResolucao.js";
import GBFS from "../resolvers/GBFS.js";
import Benchmark from "../servicos/Benchmark.js";
import {
    listarPuzzlesFixos,
    recuperarPuzzleFixo,
} from "../servicos/PuzzlesFixos.js";

const RAIZ_DO_PROJETO = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const PADROES = {
    puzzles: "facil,intermediario,dificil",
    repeticoes: "5",
    saida: "benchmark.csv",
    algoritmos: "gbfs,dfs",
};

/**
 * Catalogo de solvers injetaveis.
 *
 * `dfs` ainda NAO existe: a Pessoa 1 nao entregou `resolvers/DFS.js`. Enquanto
 * isso, o lugar dele e ocupado por `MockResolucao`, cujas metricas carregam
 * `ehMock: true`. E esse campo que faz o motor emitir o aviso no topo do CSV e
 * este CLI encher o terminal de alerta.
 */
const CATALOGO_DE_SOLVERS = {
    gbfs: {
        descricao: "GBFS real (resolvers/GBFS.js)",
        executar: (estado, opcoes) => GBFS.resolver(estado, opcoes),
    },
    dfs: {
        descricao:
            "MOCK (mocks/MockResolucao.js) - resolvers/DFS.js ainda nao existe",
        executar: () => MockResolucao.criarResultadoSucesso("DFS"),
    },
};

const COLUNAS_DA_TABELA = [
    { titulo: "puzzle", alinhamento: "esquerda" },
    { titulo: "algoritmo", alinhamento: "esquerda" },
    { titulo: "status", alinhamento: "esquerda" },
    { titulo: "reps", alinhamento: "direita" },
    { titulo: "mediana(ms)", alinhamento: "direita" },
    { titulo: "min(ms)", alinhamento: "direita" },
    { titulo: "max(ms)", alinhamento: "direita" },
    { titulo: "explorados", alinhamento: "direita" },
    { titulo: "gerados", alinhamento: "direita" },
    { titulo: "tentativas", alinhamento: "direita" },
    { titulo: "mortos", alinhamento: "direita" },
    { titulo: "podados", alinhamento: "direita" },
    { titulo: "profund", alinhamento: "direita" },
    { titulo: "fronteira", alinhamento: "direita" },
    { titulo: "heuristicas", alinhamento: "direita" },
    { titulo: "backtracks", alinhamento: "direita" },
    { titulo: "alertas", alinhamento: "esquerda" },
];

class ErroDeUso extends Error {}

function textoDeAjuda() {
    const idsDisponiveis = listarPuzzlesFixos()
        .map((puzzle) => puzzle.id)
        .join(", ");

    return [
        "Benchmark DFS x GBFS - P3-05",
        "",
        "USO",
        "    node bin/benchmark.js [--flags]",
        "",
        "FLAGS",
        `    --puzzles=a,b,c     Puzzles a medir. Padrao: ${PADROES.puzzles}`,
        `    --repeticoes=N      Execucoes por puzzle x algoritmo. Padrao: ${PADROES.repeticoes}`,
        `    --saida=arquivo     CSV de saida, relativo a raiz do projeto. Padrao: ${PADROES.saida}`,
        `    --algoritmos=a,b    Algoritmos a medir. Padrao: ${PADROES.algoritmos}`,
        "    --ajuda             Mostra esta mensagem e sai.",
        "",
        "PUZZLES DISPONIVEIS",
        `    ${idsDisponiveis}`,
        "",
        "ALGORITMOS DISPONIVEIS",
        ...Object.entries(CATALOGO_DE_SOLVERS).map(
            ([nome, solver]) => `    ${nome.padEnd(6)} ${solver.descricao}`,
        ),
        "",
        "EXEMPLOS",
        "    node bin/benchmark.js",
        "    node bin/benchmark.js --puzzles=facil --repeticoes=3 --saida=/tmp/bench.csv",
        "    node bin/benchmark.js --algoritmos=gbfs --repeticoes=10",
        "",
        "ATENCAO",
        "    Enquanto a DFS real nao existir, os numeros dela vem de MockResolucao e",
        "    sao ficticios. Nao vao para o relatorio.",
    ].join("\n");
}

function interpretarArgumentos(argumentos) {
    const opcoes = { ...PADROES, ajuda: false };

    for (const argumento of argumentos) {
        if (argumento === "--ajuda" || argumento === "-h") {
            opcoes.ajuda = true;
            continue;
        }

        if (!argumento.startsWith("--")) {
            throw new ErroDeUso(
                `argumento desconhecido: "${argumento}". As flags comecam com "--".`,
            );
        }

        const separador = argumento.indexOf("=");

        if (separador === -1) {
            throw new ErroDeUso(
                `a flag "${argumento}" precisa de um valor no formato ${argumento}=valor.`,
            );
        }

        const nome = argumento.slice(2, separador);
        const valor = argumento.slice(separador + 1);

        if (!Object.prototype.hasOwnProperty.call(PADROES, nome)) {
            throw new ErroDeUso(
                `flag desconhecida: "--${nome}". Use --ajuda para ver as flags aceitas.`,
            );
        }

        if (valor === "") {
            throw new ErroDeUso(`a flag "--${nome}" recebeu um valor vazio.`);
        }

        opcoes[nome] = valor;
    }

    return opcoes;
}

function separarLista(valor) {
    return valor
        .split(",")
        .map((item) => item.trim())
        .filter((item) => item !== "");
}

function montarPuzzles(valor) {
    const ids = separarLista(valor);

    if (ids.length === 0) {
        throw new ErroDeUso("--puzzles nao listou nenhum puzzle.");
    }

    const disponiveis = listarPuzzlesFixos().map((puzzle) => puzzle.id);

    return ids.map((id) => {
        const puzzle = recuperarPuzzleFixo(id);

        if (!puzzle) {
            throw new ErroDeUso(
                `puzzle desconhecido: "${id}". Disponiveis: ${disponiveis.join(", ")}.`,
            );
        }

        return puzzle;
    });
}

function montarSolvers(valor) {
    const nomes = separarLista(valor);

    if (nomes.length === 0) {
        throw new ErroDeUso("--algoritmos nao listou nenhum algoritmo.");
    }

    const solvers = {};

    for (const nome of nomes) {
        const entrada = CATALOGO_DE_SOLVERS[nome];

        if (!entrada) {
            throw new ErroDeUso(
                `algoritmo desconhecido: "${nome}". Disponiveis: ${Object.keys(CATALOGO_DE_SOLVERS).join(", ")}.`,
            );
        }

        solvers[nome] = entrada.executar;
    }

    return solvers;
}

function interpretarRepeticoes(valor) {
    const numero = Number(valor);

    if (!Number.isInteger(numero) || numero < 1) {
        throw new ErroDeUso(
            `--repeticoes precisa ser um inteiro maior ou igual a 1, recebeu "${valor}".`,
        );
    }

    return numero;
}

function resolverCaminhoDeSaida(valor) {
    return isAbsolute(valor) ? valor : resolve(RAIZ_DO_PROJETO, valor);
}

function formatarNumero(valor, casas = 0) {
    if (valor === null || valor === undefined || Number.isNaN(valor)) {
        return "-";
    }

    return valor.toFixed(casas);
}

function montarLinhaDaTabela(grupo) {
    const alertas = [];

    if (grupo.ehMock) {
        alertas.push("FICTICIO");
    }

    if (grupo.estadoInicialCorrompido) {
        alertas.push("ESTADO-CORROMPIDO");
    }

    if (grupo.contagemInstavel) {
        alertas.push("CONTAGEM-INSTAVEL");
    }

    if (grupo.statusInstavel) {
        alertas.push("STATUS-INSTAVEL");
    }

    return [
        String(grupo.puzzleId),
        grupo.ehMock ? `${grupo.algoritmo} [MOCK]` : String(grupo.algoritmo),
        String(grupo.status),
        String(grupo.repeticoes),
        formatarNumero(grupo.tempoMediana, 3),
        formatarNumero(grupo.tempoMinimo, 3),
        formatarNumero(grupo.tempoMaximo, 3),
        String(grupo.estadosExplorados),
        String(grupo.estadosGerados),
        String(grupo.tentativasCandidatas),
        String(grupo.estadosMortos),
        String(grupo.estadosPodados),
        String(grupo.profundidadeDaSolucao),
        String(grupo.fronteiraMaxima),
        String(grupo.avaliacoesDeHeuristicas),
        String(grupo.backtracks),
        alertas.length > 0 ? alertas.join(" ") : "-",
    ];
}

function imprimirTabela(resumo) {
    const cabecalhos = COLUNAS_DA_TABELA.map((coluna) => coluna.titulo);
    const linhas = resumo.map(montarLinhaDaTabela);
    const larguras = cabecalhos.map((cabecalho, indice) =>
        linhas.reduce(
            (maior, linha) => Math.max(maior, linha[indice].length),
            cabecalho.length,
        ),
    );

    const formatarLinha = (celulas) =>
        celulas
            .map((celula, indice) =>
                COLUNAS_DA_TABELA[indice].alinhamento === "direita"
                    ? celula.padStart(larguras[indice])
                    : celula.padEnd(larguras[indice]),
            )
            .join("  ")
            .trimEnd();

    console.log(formatarLinha(cabecalhos));
    console.log(larguras.map((largura) => "-".repeat(largura)).join("  "));

    linhas.forEach((linha) => console.log(formatarLinha(linha)));
}

function imprimirMoldura(titulo, corpo) {
    const conteudo = [titulo, "", ...corpo];
    const largura = Math.min(
        100,
        Math.max(...conteudo.map((texto) => texto.length)) + 4,
    );
    const borda = "#".repeat(largura);

    console.log("");
    console.log(borda);
    conteudo.forEach((texto) => console.log(`# ${texto}`));
    console.log(borda);
    console.log("");
}

function imprimirAvisoDeMock(resumo, posicao) {
    const afetados = resumo
        .filter((grupo) => grupo.ehMock)
        .map((grupo) => `${grupo.puzzleId}/${grupo.algoritmo}`);
    const algoritmos = [
        ...new Set(
            resumo
                .filter((grupo) => grupo.ehMock)
                .map((grupo) => grupo.algoritmo),
        ),
    ];

    imprimirMoldura(
        `ATENCAO - NUMEROS FICTICIOS NA TABELA (aviso ${posicao} da tabela)`,
        [
            `Os algoritmos ${algoritmos.join(", ")} NAO foram medidos de verdade.`,
            "Os valores vem de mocks/MockResolucao.js: sao constantes inventadas,",
            "escritas a mao para destravar o desenvolvimento da interface.",
            "",
            "Isso significa que tempo, estados explorados, gerados, backtracks e",
            "todas as demais contagens dessas linhas NAO medem nada.",
            "",
            "NAO copie essas linhas para o relatorio, para slides ou para qualquer",
            "grafico de comparacao. Elas nao sao resultado experimental.",
            "",
            `Linhas afetadas: ${afetados.join(", ")}`,
            "",
            "Para obter numeros reais e preciso que resolvers/DFS.js exista e seja",
            "registrado no lugar do mock neste CLI.",
        ],
    );
}

function imprimirInstabilidades(resumo) {
    const instaveis = resumo.filter((grupo) => grupo.contagemInstavel);
    const statusInstaveis = resumo.filter((grupo) => grupo.statusInstavel);

    if (instaveis.length === 0 && statusInstaveis.length === 0) {
        return;
    }

    console.log("");
    console.log("!! INSTABILIDADE ENTRE REPETICOES");
    console.log(
        "   Em algoritmo deterministico as contagens tem que se repetir entre",
    );
    console.log(
        "   execucoes do mesmo puzzle. Divergencia e sintoma de bug (por exemplo,",
    );
    console.log("   solver mutando estado compartilhado entre execucoes).");

    instaveis.forEach((grupo) => {
        console.log(
            `   - ${grupo.puzzleId}/${grupo.algoritmo}: campos instaveis = ${grupo.camposInstaveis.join(", ")}`,
        );
    });

    statusInstaveis.forEach((grupo) => {
        console.log(
            `   - ${grupo.puzzleId}/${grupo.algoritmo}: status divergentes = ${grupo.statusObservados.join(", ")}`,
        );
    });
}

function imprimirCorrupcao(resumo) {
    const corrompidos = resumo.filter(
        (grupo) => grupo.estadoInicialCorrompido,
    );

    if (corrompidos.length === 0) {
        return false;
    }

    imprimirMoldura("FALHA GRAVE - ESTADO INICIAL CORROMPIDO", [
        "Algum solver MUTOU a matriz/estado que recebeu como entrada.",
        "Isso contamina as execucoes seguintes e invalida a comparacao inteira:",
        "o segundo algoritmo deixa de receber o mesmo puzzle que o primeiro.",
        "",
        ...corrompidos.map(
            (grupo) => `Afetado: ${grupo.puzzleId}/${grupo.algoritmo}`,
        ),
        "",
        "Corrija o solver antes de usar qualquer numero deste benchmark.",
    ]);

    return true;
}

function executar(argumentos) {
    let opcoes;

    try {
        opcoes = interpretarArgumentos(argumentos);
    } catch (erro) {
        if (erro instanceof ErroDeUso) {
            console.error(`Erro: ${erro.message}`);
            console.error("Use: node bin/benchmark.js --ajuda");
            process.exitCode = 1;

            return;
        }

        throw erro;
    }

    if (opcoes.ajuda) {
        console.log(textoDeAjuda());

        return;
    }

    let puzzles;
    let solvers;
    let repeticoes;
    let caminhoDeSaida;

    try {
        puzzles = montarPuzzles(opcoes.puzzles);
        solvers = montarSolvers(opcoes.algoritmos);
        repeticoes = interpretarRepeticoes(opcoes.repeticoes);
        caminhoDeSaida = resolverCaminhoDeSaida(opcoes.saida);
    } catch (erro) {
        if (erro instanceof ErroDeUso) {
            console.error(`Erro: ${erro.message}`);
            console.error("Use: node bin/benchmark.js --ajuda");
            process.exitCode = 1;

            return;
        }

        throw erro;
    }

    const algoritmos = Object.keys(solvers);

    console.log("Benchmark DFS x GBFS - P3-05");
    console.log(`  puzzles.....: ${puzzles.map((p) => p.id).join(", ")}`);
    console.log(`  algoritmos..: ${algoritmos.join(", ")}`);
    console.log(`  repeticoes..: ${repeticoes}`);
    console.log(
        `  execucoes...: ${puzzles.length * algoritmos.length * repeticoes}`,
    );
    console.log(`  saida.......: ${caminhoDeSaida}`);

    const inicio = performance.now();
    let linhas;

    try {
        linhas = Benchmark.executarBenchmark({
            puzzles,
            solvers,
            repeticoes,
        });
    } catch (erro) {
        console.error(`Erro ao executar o benchmark: ${erro.message}`);
        process.exitCode = 1;

        return;
    }

    const duracao = performance.now() - inicio;
    const resumo = Benchmark.resumir(linhas);
    const temMock = resumo.some((grupo) => grupo.ehMock);

    if (temMock) {
        imprimirAvisoDeMock(resumo, "1/2 - ANTES");
    } else {
        console.log("");
    }

    imprimirTabela(resumo);
    imprimirInstabilidades(resumo);

    const houveCorrupcao = imprimirCorrupcao(resumo);

    if (temMock) {
        imprimirAvisoDeMock(resumo, "2/2 - DEPOIS");
    }

    try {
        mkdirSync(dirname(caminhoDeSaida), { recursive: true });
        writeFileSync(
            caminhoDeSaida,
            `${Benchmark.gerarCSV(linhas)}\n`,
            "utf8",
        );
    } catch (erro) {
        console.error(`Erro ao gravar o CSV em ${caminhoDeSaida}: ${erro.message}`);
        process.exitCode = 1;

        return;
    }

    console.log(`CSV gravado em: ${caminhoDeSaida}`);
    console.log(`Linhas no CSV.: ${linhas.length}`);
    console.log(`Tempo total...: ${(duracao / 1000).toFixed(3)} s`);

    if (houveCorrupcao) {
        process.exitCode = 1;
    }
}

executar(process.argv.slice(2));
