// js/layout.js
// Monta as partes que se repetem em todas as páginas da loja:
// cabeçalho, menu lateral, rodapé, painel de acessibilidade e avisos (toasts).
// Também registra o service worker (PWA) e cuida do botão "Instalar aplicativo".
//
// Cada página HTML só precisa ter:
//   <div id="topo"></div>  ...conteúdo...  <div id="rodape"></div>
// e importar este arquivo.

import { api, usuarioAtual } from './api.js';
import { quantidadeTotal, aoMudar } from './carrinho.js';
import { icones } from './icones.js';
import { escapar } from './util.js';

const paginaAtual = location.pathname;

// ---------------------------------------------------------------- Toasts
export function avisar(mensagem, { tipo = 'ok', link, textoLink, tempo = 4000 } = {}) {
  let caixa = document.querySelector('.toasts');
  if (!caixa) {
    caixa = document.createElement('div');
    caixa.className = 'toasts';
    caixa.setAttribute('role', 'status');
    caixa.setAttribute('aria-live', 'polite');
    document.body.append(caixa);
  }
  const toast = document.createElement('div');
  toast.className = `toast${tipo === 'erro' ? ' toast--erro' : ''}`;
  toast.innerHTML = `<span>${escapar(mensagem)}</span>${link ? `<a href="${escapar(link)}">${escapar(textoLink)}</a>` : ''}`;
  caixa.append(toast);
  setTimeout(() => toast.remove(), tempo);
}

// ---------------------------------------------------------------- Cabeçalho
function linkNav(href, texto) {
  const atual = href === paginaAtual || (href === '/' && paginaAtual === '/index.html');
  return `<a href="${href}"${atual ? ' aria-current="page"' : ''}>${texto}</a>`;
}

function montarTopo() {
  const alvo = document.getElementById('topo');
  if (!alvo) return;
  const buscaAtual = new URLSearchParams(location.search).get('busca') || '';
  alvo.outerHTML = `
  <a class="pular-conteudo" href="#conteudo">Pular para o conteúdo</a>
  <header class="topo">
    <div class="container topo__linha">
      <a class="topo__logo" href="/" aria-label="VitaFructus, página inicial">
        <img src="/img/logo-texto.png" alt="VitaFructus" width="134" height="46">
      </a>
      <nav class="topo__nav" aria-label="Principal">
        ${linkNav('/', 'Início')}
        ${linkNav('/#produtos', 'Produtos')}
        ${linkNav('/onde-estamos.html', 'Onde estamos')}
        ${linkNav('/sobre.html', 'Sobre nós')}
      </nav>
      <form class="busca" role="search" action="/" method="get">
        <label class="oculto-visual" for="campo-busca">Pesquisar produtos</label>
        ${icones.busca}
        <input class="entrada" id="campo-busca" name="busca" type="search" placeholder="Buscar frutas, verduras, legumes..." value="${escapar(buscaAtual)}" autocomplete="off">
      </form>
      <div class="topo__acoes">
        <a class="botao-icone" href="/carrinho.html" aria-label="Carrinho">
          ${icones.carrinho}
          <span class="contador" id="contador-carrinho" hidden>0</span>
        </a>
        <a class="botao-conta" id="botao-conta" href="/login.html">${icones.usuario}<span>Entrar</span></a>
        <button class="botao-icone" id="abrir-menu" aria-label="Abrir menu" aria-expanded="false" aria-controls="menu-lateral">${icones.menu}</button>
      </div>
    </div>
  </header>`;

  // A busca acontece na página inicial. Se já estivermos nela, o inicio.js cuida disso.
  document.querySelector('.busca').addEventListener('submit', (e) => {
    const termo = e.target.busca.value.trim();
    if (paginaAtual === '/' || paginaAtual === '/index.html') {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent('buscar', { detail: termo }));
    } else if (!termo) {
      e.preventDefault();
    }
  });
}

function atualizarContador() {
  const contador = document.getElementById('contador-carrinho');
  if (!contador) return;
  const total = quantidadeTotal();
  contador.hidden = total === 0;
  if (contador.textContent !== String(total)) {
    contador.textContent = total > 99 ? '99+' : total;
    contador.classList.remove('pulo');
    void contador.offsetWidth; // reinicia a animação
    contador.classList.add('pulo');
  }
}

