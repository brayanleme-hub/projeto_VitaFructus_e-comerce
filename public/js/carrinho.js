// js/carrinho.js
// O carrinho fica no localStorage do navegador e guarda SÓ o id do produto e a quantidade.
// Preço, nome e estoque são sempre consultados no servidor (POST /api/carrinho/conferir).

const CHAVE = 'vf-carrinho';
const EVENTO = 'carrinho-mudou';

export function itensDoCarrinho() {
  try {
    const itens = JSON.parse(localStorage.getItem(CHAVE) || '[]');
    return Array.isArray(itens) ? itens.filter((i) => Number.isInteger(i.produtoId) && i.quantidade > 0) : [];
  } catch {
    return [];
  }
}

function salvar(itens) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(itens));
  } catch {
    /* modo privado sem armazenamento */
  }
  // Avisa o resto da página (ex.: o contador do cabeçalho) que o carrinho mudou
  window.dispatchEvent(new CustomEvent(EVENTO, { detail: itens }));
}

export function adicionar(produtoId, quantidade = 1, limite = 99) {
  const itens = itensDoCarrinho();
  const existente = itens.find((i) => i.produtoId === produtoId);
  const atual = existente ? existente.quantidade : 0;
  const nova = Math.min(atual + quantidade, limite, 99);
  if (nova === atual) return false; // chegou no limite do estoque
  if (existente) existente.quantidade = nova;
  else itens.push({ produtoId, quantidade: nova });
  salvar(itens);
  return true;
}

export function definirQuantidade(produtoId, quantidade) {
  const itens = itensDoCarrinho()
    .map((i) => (i.produtoId === produtoId ? { ...i, quantidade } : i))
    .filter((i) => i.quantidade > 0);
  salvar(itens);
}

export function remover(produtoId) {
  salvar(itensDoCarrinho().filter((i) => i.produtoId !== produtoId));
}

export function limpar() {
  salvar([]);
}

export function quantidadeTotal() {
  return itensDoCarrinho().reduce((soma, i) => soma + i.quantidade, 0);
}

export function quantidadeDe(produtoId) {
  const item = itensDoCarrinho().find((i) => i.produtoId === produtoId);
  return item ? item.quantidade : 0;
}

export function aoMudar(funcao) {
  window.addEventListener(EVENTO, funcao);
  // Atualiza também se o carrinho mudar em outra aba
  window.addEventListener('storage', (e) => e.key === CHAVE && funcao());
}
