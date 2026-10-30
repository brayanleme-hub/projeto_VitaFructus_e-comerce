// painel-admin/js/pedidos.js — consultar pedidos, mudar status e escolher entregador
import { iniciarPainel, abrirJanela } from '/js/painel.js';
import { api } from '/js/api.js';
import { avisar } from '/js/layout.js';
import { reais, escapar, dataHora, quantidadeComUnidade, telefoneFormatado, NOMES_STATUS, NOMES_PAGAMENTO, NOMES_SITUACAO_PAGAMENTO, parametro } from '/js/util.js';

const TEXTO_BOTAO_STATUS = {
  em_preparacao: 'Começar a preparar',
  saiu_para_entrega: 'Marcar como saiu para entrega',
  entregue: 'Confirmar entrega',
  cancelado: 'Cancelar pedido',
};

let pedidos = [];
let entregadores = [];
let statusFiltro = parametro('status') || '';
const janela = document.getElementById('janela-pedido');

function desenharAbas() {
  const opcoes = [['', 'Todos'], ...Object.entries(NOMES_STATUS)];
  document.getElementById('filtro-status').innerHTML = opcoes
    .map(([valor, nome]) => `<button type="button" data-status="${valor}" aria-pressed="${valor === statusFiltro}">${nome}</button>`).join('');
}

function desenharTabela() {
  document.getElementById('corpo-tabela').innerHTML = pedidos.length
    ? pedidos.map((p) => `<tr>
        <td><strong>${p.id}</strong></td>
        <td>${dataHora(p.criadoEm)}</td>
        <td>${escapar(p.cliente.nome)}</td>
        <td>${NOMES_PAGAMENTO[p.formaPagamento]}</td>
        <td class="numero">${reais(p.totalCentavos)}</td>
        <td><span class="selo selo--${p.status}">${NOMES_STATUS[p.status]}</span></td>
        <td>${p.entregador ? escapar(p.entregador.nome) : '<span class="dica">—</span>'}</td>
        <td class="numero"><button class="botao botao--claro botao--pequeno" type="button" data-abrir="${p.id}">Ver e atualizar</button></td>
      </tr>`).join('')
    : '<tr><td colspan="8" class="vazio">Nenhum pedido com esse status.</td></tr>';
}

async function carregar() {
  const [lista, ents] = await Promise.all([
    api(`/api/admin/pedidos${statusFiltro ? `?status=${statusFiltro}` : ''}`),
    api('/api/admin/entregadores'),
  ]);
  pedidos = lista.pedidos;
  entregadores = ents.entregadores.filter((e) => e.ativo);
  desenharTabela();
}

function detalhe(p) {
  const podeEscolherEntregador = ['pendente', 'em_preparacao'].includes(p.status);
  return `
    <p><span class="selo selo--${p.status}">${NOMES_STATUS[p.status]}</span> &nbsp; <span class="dica">Feito em ${dataHora(p.criadoEm)}</span></p>
    <div class="paineis" style="margin-bottom:16px">
      <div><h3>Cliente</h3><p>${escapar(p.cliente.nome)}<br>${escapar(p.cliente.email)}${p.cliente.telefone ? `<br>${telefoneFormatado(p.cliente.telefone)}` : ''}</p></div>
      <div><h3>Entrega</h3><p>${escapar(p.enderecoEntrega)}</p></div>
    </div>
    <h3>Itens</h3>
    <table class="tabela-itens">
      <thead><tr><th>Produto</th><th>Qtd.</th><th>Preço</th><th>Subtotal</th></tr></thead>
      <tbody>${p.itens.map((i) => `<tr><td>${escapar(i.nome)}</td><td>${quantidadeComUnidade(i.quantidade, i.unidade)}</td><td>${reais(i.precoUnitarioCentavos)}</td><td>${reais(i.subtotalCentavos)}</td></tr>`).join('')}</tbody>
    </table>
    <div class="pedido__rodape">
      <span><strong>Pagamento:</strong> ${NOMES_PAGAMENTO[p.formaPagamento]} — ${NOMES_SITUACAO_PAGAMENTO[p.statusPagamento]}</span>
      <span class="pedido__total">${reais(p.totalCentavos)}</span>
    </div>
    <hr class="separador">
    <div class="campo">
      <label for="escolha-entregador">Entregador responsável</label>
      ${podeEscolherEntregador
        ? `<select class="entrada" id="escolha-entregador" data-pedido="${p.id}">
            <option value="">Nenhum</option>
            ${entregadores.map((e) => `<option value="${e.id}" ${p.entregador && p.entregador.id === e.id ? 'selected' : ''}>${escapar(e.nome)}</option>`).join('')}
          </select>
          ${entregadores.length ? '' : '<span class="dica">Cadastre um entregador em <a href="/admin/entregadores.html">Entregadores</a>.</span>'}`
        : `<p>${p.entregador ? escapar(p.entregador.nome) : 'Nenhum'}</p>`}
    </div>
    ${p.proximosStatus.length ? `<h3>Próximo passo</h3><div class="hero__acoes" style="margin-top:8px">
      ${p.proximosStatus.map((s) => `<button class="botao ${s === 'cancelado' ? 'botao--perigo' : ''}" type="button" data-status-novo="${s}" data-pedido="${p.id}">${TEXTO_BOTAO_STATUS[s]}</button>`).join('')}
    </div>` : '<p class="dica">Este pedido está finalizado.</p>'}
    ${p.status === 'em_preparacao' && !p.entregador ? '<p class="dica" style="margin-top:10px">Escolha um entregador antes de marcar como saiu para entrega.</p>' : ''}`;
}

