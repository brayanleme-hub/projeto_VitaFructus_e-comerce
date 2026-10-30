// controllers/entregadorController.js
// RF14 — o entregador consulta as entregas atribuídas a ele, atualiza o andamento
// e registra a conclusão.

const db = require('../database/conexao');
const validar = require('../utils/validacoes');
const { ErroHttp } = require('../utils/erros');
const { formatarPedido, SELECT_PEDIDO } = require('../utils/pedidos');
const { mudarStatusPedido } = require('./adminController');

// O entregador só pode fazer estas duas mudanças
const PERMITIDAS_ENTREGADOR = ['saiu_para_entrega', 'entregue'];

// GET /api/entregas
function listar(req, res) {
  const linhas = db.prepare(`
    ${SELECT_PEDIDO}
    WHERE pe.entregador_id = ? AND pe.status IN ('em_preparacao', 'saiu_para_entrega', 'entregue')
    ORDER BY CASE pe.status WHEN 'saiu_para_entrega' THEN 0 WHEN 'em_preparacao' THEN 1 ELSE 2 END, pe.id DESC
  `).all(req.usuario.id);
  res.json({ entregas: linhas.map((l) => formatarPedido(l, { incluirCliente: true })) });
}

// PATCH /api/entregas/:id/status — corpo: { status: 'saiu_para_entrega' | 'entregue' }
function atualizarStatus(req, res) {
  const id = validar.id(req.params.id);
  const status = validar.umDe(req.body && req.body.status, PERMITIDAS_ENTREGADOR, 'status');
  const pedido = db.prepare(`${SELECT_PEDIDO} WHERE pe.id = ? AND pe.entregador_id = ?`).get(id, req.usuario.id);
  if (!pedido) throw new ErroHttp(404, 'Entrega não encontrada entre as suas.');
  mudarStatusPedido(pedido, status);
  const atualizado = db.prepare(`${SELECT_PEDIDO} WHERE pe.id = ?`).get(id);
  res.json({
    mensagem: status === 'entregue' ? 'Entrega concluída. Bom trabalho!' : 'Pedido marcado como saiu para entrega.',
    entrega: formatarPedido(atualizado, { incluirCliente: true }),
  });
}

module.exports = { listar, atualizarStatus };
