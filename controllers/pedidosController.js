// controllers/pedidosController.js
// P3 do DFD — Gerenciar carrinho e pedidos (lado do cliente).

const db = require('../database/conexao');
const validar = require('../utils/validacoes');
const { ErroHttp } = require('../utils/erros');
const { hoje } = require('../utils/datas');
const { CONDICAO_VISIVEL_NA_LOJA } = require('../utils/produtos');
const { formatarPedido, SELECT_PEDIDO, enderecoEmTexto } = require('../utils/pedidos');
const { normalizarItens } = require('./produtosController');

const FORMAS_PAGAMENTO = ['pix', 'debito', 'credito'];

// POST /api/pedidos
// Corpo: { itens: [{ produtoId, quantidade }], formaPagamento, enderecoId }
//    ou: { itens, formaPagamento, novoEndereco: { cep, logradouro, ... } }
// Preços enviados pelo navegador são IGNORADOS: o total é recalculado aqui.
function criar(req, res) {
  if (req.usuario.tipo !== 'cliente') {
    throw new ErroHttp(403, 'Somente contas de cliente podem fazer pedidos.');
  }
  const corpo = req.body || {};
  const itens = normalizarItens(corpo.itens);
  const formaPagamento = validar.umDe(corpo.formaPagamento, FORMAS_PAGAMENTO, 'forma de pagamento');

  const buscarProduto = db.prepare(`SELECT * FROM produtos p WHERE p.id = @id AND ${CONDICAO_VISIVEL_NA_LOJA}`);
  const baixarEstoque = db.prepare(`
    UPDATE produtos SET estoque = estoque - @qtd, atualizado_em = datetime('now', 'localtime')
    WHERE id = @id AND estoque >= @qtd
  `);
  const inserirItem = db.prepare(`
    INSERT INTO itens_pedido (pedido_id, produto_id, nome_produto, unidade, preco_unitario_centavos, quantidade, subtotal_centavos)
    VALUES (@pedido_id, @produto_id, @nome, @unidade, @preco, @quantidade, @subtotal)
  `);

  // Tudo dentro de UMA transação: se qualquer item falhar, nada é gravado
  // e o estoque volta ao que era.
  const registrarPedido = db.transaction(() => {
    // 1) endereço: um já salvo do cliente, ou um novo
    let endereco;
    if (corpo.enderecoId) {
      endereco = db.prepare('SELECT * FROM enderecos WHERE id = ? AND usuario_id = ?')
        .get(validar.id(corpo.enderecoId, 'enderecoId'), req.usuario.id);
      if (!endereco) throw new ErroHttp(400, 'Escolha um endereço de entrega válido.');
    } else {
      endereco = validar.endereco(corpo.novoEndereco);
      db.prepare(`
        INSERT INTO enderecos (usuario_id, cep, logradouro, numero, complemento, bairro, cidade, uf)
        VALUES (@usuario_id, @cep, @logradouro, @numero, @complemento, @bairro, @cidade, @uf)
      `).run({ usuario_id: req.usuario.id, ...endereco });
    }

    // 2) confere cada produto com os dados do banco
    const dataHoje = hoje();
    let total = 0;
    const linhasItens = itens.map(({ produtoId, quantidade }) => {
      const produto = buscarProduto.get({ id: produtoId, hoje: dataHoje });
      if (!produto) throw new ErroHttp(409, `Um dos produtos do carrinho não está mais à venda (código ${produtoId}).`);
      if (produto.estoque < quantidade) {
        throw new ErroHttp(409, `Estoque insuficiente de ${produto.nome}: temos ${produto.estoque} ${produto.unidade}.`);
      }
      const subtotal = produto.preco_venda_centavos * quantidade;
      total += subtotal;
      return { produto, quantidade, subtotal };
    });

    // 3) cria o pedido
    const { lastInsertRowid: pedidoId } = db.prepare(`
      INSERT INTO pedidos (usuario_id, endereco_entrega, total_centavos, forma_pagamento)
      VALUES (?, ?, ?, ?)
    `).run(req.usuario.id, enderecoEmTexto(endereco), total, formaPagamento);

    // 4) grava os itens (com cópia de nome e preço) e baixa o estoque
    for (const { produto, quantidade, subtotal } of linhasItens) {
      inserirItem.run({
        pedido_id: pedidoId,
        produto_id: produto.id,
        nome: produto.nome,
        unidade: produto.unidade,
        preco: produto.preco_venda_centavos,
        quantidade,
        subtotal,
      });
      const { changes } = baixarEstoque.run({ id: produto.id, qtd: quantidade });
      if (changes !== 1) throw new ErroHttp(409, `Estoque insuficiente de ${produto.nome}.`);
    }
    return Number(pedidoId);
  });

  const pedidoId = registrarPedido();
  const pedido = db.prepare(`${SELECT_PEDIDO} WHERE pe.id = ?`).get(pedidoId);
  res.status(201).json({
    mensagem: `Pedido nº ${pedidoId} confirmado! Pagamento simulado: nenhuma cobrança real foi feita.`,
    pedido: formatarPedido(pedido),
  });
}

// GET /api/pedidos — pedidos do cliente logado
function listarMeus(req, res) {
  const linhas = db.prepare(`${SELECT_PEDIDO} WHERE pe.usuario_id = ? ORDER BY pe.id DESC`).all(req.usuario.id);
  res.json({ pedidos: linhas.map((l) => formatarPedido(l)) });
}

// GET /api/pedidos/:id — só se o pedido for do cliente logado
function obterMeu(req, res) {
  const id = validar.id(req.params.id);
  const linha = db.prepare(`${SELECT_PEDIDO} WHERE pe.id = ? AND pe.usuario_id = ?`).get(id, req.usuario.id);
  if (!linha) throw new ErroHttp(404, 'Pedido não encontrado.');
  res.json({ pedido: formatarPedido(linha) });
}

module.exports = { criar, listarMeus, obterMeu };
