import Tabuleiro from "./tabuleiro.js";
import Player from "./player.js";
import Painel from "./painel.js";
import Controlador, { ESTADOS } from "./controlador.js";
import { gerarChave } from "./comparacao.js";

/**
 * Montagem da aplicacao: e o unico arquivo que conhece IDs do HTML.
 *
 * Tabuleiro, Player, Painel e Controlador nao sabem que existe um botao chamado
 * `botao-resolver`. Isso e o que mantem a logica testavel fora do navegador.
 */

const elemento = (id) => document.getElementById(id);

const tabuleiro = new Tabuleiro(elemento("tabuleiro"));

const painelEstado = elemento("estado-execucao");
const notaValidacao = elemento("nota-validacao");
const rotuloVelocidade = elemento("rotulo-velocidade");
const rotuloProgresso = elemento("rotulo-progresso");
const controleVelocidade = elemento("controle-velocidade");
const controleProgresso = elemento("controle-progresso");

const botoes = {
    resolver: elemento("botao-resolver"),
    limpar: elemento("botao-limpar"),
    solucao: elemento("botao-solucao"),
    reproduzir: elemento("botao-reproduzir"),
    pausar: elemento("botao-pausar"),
    passo: elemento("botao-passo"),
    fim: elemento("botao-fim"),
    resetar: elemento("botao-resetar"),
};

const seletorPuzzle = elemento("seletor-puzzle");
const seletorNivel = elemento("seletor-nivel");
const seletorAlgoritmo = elemento("seletor-algoritmo");

// ---------------------------------------------------------------------- abas

const abas = [...document.querySelectorAll(".aba")];
const secoesAba = [...document.querySelectorAll(".conteudo-aba")];

/**
 * Mostra uma aba e esconde a outra.
 *
 * Usa `el.hidden` em vez de `style.display` para que a secao escondida saia
 * tambem da arvore de acessibilidade, e nao so da pintura.
 */
function mostrarAba(nome) {
    for (const aba of abas) {
        const ativa = aba.dataset.aba === nome;

        aba.classList.toggle("aba-ativa", ativa);
        aba.setAttribute("aria-selected", ativa ? "true" : "false");
    }

    for (const secao of secoesAba) {
        secao.hidden = secao.dataset.painel !== nome;
    }
}

for (const aba of abas) {
    aba.addEventListener("click", () => mostrarAba(aba.dataset.aba));
}

// ---------------------------------------------------------------- explicacao

/**
 * Linhas da tabela de explicacao, indexadas por campo.
 *
 * O mapa e montado uma vez porque `descreverEvento` roda uma vez por evento, e
 * `irAoFim` aplica dezenas de milhares de eventos em laco sincrono: fazer
 * `querySelector` 24 vezes por evento ali dentro custa caro a toa.
 */
const LINHAS_EXPLICACAO = new Map(
    [...document.querySelectorAll("[data-campo-explicacao]")].map((linha) => {
        const campo = linha.dataset.campoExplicacao;

        return [campo, { linha, celula: linha.querySelector(`[data-explicacao="${campo}"]`) }];
    }),
);

/**
 * Campos que descrevem a identidade do evento: ficam visiveis sempre, mesmo
 * quando vazios, porque sem eles a tabela perde o cabecalho conceitual.
 */
const CAMPOS_FIXOS = new Set(["tipo", "algoritmo"]);

/**
 * Um campo "existe" no evento quando nao e null/undefined/"".
 *
 * Teste explicito por null/undefined em vez de falsy: `valor` e `profundidade`
 * valem 0 legitimamente (profundidade 0 = raiz), e um teste por falsy esconderia
 * justamente o dado do primeiro no.
 */
function temValor(valor) {
    return valor !== null && valor !== undefined && valor !== "";
}

