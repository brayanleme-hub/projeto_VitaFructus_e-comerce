// js/paginas/checkout.js — finalizar pedido com pagamento SIMULADO
import { iniciarLayout } from '../layout.js';
import { api } from '../api.js';
import { itensDoCarrinho, limpar } from '../carrinho.js';
import { reais, escapar, quantidadeComUnidade, NOMES_PAGAMENTO } from '../util.js';
import { camposEndereco, aplicarMascaraCep, lerEndereco, validarEndereco, mostrarErro, comBotaoOcupado } from '../formularios.js';
import { icones } from '../icones.js';

const area = document.getElementById('area-checkout');

// Desenho de "QR Code" puramente decorativo, gerado no navegador. NÃO é um Pix de verdade.
function qrDemonstrativo() {
  let quadrados = '';
  let semente = 7;
  for (let y = 0; y < 21; y++) {
    for (let x = 0; x < 21; x++) {
      semente = (semente * 9301 + 49297) % 233280;
      const canto = (x < 7 && y < 7) || (x > 13 && y < 7) || (x < 7 && y > 13);
      if (canto ? (x % 6 === 0 || y % 6 === 0 || (x % 7 > 1 && x % 7 < 5 && y % 7 > 1 && y % 7 < 5)) : semente / 233280 > 0.55) {
        quadrados += `<rect x="${x}" y="${y}" width="1" height="1"/>`;
      }
    }
  }
  return `<svg viewBox="0 0 21 21" aria-hidden="true">${quadrados}</svg>`;
}

const DESCRICOES_PAGAMENTO = {
  pix: 'Mostramos um código de demonstração. Nenhum Pix é gerado.',
  debito: 'Simulação: não pedimos número do cartão nem senha.',
  credito: 'Simulação: não pedimos número do cartão nem código de segurança.',
};

function painelPagamento(forma) {
  if (forma === 'pix') {
    return `<div class="pix-demo">
      <div class="pix-demo__codigo">${qrDemonstrativo()}<span>DEMONSTRAÇÃO</span></div>
      <p>Num site real, aqui apareceria o QR Code do Pix para você pagar no app do banco.<br><strong>Neste projeto o pagamento é simulado e aprovado automaticamente.</strong></p>
    </div>`;
  }
  return `<p style="margin-top:14px">Num site real, os dados do cartão seriam digitados numa página segura do banco ou da operadora.
    <strong>Aqui nenhum dado de cartão é solicitado</strong> e o pagamento é aprovado automaticamente como simulação.</p>`;
}

function telaSucesso(pedido) {
  area.innerHTML = `
    <section class="cartao sucesso">
      <img src="/img/produtos/padrao.svg" alt="">
      <h1>Pedido confirmado!</h1>
      <p class="sucesso__numero">Nº ${pedido.id}</p>
      <p>Total de <strong>${reais(pedido.totalCentavos)}</strong> no ${escapar(NOMES_PAGAMENTO[pedido.formaPagamento])}.</p>
      <p class="selo-simulacao" style="justify-content:center">${icones.info} Pagamento simulado: nenhuma cobrança real foi feita.</p>
      <p style="margin-top:16px">Entrega em: ${escapar(pedido.enderecoEntrega)}</p>
      <div class="hero__acoes" style="justify-content:center">
        <a class="botao botao--grande" href="/meus-pedidos.html">Acompanhar pedido</a>
        <a class="botao botao--grande botao--claro" href="/">Voltar para a loja</a>
      </div>
    </section>`;
  window.scrollTo(0, 0);
}

