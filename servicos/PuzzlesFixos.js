import { casosBase } from "../tests/casosBase.js";

/**
 * Expoe os puzzles fixos da BASE-V1 para a interface.
 *
 * Os casos moram em `tests/casosBase.js` porque foi la que a base do grupo os
 * definiu. Importar uma fixture de teste em codigo de producao nao e ideal, mas
 * duplicar as matrizes seria pior: elas sao a referencia de reprodutibilidade do
 * trabalho e precisam existir em um lugar so.
 */

// Casos que servem para demonstracao/carregamento na UI. Ficam de fora os casos
// que existem apenas para testar heuristicas (empateMRV, empateDegree, lcv), pois
// sao o mesmo tabuleiro "facil" com expectativas diferentes anexadas.
const CHAVES_EXPOSTAS = [
    "facil",
    "intermediario",
    "dificil",
    "completoValido",
    "duplicataLinha",
    "duplicataColuna",
    "duplicataBloco",
    "localmenteValidoInsoluvel",
    "dominioZero",
];

/**
 * Sempre devolve COPIAS das matrizes.
 *
 * Devolver a referencia de `casosBase` deixaria um solver que mutasse a entrada
 * corromper a fixture compartilhada dos testes — e o sintoma apareceria muito
 * longe da causa, em um teste de outra pessoa.
 */
export function listarPuzzlesFixos() {
    return CHAVES_EXPOSTAS.map((chave) => ({
        id: chave,
        nome: casosBase[chave].nome,
        matriz: casosBase[chave].matriz.map((linha) => [...linha]),
    }));
}

export function recuperarPuzzleFixo(id) {
    if (!CHAVES_EXPOSTAS.includes(id)) {
        return null;
    }

    return {
        id,
        nome: casosBase[id].nome,
        matriz: casosBase[id].matriz.map((linha) => [...linha]),
    };
}
