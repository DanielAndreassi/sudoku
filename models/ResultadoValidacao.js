export default class ResultadoValidacao {
    constructor(ehValido = false, codigo = null, mensagem = "", celulas = []) {
        this.ehValido = ehValido;
        this.codigo = codigo;
        this.mensagem = mensagem;
        this.celulas = celulas;
    }
}
