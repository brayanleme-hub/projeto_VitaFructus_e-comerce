// sw.js — Service Worker do VitaFructus (é ele que transforma o site em PWA)
//
// O que ele faz:
// - Guarda em cache os arquivos da "casca" do site (CSS, JS, fontes, ícones).
// - Páginas HTML: tenta a internet primeiro; sem conexão, mostra a versão salva
//   ou a página offline.html.
// - A API (/api/...) e os painéis NUNCA vão para o cache: preço e estoque
//   precisam estar sempre atualizados, e dados de login não devem ficar salvos.
//
// Ao mudar arquivos do site, aumente a VERSAO para os celulares baixarem tudo de novo.

const VERSAO = 'vitafructus-v2';

const ARQUIVOS_BASE = [
  '/',
  '/offline.html',
  '/css/estilo.css',
  '/js/preferencias.js',
  '/js/util.js',
  '/js/api.js',
  '/js/carrinho.js',
  '/js/icones.js',
  '/js/layout.js',
  '/js/componentes.js',
  '/js/paginas/inicio.js',
  '/fontes/fredoka-latin-500-normal.woff2',
  '/fontes/fredoka-latin-600-normal.woff2',
  '/fontes/figtree-latin-400-normal.woff2',
  '/fontes/figtree-latin-700-normal.woff2',
  '/img/logo-texto.png',
  '/img/produtos/padrao.svg',
  '/vendor/leaflet/leaflet.js',
  '/vendor/leaflet/leaflet.css',
  '/js/paginas/onde-estamos.js',
  '/img/icones/icone-192.png',
  '/manifest.webmanifest',
];

// Instalação: baixa os arquivos base
self.addEventListener('install', (evento) => {
  evento.waitUntil(caches.open(VERSAO).then((cache) => cache.addAll(ARQUIVOS_BASE)));
  self.skipWaiting();
});

// Ativação: apaga caches de versões antigas
self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys().then((nomes) => Promise.all(nomes.filter((n) => n !== VERSAO).map((n) => caches.delete(n))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (evento) => {
  const pedido = evento.request;
  const url = new URL(pedido.url);

  // Só cuidamos de GET do próprio site
  if (pedido.method !== 'GET' || url.origin !== self.location.origin) return;

  // API e áreas restritas: sempre pela internet, nunca do cache
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/admin') || url.pathname.startsWith('/entregas')) return;

  // Páginas: internet primeiro, cache como reserva
  if (pedido.mode === 'navigate') {
    evento.respondWith(
      fetch(pedido)
        .then((resposta) => {
          if (resposta.ok) {
            const copia = resposta.clone();
            caches.open(VERSAO).then((cache) => cache.put(pedido, copia));
          }
          return resposta;
        })
        .catch(async () => (await caches.match(pedido, { ignoreSearch: true })) || caches.match('/offline.html'))
    );
    return;
  }

  // Arquivos (CSS, JS, imagens, fontes): usa o cache e atualiza em segundo plano
  evento.respondWith(
    caches.match(pedido).then((doCache) => {
      const daRede = fetch(pedido)
        .then((resposta) => {
          if (resposta.ok) {
            const copia = resposta.clone();
            caches.open(VERSAO).then((cache) => cache.put(pedido, copia));
          }
          return resposta;
        })
        .catch(() => doCache);
      return doCache || daRede;
    })
  );
});