// ---------------------------------------------------------------- Menu lateral (três barras)
let eventoInstalacao = null; // guardado quando o navegador permite instalar o app

function montarMenu(usuario) {
  const primeiroNome = usuario ? usuario.nome.split(' ')[0] : null;
  const fundo = document.createElement('div');
  fundo.className = 'menu-fundo';
  fundo.hidden = true;
  const menu = document.createElement('aside');
  menu.className = 'menu-lateral';
  menu.id = 'menu-lateral';
  menu.setAttribute('aria-label', 'Menu');
  menu.innerHTML = `
    <div class="menu-lateral__topo">
      <span class="menu-lateral__saudacao">${primeiroNome ? `Olá, ${escapar(primeiroNome)}!` : 'Menu'}</span>
      <button class="botao-icone" id="fechar-menu" aria-label="Fechar menu">${icones.fechar}</button>
    </div>
    <ul class="grupo">
      <li><a href="/">${icones.casa}Início</a></li>
      <li><a href="/#produtos">${icones.folha}Produtos</a></li>
      <li><a href="/#ofertas">${icones.etiqueta}Ofertas para evitar desperdício</a></li>
      <li><a href="/onde-estamos.html">${icones.mapa}Onde estamos</a></li>
      <li><a href="/sobre.html">${icones.info}Sobre nós</a></li>
    </ul>
    <ul class="grupo">
      ${usuario && usuario.tipo === 'cliente' ? `<li><a href="/meus-pedidos.html">${icones.pacote}Meus pedidos</a></li>` : ''}
      ${usuario && usuario.tipo === 'admin' ? `<li><a href="/admin/">${icones.painel}Painel administrativo</a></li>` : ''}
      ${usuario && usuario.tipo === 'entregador' ? `<li><a href="/entregas/">${icones.moto}Minhas entregas</a></li>` : ''}
      <li><a href="/sobre.html#contato">${icones.telefone}Contato</a></li>
      <li><button class="item" type="button" id="menu-configuracoes">${icones.engrenagem}Configurações e acessibilidade</button></li>
      <li id="item-instalar" hidden><button class="item" type="button" id="menu-instalar">${icones.baixar}Instalar aplicativo</button></li>
    </ul>
    <ul class="grupo">
      ${usuario
        ? `<li><button class="item" type="button" id="menu-sair">${icones.sair}Sair da conta</button></li>`
        : `<li><a href="/login.html">${icones.usuario}Entrar</a></li><li><a href="/cadastro.html">${icones.mais}Criar conta</a></li>`}
    </ul>`;
  document.body.append(fundo, menu);

  const botaoAbrir = document.getElementById('abrir-menu');
  const abrir = () => {
    fundo.hidden = false;
    menu.classList.add('aberto');
    botaoAbrir.setAttribute('aria-expanded', 'true');
    document.getElementById('fechar-menu').focus();
  };
  const fechar = () => {
    fundo.hidden = true;
    menu.classList.remove('aberto');
    botaoAbrir.setAttribute('aria-expanded', 'false');
  };
  botaoAbrir.addEventListener('click', abrir);
  fundo.addEventListener('click', fechar);
  document.getElementById('fechar-menu').addEventListener('click', () => {
    fechar();
    botaoAbrir.focus();
  });
  menu.addEventListener('click', (e) => e.target.closest('a') && fechar());
  document.addEventListener('keydown', (e) => e.key === 'Escape' && menu.classList.contains('aberto') && fechar());

  document.getElementById('menu-configuracoes').addEventListener('click', () => {
    fechar();
    abrirPainelAcessibilidade();
  });

  const sair = document.getElementById('menu-sair');
  if (sair) {
    sair.addEventListener('click', async () => {
      await api('/api/auth/logout', { metodo: 'POST' }).catch(() => {});
      location.href = '/';
    });
  }

  document.getElementById('menu-instalar').addEventListener('click', instalarApp);
  mostrarOpcaoInstalar();
}

// ---------------------------------------------------------------- Botão da conta
function atualizarBotaoConta(usuario) {
  const botao = document.getElementById('botao-conta');
  if (!botao || !usuario) return;
  const destinos = { admin: '/admin/', entregador: '/entregas/', cliente: '/meus-pedidos.html' };
  botao.href = destinos[usuario.tipo];
  botao.querySelector('span').textContent = usuario.nome.split(' ')[0];
  botao.setAttribute('aria-label', `Minha conta: ${usuario.nome}`);
}

