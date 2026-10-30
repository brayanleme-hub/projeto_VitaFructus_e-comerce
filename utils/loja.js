// utils/loja.js
// Dados da loja física usados na página "Onde estamos".
// Os valores padrão são DEMONSTRATIVOS (região de Heliópolis, São Paulo).
// Para usar o endereço real do hortifrúti, defina as variáveis no .env.

function numero(valor, padrao) {
  if (valor === undefined || String(valor).trim() === '') return padrao;
  const n = Number(valor);
  return Number.isFinite(n) ? n : padrao;
}

function dadosDaLoja() {
  return {
    nome: process.env.LOJA_NOME || 'VitaFructus Hortifrúti',
    endereco: process.env.LOJA_ENDERECO || 'Heliópolis, Ipiranga, São Paulo - SP',
    latitude: numero(process.env.LOJA_LATITUDE, -23.6026),
    longitude: numero(process.env.LOJA_LONGITUDE, -46.5964),
    raioEntregaKm: numero(process.env.LOJA_RAIO_ENTREGA_KM, 5),
    telefone: process.env.LOJA_TELEFONE || '(11) 0000-0000',
    horarios: ['Segunda a sexta: 8h às 19h', 'Sábado: 8h às 14h'],
    demonstrativo: !process.env.LOJA_ENDERECO,
  };
}

module.exports = { dadosDaLoja };