async function iniciar() {
  const usuario = await iniciarLayout();
  if (!usuario) {
    location.replace('/login.html?voltar=/checkout.html');
    return;
  }
  if (usuario.tipo !== 'cliente') {
    area.innerHTML = '<div class="aviso aviso--alerta"><p>Esta conta é da equipe da loja. Para comprar, entre com uma conta de cliente.</p></div>';
    return;
  }
  const itensLocais = itensDoCarrinho();
  if (!itensLocais.length) {
    location.replace('/carrinho.html');
    return;
  }

  let conferencia;
  let enderecos;
  try {
    [conferencia, { enderecos }] = await Promise.all([
      api('/api/carrinho/conferir', { metodo: 'POST', corpo: { itens: itensLocais } }),
      api('/api/enderecos'),
    ]);
  } catch (erro) {
    area.innerHTML = `<div class="aviso aviso--erro"><p>${escapar(erro.message)}</p></div>`;
    return;
  }

  const itens = conferencia.itens.filter((i) => i.quantidade > 0);
  const problemas = conferencia.itens.filter((i) => i.aviso);
  if (!itens.length) {
    location.replace('/carrinho.html');
    return;
  }

  area.innerHTML = `
    <h1 class="pagina__titulo">Finalizar pedido</h1>
    <p class="selo-simulacao">${icones.info} Projeto acadêmico: o pagamento é simulado e nenhuma cobrança real será feita.</p>
    ${problemas.length ? `<div class="aviso aviso--alerta" style="margin-top:16px"><p>Alguns itens mudaram desde que você os adicionou. <a href="/carrinho.html">Revise o carrinho</a> se quiser.</p></div>` : ''}
    <div class="aviso aviso--erro" id="erro-checkout" role="alert" hidden style="margin-top:16px"></div>
    <form class="duas-colunas" id="form-checkout" novalidate style="margin-top:20px">
      <div>
        <section class="cartao bloco-checkout" aria-labelledby="titulo-endereco">
          <h2 id="titulo-endereco">1. Endereço de entrega</h2>
          <div class="opcoes" id="opcoes-endereco">
            ${enderecos.map((e, i) => `
              <label class="opcao"><input type="radio" name="endereco" value="${e.id}" ${i === 0 ? 'checked' : ''}>
                <span>${escapar(e.resumo)}</span></label>`).join('')}
            <label class="opcao"><input type="radio" name="endereco" value="novo" ${enderecos.length ? '' : 'checked'}>
              <span><strong>Entregar em outro endereço</strong></span></label>
          </div>
          <div class="grade-campos" id="novo-endereco" style="margin-top:16px" ${enderecos.length ? 'hidden' : ''}>${camposEndereco('chk')}</div>
        </section>

        <section class="cartao bloco-checkout" aria-labelledby="titulo-pagamento">
          <h2 id="titulo-pagamento">2. Forma de pagamento</h2>
          <div class="opcoes opcoes--pagamento">
            ${['pix', 'debito', 'credito'].map((f, i) => `
              <label class="opcao"><input type="radio" name="pagamento" value="${f}" ${i === 0 ? 'checked' : ''}>
                ${f === 'pix' ? icones.pix : icones.cartao}<strong>${NOMES_PAGAMENTO[f]}</strong></label>`).join('')}
          </div>
          <p class="dica" id="descricao-pagamento" style="margin:12px 0 0">${DESCRICOES_PAGAMENTO.pix}</p>
          <div id="painel-pagamento">${painelPagamento('pix')}</div>
        </section>
      </div>

      <aside class="cartao resumo" aria-labelledby="titulo-resumo">
        <h2 id="titulo-resumo">3. Confira seu pedido</h2>
        ${itens.map((i) => `
          <div class="resumo__linha"><span>${escapar(i.nome)} <small>(${quantidadeComUnidade(i.quantidade, i.unidade)})</small></span><span>${reais(i.subtotalCentavos)}</span></div>`).join('')}
        <div class="resumo__linha"><span>Entrega</span><span>Sem custo</span></div>
        <div class="resumo__linha resumo__total"><span>Total</span><span>${reais(conferencia.totalCentavos)}</span></div>
        <button class="botao botao--grande botao--bloco" type="submit" style="margin-top:16px">Confirmar pedido</button>
        <a class="botao botao--claro botao--bloco" href="/carrinho.html" style="margin-top:10px">Voltar ao carrinho</a>
        <p class="resumo__nota">O total final é calculado pelo servidor com os preços de agora.</p>
      </aside>
    </form>`;

  const form = document.getElementById('form-checkout');
  const novoEndereco = document.getElementById('novo-endereco');
  const caixaErro = document.getElementById('erro-checkout');
  aplicarMascaraCep(novoEndereco.querySelector('[name="cep"]'));

  form.addEventListener('change', (e) => {
    if (e.target.name === 'endereco') novoEndereco.hidden = e.target.value !== 'novo';
    if (e.target.name === 'pagamento') {
      document.getElementById('descricao-pagamento').textContent = DESCRICOES_PAGAMENTO[e.target.value];
      document.getElementById('painel-pagamento').innerHTML = painelPagamento(e.target.value);
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const escolhaEndereco = form.endereco.value;
    // Só ids e quantidades vão para o servidor. Nenhum preço é enviado.
    const corpo = {
      itens: itens.map((i) => ({ produtoId: i.produtoId, quantidade: i.quantidade })),
      formaPagamento: form.pagamento.value,
    };
    if (escolhaEndereco === 'novo') {
      corpo.novoEndereco = lerEndereco(novoEndereco);
      const erro = validarEndereco(corpo.novoEndereco);
      if (erro) return mostrarErro(caixaErro, erro);
    } else {
      corpo.enderecoId = Number(escolhaEndereco);
    }

    try {
      const { pedido } = await comBotaoOcupado(form.querySelector('[type="submit"]'), 'Registrando pedido...', () =>
        api('/api/pedidos', { metodo: 'POST', corpo }));
      limpar();
      telaSucesso(pedido);
    } catch (erro) {
      mostrarErro(caixaErro, erro.status === 409 ? `${erro.message} Revise o carrinho.` : erro.message);
    }
  });
}

iniciar();
