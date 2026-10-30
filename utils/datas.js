// utils/datas.js
// Datas sempre no fuso da loja (São Paulo), no formato AAAA-MM-DD.
// Assim a regra "produto sai da venda depois da data-limite" funciona igual
// no seu PC e num servidor na nuvem (que costuma estar em outro fuso).

const FUSO_LOJA = process.env.FUSO_LOJA || 'America/Sao_Paulo';

function dataISO(data) {
  // 'en-CA' formata como AAAA-MM-DD
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO_LOJA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(data);
}

function hoje() {
  return dataISO(new Date());
}

// Soma dias a partir de hoje. Ex.: daquiDias(3) -> data daqui a 3 dias
function daquiDias(dias) {
  const [ano, mes, dia] = hoje().split('-').map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia + dias));
  return data.toISOString().slice(0, 10);
}

module.exports = { hoje, daquiDias };
