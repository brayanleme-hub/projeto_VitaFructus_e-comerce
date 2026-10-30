// js/paginas/onde-estamos.js — "Como nos encontrar"
// Usa duas coisas do navegador/internet:
// 1) API de Geolocalização (navigator.geolocation): pergunta ao usuário a posição do aparelho.
// 2) Leaflet + OpenStreetMap: desenha o mapa com a loja, o cliente e a área de entrega.
// A rota de verdade (ruas) é aberta no Google Maps ou no Waze, que já fazem isso muito bem.
import { iniciarLayout } from '../layout.js';
import { api } from '../api.js';
import { icones } from '../icones.js';
import { escapar } from '../util.js';

const L = window.L; // biblioteca Leaflet, carregada pelo <script> no HTML
let mapa;
let loja;
let marcadorVoce;
let linhaAteLoja;

// ---------------------------------------------------------------- Cálculos
// Distância em linha reta entre dois pontos do globo (fórmula de Haversine)
export function distanciaKm(lat1, lon1, lat2, lon2) {
  const raioTerra = 6371;
  const rad = (graus) => (graus * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * raioTerra * Math.asin(Math.sqrt(a));
}

function textoDistancia(km) {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1).replace('.', ',')} km`;
}

// Estimativa simples: a pé ~4,5 km/h e de carro ~20 km/h no trânsito da cidade.
// Multiplicamos por 1,3 porque as ruas não são uma linha reta.
function textoTempo(km, velocidadeKmH) {
  const minutos = Math.max(1, Math.round(((km * 1.3) / velocidadeKmH) * 60));
  return minutos < 60 ? `${minutos} min` : `${Math.floor(minutos / 60)} h ${minutos % 60} min`;
}

function linkRota(destino, origem, modo) {
  const params = new URLSearchParams({ api: '1', destination: `${destino.latitude},${destino.longitude}`, travelmode: modo });
  if (origem) params.set('origin', `${origem.latitude},${origem.longitude}`);
  return `https://www.google.com/maps/dir/?${params}`;
}

// ---------------------------------------------------------------- Mapa
function iniciarMapa() {
  const centro = [loja.latitude, loja.longitude];
  mapa = L.map('mapa', { scrollWheelZoom: false }).setView(centro, 14);

  // Camada de ruas do OpenStreetMap (a atribuição é obrigatória pela licença)
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(mapa);

  // Área de entrega
  L.circle(centro, {
    radius: loja.raioEntregaKm * 1000,
    color: '#2f8a3b',
    weight: 2,
    fillColor: '#2f8a3b',
    fillOpacity: 0.08,
  }).addTo(mapa);

  // Marcador da loja (ícone feito com HTML/CSS, sem depender de imagens do Leaflet)
  const iconeLoja = L.divIcon({
    className: '',
    html: '<div class="pino pino--loja"><img src="/img/icones/favicon-48.png" alt=""></div>',
    iconSize: [46, 46],
    iconAnchor: [23, 23],
  });
  L.marker(centro, { icon: iconeLoja, title: loja.nome, keyboard: true })
    .addTo(mapa)
    .bindPopup(`<strong>${escapar(loja.nome)}</strong><br>${escapar(loja.endereco)}`)
    .openPopup();

  document.getElementById('legenda-mapa').textContent =
    `O círculo verde mostra a área de entrega: até ${loja.raioEntregaKm} km da loja.`;
}

// ---------------------------------------------------------------- Geolocalização
function mostrarResultado(html) {
  document.getElementById('resultado-localizacao').innerHTML = html;
}

