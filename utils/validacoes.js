// utils/validacoes.js
// Funções pequenas para validar o que chega do navegador.
// Regra de ouro: NUNCA confie no que vem do frontend. Valide tudo de novo aqui.

const { ErroHttp } = require('./erros');

// Texto obrigatório, sem espaços nas pontas, com tamanho mínimo e máximo
function texto(valor, campo, { min = 1, max = 200, obrigatorio = true } = {}) {
  if (valor === undefined || valor === null || String(valor).trim() === '') {
    if (obrigatorio) throw new ErroHttp(400, `Preencha o campo ${campo}.`);
    return null;
  }
  if (typeof valor !== 'string' && typeof valor !== 'number') {
    throw new ErroHttp(400, `O campo ${campo} é inválido.`);
  }
  const limpo = String(valor).trim();
  if (limpo.length < min) throw new ErroHttp(400, `O campo ${campo} precisa ter pelo menos ${min} caracteres.`);
  if (limpo.length > max) throw new ErroHttp(400, `O campo ${campo} pode ter no máximo ${max} caracteres.`);
  return limpo;
}

function email(valor) {
  const limpo = texto(valor, 'e-mail', { max: 120 }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(limpo)) {
    throw new ErroHttp(400, 'Digite um e-mail válido, como nome@exemplo.com.');
  }
  return limpo;
}

function senha(valor) {
  if (typeof valor !== 'string' || valor.length < 8) {
    throw new ErroHttp(400, 'A senha precisa ter pelo menos 8 caracteres.');
  }
  // o bcrypt só considera os primeiros 72 bytes
  if (Buffer.byteLength(valor) > 72) throw new ErroHttp(400, 'A senha pode ter no máximo 72 caracteres.');
  return valor;
}

// Telefone opcional: guarda só os números (10 ou 11 dígitos)
function telefone(valor) {
  if (valor === undefined || valor === null || String(valor).trim() === '') return null;
  const numeros = String(valor).replace(/\D/g, '');
  if (numeros.length < 10 || numeros.length > 11) {
    throw new ErroHttp(400, 'Digite o telefone com DDD, por exemplo (11) 91234-5678.');
  }
  return numeros;
}

// Número inteiro dentro de um intervalo (preços em centavos, quantidades, ids)
function inteiro(valor, campo, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const numero = Number(valor);
  if (valor === '' || valor === null || valor === undefined || !Number.isInteger(numero)) {
    throw new ErroHttp(400, `O campo ${campo} precisa ser um número inteiro.`);
  }
  if (numero < min || numero > max) {
    throw new ErroHttp(400, `O campo ${campo} precisa estar entre ${min} e ${max}.`);
  }
  return numero;
}

function id(valor, campo = 'id') {
  return inteiro(valor, campo, { min: 1 });
}

function booleano(valor) {
  return valor === true || valor === 1 || valor === '1' || valor === 'true';
}

// Data AAAA-MM-DD válida (ex.: 2026-02-30 é rejeitada)
function data(valor, campo) {
  if (valor === undefined || valor === null || valor === '') return null;
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    throw new ErroHttp(400, `O campo ${campo} precisa estar no formato AAAA-MM-DD.`);
  }
  const d = new Date(`${valor}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== valor) {
    throw new ErroHttp(400, `A data em ${campo} não existe.`);
  }
  return valor;
}

function umDe(valor, opcoes, campo) {
  if (!opcoes.includes(valor)) {
    throw new ErroHttp(400, `O campo ${campo} precisa ser um destes: ${opcoes.join(', ')}.`);
  }
  return valor;
}

// Endereço completo de entrega
function endereco(dados) {
  if (!dados || typeof dados !== 'object') throw new ErroHttp(400, 'Informe o endereço de entrega.');
  const cep = String(dados.cep || '').replace(/\D/g, '');
  if (cep.length !== 8) throw new ErroHttp(400, 'O CEP precisa ter 8 números.');
  const uf = texto(dados.uf, 'UF', { min: 2, max: 2 }).toUpperCase();
  if (!/^[A-Z]{2}$/.test(uf)) throw new ErroHttp(400, 'A UF precisa ter 2 letras, como SP.');
  return {
    cep,
    logradouro: texto(dados.logradouro, 'rua', { min: 3, max: 120 }),
    numero: texto(dados.numero, 'número', { max: 10 }),
    complemento: texto(dados.complemento, 'complemento', { max: 60, obrigatorio: false }),
    bairro: texto(dados.bairro, 'bairro', { min: 2, max: 80 }),
    cidade: texto(dados.cidade, 'cidade', { min: 2, max: 80 }),
    uf,
  };
}

// Caminho de imagem: arquivo local em /img/ ou endereço https://
function imagem(valor) {
  if (valor === undefined || valor === null || String(valor).trim() === '') return '/img/produtos/padrao.svg';
  const limpo = texto(valor, 'imagem', { max: 500 });
  const local = /^\/img\/[\w\-./]+\.(svg|png|jpe?g|webp)$/i.test(limpo) && !limpo.includes('..');
  const remota = /^https:\/\/[^\s"'<>]+$/i.test(limpo);
  if (!local && !remota) {
    throw new ErroHttp(400, 'A imagem precisa ser um arquivo em /img/... ou um endereço que comece com https://');
  }
  return limpo;
}

module.exports = { texto, email, senha, telefone, inteiro, id, booleano, data, umDe, endereco, imagem };
