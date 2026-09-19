export default class Regras {
    constructor() {}

    static numeroExisteNaLinha(estado, num, y) {
        for (let x = 0; x < 9; x++) {
            if (estado.quadro[y][x] === num) {
                return true;
            }
        }
        return false;
    }

    static numeroExisteNaColuna(estado, num, x) {
        for (let y = 0; y < 9; y++) {
            if (estado.quadro[y][x] === num) {
                return true;
            }
        }
        return false;
    }

    static numeroExisteNoQuadrante(estado, num, x, y) {
        const quadranteX = Math.floor(x / 3) * 3;
        const quadranteY = Math.floor(y / 3) * 3;

        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                if (estado.quadro[quadranteY + i][quadranteX + j] === num) {
                    return true;
                }
            }
        }
        return false;
    }
}
