// js/paginas/meus-pedidos.js — RF06 e RF15: o cliente consulta pedidos e acompanha a entrega
import { iniciarLayout } from '../layout.js';
import { api } from '../api.js';
import { reais, escapar, dataHora, quantidadeComUnidade, NOMES_STATUS, NOMES_PAGAMENTO, NOMES_SITUACAO_PAGAMENTO } from '../util.js';

const ETAPAS = ['pendente', 'em_preparacao', 'saiu_para_entrega', 'entregue'];
const lista = document.getElementById('lista-pedidos');

function linhaDoTempo(status) {
  if (status === 'cancelado') return '<p class="aviso aviso--erro">Este pedido foi cancelado. O pagamento simulado foi estornado.</p>';
  const atual = ETAPAS.indexOf(status);
  return `<ol class="linha-tempo" aria-label="Andamento do pedido">
    ${ETAPAS.map((etapa, i) => `<li class="${i <= atual ? 'feito' : ''}" ${i === atual ? 'aria-current="step"' : ''}>${NOMES_STATUS[etapa]}</li>`).join('')}
  </ol>`;
}

function cartaoPedido(p) {
  return `
  <article class="cartao" aria-labelledby="pedido-${p.id}">
    <div class="pedido__cabeca">
      <div>
        <h2 id="pedido-${p.id}">Pedido nº ${p.id}</h2>
        <span class="pedido__data">${dataHora(p.criadoEm)}</span>
      </div>
      <span class="selo selo--${p.status}">${NOMES_STATUS[p.status]}</span>
    </div>
    ${linhaDoTempo(p.status)}
    <table class="tabela-itens">
      <thead><tr><th>Produto</th><th>Quantidade</th><th>Preço</th><th>Subtotal</th></tr></thead>
      <tbody>
        ${p.itens.map((i) => `<tr><td>${escapar(i.nome)}</td><td>${quantidadeComUnidade(i.quantidade, i.unidade)}</td><td>${reais(i.precoUnitarioCentavos)}</td><td>${reais(i.subtotalCentavos)}</td></tr>`).join('')}
      </tbody>
    </table>
    <div class="pedido__rodape">
      <div>
        <div><strong>Pagamento:</strong> ${NOMES_PAGAMENTO[p.formaPagamento]} — ${NOMES_SITUACAO_PAGAMENTO[p.statusPagamento]}</div>
        <div><strong>Entrega:</strong> ${escapar(p.enderecoEntrega)}</div>
        ${p.entregador ? `<div><strong>Entregador:</strong> ${escapar(p.entregador.nome)}</div>` : ''}
      </div>
      <span class="pedido__total">${reais(p.totalCentavos)}</span>
    </div>
  </article>`;
}

async function carregar() {
  try {
    const { pedidos } = await api('/api/pedidos');
    lista.innerHTML = pedidos.length
      ? pedidos.map(cartaoPedido).join('')
      : `<div class="cartao vazio"><img src="/img/produtos/padrao.svg" alt=""><h2>Você ainda não fez pedidos</h2>
         <a class="botao botao--grande" href="/#produtos">Escolher produtos</a></div>`;
  } catch (erro) {
    lista.innerHTML = `<div class="aviso aviso--erro"><p>${escapar(erro.message)}</p></div>`;
  }
}

async function iniciar() {
  const usuario = await iniciarLayout();
  if (!usuario) {
    location.replace('/login.html?voltar=/meus-pedidos.html');
    return;
  }
  document.getElementById('atualizar').addEventListener('click', carregar);
  carregar();
}

iniciar();
