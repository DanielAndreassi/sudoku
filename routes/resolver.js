import { Router } from "express";

import SudokuEstado from "../models/SudokuEstado.js";
import DFS from "../resolvers/DFS.js";
import GBFS from "../resolvers/GBFS.js";
import { listarPuzzlesFixos } from "../servicos/PuzzlesFixos.js";
import Validacao from "../validacao/Validacao.js";

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
 * funcao por nome. As duas entradas entregam exatamente o mesmo contrato, o que
 * permite ao painel comparar DFS e GBFS lado a lado.
 *
 * Contrato acordado, identico ao que o GBFS ja cumpre:
 *     resolver(estadoInicial: SudokuEstado, opcoes: { silencioso?: boolean })
 *         -> ResultadoResolucao
 */
const RESOLVEDORES = {
    gbfs: (estado, opcoes) => GBFS.resolver(estado, opcoes),
    dfs: (estado, opcoes) => DFS.resolver(estado, opcoes),
};

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

    // Validacao completa da Pessoa 1 (P1-03 a P1-05) antes de qualquer busca:
    // estrutura, duplicatas, dominio zero e solubilidade. A guarda provisoria
    // que existia ate aqui foi removida de proposito — ela recusava duplicatas
    // mas deixava o insolvivel ser descoberto so pela busca, o que obrigava o
    // cliente a adivinhar a diferenca entre "erro meu" e "puzzle impossivel".
    const validacao = Validacao.validarQuadroInicial(quadro);

    if (!validacao.ehValido) {
        return resposta.status(422).json({
            erro: "VALIDACAO",
            validacao,
        });
    }

    // Copia independente: o solver nunca recebe a matriz que veio da requisicao.
    const estado = SudokuEstado.gerarDeMatriz(quadro);
    const resultado = resolvedor(estado, { silencioso: silencioso === true });

    return resposta.json({
        algoritmo: chaveAlgoritmo,
        resultado,
    });
});

export default rotas;
