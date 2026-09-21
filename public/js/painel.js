import Comparacao, {
    AUSENTE,
    CAMPOS_METRICA,
    formatarMetrica,
} from "./comparacao.js";

/**
 * P3-04 — Camada DOM fina sobre `comparacao.js`.
 *
 * Toda a regra (chave do puzzle, descarte da comparacao, metricas nao
 * comparaveis, deteccao de mock) mora em `comparacao.js`, que e testado por
 * `tests/comparacao.test.js`. Aqui so ha escrita na tela; a verificacao desta
 * camada e por checklist manual, decisao ja tomada do projeto.
 *
 * METRICAS NAO COMPARAVEIS FORA DA TABELA
 * ---------------------------------------
 * `estadosMortos` e `fronteiraMaxima` ficavam dentro da tabela, com sufixo "*"
 * e a classe `nao-comparavel`. Marcada dentro da tabela, a linha ainda convida
 * a leitura horizontal: o olho varre e compara os dois numeros lado a lado
 * antes de processar o aviso. Decisao do grupo: tirar essas metricas da tabela
 * e mostra-las num bloco proprio (`#comparacao-nao-comparavel`), uma abaixo da
 * outra, cada uma com a nota inteira. A tabela principal passa a conter so o
 * que e de fato comparavel entre DFS e GBFS.
 */

const ESPACO_SVG = "http://www.w3.org/2000/svg";

/**
 * Triangulo de alerta em SVG inline (o projeto nao usa emoji).
 *
 * `stroke="currentColor"` deixa o icone herdar a cor do `h3`, que o CSS pinta
 * com `var(--alerta)`.
 */
function criarIconeAlerta() {
    const svg = document.createElementNS(ESPACO_SVG, "svg");

    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", "14");
    svg.setAttribute("height", "14");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");

    const triangulo = document.createElementNS(ESPACO_SVG, "path");

    triangulo.setAttribute(
        "d",
        "M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z",
    );

    const haste = document.createElementNS(ESPACO_SVG, "line");

    haste.setAttribute("x1", "12");
    haste.setAttribute("y1", "9");
    haste.setAttribute("x2", "12");
    haste.setAttribute("y2", "13");

    const ponto = document.createElementNS(ESPACO_SVG, "line");

    ponto.setAttribute("x1", "12");
    ponto.setAttribute("y1", "17");
    ponto.setAttribute("x2", "12.01");
    ponto.setAttribute("y2", "17");

    svg.append(triangulo, haste, ponto);

    return svg;
}

export default class Painel {
    constructor({
        elementoMetricas,
        elementoComparacao,
        elementoAviso,
        elementoNaoComparavel,
    } = {}) {
        this.elementoMetricas = elementoMetricas ?? null;
        this.elementoComparacao = elementoComparacao ?? null;
        this.elementoAviso = elementoAviso ?? null;
        this.elementoNaoComparavel = elementoNaoComparavel ?? null;
        this.comparacao = new Comparacao();
    }

    escrever(campo, texto) {
        if (!this.elementoMetricas) {
            return;
        }

        const celula = this.elementoMetricas.querySelector(
            `[data-metrica="${campo}"]`,
        );

        if (celula) {
            celula.textContent = texto;
        }
    }

    /**
     * Preenche a tabela de metricas da execucao corrente.
     *
     * Os valores vem prontos do solver: o player nunca recalcula `tempo` usando
     * o relogio da animacao (doc 04, P3-04, Dica 1).
     */
    mostrarExecucao(algoritmo, resultado) {
        if (!resultado) {
            this.limparMetricas();
            return;
        }

        const metricas = resultado.metricas ?? {};

        this.escrever("algoritmo", String(algoritmo ?? "").toUpperCase() || AUSENTE);
        this.escrever("status", formatarMetrica("status", resultado.status));

        for (const descritor of CAMPOS_METRICA) {
            if (descritor.derivada) {
                const mortos = Number(metricas.estadosMortos ?? 0);
                const podados = Number(metricas.estadosPodados ?? 0);

                this.escrever(
                    descritor.campo,
                    formatarMetrica(descritor.campo, mortos + podados),
                );
                continue;
            }

            this.escrever(
                descritor.campo,
                formatarMetrica(descritor.campo, metricas[descritor.campo] ?? null),
            );
        }

        this.escrever(
            "eventos",
            formatarMetrica("eventos", resultado.eventos?.length ?? null),
        );

        this.mostrarAviso(
            metricas.ehMock === true
                ? "Atencao: esta execucao usou numeros de mock (ehMock). Nao servem para o relatorio."
                : "",
        );
    }

    registrarParaComparacao(chavePuzzle, algoritmo, resultado) {
        const retorno = this.comparacao.registrar(chavePuzzle, algoritmo, resultado);

        this.renderizarComparacao();

        return retorno;
    }

