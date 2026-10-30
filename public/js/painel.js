// js/painel.js — estrutura comum do painel administrativo e da área do entregador
import { api, usuarioAtual } from './api.js';
import { icones } from './icones.js';
import { montarAcessibilidade } from './layout.js';
import { escapar } from './util.js';

const MENUS = {
  admin: [
    { href: '/admin/', texto: 'Visão geral', icone: 'painel' },
    { href: '/admin/produtos.html', texto: 'Produtos e ofertas', icone: 'folha' },
    { href: '/admin/pedidos.html', texto: 'Pedidos', icone: 'pacote' },
    { href: '/admin/entregadores.html', texto: 'Entregadores', icone: 'moto' },
  ],
  entregador: [{ href: '/entregas/', texto: 'Minhas entregas', icone: 'moto' }],
};

const NOMES_PAPEL = { admin: 'Administração', entregador: 'Área do entregador' };

// Monta o menu lateral. O servidor já conferiu a permissão antes de entregar a página;
// aqui só buscamos o nome do usuário para mostrar.
export async function iniciarPainel(papel) {
  const usuario = await usuarioAtual();
  const caminho = location.pathname === '/admin/index.html' ? '/admin/' : location.pathname;
  const menu = document.createElement('nav');
  menu.className = 'painel__menu';
  menu.setAttribute('aria-label', NOMES_PAPEL[papel]);
  menu.innerHTML = `
    <a class="painel__logo" href="/" aria-label="Ir para a loja"><img src="/img/logo-texto.png" alt="VitaFructus" width="110" height="38"></a>
    <p class="painel__papel">${NOMES_PAPEL[papel]}${usuario ? `<br><strong>${escapar(usuario.nome)}</strong>` : ''}</p>
    ${MENUS[papel].map((m) => `<a href="${m.href}"${m.href === caminho ? ' aria-current="page"' : ''}>${icones[m.icone]}${m.texto}</a>`).join('')}
    <a class="empurra" href="/">${icones.casa}Ver loja</a>
    <button type="button" id="sair-painel">${icones.sair}Sair</button>`;
  document.body.prepend(menu);
  document.getElementById('sair-painel').addEventListener('click', async () => {
    await api('/api/auth/logout', { metodo: 'POST' }).catch(() => {});
    location.href = '/login.html';
  });
  montarAcessibilidade();
  return usuario;
}

// Abre um <dialog> e devolve funções para fechar
export function abrirJanela(dialog) {
  dialog.showModal();
  dialog.querySelectorAll('[data-fechar-janela]').forEach((b) => (b.onclick = () => dialog.close()));
}
