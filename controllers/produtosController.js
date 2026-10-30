// controllers/produtosController.js
// Parte pública do P2/P3 do DFD: catálogo, pesquisa, filtros e conferência do carrinho.

const db = require('../database/conexao');
const validar = require('../utils/validacoes');
const { ErroHttp } = require('../utils/erros');
const { hoje } = require('../utils/datas');
const { CONDICAO_VISIVEL_NA_LOJA, SELECT_PRODUTO, formatarProduto } = require('../utils/produtos');

// GET /api/categorias
function listarCategorias(req, res) {
  const categorias = db.prepare(`
    SELECT c.id, c.nome, c.slug,
           (SELECT COUNT(*) FROM produtos p WHERE p.categoria_id = c.id AND ${CONDICAO_VISIVEL_NA_LOJA}) AS total
    FROM categorias c ORDER BY c.id
  `).all({ hoje: hoje() });
  res.json({ categorias });
}

// GET /api/produtos?categoria=frutas&busca=ban&ofertas=1
function listar(req, res) {
  const filtros = [CONDICAO_VISIVEL_NA_LOJA];
  const parametros = { hoje: hoje() };

  if (req.query.categoria) {
    filtros.push('c.slug = @categoria');
    parametros.categoria = String(req.query.categoria);
  }
  if (req.query.ofertas === '1') {
    filtros.push('p.em_oferta = 1');
  }
  if (req.query.busca) {
    const busca = String(req.query.busca).trim().slice(0, 60);
    // escapa % e _ para o usuário não conseguir "curingas" no LIKE
    parametros.busca = `%${busca.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    filtros.push("(p.nome LIKE @busca ESCAPE '\\' OR p.descricao LIKE @busca ESCAPE '\\')");
  }

  const linhas = db.prepare(`
    ${SELECT_PRODUTO}
    WHERE ${filtros.join(' AND ')}
    ORDER BY (p.estoque > 0) DESC, p.em_oferta DESC, c.id, p.nome
  `).all(parametros);

  res.json({ total: linhas.length, produtos: linhas.map(formatarProduto) });
}

// GET /api/produtos/:id
function obter(req, res) {
  const id = validar.id(req.params.id);
  const linha = db.prepare(`${SELECT_PRODUTO} WHERE p.id = @id AND ${CONDICAO_VISIVEL_NA_LOJA}`).get({ id, hoje: hoje() });
  if (!linha) throw new ErroHttp(404, 'Produto não encontrado.');
  res.json({ produto: formatarProduto(linha) });
}

// Junta itens repetidos e valida o formato [{ produtoId, quantidade }]
function normalizarItens(itens) {
  if (!Array.isArray(itens) || itens.length === 0) throw new ErroHttp(400, 'O carrinho está vazio.');
  if (itens.length > 50) throw new ErroHttp(400, 'O carrinho pode ter no máximo 50 produtos diferentes.');
  const mapa = new Map();
  for (const item of itens) {
    const produtoId = validar.id(item && item.produtoId, 'produtoId');
    const quantidade = validar.inteiro(item && item.quantidade, 'quantidade', { min: 1, max: 99 });
    mapa.set(produtoId, Math.min(99, (mapa.get(produtoId) || 0) + quantidade));
  }
  return [...mapa].map(([produtoId, quantidade]) => ({ produtoId, quantidade }));
}

// POST /api/carrinho/conferir
// O carrinho fica no navegador só com ids e quantidades.
// Os preços e o estoque são SEMPRE consultados aqui no servidor.
function conferirCarrinho(req, res) {
  const itens = normalizarItens(req.body && req.body.itens);
  const buscar = db.prepare(`${SELECT_PRODUTO} WHERE p.id = @id AND ${CONDICAO_VISIVEL_NA_LOJA}`);
  const dataHoje = hoje();

  let totalCentavos = 0;
  const resultado = itens.map(({ produtoId, quantidade }) => {
    const linha = buscar.get({ id: produtoId, hoje: dataHoje });
    if (!linha) {
      return { produtoId, quantidadePedida: quantidade, quantidade: 0, disponivel: false, aviso: 'Este produto não está mais à venda.' };
    }
    const produto = formatarProduto(linha);
    const quantidadeOk = Math.min(quantidade, produto.estoque);
    let aviso = null;
    if (produto.estoque === 0) aviso = 'Produto esgotado.';
    else if (quantidadeOk < quantidade) aviso = `Só temos ${produto.estoque} ${produto.unidade} disponível(is).`;
    const subtotalCentavos = produto.precoVendaCentavos * quantidadeOk;
    totalCentavos += subtotalCentavos;
    return { ...produto, produtoId, quantidadePedida: quantidade, quantidade: quantidadeOk, subtotalCentavos, aviso };
  });

  res.json({ itens: resultado, totalCentavos });
}

module.exports = { listarCategorias, listar, obter, conferirCarrinho, normalizarItens };
