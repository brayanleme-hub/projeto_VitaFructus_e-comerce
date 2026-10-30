// controllers/adminController.js
// Área administrativa: dashboard, produtos/promoções (P2), pedidos e entregadores.
// Todas as rotas que usam este controller passam por exigirPapel('admin').

const bcrypt = require('bcryptjs');
const db = require('../database/conexao');
const validar = require('../utils/validacoes');
const { ErroHttp } = require('../utils/erros');
const { hoje, daquiDias } = require('../utils/datas');
const { SELECT_PRODUTO, formatarProduto } = require('../utils/produtos');
const { STATUS, podeMudar, formatarPedido, SELECT_PEDIDO } = require('../utils/pedidos');

const UNIDADES = ['kg', 'unidade', 'bandeja', 'maço', 'dúzia'];
const ESTOQUE_BAIXO = 5;
const DIAS_ALERTA_DATA_LIMITE = 3;

// ---------------------------------------------------------------- Dashboard

// GET /api/admin/resumo
function resumo(req, res) {
  const dataHoje = hoje();
  const limiteAlerta = daquiDias(DIAS_ALERTA_DATA_LIMITE);
  const contar = (sql, ...p) => db.prepare(sql).get(...p).total;

  const estoqueBaixo = db.prepare(`
    ${SELECT_PRODUTO}
    WHERE p.ativo = 1 AND p.estoque <= ? AND (p.data_limite IS NULL OR p.data_limite >= ?)
    ORDER BY p.estoque, p.nome
  `).all(ESTOQUE_BAIXO, dataHoje);

  const proximosDataLimite = db.prepare(`
    ${SELECT_PRODUTO}
    WHERE p.ativo = 1 AND p.data_limite BETWEEN ? AND ?
    ORDER BY p.data_limite, p.nome
  `).all(dataHoje, limiteAlerta);

  const vencidos = db.prepare(`
    ${SELECT_PRODUTO} WHERE p.ativo = 1 AND p.data_limite < ? ORDER BY p.data_limite
  `).all(dataHoje);

  res.json({
    totais: {
      produtos: contar('SELECT COUNT(*) AS total FROM produtos'),
      produtosAtivos: contar('SELECT COUNT(*) AS total FROM produtos WHERE ativo = 1'),
      pedidos: contar('SELECT COUNT(*) AS total FROM pedidos'),
      pedidosPendentes: contar("SELECT COUNT(*) AS total FROM pedidos WHERE status = 'pendente'"),
      pedidosEmAndamento: contar("SELECT COUNT(*) AS total FROM pedidos WHERE status IN ('em_preparacao', 'saiu_para_entrega')"),
      faturamentoCentavos: contar("SELECT COALESCE(SUM(total_centavos), 0) AS total FROM pedidos WHERE status <> 'cancelado'"),
    },
    limites: { estoqueBaixo: ESTOQUE_BAIXO, diasDataLimite: DIAS_ALERTA_DATA_LIMITE },
    estoqueBaixo: estoqueBaixo.map(formatarProduto),
    proximosDataLimite: proximosDataLimite.map(formatarProduto),
    vencidos: vencidos.map(formatarProduto),
  });
}

// ---------------------------------------------------------------- Produtos