function aoEncontrarPosicao(posicao) {
  const voce = { latitude: posicao.coords.latitude, longitude: posicao.coords.longitude };
  const km = distanciaKm(voce.latitude, voce.longitude, loja.latitude, loja.longitude);
  const entregamos = km <= loja.raioEntregaKm;

  // Marcador "você está aqui" e linha até a loja
  const iconeVoce = L.divIcon({ className: '', html: '<div class="pino pino--voce"></div>', iconSize: [22, 22], iconAnchor: [11, 11] });
  if (marcadorVoce) marcadorVoce.remove();
  if (linhaAteLoja) linhaAteLoja.remove();
  marcadorVoce = L.marker([voce.latitude, voce.longitude], { icon: iconeVoce, title: 'Você está aqui' })
    .addTo(mapa)
    .bindPopup('Você está aqui');
  linhaAteLoja = L.polyline([[voce.latitude, voce.longitude], [loja.latitude, loja.longitude]], {
    color: '#e3a23b', weight: 4, dashArray: '8 8',
  }).addTo(mapa);
  mapa.fitBounds(linhaAteLoja.getBounds(), { padding: [60, 60], maxZoom: 16 });

  mostrarResultado(`
    <div class="resultado-distancia">
      <div>
        <div class="resultado-distancia__numero">${textoDistancia(km)}</div>
        <span class="dica">da loja, em linha reta (precisão do aparelho: cerca de ${Math.round(posicao.coords.accuracy)} m)</span>
      </div>
      <div class="resultado-distancia__tempos">
        <span class="selo">A pé: ~${textoTempo(km, 4.5)}</span>
        <span class="selo">De carro: ~${textoTempo(km, 20)}</span>
      </div>
      <p class="aviso ${entregamos ? '' : 'aviso--alerta'}">${entregamos
        ? 'Boa notícia: você está dentro da nossa área de entrega!'
        : `Você está fora da área de entrega (até ${loja.raioEntregaKm} km). Ainda dá para visitar a loja.`}</p>
      <div class="localizacao__botoes">
        <a class="botao" href="${linkRota(loja, voce, 'driving')}" target="_blank" rel="noopener">${icones.rota} Rota de carro</a>
        <a class="botao botao--claro" href="${linkRota(loja, voce, 'walking')}" target="_blank" rel="noopener">Rota a pé</a>
      </div>
    </div>`);
}

function aoFalharPosicao(erro) {
  const mensagens = {
    1: 'Você não permitiu o acesso à localização. Para liberar, toque no cadeado ao lado do endereço do site e ative "Localização".',
    2: 'Não foi possível descobrir sua localização agora. Verifique se o GPS ou o Wi-Fi está ligado.',
    3: 'A localização demorou demais para responder. Tente de novo.',
  };
  mostrarResultado(`<p class="aviso aviso--erro" style="margin-top:16px">${mensagens[erro.code] || 'Não foi possível obter sua localização.'}</p>`);
}

function pedirLocalizacao() {
  // A API de geolocalização só funciona em HTTPS ou em localhost (regra dos navegadores)
  if (!window.isSecureContext) {
    mostrarResultado('<p class="aviso aviso--alerta" style="margin-top:16px">Para usar sua localização, abra o site por <strong>https://</strong> ou por <strong>localhost</strong>. Pelo IP da rede (http://192.168...) o navegador bloqueia esse recurso.</p>');
    return;
  }
  if (!('geolocation' in navigator)) {
    mostrarResultado('<p class="aviso aviso--erro" style="margin-top:16px">Este navegador não tem o recurso de localização.</p>');
    return;
  }
  mostrarResultado('<p class="carregando">Procurando sua localização...</p>');
  navigator.geolocation.getCurrentPosition(aoEncontrarPosicao, aoFalharPosicao, {
    enableHighAccuracy: true, // usa o GPS quando houver
    timeout: 15000, // espera no máximo 15 segundos
    maximumAge: 60000, // aceita uma posição de até 1 minuto atrás
  });
}

// ---------------------------------------------------------------- Início
async function iniciar() {
  await iniciarLayout();
  try {
    ({ loja } = await api('/api/loja'));
  } catch (erro) {
    document.getElementById('titulo-loja').textContent = 'Não foi possível carregar o endereço';
    mostrarResultado(`<p class="aviso aviso--erro">${escapar(erro.message)}</p>`);
    return;
  }

  document.getElementById('titulo-loja').textContent = loja.nome;
  document.getElementById('endereco-loja').textContent = loja.endereco;
  document.getElementById('aviso-demo').hidden = !loja.demonstrativo;
  document.getElementById('dados-loja').innerHTML = `
    <li>${icones.relogio}<span>${loja.horarios.map(escapar).join('<br>')}</span></li>
    <li>${icones.telefone}<span>${escapar(loja.telefone)}</span></li>
    <li>${icones.moto}<span>Entregamos até ${loja.raioEntregaKm} km da loja</span></li>`;
  const destino = `${loja.latitude},${loja.longitude}`;
  document.getElementById('botoes-loja').innerHTML = `
    <a class="botao botao--claro botao--pequeno" href="${linkRota(loja, null, 'driving')}" target="_blank" rel="noopener">${icones.mapa} Abrir no Google Maps</a>
    <a class="botao botao--claro botao--pequeno" href="https://waze.com/ul?ll=${destino}&navigate=yes" target="_blank" rel="noopener">Abrir no Waze</a>`;

  const botao = document.getElementById('usar-localizacao');
  botao.innerHTML = `${icones.alvo} Usar minha localização`;
  botao.addEventListener('click', pedirLocalizacao);

  if (L) iniciarMapa();
  else document.getElementById('mapa').innerHTML = '<p class="vazio">Não foi possível carregar o mapa (sem internet?).</p>';
}

iniciar();
