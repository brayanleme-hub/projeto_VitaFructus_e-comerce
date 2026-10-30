// js/paginas/inicio.js — página inicial: carrossel, ofertas, categorias, busca e produtos
import { iniciarLayout, avisar } from '../layout.js';
import { api } from '../api.js';
import { adicionar, quantidadeDe } from '../carrinho.js';
import { cardProduto } from '../componentes.js';
import { icones } from '../icones.js';
import { escapar } from '../util.js';

const IMAGENS_CATEGORIA = {
  '': '/img/produtos/feira.jpg',
  frutas: '/img/produtos/maca.jpg',
  verduras: '/img/produtos/alface.jpg',
  legumes: '/img/produtos/cenoura.jpg',
  ofertas: '/img/produtos/abacate.jpg',
};

// Estado da tela (o que está filtrado agora)
const estado = {
  categoria: new URLSearchParams(location.search).get('categoria') || '',
  busca: new URLSearchParams(location.search).get('busca') || '',
  categorias: [],
  produtosPorId: new Map(),
};

// ---------------------------------------------------------------- Carrossel
function iniciarCarrossel() {
  const faixa = document.getElementById('faixa-carrossel');
  const slides = [...faixa.children];
  const pontos = document.getElementById('pontos-carrossel');
  const reduzirMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    || document.documentElement.classList.contains('sem-animacoes');
  let atual = 0;
  let timer = null;

  document.getElementById('carrossel-anterior').innerHTML = icones.seta_esq;
  document.getElementById('carrossel-proximo').innerHTML = icones.seta_dir;
  pontos.innerHTML = slides.map((_, i) => `<button type="button" aria-label="Ir para o destaque ${i + 1}"></button>`).join('');

  function mostrar(indice) {
    atual = (indice + slides.length) % slides.length;
    faixa.style.transform = `translateX(-${atual * 100}%)`;
    slides.forEach((s, i) => {
      s.setAttribute('aria-hidden', String(i !== atual));
      s.querySelectorAll('a').forEach((a) => (a.tabIndex = i === atual ? 0 : -1));
    });
    [...pontos.children].forEach((p, i) => p.setAttribute('aria-current', String(i === atual)));
  }
  function iniciarAutomatico() {
    if (reduzirMovimento) return; // respeita quem prefere menos movimento
    parar();
    timer = setInterval(() => mostrar(atual + 1), 6000);
  }
  function parar() {
    clearInterval(timer);
  }

  document.getElementById('carrossel-anterior').addEventListener('click', () => { mostrar(atual - 1); iniciarAutomatico(); });
  document.getElementById('carrossel-proximo').addEventListener('click', () => { mostrar(atual + 1); iniciarAutomatico(); });
  pontos.addEventListener('click', (e) => {
    const i = [...pontos.children].indexOf(e.target.closest('button'));
    if (i >= 0) { mostrar(i); iniciarAutomatico(); }
  });
  // Pausa quando o mouse ou o foco do teclado estão no carrossel
  const area = faixa.closest('.carrossel');
  area.addEventListener('mouseenter', parar);
  area.addEventListener('mouseleave', iniciarAutomatico);
  area.addEventListener('focusin', parar);
  area.addEventListener('focusout', iniciarAutomatico);

  // Botões "Ver frutas"/"Ver verduras" filtram sem recarregar a página
  faixa.addEventListener('click', (e) => {
    const link = e.target.closest('[data-categoria]');
    if (!link) return;
    e.preventDefault();
    filtrarCategoria(link.dataset.categoria);
    document.getElementById('produtos').scrollIntoView();
  });

  mostrar(0);
  iniciarAutomatico();
}

// ---------------------------------------------------------------- Categorias
function desenharCategorias() {
  const totalOfertas = [...estado.produtosPorId.values()].filter((p) => p.emOferta).length;
  const totalGeral = estado.categorias.reduce((s, c) => s + c.total, 0);
  const opcoes = [
    { slug: '', nome: 'Todos', total: totalGeral },
    ...estado.categorias,
    { slug: 'ofertas', nome: 'Ofertas especiais', total: totalOfertas },
  ];
  document.getElementById('categorias').innerHTML = opcoes.map((c) => `
    <button type="button" class="categoria${c.slug === 'ofertas' ? ' categoria--oferta' : ''}" data-slug="${c.slug}"
            aria-pressed="${estado.categoria === c.slug}">
      <img src="${IMAGENS_CATEGORIA[c.slug] || IMAGENS_CATEGORIA['']}" alt="" width="34" height="34">
      ${escapar(c.nome)} <span class="qtd">${c.total}</span>
    </button>`).join('');
}

function atualizarUrl() {
  const params = new URLSearchParams();
  if (estado.categoria) params.set('categoria', estado.categoria);
  if (estado.busca) params.set('busca', estado.busca);
  const query = params.toString();
  history.replaceState(null, '', `${location.pathname}${query ? `?${query}` : ''}${location.hash}`);
}

