// painel-admin/js/produtos.js — cadastrar, editar, ofertas, ativar/desativar e excluir produtos
import { iniciarPainel, abrirJanela } from '/js/painel.js';
import { api } from '/js/api.js';
import { avisar } from '/js/layout.js';
import { reais, escapar, diaMes, paraCentavos, centavosParaCampo } from '/js/util.js';
import { mostrarErro, comBotaoOcupado } from '/js/formularios.js';
import { icones } from '/js/icones.js';

const NOMES_SITUACAO = { ativo: 'Na loja', inativo: 'Inativo', vencido: 'Vencido', esgotado: 'Esgotado' };
let produtos = [];
let categorias = [];
let editandoId = null;
const filtro = { texto: '', situacao: '' };

const janela = document.getElementById('janela-produto');
const form = document.getElementById('form-produto');
const caixaErro = document.getElementById('erro-produto');

function linhaProduto(p) {
  return `<tr>
    <td><div class="produto-celula"><img src="${escapar(p.imagem)}" alt=""><div><strong>${escapar(p.nome)}</strong><br><span class="dica">por ${escapar(p.unidade)}</span></div></div></td>
    <td>${escapar(p.categoria.nome)}</td>
    <td class="numero">${p.emOferta ? `<s>${reais(p.precoOriginalCentavos)}</s><br><strong style="color:var(--tomate)">${reais(p.precoVendaCentavos)}</strong> <span class="selo" style="background:var(--raiz-clara);color:#7a4f06">-${p.descontoPercentual}%</span>` : reais(p.precoVendaCentavos)}</td>
    <td class="numero">${p.estoque}</td>
    <td>${p.dataLimite ? diaMes(p.dataLimite) + '/' + p.dataLimite.slice(0, 4) : '<span class="dica">—</span>'}</td>
    <td><span class="selo selo--${p.situacao}">${NOMES_SITUACAO[p.situacao]}</span></td>
    <td class="numero"><div class="acoes">
      <button class="botao botao--claro botao--pequeno" type="button" data-editar="${p.id}">${icones.lapis}Editar</button>
      <button class="botao botao--claro botao--pequeno" type="button" data-ativo="${p.id}">${p.ativo ? 'Desativar' : 'Ativar'}</button>
      <button class="botao botao--perigo botao--pequeno" type="button" data-excluir="${p.id}" aria-label="Excluir ${escapar(p.nome)}">${icones.lixeira}</button>
    </div></td>
  </tr>`;
}

function desenhar() {
  const texto = filtro.texto.toLowerCase();
  const visiveis = produtos.filter((p) => {
    if (texto && !p.nome.toLowerCase().includes(texto)) return false;
    if (filtro.situacao === 'oferta') return p.emOferta;
    if (filtro.situacao) return p.situacao === filtro.situacao;
    return true;
  });
  document.getElementById('corpo-tabela').innerHTML = visiveis.length
    ? visiveis.map(linhaProduto).join('')
    : '<tr><td colspan="7" class="vazio">Nenhum produto com esse filtro.</td></tr>';
}

async function carregar() {
  const [{ produtos: lista, unidades }, { categorias: cats }] = await Promise.all([api('/api/admin/produtos'), api('/api/categorias')]);
  produtos = lista;
  if (!categorias.length) {
    categorias = cats;
    form.categoriaId.innerHTML = categorias.map((c) => `<option value="${c.id}">${escapar(c.nome)}</option>`).join('');
    form.unidade.innerHTML = unidades.map((u) => `<option>${u}</option>`).join('');
  }
  desenhar();
}

// ---------------------------------------------------------------- Formulário
function atualizarCamposOferta() {
  const emOferta = form.emOferta.checked;
  document.getElementById('campos-oferta').hidden = !emOferta;
  const original = paraCentavos(form.preco.value);
  const promo = paraCentavos(form.promo.value);
  const resumo = document.getElementById('p-resumo-oferta');
  resumo.textContent = emOferta && original > 0 && promo > 0 && promo < original
    ? `De ${reais(original)} por ${reais(promo)} (${Math.round((1 - promo / original) * 100)}% de desconto)`
    : '';
}

// Desconto em % preenche o preço promocional (e vice-versa)
form.desconto.addEventListener('input', () => {
  const original = paraCentavos(form.preco.value);
  const pct = Number(form.desconto.value);
  if (original > 0 && pct > 0 && pct < 100) form.promo.value = centavosParaCampo(Math.round(original * (1 - pct / 100)));
  atualizarCamposOferta();
});
form.promo.addEventListener('input', () => {
  form.desconto.value = '';
  atualizarCamposOferta();
});
form.preco.addEventListener('input', atualizarCamposOferta);
form.emOferta.addEventListener('change', atualizarCamposOferta);
form.imagem.addEventListener('change', () => {
  document.getElementById('p-previa').src = form.imagem.value.trim() || '/img/produtos/padrao.svg';
});
document.getElementById('p-previa').addEventListener('error', (e) => {
  e.target.src = '/img/produtos/padrao.svg';
});

