import { Router } from "express";

import SudokuEstado from "../models/SudokuEstado.js";
import ResultadoValidacao from "../models/ResultadoValidacao.js";
import GBFS from "../resolvers/GBFS.js";
import { listarPuzzlesFixos } from "../servicos/PuzzlesFixos.js";

const rotas = Router();

/**
 * O template EJS ja renderiza os NOMES dos puzzles no <select>. Esta rota entrega
 * as MATRIZES, que o cliente precisa para preencher a grade sem recarregar a
 * pagina. Separar os dois evita embutir nove matrizes 9x9 no HTML.
 */
rotas.get("/puzzles", (requisicao, resposta) => {
    resposta.json(listarPuzzlesFixos());
});

/**
 * Registro de resolvedores por injecao.
 *
 * O controlador e as rotas nao conhecem MRV, LCV nem recursao: escolhem uma
 * funcao por nome. Quando a Pessoa 1 entregar a DFS (P1-01/P1-02), basta
 * importar `resolvers/DFS.js` e trocar o `null` abaixo pela funcao — nenhuma
 * outra linha deste arquivo muda.
 *
 * Contrato acordado, identico ao que o GBFS ja cumpre:
 *     resolver(estadoInicial: SudokuEstado, opcoes: { silencioso?: boolean })
 *         -> ResultadoResolucao
 */
const RESOLVEDORES = {
    gbfs: (estado, opcoes) => GBFS.resolver(estado, opcoes),
    dfs: null,
};

/**
 * Guarda provisoria de entrada.
 *
 * NAO e a validacao completa da Pessoa 1 (P1-03 a P1-05). Ela cobre apenas o que
 * a BASE-V1 ja oferece: forma da matriz e ausencia de duplicatas. Nao detecta
 * dominio zero nem insolubilidade global — isso exige a busca silenciosa do
 * P1-04, que ainda nao existe.
 *
 * Existe so para o servidor recusar lixo de entrada com uma mensagem clara em vez
 * de estourar dentro do solver. Quando `Validacao.validarQuadroInicial(matriz)`
 * chegar, esta funcao inteira e substituida por uma chamada a ela.
 */
function validarEntradaProvisoria(quadro) {
    if (!Array.isArray(quadro) || quadro.length !== 9) {
        return new ResultadoValidacao(
            false,
            "INVALID_STRUCTURE",
            "O tabuleiro precisa ser uma matriz com exatamente 9 linhas.",
        );
    }

    for (let linha = 0; linha < 9; linha++) {
        if (!Array.isArray(quadro[linha]) || quadro[linha].length !== 9) {
            return new ResultadoValidacao(
                false,
                "INVALID_STRUCTURE",
                `A linha ${linha + 1} precisa ter exatamente 9 colunas.`,
            );
        }

        for (let coluna = 0; coluna < 9; coluna++) {
            const valor = quadro[linha][coluna];

            if (!Number.isInteger(valor) || valor < 0 || valor > 9) {
                return new ResultadoValidacao(
                    false,
                    "INVALID_STRUCTURE",
                    `A celula (linha ${linha + 1}, coluna ${coluna + 1}) precisa ser um inteiro de 0 a 9.`,
                    [{ linha, coluna }],
                );
            }
        }
    }

    if (!new SudokuEstado(quadro).estaValido()) {
        return new ResultadoValidacao(
            false,
            "INVALID_RULES",
            "Ha valor repetido em alguma linha, coluna ou quadrante 3x3.",
        );
    }

    return new ResultadoValidacao(true, "VALID_LOCAL", "Entrada aceita pela verificacao provisoria.");
}

rotas.post("/resolver", (requisicao, resposta) => {
    const { algoritmo, quadro, silencioso } = requisicao.body ?? {};

    const chaveAlgoritmo = String(algoritmo ?? "").toLowerCase();

    if (!Object.hasOwn(RESOLVEDORES, chaveAlgoritmo)) {
        return resposta.status(400).json({
            erro: "ALGORITMO_DESCONHECIDO",
            mensagem: `Algoritmo "${algoritmo}" nao existe. Disponiveis: ${Object.keys(RESOLVEDORES).join(", ")}.`,
        });
    }

    const resolvedor = RESOLVEDORES[chaveAlgoritmo];

    if (resolvedor === null) {
        return resposta.status(501).json({
            erro: "RESOLVEDOR_NAO_IMPLEMENTADO",
            mensagem:
                "A DFS ainda nao foi entregue pela Pessoa 1 (etapas P1-01/P1-02). " +
                "Selecione GBFS para executar uma busca real.",
        });
    }

    const validacao = validarEntradaProvisoria(quadro);

    if (!validacao.ehValido) {
        return resposta.status(422).json({
            erro: "VALIDACAO",
            validacao,
            avisoValidacao:
                "Verificacao provisoria da Pessoa 3. A validacao completa (dominio zero e " +
                "insolubilidade global) depende da entrega da Pessoa 1.",
        });
    }

    // Copia independente: o solver nunca recebe a matriz que veio da requisicao.
    const estado = SudokuEstado.gerarDeMatriz(quadro);
    const resultado = resolvedor(estado, { silencioso: silencioso === true });

    return resposta.json({
        algoritmo: chaveAlgoritmo,
        resultado,
        avisoValidacao:
            "Executado sem a validacao completa da Pessoa 1: um tabuleiro insoluvel " +
            "sera descoberto pela propria busca, nao antes dela.",
    });
});

export default rotas;
