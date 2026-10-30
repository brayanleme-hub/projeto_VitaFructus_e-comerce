// js/componentes.js — pedaços de HTML reaproveitados (card de produto)
import { reais, diaMes, diasAte, escapar } from './util.js';
import { icones } from './icones.js';

function textoValidade(dataLimite) {
  const dias = diasAte(dataLimite);
  if (dias === 0) return 'Oferta válida só hoje';
  if (dias === 1) return 'Oferta válida até amanhã';
  return `Oferta válida até ${diaMes(dataLimite)}`;
}

// Card de produto. O botão leva data-produto com o id; quem usa o card cuida do clique.
export function cardProduto(p) {
  const esgotado = !p.disponivel;
  const classes = ['produto', p.emOferta ? 'produto--oferta' : '', esgotado ? 'produto--esgotado' : ''].join(' ');
  const poucos = !esgotado && p.estoque <= 5;
  return `
  <article class="${classes}" aria-labelledby="produto-${p.id}">
    ${p.descontoPercentual > 0 ? `<span class="desconto" aria-label="${p.descontoPercentual}% de desconto">-${p.descontoPercentual}%</span>` : ''}
    ${esgotado ? '<span class="selo selo--esgotado selo-esgotado">Esgotado</span>' : ''}
    <img class="produto__imagem" src="${escapar(p.imagem)}" alt="" loading="lazy" width="480" height="360">
    <div class="produto__corpo">
      <span class="produto__categoria">${escapar(p.categoria.nome)}</span>
      <h3 class="produto__nome" id="produto-${p.id}">${escapar(p.nome)}</h3>
      <p class="produto__descricao">${escapar(p.descricao)}</p>
      <div class="produto__rodape">
        <p class="plaquinha" aria-label="${p.emOferta ? `De ${reais(p.precoOriginalCentavos)} por ` : ''}${reais(p.precoVendaCentavos)} por ${escapar(p.unidade)}">
          ${p.emOferta ? `<span class="plaquinha__de">${reais(p.precoOriginalCentavos)}</span>` : ''}
          <span class="plaquinha__por">${reais(p.precoVendaCentavos)} <small>/${escapar(p.unidade)}</small></span>
        </p>
        ${p.emOferta && p.dataLimite ? `<span class="produto__info-oferta">${icones.relogio}${textoValidade(p.dataLimite)}</span>` : ''}
        ${poucos ? `<span class="produto__estoque">Restam só ${p.estoque}</span>` : ''}
        <button class="botao ${p.emOferta ? 'botao--oferta' : ''}" type="button" data-produto="${p.id}" ${esgotado ? 'disabled' : ''}>
          ${esgotado ? 'Esgotado' : `${icones.carrinho} Adicionar<span class="so-desktop"> ao carrinho</span>`}
        </button>
      </div>
    </div>
  </article>`;
}
