// controllers/enderecosController.js
// Endereços de entrega do cliente logado.

const db = require('../database/conexao');
const validar = require('../utils/validacoes');
const { enderecoEmTexto } = require('../utils/pedidos');

function formatar(e) {
  return {
    id: e.id,
    cep: e.cep,
    logradouro: e.logradouro,
    numero: e.numero,
    complemento: e.complemento,
    bairro: e.bairro,
    cidade: e.cidade,
    uf: e.uf,
    resumo: enderecoEmTexto(e),
  };
}

// GET /api/enderecos
function listar(req, res) {
  const linhas = db.prepare('SELECT * FROM enderecos WHERE usuario_id = ? ORDER BY id DESC').all(req.usuario.id);
  res.json({ enderecos: linhas.map(formatar) });
}

// POST /api/enderecos
function criar(req, res) {
  const endereco = validar.endereco(req.body);
  const { lastInsertRowid } = db.prepare(`
    INSERT INTO enderecos (usuario_id, cep, logradouro, numero, complemento, bairro, cidade, uf)
    VALUES (@usuario_id, @cep, @logradouro, @numero, @complemento, @bairro, @cidade, @uf)
  `).run({ usuario_id: req.usuario.id, ...endereco });
  const linha = db.prepare('SELECT * FROM enderecos WHERE id = ?').get(lastInsertRowid);
  res.status(201).json({ mensagem: 'Endereço salvo.', endereco: formatar(linha) });
}

module.exports = { listar, criar, formatar };
