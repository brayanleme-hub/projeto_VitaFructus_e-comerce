// utils/pedidos.js
// Status dos pedidos, transições permitidas e funções para montar a resposta.

const db = require('../database/conexao');

const STATUS = ['pendente', 'em_preparacao', 'saiu_para_entrega', 'entregue', 'cancelado'];

// De cada status, para quais ele pode ir
const TRANSICOES = {
  pendente: ['em_preparacao', 'cancelado'],
  em_preparacao: ['saiu_para_entrega', 'cancelado'],
  saiu_para_entrega: ['entregue'],
  entregue: [],
  cancelado: [],
};

function podeMudar(statusAtual, novoStatus) {
  return (TRANSICOES[statusAtual] || []).includes(novoStatus);
}

const sqlItens = db.prepare(`
  SELECT produto_id, nome_produto, unidade, preco_unitario_centavos, quantidade, subtotal_centavos
  FROM itens_pedido WHERE pedido_id = ? ORDER BY id
`);

// Monta o objeto do pedido (com itens) no formato da API
function formatarPedido(linha, { incluirCliente = false } = {}) {
  const pedido = {
    id: linha.id,
    status: linha.status,
    statusPagamento: linha.status_pagamento,
    formaPagamento: linha.forma_pagamento,
    totalCentavos: linha.total_centavos,
    enderecoEntrega: linha.endereco_entrega,
    criadoEm: linha.criado_em,
    atualizadoEm: linha.atualizado_em,
    entregador: linha.entregador_id ? { id: linha.entregador_id, nome: linha.entregador_nome } : null,
    proximosStatus: TRANSICOES[linha.status] || [],
    itens: sqlItens.all(linha.id).map((i) => ({
      produtoId: i.produto_id,
      nome: i.nome_produto,
      unidade: i.unidade,
      precoUnitarioCentavos: i.preco_unitario_centavos,
      quantidade: i.quantidade,
      subtotalCentavos: i.subtotal_centavos,
    })),
  };
  if (incluirCliente) {
    pedido.cliente = { id: linha.usuario_id, nome: linha.cliente_nome, email: linha.cliente_email, telefone: linha.cliente_telefone };
  }
  return pedido;
}

const SELECT_PEDIDO = `
  SELECT pe.*, cli.nome AS cliente_nome, cli.email AS cliente_email, cli.telefone AS cliente_telefone,
         ent.nome AS entregador_nome
  FROM pedidos pe
  JOIN usuarios cli ON cli.id = pe.usuario_id
  LEFT JOIN usuarios ent ON ent.id = pe.entregador_id
`;

function enderecoEmTexto(e) {
  const complemento = e.complemento ? `, ${e.complemento}` : '';
  const cep = `${e.cep.slice(0, 5)}-${e.cep.slice(5)}`;
  return `${e.logradouro}, ${e.numero}${complemento} - ${e.bairro}, ${e.cidade}/${e.uf} - CEP ${cep}`;
}

module.exports = { STATUS, TRANSICOES, podeMudar, formatarPedido, SELECT_PEDIDO, enderecoEmTexto };