// ---------------------------------------------------------------- Rodapé
function montarRodape() {
  const alvo = document.getElementById('rodape');
  if (!alvo) return;
  alvo.outerHTML = `
  <footer class="rodape">
    <div class="container rodape__grade">
      <section>
        <a class="rodape__logo" href="/"><img src="/img/logo-texto.png" alt="VitaFructus" width="116" height="40"></a>
        <p>Hortifrúti on-line que ajuda o comércio do bairro a vender mais e desperdiçar menos.</p>
        <p class="rodape__demo">Projeto acadêmico da Fábrica de Software — Etec Heliópolis.</p>
      </section>
      <section>
        <h2>Navegue</h2>
        <ul>
          <li><a href="/">Início</a></li>
          <li><a href="/#produtos">Produtos</a></li>
          <li><a href="/#ofertas">Ofertas</a></li>
          <li><a href="/onde-estamos.html">Onde estamos</a></li>
          <li><a href="/sobre.html">Sobre nós</a></li>
          <li><a href="/meus-pedidos.html">Meus pedidos</a></li>
        </ul>
      </section>
      <section>
        <h2>Atendimento</h2>
        <ul>
          <li>Segunda a sexta: 8h às 19h</li>
          <li>Sábado: 8h às 14h</li>
          <li>contato@vitafructus.exemplo</li>
          <li>(11) 0000-0000</li>
        </ul>
        <p class="rodape__demo">Horários e contatos demonstrativos.</p>
      </section>
      <section>
        <h2>Entrega</h2>
        <p>Entregamos em Heliópolis e bairros vizinhos. Você acompanha cada etapa em Meus pedidos.</p>
        <p><a href="/onde-estamos.html">Ver se entregamos aí</a></p>
        <p class="rodape__demo">Área de entrega demonstrativa.</p>
      </section>
    </div>
    <div class="container rodape__base">
      <span>Projeto acadêmico: nenhuma compra ou cobrança é real.</span>
      <span>Fotos: <a href="https://www.pexels.com" rel="noopener">Pexels</a>. Mapa: © <a href="https://www.openstreetmap.org/copyright" rel="noopener">OpenStreetMap</a>. Ícone padrão: <a href="https://github.com/jdecked/twemoji" rel="noopener">Twemoji</a> (CC-BY 4.0)</span>
    </div>
  </footer>`;
}

// ---------------------------------------------------------------- Acessibilidade (RNF05)
const CHAVE_A11Y = 'vf-acessibilidade';

function lerPreferencias() {
  try {
    return JSON.parse(localStorage.getItem(CHAVE_A11Y) || '{}');
  } catch {
    return {};
  }
}

function aplicarPreferencias(prefs) {
  const html = document.documentElement;
  html.classList.remove('texto-1', 'texto-2', 'texto-3');
  if (prefs.texto) html.classList.add(`texto-${prefs.texto}`);
  html.classList.toggle('alto-contraste', !!prefs.contraste);
  html.classList.toggle('destacar-links', !!prefs.links);
  html.classList.toggle('sem-animacoes', !!prefs.animacoes);
  try {
    localStorage.setItem(CHAVE_A11Y, JSON.stringify(prefs));
  } catch {
    /* sem armazenamento */
  }
}