    renderizarComparacao() {
        this.limparNaoComparavel();

        if (!this.elementoComparacao) {
            return;
        }

        this.elementoComparacao.replaceChildren();
        this.mostrarAviso(this.comparacao.avisoMock ?? "");

        const registrados = this.comparacao.algoritmosRegistrados;

        if (registrados.length === 0) {
            const vazio = document.createElement("p");
            vazio.className = "nota";
            vazio.textContent =
                "Nenhuma execucao guardada ainda. Resolva o mesmo puzzle com DFS e com GBFS para comparar.";
            this.elementoComparacao.append(vazio);
            return;
        }

        const identificacao = document.createElement("p");
        identificacao.className = "nota";
        identificacao.textContent =
            `Puzzle da comparacao: ${this.comparacao.chaveAtual}. ` +
            (this.comparacao.completa
                ? "Mesmo estado inicial para os dois algoritmos."
                : `Falta executar: ${["DFS", "GBFS"]
                      .filter((nome) => !registrados.includes(nome))
                      .join(", ")}.`);
        this.elementoComparacao.append(identificacao);

        const linhas = this.comparacao.linhas;

        const tabela = document.createElement("table");
        tabela.className = "tabela-comparacao";

        const cabecalho = document.createElement("thead");
        const linhaCabecalho = document.createElement("tr");

        for (const titulo of ["Metrica", "DFS", "GBFS"]) {
            const celula = document.createElement("th");
            celula.textContent = titulo;
            linhaCabecalho.append(celula);
        }

        cabecalho.append(linhaCabecalho);
        tabela.append(cabecalho);

        const corpo = document.createElement("tbody");

        for (const linha of linhas.filter((item) => item.comparavel)) {
            const tr = document.createElement("tr");
            tr.dataset.campo = linha.campo;

            if (linha.derivada) {
                tr.classList.add("linha-derivada");
            }

            const rotulo = document.createElement("th");
            rotulo.textContent = linha.rotulo;

            if (linha.nota) {
                const nota = document.createElement("small");
                nota.className = "nota-metrica";
                nota.textContent = linha.nota;
                rotulo.append(nota);
            }

            tr.append(rotulo);

            for (const valor of [linha.dfs, linha.gbfs]) {
                const celula = document.createElement("td");
                celula.textContent = formatarMetrica(linha.campo, valor);
                tr.append(celula);
            }

            corpo.append(tr);
        }

        tabela.append(corpo);
        this.elementoComparacao.append(tabela);

        this.renderizarNaoComparaveis(
            linhas.filter((item) => !item.comparavel),
        );
    }

    /**
     * Desenha o bloco das metricas que NAO podem ser lidas lado a lado.
     *
     * Sem nenhuma linha nao comparavel o bloco fica vazio: nada de titulo
     * orfao. Tambem nao estoura quando `elementoNaoComparavel` e null, porque
     * `app.js` pode nao passar o quarto elemento.
     */
    renderizarNaoComparaveis(linhas) {
        if (!this.elementoNaoComparavel) {
            return;
        }

        this.elementoNaoComparavel.replaceChildren();

        if (linhas.length === 0) {
            return;
        }

        const bloco = document.createElement("div");
        bloco.className = "bloco-incomparavel";

        const titulo = document.createElement("h3");
        titulo.append(
            criarIconeAlerta(),
            "Medem coisas diferentes em cada algoritmo",
        );
        bloco.append(titulo);

        for (const linha of linhas) {
            const item = document.createElement("div");
            item.className = "item";

            const cabecalho = document.createElement("div");
            cabecalho.className = "item-cabecalho";

            const rotulo = document.createElement("span");
            rotulo.textContent = linha.rotulo;

            const valores = document.createElement("span");
            valores.className = "item-valores";
            valores.textContent =
                `DFS ${formatarMetrica(linha.campo, linha.dfs)} · ` +
                `GBFS ${formatarMetrica(linha.campo, linha.gbfs)}`;

            cabecalho.append(rotulo, valores);
            item.append(cabecalho);

            if (linha.nota) {
                const nota = document.createElement("small");
                nota.className = "item-nota";
                nota.textContent = linha.nota;
                item.append(nota);
            }

            bloco.append(item);
        }

        this.elementoNaoComparavel.append(bloco);
    }

    mostrarAviso(texto) {
        if (!this.elementoAviso) {
            return;
        }

        this.elementoAviso.textContent = texto ?? "";
        this.elementoAviso.className = texto ? "aviso-mock" : "";
    }

    limparMetricas() {
        if (!this.elementoMetricas) {
            return;
        }

        for (const celula of this.elementoMetricas.querySelectorAll("[data-metrica]")) {
            celula.textContent = AUSENTE;
        }
    }

    limparNaoComparavel() {
        if (!this.elementoNaoComparavel) {
            return;
        }

        this.elementoNaoComparavel.replaceChildren();
    }

    limpar() {
        this.comparacao.limpar();
        this.limparMetricas();
        this.mostrarAviso("");
        this.limparNaoComparavel();

        if (this.elementoComparacao) {
            this.elementoComparacao.replaceChildren();
        }
    }
}
