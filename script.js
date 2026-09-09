let matrizPrincipal = Array.from({ length: 9 }, () => Array(9).fill(0));
let matrizPossibilidades = Array.from({ length: 9 }, () => Array(9).fill(0));
let mapaDePrioridadeDeCelulas;
function gerarMatrizInicial() {
    // Quantidade de células que serão removidas.
    // 45 removidas = 36 números iniciais.
    const quantidadeRemover = 45;
    /**
     * Embaralha um array usando Fisher-Yates.
     */
    function embaralhar(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }

        return array;
    }

    /**
     * Verifica se um número pode ser colocado
     * em determinada célula.
     */
    function numeroValido(num, x, y) {
        return (
            !numeroExisteNaLinha(num, y) &&
            !numeroExisteNaColuna(num, x) &&
            !numeroExisteNoQuadrante(num, x, y)
        );
    }

    /**
     * Preenche a matriz inteira utilizando backtracking.
     */
    function preencherSudoku() {
        for (let y = 0; y < 9; y++) {
            for (let x = 0; x < 9; x++) {
                if (matrizPrincipal[y][x] !== 0) {
                    continue;
                }

                const numeros = embaralhar([1, 2, 3, 4, 5, 6, 7, 8, 9]);

                for (const numero of numeros) {
                    if (numeroValido(numero, x, y)) {
                        matrizPrincipal[y][x] = numero;

                        // Tenta resolver o restante
                        if (preencherSudoku()) {
                            return true;
                        }

                        // Se não conseguiu, volta atrás
                        matrizPrincipal[y][x] = 0;
                    }
                }

                // Nenhum número funcionou nessa célula
                return false;
            }
        }

        // Não encontrou mais células vazias
        return true;
    }

    /**
     * Remove números aleatoriamente do Sudoku completo.
     */
    function removerNumeros(quantidade) {
        const celulas = [];

        for (let y = 0; y < 9; y++) {
            for (let x = 0; x < 9; x++) {
                celulas.push({ x, y });
            }
        }

        embaralhar(celulas);

        for (let i = 0; i < quantidade; i++) {
            const { x, y } = celulas[i];
            matrizPrincipal[y][x] = 0;
        }
    }

    // 1. Gera Sudoku completo
    preencherSudoku();

    // 2. Remove números para criar o problema
    removerNumeros(quantidadeRemover);

    return matrizPrincipal;
}

function numeroExisteNaLinha(num, y) {
    for (let x = 0; x < 9; x++) {
        if (matrizPrincipal[y][x] === num) {
            return true;
        }
    }
    return false;
}

function numeroExisteNaColuna(num, x) {
    for (let y = 0; y < 9; y++) {
        if (matrizPrincipal[y][x] === num) {
            return true;
        }
    }
    return false;
}

function numeroExisteNoQuadrante(num, x, y) {
    const quadranteX = Math.floor(x / 3) * 3;
    const quadranteY = Math.floor(y / 3) * 3;

    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            if (matrizPrincipal[quadranteY + i][quadranteX + j] === num) {
                return true;
            }
        }
    }
    return false;
}

function recuperaValoresPossiveisCelula(x, y) {
    let possibilidades = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter(
        (num) =>
            !numeroExisteNaLinha(num, y) &&
            !numeroExisteNaColuna(num, x) &&
            !numeroExisteNoQuadrante(num, x, y),
    );
    return {
        quant: possibilidades.length,
        valores: possibilidades,
        coordenadas: { x, y },
    };
}

function atualizaMatrizPossibilidades() {
    for (let y = 0; y < 9; y++) {
        for (let x = 0; x < 9; x++) {
            if (matrizPrincipal[y][x] === 0) {
                matrizPossibilidades[y][x] = recuperaValoresPossiveisCelula(
                    x,
                    y,
                );
            } else {
                matrizPossibilidades[y][x] = null;
            }
        }
    }
}

function atualizarMapaDePrioridadeDeCelulas() {
    let m = new Map();
    for (let chave = 1; chave <= 9; chave++) {
        m.set(`${chave}`, []);
    }
    for (let x = 0; x < 9; x++) {
        for (let y = 0; y < 9; y++) {
            if (matrizPossibilidades[y][x] !== null) {
                m.get(`${matrizPossibilidades[y][x].quant}`).push(
                    matrizPossibilidades[y][x],
                );
            }
        }
    }
    mapaDePrioridadeDeCelulas = m;
}

function test() {
    gerarMatrizInicial();
    atualizaMatrizPossibilidades();
    atualizarMapaDePrioridadeDeCelulas();

    console.table(matrizPrincipal);
    console.table(matrizPossibilidades);
    console.log(mapaDePrioridadeDeCelulas);
}

test();
