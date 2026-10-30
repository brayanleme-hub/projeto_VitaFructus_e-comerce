// painel-entregador/js/entregas.js — RF14: o entregador vê as entregas dele e atualiza o andamento
import { iniciarPainel } from '/js/painel.js';
import { api } from '/js/api.js';
import { avisar } from '/js/layout.js';
import { reais, escapar, dataHora, quantidadeComUnidade, telefoneFormatado, NOMES_STATUS } from '/js/util.js';

function cartaoEntrega(p) {
  const mapa = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.enderecoEntrega)}`;
  return `<article class="cartao entrega" aria-labelledby="entrega-${p.id}">
    <div class="pedido__cabeca"><h2 id="entrega-${p.id}">Pedido nº ${p.id}</h2><span class="selo selo--${p.status}">${NOMES_STATUS[p.status]}</span></div>
    <dl>
      <dt>Cliente</dt><dd>${escapar(p.cliente.nome)}${p.cliente.telefone ? `, <a href="tel:${escapar(p.cliente.telefone)}">${telefoneFormatado(p.cliente.telefone)}</a>` : ''}</dd>
      <dt>Endereço</dt><dd>${escapar(p.enderecoEntrega)}<br><a href="${mapa}" target="_blank" rel="noopener">Abrir no mapa</a></dd>
      <dt>Itens</dt><dd>${p.itens.map((i) => `${quantidadeComUnidade(i.quantidade, i.unidade)} de ${escapar(i.nome)}`).join('<br>')}</dd>
      <dt>Total (já pago, simulação)</dt><dd>${reais(p.totalCentavos)}</dd>
    </dl>
    <div class="entrega__acoes">
      ${p.status === 'em_preparacao' ? `<button class="botao botao--grande" type="button" data-status="saiu_para_entrega" data-pedido="${p.id}">Peguei o pedido: saí para entrega</button>` : ''}
      ${p.status === 'saiu_para_entrega' ? `<button class="botao botao--grande" type="button" data-status="entregue" data-pedido="${p.id}">Confirmar entrega</button>` : ''}
    </div>
  </article>`;
}

async function carregar() {
  try {
    const { entregas } = await api('/api/entregas');
    const abertas = entregas.filter((e) => e.status !== 'entregue');
    const concluidas = entregas.filter((e) => e.status === 'entregue');
    document.getElementById('lista-entregas').innerHTML = abertas.length
      ? abertas.map(cartaoEntrega).join('')
      : '<div class="cartao vazio"><img src="/img/produtos/padrao.svg" alt=""><p>Nenhuma entrega para você agora.</p></div>';
    document.getElementById('lista-concluidas').innerHTML = concluidas.length
      ? concluidas.map((p) => `<li><span>Pedido nº ${p.id}, ${escapar(p.cliente.nome)}</span><span class="dica">${dataHora(p.atualizadoEm)}</span></li>`).join('')
      : '<li><span class="dica">Nenhuma entrega concluída ainda.</span></li>';
  } catch (erro) {
    document.getElementById('lista-entregas').innerHTML = `<div class="aviso aviso--erro"><p>${escapar(erro.message)}</p></div>`;
  }
}

document.getElementById('lista-entregas').addEventListener('click', async (e) => {
  const botao = e.target.closest('[data-status]');
  if (!botao) return;
  try {
    botao.disabled = true;
    const { mensagem } = await api(`/api/entregas/${botao.dataset.pedido}/status`, { metodo: 'PATCH', corpo: { status: botao.dataset.status } });
    avisar(mensagem);
    carregar();
  } catch (erro) {
    botao.disabled = false;
    avisar(erro.message, { tipo: 'erro' });
  }
});
document.getElementById('atualizar').addEventListener('click', carregar);

iniciarPainel('entregador').then(carregar);