async function abrirPedido(id) {
  const { pedido } = await api(`/api/admin/pedidos/${id}`);
  document.getElementById('titulo-pedido').textContent = `Pedido nº ${pedido.id}`;
  document.getElementById('detalhe-pedido').innerHTML = detalhe(pedido);
  if (!janela.open) abrirJanela(janela);
}

document.getElementById('corpo-tabela').addEventListener('click', (e) => {
  const botao = e.target.closest('[data-abrir]');
  if (botao) abrirPedido(Number(botao.dataset.abrir)).catch((erro) => avisar(erro.message, { tipo: 'erro' }));
});

document.getElementById('detalhe-pedido').addEventListener('click', async (e) => {
  const botao = e.target.closest('[data-status-novo]');
  if (!botao) return;
  const novo = botao.dataset.statusNovo;
  if (novo === 'cancelado' && !window.confirm('Cancelar este pedido? Os produtos voltam para o estoque.')) return;
  try {
    const { mensagem } = await api(`/api/admin/pedidos/${botao.dataset.pedido}/status`, { metodo: 'PATCH', corpo: { status: novo } });
    avisar(mensagem);
    await abrirPedido(Number(botao.dataset.pedido));
    carregar();
  } catch (erro) {
    avisar(erro.message, { tipo: 'erro', tempo: 7000 });
  }
});

document.getElementById('detalhe-pedido').addEventListener('change', async (e) => {
  if (e.target.id !== 'escolha-entregador') return;
  try {
    const { mensagem } = await api(`/api/admin/pedidos/${e.target.dataset.pedido}/entregador`, {
      metodo: 'PATCH', corpo: { entregadorId: e.target.value ? Number(e.target.value) : null },
    });
    avisar(mensagem);
    await abrirPedido(Number(e.target.dataset.pedido));
    carregar();
  } catch (erro) {
    avisar(erro.message, { tipo: 'erro' });
  }
});

document.getElementById('filtro-status').addEventListener('click', (e) => {
  const botao = e.target.closest('[data-status]');
  if (!botao) return;
  statusFiltro = botao.dataset.status;
  history.replaceState(null, '', statusFiltro ? `?status=${statusFiltro}` : location.pathname);
  desenharAbas();
  carregar();
});
document.getElementById('atualizar').addEventListener('click', () => carregar());

async function iniciar() {
  await iniciarPainel('admin');
  desenharAbas();
  try {
    await carregar();
  } catch (erro) {
    document.getElementById('corpo-tabela').innerHTML = `<tr><td colspan="8"><div class="aviso aviso--erro"><p>${escapar(erro.message)}</p></div></td></tr>`;
  }
}

iniciar();
