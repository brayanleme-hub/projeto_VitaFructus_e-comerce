// js/preferencias.js
// Carregado no <head> SEM "defer", antes de a página aparecer.
// Aplica as opções de acessibilidade salvas, para a página já abrir do jeito certo
// (sem "piscar" no tamanho padrão e depois mudar).
(function () {
  try {
    var prefs = JSON.parse(localStorage.getItem('vf-acessibilidade') || '{}');
    var html = document.documentElement;
    if (prefs.texto) html.classList.add('texto-' + prefs.texto);
    if (prefs.contraste) html.classList.add('alto-contraste');
    if (prefs.links) html.classList.add('destacar-links');
    if (prefs.animacoes) html.classList.add('sem-animacoes');
  } catch (e) {
    /* navegador sem localStorage: segue com o padrão */
  }
})();
