// utils/erros.js
// Um erro que já sabe qual código HTTP devolver.
// Nos controllers: throw new ErroHttp(404, 'Produto não encontrado')
// O middleware de erros (middlewares/erros.js) transforma isso em resposta JSON.

class ErroHttp extends Error {
  constructor(status, mensagem, detalhes) {
    super(mensagem);
    this.status = status;
    this.detalhes = detalhes;
  }
}

module.exports = { ErroHttp };
