// js/paginas/carrinho.js — página do carrinho
// Os itens vêm do localStorage, mas preço, nome e estoque são conferidos no servidor.
import { iniciarLayout, avisar } from '../layout.js';
import { api } from '../api.js';
import { itensDoCarrinho, definirQuantidade, remover, aoMudar } from '../carrinho.js';
import { reais, escapar, quantidadeComUnidade } from '../util.js';
import { icones } from '../icones.js';

const area = document.getElementById('area-carrinho');
let conferencia = null; // última resposta do servidor

function carrinhoVazio() {
  area.innerHTML = `
    <div class="cartao vazio">
      <img src="/img/produtos/padrao.svg" alt="">
      <h2>Seu carrinho está vazio</h2>
      <p>Que tal começar pelas ofertas do dia?</p>
      <a class="botao botao--grande" href="/#ofertas">Ver ofertas</a>
    </div>`;
}

function desenhar() {
  const itens = conferencia.itens;
  const validos = itens.filter((i) => i.quantidade > 0);
  const quantidadeItens = validos.reduce((s, i) => s + i.quantidade, 0);
  const economia = validos.reduce((s, i) => s + (i.precoOriginalCentavos - i.precoVendaCentavos) * i.quantidade, 0);

  area.innerHTML = `
    <div class="duas-colunas">
      <ul class="lista-carrinho">
        ${itens.map((item) => (item.nome ? `
          <li class="item-carrinho">
            <img src="${escapar(item.imagem)}" alt="" width="480" height="360">
            <div>
              <h3>${escapar(item.nome)}</h3>
              <div class="item-carrinho__preco">
                ${item.emOferta ? `<s>${reais(item.precoOriginalCentavos)}</s> ` : ''}${reais(item.precoVendaCentavos)} / ${escapar(item.unidade)}
                ${item.emOferta ? '<span class="selo" style="background:var(--raiz-clara);color:#7a4f06">Oferta</span>' : ''}
              </div>
              ${item.aviso ? `<p class="aviso aviso--alerta">${escapar(item.aviso)}</p>` : ''}
            </div>
            <div class="item-carrinho__lado">
              <div class="quantidade" role="group" aria-label="Quantidade de ${escapar(item.nome)}">
                <button type="button" data-menos="${item.produtoId}" aria-label="Diminuir" ${item.quantidade <= 1 ? 'disabled' : ''}>−</button>
                <output aria-live="polite">${quantidadeComUnidade(item.quantidade, item.unidade)}</output>
                <button type="button" data-mais="${item.produtoId}" aria-label="Aumentar" ${item.quantidade >= item.estoque ? 'disabled' : ''}>+</button>
              </div>
              <span class="item-carrinho__subtotal">${reais(item.subtotalCentavos)}</span>
              <button class="link-remover" type="button" data-remover="${item.produtoId}">Remover</button>
            </div>
          </li>` : `
          <li class="item-carrinho">
            <img src="/img/produtos/padrao.svg" alt="" width="480" height="360">
            <div><h3>Produto indisponível</h3><p class="aviso aviso--alerta">${escapar(item.aviso)}</p></div>
            <div class="item-carrinho__lado"><button class="link-remover" type="button" data-remover="${item.produtoId}">Remover</button></div>
          </li>`)).join('')}
      </ul>
      <aside class="cartao resumo" aria-labelledby="titulo-resumo">
        <h2 id="titulo-resumo">Resumo</h2>
        <div class="resumo__linha"><span>Itens</span><span>${quantidadeItens}</span></div>
        ${economia > 0 ? `<div class="resumo__linha" style="color:var(--sucesso)"><span>Você economiza</span><strong>${reais(economia)}</strong></div>` : ''}
        <div class="resumo__linha"><span>Entrega</span><span>Sem custo</span></div>
        <div class="resumo__linha resumo__total"><span>Total</span><span>${reais(conferencia.totalCentavos)}</span></div>
        <a class="botao botao--grande botao--bloco" href="/checkout.html" ${validos.length ? '' : 'aria-disabled="true" onclick="return false"'} style="margin-top:16px">
          Finalizar pedido
        </a>
        <a class="botao botao--claro botao--bloco" href="/#produtos" style="margin-top:10px">Continuar comprando</a>
        <p class="resumo__nota">${icones.escudo.replace('<svg', '<svg style="width:16px;height:16px;vertical-align:-3px"')} Os preços são conferidos de novo quando você confirma o pedido.</p>
      </aside>
    </div>`;
}

async function conferir() {
  const itens = itensDoCarrinho();
  if (!itens.length) return carrinhoVazio();
  try {
    conferencia = await api('/api/carrinho/conferir', { metodo: 'POST', corpo: { itens } });
    // Se o servidor reduziu alguma quantidade (estoque menor), ajusta o carrinho local
    for (const item of conferencia.itens) {
      if (item.quantidade > 0 && item.quantidade !== item.quantidadePedida) definirQuantidade(item.produtoId, item.quantidade);
    }
    desenhar();
  } catch (erro) {
    area.innerHTML = `<div class="aviso aviso--erro"><p>${escapar(erro.message)}</p></div>`;
  }
}

area.addEventListener('click', (e) => {
  const mais = e.target.closest('[data-mais]');
  const menos = e.target.closest('[data-menos]');
  const tirar = e.target.closest('[data-remover]');
  if (mais || menos) {
    const id = Number((mais || menos).dataset.mais || (mais || menos).dataset.menos);
    const item = conferencia.itens.find((i) => i.produtoId === id);
    definirQuantidade(id, item.quantidade + (mais ? 1 : -1));
  }
  if (tirar) {
    const id = Number(tirar.dataset.remover);
    const item = conferencia.itens.find((i) => i.produtoId === id);
    remover(id);
    avisar(`${item && item.nome ? item.nome : 'Produto'} removido do carrinho.`);
  }
});

iniciarLayout().then(() => {
  conferir();
  aoMudar(conferir); // qualquer mudança no carrinho recalcula pelo servidor
});