// Valida o corpo enviado pelo formulário de produto e aplica as regras de oferta
function validarProduto(corpo) {
  const dados = corpo || {};
  const precoOriginal = validar.inteiro(dados.precoOriginalCentavos, 'preço original', { min: 1, max: 1000000 });
  const emOferta = validar.booleano(dados.emOferta);
  const dataLimite = validar.data(dados.dataLimite, 'data-limite');

  let precoVenda = precoOriginal;
  if (emOferta) {
    precoVenda = validar.inteiro(dados.precoPromocionalCentavos, 'preço promocional', { min: 1, max: 1000000 });
    if (precoVenda >= precoOriginal) {
      throw new ErroHttp(400, 'O preço promocional precisa ser menor que o preço original.');
    }
    if (!dataLimite) {
      throw new ErroHttp(400, 'Produtos em oferta precisam de data-limite de comercialização.');
    }
    if (dataLimite < hoje()) {
      throw new ErroHttp(400, 'A data-limite de uma oferta não pode estar no passado.');
    }
  }

  const categoriaId = validar.id(dados.categoriaId, 'categoria');
  if (!db.prepare('SELECT 1 FROM categorias WHERE id = ?').get(categoriaId)) {
    throw new ErroHttp(400, 'Escolha uma categoria válida.');
  }

  return {
    nome: validar.texto(dados.nome, 'nome', { min: 2, max: 80 }),
    descricao: validar.texto(dados.descricao, 'descrição', { max: 400, obrigatorio: false }) || '',
    categoria_id: categoriaId,
    unidade: validar.umDe(dados.unidade, UNIDADES, 'unidade de venda'),
    preco_original_centavos: precoOriginal,
    preco_venda_centavos: precoVenda,
    imagem: validar.imagem(dados.imagem),
    estoque: validar.inteiro(dados.estoque, 'estoque', { min: 0, max: 100000 }),
    data_limite: dataLimite,
    em_oferta: emOferta ? 1 : 0,
    ativo: dados.ativo === undefined ? 1 : validar.booleano(dados.ativo) ? 1 : 0,
  };
}

function buscarProdutoOu404(id) {
  const linha = db.prepare(`${SELECT_PRODUTO} WHERE p.id = ?`).get(id);
  if (!linha) throw new ErroHttp(404, 'Produto não encontrado.');
  return linha;
}

// GET /api/admin/produtos — todos, inclusive inativos e vencidos
function listarProdutos(req, res) {
  const linhas = db.prepare(`${SELECT_PRODUTO} ORDER BY p.ativo DESC, c.id, p.nome`).all();
  res.json({ produtos: linhas.map(formatarProduto), unidades: UNIDADES });
}

// POST /api/admin/produtos
function criarProduto(req, res) {
  const produto = validarProduto(req.body);
  const { lastInsertRowid } = db.prepare(`
    INSERT INTO produtos (nome, descricao, categoria_id, unidade, preco_original_centavos, preco_venda_centavos,
                          imagem, estoque, data_limite, em_oferta, ativo)
    VALUES (@nome, @descricao, @categoria_id, @unidade, @preco_original_centavos, @preco_venda_centavos,
            @imagem, @estoque, @data_limite, @em_oferta, @ativo)
  `).run(produto);
  res.status(201).json({ mensagem: 'Produto cadastrado.', produto: formatarProduto(buscarProdutoOu404(lastInsertRowid)) });
}

// PUT /api/admin/produtos/:id
function atualizarProduto(req, res) {
  const id = validar.id(req.params.id);
  buscarProdutoOu404(id);
  const produto = validarProduto(req.body);
  db.prepare(`
    UPDATE produtos SET nome = @nome, descricao = @descricao, categoria_id = @categoria_id, unidade = @unidade,
      preco_original_centavos = @preco_original_centavos, preco_venda_centavos = @preco_venda_centavos,
      imagem = @imagem, estoque = @estoque, data_limite = @data_limite, em_oferta = @em_oferta, ativo = @ativo,
      atualizado_em = datetime('now', 'localtime')
    WHERE id = @id
  `).run({ ...produto, id });
  res.json({ mensagem: 'Produto atualizado.', produto: formatarProduto(buscarProdutoOu404(id)) });
}

// PATCH /api/admin/produtos/:id/ativo — corpo: { ativo: true|false }
function alterarAtivoProduto(req, res) {
  const id = validar.id(req.params.id);
  buscarProdutoOu404(id);
  const ativo = validar.booleano(req.body && req.body.ativo) ? 1 : 0;
  db.prepare("UPDATE produtos SET ativo = ?, atualizado_em = datetime('now', 'localtime') WHERE id = ?").run(ativo, id);
  res.json({
    mensagem: ativo ? 'Produto ativado: ele volta a aparecer na loja.' : 'Produto desativado: ele não aparece mais na loja.',
    produto: formatarProduto(buscarProdutoOu404(id)),
  });
}

