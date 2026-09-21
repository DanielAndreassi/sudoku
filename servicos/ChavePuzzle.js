const TAMANHO = 9;

function validarMatriz(matriz) {
    if (!Array.isArray(matriz)) {
        throw new Error("ChavePuzzle: a matriz deve ser um array 9x9.");
    }

    if (matriz.length !== TAMANHO) {
        throw new Error(
            `ChavePuzzle: a matriz deve ter 9 linhas, recebeu ${matriz.length}.`,
        );
    }

    for (let linha = 0; linha < TAMANHO; linha++) {
        const valores = matriz[linha];

        if (!Array.isArray(valores) || valores.length !== TAMANHO) {
            throw new Error(
                `ChavePuzzle: a linha ${linha} deve ter 9 colunas, recebeu ${
                    Array.isArray(valores) ? valores.length : "algo que nao e array"
                }.`,
            );
        }

        for (let coluna = 0; coluna < TAMANHO; coluna++) {
            const valor = valores[coluna];

            if (!Number.isInteger(valor) || valor < 0 || valor > 9) {
                throw new Error(
                    `ChavePuzzle: valor invalido em [${linha}][${coluna}]: ${valor}. Esperado um inteiro de 0 a 9.`,
                );
            }
        }
    }
}

export function gerarChave(matriz) {
    validarMatriz(matriz);

    return matriz.map((linha) => linha.join("")).join("");
}