/**
 * Escreve um campo e decide se a linha aparece.
 *
 * Nem todo tipo de evento carrega todo campo: um SEARCH_STARTED nao tem celula,
 * candidatos, MRV, grau nem LCV. Mostrar dez linhas com "—" e ruido que compete
 * com o punhado de dados que realmente descreve o evento, entao a linha sem
 * valor sai da tabela em vez de ficar ocupando espaco.
 */
function escreverExplicacao(campo, valor) {
    const alvo = LINHAS_EXPLICACAO.get(campo);

    if (!alvo) {
        return;
    }

    const presente = temValor(valor);

    if (alvo.celula) {
        alvo.celula.textContent = presente ? String(valor) : "—";
    }

    alvo.linha.hidden = !presente && !CAMPOS_FIXOS.has(campo);
}

/**
 * Volta a tabela ao estado de repouso: todas as linhas visiveis com "—".
 *
 * Em repouso nao existe evento para filtrar, e uma tabela com duas linhas so
 * pareceria quebrada; a lista completa mostra o que o painel vai explicar assim
 * que a animacao comecar.
 */
function limparExplicacao() {
    for (const { linha, celula } of LINHAS_EXPLICACAO.values()) {
        linha.hidden = false;

        if (celula) {
            celula.textContent = "—";
        }
    }
}

function descreverEvento(evento) {
    const meta = evento.metadados ?? {};

    escreverExplicacao("tipo", evento.tipo);
    escreverExplicacao("algoritmo", evento.algoritmo);
    escreverExplicacao(
        "celula",
        evento.celula ? `linha ${evento.celula.linha + 1}, coluna ${evento.celula.coluna + 1}` : null,
    );
    escreverExplicacao("candidatos", evento.candidatos?.length ? evento.candidatos.join(", ") : null);
    escreverExplicacao("valor", evento.valor);
    escreverExplicacao("profundidade", evento.profundidade);
    escreverExplicacao("tamanhoFronteira", evento.tamanhoFronteira);
    escreverExplicacao("mrv", meta.mrv);
    escreverExplicacao("grau", meta.grau);
    escreverExplicacao(
        "lcv",
        Array.isArray(meta.avaliacoesLCV)
            ? meta.avaliacoesLCV
                  .map((a) => `${a.valor}${a.contraditorio ? " (contradiz)" : `(${a.impacto})`}`)
                  .join("  ")
            : meta.impactoLCV !== undefined
              ? `impacto ${meta.impactoLCV}`
              : null,
    );
    escreverExplicacao(
        "scoreHeuristico",
        typeof evento.scoreHeuristico === "number" ? evento.scoreHeuristico.toFixed(3) : null,
    );
    escreverExplicacao("razao", evento.razao);
}

// ------------------------------------------------------------------- player

/**
 * Traduz um `EventoBusca` em pintura de tabuleiro.
 *
 * O snapshot vem primeiro porque, no GBFS, o proximo no expandido pode nao ser
 * filho do no mostrado antes — a fronteira salta de ramo. Sem trocar o tabuleiro
 * pelo snapshot, a animacao ficaria mentindo (doc 00 §13.2).
 */