// DELETE /api/admin/produtos/:id
// Se o produto já foi vendido, a exclusão é bloqueada para não quebrar pedidos antigos.
function excluirProduto(req, res) {
  const id = validar.id(req.params.id);
  buscarProdutoOu404(id);
  const vendido = db.prepare('SELECT COUNT(*) AS total FROM itens_pedido WHERE produto_id = ?').get(id).total;
  if (vendido > 0) {
    throw new ErroHttp(409, `Este produto aparece em ${vendido} item(ns) de pedido e não pode ser excluído. Desative-o para tirá-lo da loja.`);
  }
  db.prepare('DELETE FROM produtos WHERE id = ?').run(id);
  res.json({ mensagem: 'Produto excluído.' });
}

// ---------------------------------------------------------------- Pedidos

// GET /api/admin/pedidos?status=pendente
function listarPedidos(req, res) {
  const parametros = [];
  let filtro = '';
  if (req.query.status) {
    validar.umDe(req.query.status, STATUS, 'status');
    filtro = 'WHERE pe.status = ?';
    parametros.push(req.query.status);
  }
  const linhas = db.prepare(`${SELECT_PEDIDO} ${filtro} ORDER BY pe.id DESC`).all(...parametros);
  res.json({ pedidos: linhas.map((l) => formatarPedido(l, { incluirCliente: true })) });
}

function buscarPedidoOu404(id) {
  const linha = db.prepare(`${SELECT_PEDIDO} WHERE pe.id = ?`).get(id);
  if (!linha) throw new ErroHttp(404, 'Pedido não encontrado.');
  return linha;
}

// GET /api/admin/pedidos/:id
function obterPedido(req, res) {
  const id = validar.id(req.params.id);
  res.json({ pedido: formatarPedido(buscarPedidoOu404(id), { incluirCliente: true }) });
}

// Muda o status respeitando as transições. Reaproveitado pelo entregador.
// Cancelar devolve os produtos ao estoque (na mesma transação).
const mudarStatusPedido = db.transaction((pedido, novoStatus) => {
  if (!podeMudar(pedido.status, novoStatus)) {
    throw new ErroHttp(409, `Não é possível mudar o pedido de "${pedido.status}" para "${novoStatus}".`);
  }
  if (novoStatus === 'saiu_para_entrega' && !pedido.entregador_id) {
    throw new ErroHttp(409, 'Escolha um entregador antes de marcar o pedido como "saiu para entrega".');
  }
  if (novoStatus === 'cancelado') {
    const itens = db.prepare('SELECT produto_id, quantidade FROM itens_pedido WHERE pedido_id = ?').all(pedido.id);
    const devolver = db.prepare('UPDATE produtos SET estoque = estoque + ? WHERE id = ?');
    for (const item of itens) devolver.run(item.quantidade, item.produto_id);
    db.prepare("UPDATE pedidos SET status_pagamento = 'estornado_simulado' WHERE id = ?").run(pedido.id);
  }
  db.prepare("UPDATE pedidos SET status = ?, atualizado_em = datetime('now', 'localtime') WHERE id = ?")
    .run(novoStatus, pedido.id);
});

// PATCH /api/admin/pedidos/:id/status — corpo: { status }
function atualizarStatusPedido(req, res) {
  const id = validar.id(req.params.id);
  const novoStatus = validar.umDe(req.body && req.body.status, STATUS, 'status');
  mudarStatusPedido(buscarPedidoOu404(id), novoStatus);
  res.json({ mensagem: 'Status do pedido atualizado.', pedido: formatarPedido(buscarPedidoOu404(id), { incluirCliente: true }) });
}

