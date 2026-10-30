// middlewares/erros.js
// Último middleware do Express: transforma qualquer erro em uma resposta JSON clara.
// No Express 5, erros lançados dentro dos controllers chegam aqui automaticamente.

function rotaNaoEncontrada(req, res) {
  res.status(404).json({ erro: 'Rota da API não encontrada.' });
}

// eslint-disable-next-line no-unused-vars
function tratarErros(erro, req, res, next) {
  // JSON mal formatado enviado pelo cliente
  if (erro.type === 'entity.parse.failed') {
    return res.status(400).json({ erro: 'O JSON enviado está mal formatado.' });
  }
  if (erro.type === 'entity.too.large') {
    return res.status(413).json({ erro: 'Os dados enviados são grandes demais.' });
  }

  // Erros que nós mesmos lançamos (ErroHttp)
  if (erro.status && erro.status < 500) {
    return res.status(erro.status).json({ erro: erro.message, ...(erro.detalhes ? { detalhes: erro.detalhes } : {}) });
  }

  // Regras do banco (CHECK, UNIQUE, FOREIGN KEY) que escaparam da validação
  if (erro.code && String(erro.code).startsWith('SQLITE_CONSTRAINT')) {
    return res.status(409).json({ erro: 'Os dados não respeitam as regras do banco de dados.' });
  }

  // Erro inesperado: mostra no terminal, mas não revela detalhes ao usuário
  console.error(erro);
  res.status(500).json({ erro: 'Erro interno no servidor. Tente novamente.' });
}

module.exports = { rotaNaoEncontrada, tratarErros };