function aplicarEvento(evento) {
    if (evento.estadoSnapshot) {
        tabuleiro.renderizarSnapshot(evento.estadoSnapshot);
    } else {
        tabuleiro.limparMarcas("selecionada", "tentativa", "podada");
    }

    const celula = evento.celula;

    switch (evento.tipo) {
        case "CELL_SELECTED":
        case "CANDIDATES_COMPUTED":
            if (celula) {
                tabuleiro.marcar(celula.linha, celula.coluna, "selecionada");
            }
            break;

        case "VALUE_TRIED":
        case "CHILD_GENERATED":
            if (celula) {
                tabuleiro.definirValor(celula.linha, celula.coluna, evento.valor);
                tabuleiro.marcar(celula.linha, celula.coluna, "tentativa");
            }
            break;

        case "STATE_PRUNED":
        case "BACKTRACK":
            if (celula) {
                tabuleiro.definirValor(celula.linha, celula.coluna, evento.valor);
                tabuleiro.marcar(celula.linha, celula.coluna, "podada");
            }
            break;

        // SEARCH_FINISHED entra junto porque ele vem DEPOIS de SOLUTION_FOUND
        // carregando o mesmo snapshot: sem tratar os dois, o renderizarSnapshot
        // do evento final limpa as marcas de solucao recem pintadas e o tabuleiro
        // termina a animacao sem destaque nenhum.
        case "SOLUTION_FOUND":
        case "SEARCH_FINISHED":
            if (evento.estadoSnapshot?.every((l) => l.every((v) => v !== 0)) !== true) {
                break;
            }

            for (let linha = 0; linha < 9; linha++) {
                for (let coluna = 0; coluna < 9; coluna++) {
                    if (!tabuleiro.ehPista(linha, coluna)) {
                        tabuleiro.marcar(linha, coluna, "solucao");
                    }
                }
            }
            break;

        default:
            break;
    }

    descreverEvento(evento);
}

const player = new Player({
    aoAplicarEvento: aplicarEvento,
    aoMudarEstado: ({ indice, total }) => atualizarProgresso(indice, total),
    aoTerminar: () => controlador.aoTerminarAnimacao(),
    velocidadeMs: Number(controleVelocidade.value),
});

const painel = new Painel({
    elementoMetricas: elemento("tabela-metricas"),
    elementoComparacao: elemento("tabela-comparacao"),
    elementoAviso: elemento("aviso-comparacao"),
    elementoNaoComparavel: elemento("comparacao-nao-comparavel"),
});

// ---------------------------------------------------------------------- api

const api = {
    async resolver({ algoritmo, quadro }) {
        const resposta = await fetch("/api/resolver", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ algoritmo, quadro }),
        });

        const corpo = await resposta.json();

        if (!resposta.ok) {
            return { ok: false, ...corpo };
        }

        notaValidacao.textContent = corpo.avisoValidacao ?? "";
        notaValidacao.className = corpo.avisoValidacao ? "nota aviso" : "nota";

        return { ok: true, resultado: corpo.resultado };
    },
};

const controlador = new Controlador({
    tabuleiro,
    player,
    painel,
    api,
    gerarChave,
    aoMudar: (instantaneo) => pintarControles(instantaneo),
});

// ------------------------------------------------------------------ pintura

function pintarControles(foto) {
    painelEstado.textContent = foto.mensagem || "Pronto.";
    painelEstado.className = `estado-execucao ${tomDoEstado(foto.estado)}`;

    botoes.resolver.disabled = !foto.podeResolver;
    botoes.limpar.disabled = foto.ocupado;
    botoes.solucao.disabled = !foto.temAnimacao;
    botoes.reproduzir.disabled = !foto.podeReproduzir;
    botoes.pausar.disabled = !foto.podePausar;
    botoes.passo.disabled = !foto.podePassar;
    botoes.fim.disabled = !foto.temAnimacao;
    botoes.resetar.disabled = !foto.temAnimacao;

    seletorPuzzle.disabled = foto.ocupado;
    seletorNivel.disabled = foto.ocupado;
    seletorAlgoritmo.disabled = foto.ocupado;

    atualizarProgresso(foto.indiceEvento, foto.totalEventos);
}

function tomDoEstado(estado) {
    if (estado === ESTADOS.ERRO) {
        return "falha";
    }

    if (estado === ESTADOS.VALIDANDO || estado === ESTADOS.RESOLVENDO || estado === ESTADOS.REPRODUZINDO) {
        return "trabalhando";
    }

    if (estado === ESTADOS.PRONTO || estado === ESTADOS.FINALIZADO) {
        return "ok";
    }

    return "";
}