// PATCH /api/admin/pedidos/:id/entregador — corpo: { entregadorId } (null remove)
function atribuirEntregador(req, res) {
  const id = validar.id(req.params.id);
  const pedido = buscarPedidoOu404(id);
  if (!['pendente', 'em_preparacao'].includes(pedido.status)) {
    throw new ErroHttp(409, 'Só é possível escolher o entregador antes do pedido sair para entrega.');
  }
  let entregadorId = null;
  if (req.body && req.body.entregadorId) {
    entregadorId = validar.id(req.body.entregadorId, 'entregador');
    const entregador = db.prepare("SELECT 1 FROM usuarios WHERE id = ? AND tipo = 'entregador' AND ativo = 1").get(entregadorId);
    if (!entregador) throw new ErroHttp(400, 'Escolha um entregador ativo.');
  }
  db.prepare("UPDATE pedidos SET entregador_id = ?, atualizado_em = datetime('now', 'localtime') WHERE id = ?").run(entregadorId, id);
  res.json({ mensagem: entregadorId ? 'Entregador definido.' : 'Entregador removido.', pedido: formatarPedido(buscarPedidoOu404(id), { incluirCliente: true }) });
}

// ---------------------------------------------------------------- Entregadores

function formatarEntregador(u) {
  return { id: u.id, nome: u.nome, email: u.email, telefone: u.telefone, ativo: u.ativo === 1, entregasAtivas: u.entregas_ativas || 0 };
}

// GET /api/admin/entregadores
function listarEntregadores(req, res) {
  const linhas = db.prepare(`
    SELECT u.*, (SELECT COUNT(*) FROM pedidos p WHERE p.entregador_id = u.id
                  AND p.status IN ('em_preparacao', 'saiu_para_entrega')) AS entregas_ativas
    FROM usuarios u WHERE u.tipo = 'entregador' ORDER BY u.ativo DESC, u.nome
  `).all();
  res.json({ entregadores: linhas.map(formatarEntregador) });
}

// POST /api/admin/entregadores — o admin cria a conta (com senha) do entregador
async function criarEntregador(req, res) {
  const dados = req.body || {};
  const nome = validar.texto(dados.nome, 'nome', { min: 2, max: 80 });
  const email = validar.email(dados.email);
  const senha = validar.senha(dados.senha);
  const telefone = validar.telefone(dados.telefone);
  if (db.prepare('SELECT 1 FROM usuarios WHERE email = ?').get(email)) {
    throw new ErroHttp(409, 'Já existe uma conta com este e-mail.');
  }
  const hash = await bcrypt.hash(senha, 10);
  const { lastInsertRowid } = db.prepare("INSERT INTO usuarios (nome, email, senha_hash, telefone, tipo) VALUES (?, ?, ?, ?, 'entregador')")
    .run(nome, email, hash, telefone);
  const linha = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(lastInsertRowid);
  res.status(201).json({ mensagem: 'Entregador cadastrado.', entregador: formatarEntregador(linha) });
}

// PATCH /api/admin/entregadores/:id/ativo — corpo: { ativo }
function alterarAtivoEntregador(req, res) {
  const id = validar.id(req.params.id);
  const ativo = validar.booleano(req.body && req.body.ativo) ? 1 : 0;
  const { changes } = db.prepare("UPDATE usuarios SET ativo = ? WHERE id = ? AND tipo = 'entregador'").run(ativo, id);
  if (!changes) throw new ErroHttp(404, 'Entregador não encontrado.');
  res.json({ mensagem: ativo ? 'Entregador ativado.' : 'Entregador desativado: ele não consegue mais entrar.' });
}

module.exports = {
  resumo,
  listarProdutos, criarProduto, atualizarProduto, alterarAtivoProduto, excluirProduto,
  listarPedidos, obterPedido, atualizarStatusPedido, atribuirEntregador, mudarStatusPedido,
  listarEntregadores, criarEntregador, alterarAtivoEntregador,
};
