// painel-admin/js/visao-geral.js — dashboard do administrador
import { iniciarPainel } from '/js/painel.js';
import { api } from '/js/api.js';
import { reais, escapar, diaMes, diasAte } from '/js/util.js';

function itemProduto(p, detalhe) {
  return `<li><span class="nome"><img src="${escapar(p.imagem)}" alt="">${escapar(p.nome)}</span><span>${detalhe}</span></li>`;
}

function textoDias(data) {
  const d = diasAte(data);
  if (d === 0) return '<span class="selo selo--pendente">vence hoje</span>';
  if (d === 1) return '<span class="selo selo--pendente">amanhã</span>';
  return `<span class="selo">${diaMes(data)}</span>`;
}

async function iniciar() {
  await iniciarPainel('admin');
  document.getElementById('data-hoje').textContent = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  try {
    const r = await api('/api/admin/resumo');
    const t = r.totais;
    document.getElementById('indicadores').innerHTML = `
      <a class="indicador" href="/admin/produtos.html"><strong>${t.produtos}</strong><span>produtos cadastrados (${t.produtosAtivos} ativos)</span></a>
      <a class="indicador" href="/admin/pedidos.html"><strong>${t.pedidos}</strong><span>pedidos no total</span></a>
      <a class="indicador ${t.pedidosPendentes ? 'indicador--alerta' : ''}" href="/admin/pedidos.html?status=pendente"><strong>${t.pedidosPendentes}</strong><span>pedidos pendentes</span></a>
      <a class="indicador" href="/admin/pedidos.html?status=em_preparacao"><strong>${t.pedidosEmAndamento}</strong><span>em preparação ou a caminho</span></a>
      <div class="indicador"><strong>${reais(t.faturamentoCentavos)}</strong><span>vendido (sem cancelados)</span></div>`;

    document.getElementById('dica-data').textContent = `Ativos com data-limite nos próximos ${r.limites.diasDataLimite} dias.`;
    document.getElementById('dica-estoque').textContent = `Ativos com ${r.limites.estoqueBaixo} unidades ou menos.`;
    const vazio = (msg) => `<li><span class="dica">${msg}</span></li>`;
    document.getElementById('lista-data').innerHTML = r.proximosDataLimite.map((p) => itemProduto(p, textoDias(p.dataLimite))).join('') || vazio('Nenhum produto perto da data-limite.');
    document.getElementById('lista-estoque').innerHTML = r.estoqueBaixo.map((p) => itemProduto(p, `<span class="selo ${p.estoque === 0 ? 'selo--esgotado' : 'selo--pendente'}">${p.estoque} ${escapar(p.unidade)}</span>`)).join('') || vazio('Estoque em dia.');
    document.getElementById('lista-vencidos').innerHTML = r.vencidos.map((p) => itemProduto(p, `<span class="selo selo--vencido">${diaMes(p.dataLimite)}</span>`)).join('') || vazio('Nenhum produto vencido ativo.');
  } catch (erro) {
    document.getElementById('indicadores').innerHTML = `<div class="aviso aviso--erro"><p>${escapar(erro.message)}</p></div>`;
  }
}

iniciar();