/**
 * A unidade mora aqui e nao mais no HTML: `#rotulo-velocidade` virou `<output>`
 * e o seu conteudo inteiro passa a ser escrito por este arquivo.
 */
function atualizarVelocidade(ms) {
    // Acima de 1 s a leitura em milissegundos fica ruim ("1750 ms" exige conta
    // mental). A faixa vai ate 2 s, entao dali pra cima mostra em segundos.
    rotuloVelocidade.textContent =
        ms >= 1000
            ? `${(ms / 1000).toFixed(2).replace(".", ",")} s`
            : `${ms} ms`;
}

function atualizarProgresso(indice, total) {
    controleProgresso.max = String(total);
    controleProgresso.value = String(indice);
    rotuloProgresso.textContent = `${indice.toLocaleString("pt-BR")} / ${total.toLocaleString("pt-BR")}`;
}

// ------------------------------------------------------------------ eventos

botoes.resolver.addEventListener("click", () => {
    limparExplicacao();
    controlador.resolver(seletorAlgoritmo.value);
});

botoes.limpar.addEventListener("click", () => {
    controlador.limpar();
    seletorPuzzle.value = "";
    seletorNivel.value = "";
    limparExplicacao();
    notaValidacao.textContent = "";
    notaValidacao.className = "nota";
});

botoes.solucao.addEventListener("click", () => controlador.mostrarSolucao());
botoes.reproduzir.addEventListener("click", () => controlador.reproduzir());
botoes.pausar.addEventListener("click", () => controlador.pausar());
botoes.passo.addEventListener("click", () => controlador.proximoPasso());
botoes.fim.addEventListener("click", () => controlador.irAoFim());
botoes.resetar.addEventListener("click", () => {
    controlador.resetarAnimacao();
    limparExplicacao();
});

controleVelocidade.addEventListener("input", () => {
    const ms = Number(controleVelocidade.value);
    atualizarVelocidade(ms);
    player.definirVelocidade(ms);
});

controleProgresso.addEventListener("input", () => {
    if (controlador.estado === ESTADOS.REPRODUZINDO) {
        controlador.pausar();
    }

    player.irParaIndice(Number(controleProgresso.value));
});

// -------------------------------------------------------- carga de puzzles

const puzzlesFixos = new Map();

seletorPuzzle.addEventListener("change", () => {
    const matriz = puzzlesFixos.get(seletorPuzzle.value);

    if (matriz) {
        seletorNivel.value = "";
        limparExplicacao();
        controlador.carregarPuzzle(matriz);
    }
});

seletorNivel.addEventListener("change", async () => {
    const nivel = seletorNivel.value;

    if (!nivel) {
        return;
    }

    try {
        const resposta = await fetch(`/api/gerar?nivel=${encodeURIComponent(nivel)}`);
        const corpo = await resposta.json();

        if (!resposta.ok) {
            throw new Error(corpo.mensagem ?? "falha ao gerar");
        }

        seletorPuzzle.value = "";
        limparExplicacao();
        controlador.carregarPuzzle(corpo.puzzle);

        notaValidacao.textContent = corpo.aviso ?? "";
        notaValidacao.className = corpo.aviso ? "nota aviso" : "nota";
    } catch (erro) {
        painelEstado.textContent = `Nao foi possivel gerar o puzzle: ${erro.message}`;
        painelEstado.className = "estado-execucao falha";
    }
});

async function carregarListaDePuzzles() {
    const resposta = await fetch("/api/puzzles");

    for (const puzzle of await resposta.json()) {
        puzzlesFixos.set(puzzle.id, puzzle.matriz);
    }
}

carregarListaDePuzzles().catch((erro) => {
    painelEstado.textContent = `Nao foi possivel carregar os exemplos: ${erro.message}`;
    painelEstado.className = "estado-execucao falha";
});

mostrarAba("execucao");
atualizarVelocidade(Number(controleVelocidade.value));
pintarControles(controlador.instantaneo());
