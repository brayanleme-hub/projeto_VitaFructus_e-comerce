// js/util.js — funções pequenas usadas em várias páginas

const formatadorMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

// 1290 -> "R$ 12,90"
export function reais(centavos) {
  return formatadorMoeda.format((centavos || 0) / 100);
}

// "12,90" ou "12.90" -> 1290 (para os formulários do painel)
export function paraCentavos(texto) {
  const limpo = String(texto || '').replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
  const numero = Number(limpo);
  return Number.isFinite(numero) ? Math.round(numero * 100) : NaN;
}

// 1290 -> "12,90" (para preencher campos)
export function centavosParaCampo(centavos) {
  return ((centavos || 0) / 100).toFixed(2).replace('.', ',');
}

// "2026-10-30" -> "30/10"
export function diaMes(dataISO) {
  if (!dataISO) return '';
  const [, mes, dia] = dataISO.split('-');
  return `${dia}/${mes}`;
}

// "2026-10-28 14:05:00" -> "28/10/2026 às 14:05"
export function dataHora(texto) {
  if (!texto) return '';
  const [data, hora = ''] = texto.split(' ');
  const [ano, mes, dia] = data.split('-');
  return `${dia}/${mes}/${ano}${hora ? ` às ${hora.slice(0, 5)}` : ''}`;
}

// Quantos dias faltam até a data (0 = hoje)
export function diasAte(dataISO) {
  if (!dataISO) return null;
  const hoje = new Date();
  const inicioHoje = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const [ano, mes, dia] = dataISO.split('-').map(Number);
  return Math.round((Date.UTC(ano, mes - 1, dia) - inicioHoje) / 86400000);
}

// Evita que um texto vindo do banco vire HTML (proteção contra XSS)
export function escapar(texto) {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// "1 kg", "2 bandejas", "3 maços"
export function quantidadeComUnidade(qtd, unidade) {
  if (qtd === 1 || unidade === 'kg') return `${qtd} ${unidade}`;
  const plurais = { unidade: 'unidades', bandeja: 'bandejas', 'maço': 'maços', 'dúzia': 'dúzias' };
  return `${qtd} ${plurais[unidade] || unidade}`;
}

// "11912345678" -> "(11) 91234-5678"
export function telefoneFormatado(numeros) {
  const n = String(numeros || '').replace(/\D/g, '');
  if (n.length === 11) return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
  if (n.length === 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
  return n;
}

export const NOMES_STATUS = {
  pendente: 'Pendente',
  em_preparacao: 'Em preparação',
  saiu_para_entrega: 'Saiu para entrega',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
};

export const NOMES_PAGAMENTO = { pix: 'Pix', debito: 'Cartão de débito', credito: 'Cartão de crédito' };

export const NOMES_SITUACAO_PAGAMENTO = {
  aprovado_simulado: 'Aprovado (simulação)',
  estornado_simulado: 'Estornado (simulação)',
};

// Lê ?parametro=valor da URL
export function parametro(nome) {
  return new URLSearchParams(location.search).get(nome);
}

// Só aceita voltar para páginas do próprio site (evita redirecionar para sites falsos)
export function destinoSeguro(url, padrao = '/') {
  return url && url.startsWith('/') && !url.startsWith('//') ? url : padrao;
}