function filtrarCategoria(slug) {
  estado.categoria = slug;
  document.querySelectorAll('.categoria').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.slug === slug)));
  atualizarUrl();
  carregarProdutos();
}

// ---------------------------------------------------------------- Produtos
async function carregarProdutos() {
  const grade = document.getElementById('grade-produtos');
  const params = new URLSearchParams();
  if (estado.categoria === 'ofertas') params.set('ofertas', '1');
  else if (estado.categoria) params.set('categoria', estado.categoria);
  if (estado.busca) params.set('busca', estado.busca);

  const infoBusca = document.getElementById('resultado-busca');
  try {
    const { produtos } = await api(`/api/produtos?${params}`);
    produtos.forEach((p) => estado.produtosPorId.set(p.id, p));

    if (estado.busca) {
      infoBusca.hidden = false;
      infoBusca.innerHTML = `<span>${produtos.length} resultado(s) para <strong>"${escapar(estado.busca)}"</strong></span>
        <button class="botao botao--claro botao--pequeno" type="button" id="limpar-busca">Limpar busca</button>`;
      document.getElementById('limpar-busca').addEventListener('click', () => buscar(''));
    } else {
      infoBusca.hidden = true;
    }

    grade.innerHTML = produtos.length
      ? produtos.map(cardProduto).join('')
      : `<div class="vazio" style="grid-column: 1 / -1">
           <img src="/img/produtos/padrao.svg" alt="">
           <p>Nenhum produto encontrado${estado.busca ? ` para "${escapar(estado.busca)}"` : ' nesta categoria'}.</p>
           <button class="botao botao--claro" type="button" data-ver-todos>Ver todos os produtos</button>
         </div>`;
  } catch (erro) {
    grade.innerHTML = `<div class="aviso aviso--erro" style="grid-column: 1 / -1"><p>${escapar(erro.message)}</p></div>`;
  }
}

async function carregarOfertas() {
  const secao = document.getElementById('ofertas');
  try {
    const { produtos } = await api('/api/produtos?ofertas=1');
    produtos.forEach((p) => estado.produtosPorId.set(p.id, p));
    secao.hidden = produtos.length === 0;
    document.getElementById('grade-ofertas').innerHTML = produtos.map(cardProduto).join('');
    document.getElementById('garantia-ofertas').innerHTML = `${icones.escudo}
      <span>São produtos frescos e próprios para consumo, no ponto ideal para hoje ou amanhã. Cada oferta tem data-limite: depois dela, o produto sai da loja. Nunca vendemos alimentos vencidos ou estragados.</span>`;
  } catch {
    secao.hidden = true;
  }
}

function buscar(termo) {
  estado.busca = termo;
  document.getElementById('campo-busca').value = termo;
  atualizarUrl();
  carregarProdutos();
  if (termo) document.getElementById('produtos').scrollIntoView();
}

// Clique em "Adicionar ao carrinho" (vale para as duas grades)
function aoClicarProduto(e) {
  if (e.target.closest('[data-ver-todos]')) {
    estado.busca = '';
    document.getElementById('campo-busca').value = '';
    filtrarCategoria('');
    return;
  }
  const botao = e.target.closest('[data-produto]');
  if (!botao) return;
  const produto = estado.produtosPorId.get(Number(botao.dataset.produto));
  if (!produto || !produto.disponivel) return;

  if (adicionar(produto.id, 1, produto.estoque)) {
    avisar(`${produto.nome} no carrinho (${quantidadeDe(produto.id)} ${produto.unidade}).`, { link: '/carrinho.html', textoLink: 'Ver carrinho' });
  } else {
    avisar(`Você já colocou todo o estoque de ${produto.nome} no carrinho.`, { tipo: 'erro' });
  }
}

// ---------------------------------------------------------------- Início
async function iniciar() {
  await iniciarLayout();
  iniciarCarrossel();
  if (new URLSearchParams(location.search).get('bemvindo')) {
    avisar('Conta criada! Agora é só escolher seus produtos.');
    history.replaceState(null, '', '/');
  }

  document.getElementById('grade-produtos').addEventListener('click', aoClicarProduto);
  document.getElementById('grade-ofertas').addEventListener('click', aoClicarProduto);
  document.getElementById('categorias').addEventListener('click', (e) => {
    const botao = e.target.closest('[data-slug]');
    if (botao) filtrarCategoria(botao.dataset.slug);
  });
  window.addEventListener('buscar', (e) => buscar(e.detail));

  try {
    estado.categorias = (await api('/api/categorias')).categorias;
  } catch {
    estado.categorias = [];
  }
  await Promise.all([carregarOfertas(), carregarProdutos()]);
  desenharCategorias();

  // Se a página abriu com #produtos ou com busca, rola até a lista
  if (location.hash === '#produtos' || estado.busca) {
    document.getElementById('produtos').scrollIntoView();
  } else if (location.hash === '#ofertas') {
    document.getElementById('ofertas').scrollIntoView();
  }
}

iniciar();