export function montarAcessibilidade() {
  const botao = document.createElement('button');
  botao.className = 'botao-acessibilidade';
  botao.type = 'button';
  botao.setAttribute('aria-label', 'Abrir opções de acessibilidade');
  botao.setAttribute('aria-expanded', 'false');
  botao.setAttribute('aria-controls', 'painel-acessibilidade');
  botao.innerHTML = icones.acessibilidade;

  const painel = document.createElement('section');
  painel.className = 'painel-acessibilidade';
  painel.id = 'painel-acessibilidade';
  painel.hidden = true;
  painel.setAttribute('aria-labelledby', 'titulo-a11y');
  painel.innerHTML = `
    <h2 id="titulo-a11y">Acessibilidade
      <button class="botao-icone" type="button" data-fechar aria-label="Fechar opções de acessibilidade">${icones.fechar}</button>
    </h2>
    <div class="opcao-a11y">
      <span class="opcao-a11y__titulo" id="rotulo-texto">Tamanho do texto</span>
      <div class="tamanhos" role="group" aria-labelledby="rotulo-texto">
        <button type="button" data-texto="0" aria-label="Texto normal">A</button>
        <button type="button" data-texto="1" aria-label="Texto grande" style="font-size:1.1em">A+</button>
        <button type="button" data-texto="2" aria-label="Texto maior" style="font-size:1.2em">A++</button>
        <button type="button" data-texto="3" aria-label="Texto muito grande" style="font-size:1.3em">A+++</button>
      </div>
    </div>
    <div class="opcao-a11y"><label class="chave">Alto contraste <input type="checkbox" data-opcao="contraste"></label></div>
    <div class="opcao-a11y"><label class="chave">Destacar links <input type="checkbox" data-opcao="links"></label></div>
    <div class="opcao-a11y"><label class="chave">Reduzir animações <input type="checkbox" data-opcao="animacoes"></label></div>
    <button class="botao botao--claro botao--bloco" type="button" data-restaurar>Voltar ao padrão</button>`;
  document.body.append(botao, painel);

  const sincronizar = () => {
    const prefs = lerPreferencias();
    painel.querySelectorAll('[data-texto]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.texto) === (prefs.texto || 0))));
    painel.querySelectorAll('[data-opcao]').forEach((c) => (c.checked = !!prefs[c.dataset.opcao]));
  };

  painel.addEventListener('click', (e) => {
    const prefs = lerPreferencias();
    const tamanho = e.target.closest('[data-texto]');
    if (tamanho) {
      aplicarPreferencias({ ...prefs, texto: Number(tamanho.dataset.texto) });
      sincronizar();
    }
    if (e.target.closest('[data-restaurar]')) {
      aplicarPreferencias({});
      sincronizar();
    }
    if (e.target.closest('[data-fechar]')) fecharPainelAcessibilidade();
  });
  painel.addEventListener('change', (e) => {
    const opcao = e.target.dataset.opcao;
    if (opcao) aplicarPreferencias({ ...lerPreferencias(), [opcao]: e.target.checked });
  });
  botao.addEventListener('click', () => (painel.hidden ? abrirPainelAcessibilidade() : fecharPainelAcessibilidade()));
  document.addEventListener('keydown', (e) => e.key === 'Escape' && !painel.hidden && fecharPainelAcessibilidade());
  sincronizar();
}

function abrirPainelAcessibilidade() {
  const painel = document.getElementById('painel-acessibilidade');
  painel.hidden = false;
  document.querySelector('.botao-acessibilidade').setAttribute('aria-expanded', 'true');
  painel.querySelector('[data-texto]').focus();
}

function fecharPainelAcessibilidade() {
  document.getElementById('painel-acessibilidade').hidden = true;
  const botao = document.querySelector('.botao-acessibilidade');
  botao.setAttribute('aria-expanded', 'false');
  botao.focus();
}

// ---------------------------------------------------------------- PWA
function registrarServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((erro) => console.warn('Service worker não registrado:', erro));
    });
  }
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault(); // guarda o evento para usar no botão do menu
  eventoInstalacao = e;
  mostrarOpcaoInstalar();
});

function ehIphone() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function appJaInstalado() {
  return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}

function mostrarOpcaoInstalar() {
  const item = document.getElementById('item-instalar');
  if (item) item.hidden = appJaInstalado() || !(eventoInstalacao || ehIphone());
}

async function instalarApp() {
  if (eventoInstalacao) {
    eventoInstalacao.prompt();
    const { outcome } = await eventoInstalacao.userChoice;
    if (outcome === 'accepted') avisar('Aplicativo instalado! Procure o VitaFructus na tela inicial.');
    eventoInstalacao = null;
    mostrarOpcaoInstalar();
  } else if (ehIphone()) {
    avisar('No Safari, toque em Compartilhar e depois em "Adicionar à Tela de Início".', { tempo: 8000 });
  }
}

// ---------------------------------------------------------------- Início
// Toda página chama iniciarLayout() e recebe o usuário logado (ou null).
export async function iniciarLayout() {
  montarTopo();
  montarRodape();
  montarAcessibilidade();
  atualizarContador();
  aoMudar(atualizarContador);
  registrarServiceWorker();
  const usuario = await usuarioAtual();
  atualizarBotaoConta(usuario);
  montarMenu(usuario);
  return usuario;
}