function abrirFormulario(produto) {
  editandoId = produto ? produto.id : null;
  form.reset();
  mostrarErro(caixaErro, null);
  document.getElementById('titulo-janela').textContent = produto ? `Editar ${produto.nome}` : 'Novo produto';
  if (produto) {
    form.nome.value = produto.nome;
    form.descricao.value = produto.descricao;
    form.categoriaId.value = produto.categoria.id;
    form.unidade.value = produto.unidade;
    form.preco.value = centavosParaCampo(produto.precoOriginalCentavos);
    form.estoque.value = produto.estoque;
    form.emOferta.checked = produto.emOferta;
    form.promo.value = produto.emOferta ? centavosParaCampo(produto.precoVendaCentavos) : '';
    form.dataLimite.value = produto.dataLimite || '';
    form.ativo.checked = produto.ativo;
    form.imagem.value = produto.imagem;
  }
  document.getElementById('p-previa').src = form.imagem.value || '/img/produtos/padrao.svg';
  atualizarCamposOferta();
  abrirJanela(janela);
  form.nome.focus();
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const precoOriginal = paraCentavos(form.preco.value);
  const corpo = {
    nome: form.nome.value.trim(),
    descricao: form.descricao.value.trim(),
    categoriaId: Number(form.categoriaId.value),
    unidade: form.unidade.value,
    precoOriginalCentavos: precoOriginal,
    estoque: Number(form.estoque.value),
    emOferta: form.emOferta.checked,
    precoPromocionalCentavos: form.emOferta.checked ? paraCentavos(form.promo.value) : null,
    dataLimite: form.dataLimite.value || null,
    ativo: form.ativo.checked,
    imagem: form.imagem.value.trim(),
  };
  // Conferências rápidas no navegador (o servidor valida de novo)
  if (corpo.nome.length < 2) return mostrarErro(caixaErro, 'Digite o nome do produto.', form.nome);
  if (!(precoOriginal > 0)) return mostrarErro(caixaErro, 'Digite um preço válido, como 5,99.', form.preco);
  if (!Number.isInteger(corpo.estoque) || corpo.estoque < 0) return mostrarErro(caixaErro, 'O estoque precisa ser um número inteiro (0 ou mais).', form.estoque);
  if (corpo.emOferta && !(corpo.precoPromocionalCentavos > 0 && corpo.precoPromocionalCentavos < precoOriginal)) {
    return mostrarErro(caixaErro, 'O preço promocional precisa ser menor que o preço original.', form.promo);
  }
  if (corpo.emOferta && !corpo.dataLimite) return mostrarErro(caixaErro, 'Ofertas precisam de data-limite.', form.dataLimite);

  try {
    const { mensagem } = await comBotaoOcupado(form.querySelector('[type="submit"]'), 'Salvando...', () =>
      api(editandoId ? `/api/admin/produtos/${editandoId}` : '/api/admin/produtos', { metodo: editandoId ? 'PUT' : 'POST', corpo }));
    janela.close();
    avisar(mensagem);
    carregar();
  } catch (erro) {
    mostrarErro(caixaErro, erro.message);
  }
});

// ---------------------------------------------------------------- Ações da tabela
document.getElementById('corpo-tabela').addEventListener('click', async (e) => {
  const editar = e.target.closest('[data-editar]');
  const ativo = e.target.closest('[data-ativo]');
  const excluir = e.target.closest('[data-excluir]');
  try {
    if (editar) abrirFormulario(produtos.find((p) => p.id === Number(editar.dataset.editar)));
    if (ativo) {
      const produto = produtos.find((p) => p.id === Number(ativo.dataset.ativo));
      const { mensagem } = await api(`/api/admin/produtos/${produto.id}/ativo`, { metodo: 'PATCH', corpo: { ativo: !produto.ativo } });
      avisar(mensagem);
      carregar();
    }
    if (excluir) {
      const produto = produtos.find((p) => p.id === Number(excluir.dataset.excluir));
      if (!window.confirm(`Excluir "${produto.nome}" de vez? Esta ação não pode ser desfeita.`)) return;
      const { mensagem } = await api(`/api/admin/produtos/${produto.id}`, { metodo: 'DELETE' });
      avisar(mensagem);
      carregar();
    }
  } catch (erro) {
    avisar(erro.message, { tipo: 'erro', tempo: 7000 });
  }
});

document.getElementById('filtro-texto').addEventListener('input', (e) => {
  filtro.texto = e.target.value.trim();
  desenhar();
});
document.getElementById('filtro-situacao').addEventListener('click', (e) => {
  const botao = e.target.closest('[data-situacao]');
  if (!botao) return;
  filtro.situacao = botao.dataset.situacao;
  document.querySelectorAll('#filtro-situacao button').forEach((b) => b.setAttribute('aria-pressed', String(b === botao)));
  desenhar();
});

async function iniciar() {
  await iniciarPainel('admin');
  const novo = document.getElementById('novo-produto');
  novo.innerHTML = `${icones.mais} Novo produto`;
  novo.addEventListener('click', () => abrirFormulario(null));
  try {
    await carregar();
  } catch (erro) {
    document.getElementById('corpo-tabela').innerHTML = `<tr><td colspan="7"><div class="aviso aviso--erro"><p>${escapar(erro.message)}</p></div></td></tr>`;
  }
}

iniciar();
