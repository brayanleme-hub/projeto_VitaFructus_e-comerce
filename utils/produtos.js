// utils/produtos.js
// Regras de negócio dos produtos, reaproveitadas pela loja e pelo painel.

const { hoje } = require('./datas');

// Um produto aparece na loja somente se:
// - estiver ativo, e
// - não tiver passado da data-limite de comercialização.
// (Produto esgotado aparece, mas com o botão desativado.)
const CONDICAO_VISIVEL_NA_LOJA = `
  p.ativo = 1 AND (p.data_limite IS NULL OR p.data_limite >= @hoje)
`;

const SELECT_PRODUTO = `
  SELECT p.*, c.nome AS categoria_nome, c.slug AS categoria_slug
  FROM produtos p
  JOIN categorias c ON c.id = p.categoria_id
`;

function descontoPercentual(original, venda) {
  if (!original || venda >= original) return 0;
  return Math.round((1 - venda / original) * 100);
}

// Situação do produto para o painel
function situacao(linha, dataHoje = hoje()) {
  if (!linha.ativo) return 'inativo';
  if (linha.data_limite && linha.data_limite < dataHoje) return 'vencido';
  if (linha.estoque <= 0) return 'esgotado';
  return 'ativo';
}

// Transforma a linha do banco (snake_case) no formato da API (camelCase)
function formatarProduto(linha) {
  const dataHoje = hoje();
  return {
    id: linha.id,
    nome: linha.nome,
    descricao: linha.descricao,
    categoria: { id: linha.categoria_id, nome: linha.categoria_nome, slug: linha.categoria_slug },
    unidade: linha.unidade,
    precoOriginalCentavos: linha.preco_original_centavos,
    precoVendaCentavos: linha.preco_venda_centavos,
    descontoPercentual: descontoPercentual(linha.preco_original_centavos, linha.preco_venda_centavos),
    emOferta: linha.em_oferta === 1,
    estoque: linha.estoque,
    disponivel: situacao(linha, dataHoje) === 'ativo',
    dataLimite: linha.data_limite,
    imagem: linha.imagem,
    ativo: linha.ativo === 1,
    situacao: situacao(linha, dataHoje),
    criadoEm: linha.criado_em,
    atualizadoEm: linha.atualizado_em,
  };
}

module.exports = { CONDICAO_VISIVEL_NA_LOJA, SELECT_PRODUTO, formatarProduto, descontoPercentual, situacao };
