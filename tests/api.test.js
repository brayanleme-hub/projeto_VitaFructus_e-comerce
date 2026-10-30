// tests/api.test.js
// Testes automáticos da API. Rode com:  npm test
// Usam um banco TEMPORÁRIO (não mexem no seu database/vitafructus.db).

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const os = require('os');
const fs = require('fs');
const path = require('path');

const pastaTemp = fs.mkdtempSync(path.join(os.tmpdir(), 'vitafructus-teste-'));
process.env.DB_ARQUIVO = path.join(pastaTemp, 'teste.db');
process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'segredo-dos-testes';
process.env.ADMIN_EMAIL = 'admin@teste.com';
process.env.ADMIN_SENHA = 'senhaAdmin123';
delete process.env.PORT;

const app = require('../app');
const db = require('../database/conexao');

let servidor;
let base;

before(async () => {
  servidor = app.listen(0);
  await new Promise((r) => servidor.once('listening', r));
  base = `http://127.0.0.1:${servidor.address().port}`;
});

after(() => {
  servidor.close();
  db.close();
  fs.rmSync(pastaTemp, { recursive: true, force: true });
});

// Pequeno "navegador" que guarda o cookie de sessão
function criarCliente() {
  let cookie = '';
  return async function requisitar(metodo, url, corpo) {
    const resposta = await fetch(base + url, {
      method: metodo,
      redirect: 'manual',
      headers: { ...(corpo ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) },
      body: corpo ? JSON.stringify(corpo) : undefined,
    });
    const novoCookie = resposta.headers.get('set-cookie');
    if (novoCookie) cookie = novoCookie.split(';')[0];
    const tipo = resposta.headers.get('content-type') || '';
    const dados = tipo.includes('json') ? await resposta.json() : await resposta.text();
    return { status: resposta.status, dados, headers: resposta.headers };
  };
}

const ENDERECO = { cep: '04230-000', logradouro: 'Estrada das Lágrimas', numero: '2461', bairro: 'Heliópolis', cidade: 'São Paulo', uf: 'sp' };

test('status e catálogo público', async () => {
  const visitante = criarCliente();
  assert.equal((await visitante('GET', '/api/status')).status, 200);

  const { dados } = await visitante('GET', '/api/produtos');
  assert.ok(dados.produtos.length >= 10);
  const banana = dados.produtos.find((p) => p.nome === 'Banana prata');
  assert.equal(banana.emOferta, true);
  assert.equal(banana.descontoPercentual, 33);

  const ofertas = await visitante('GET', '/api/produtos?ofertas=1');
  assert.ok(ofertas.dados.produtos.every((p) => p.emOferta));

  const frutas = await visitante('GET', '/api/produtos?categoria=frutas');
  assert.ok(frutas.dados.produtos.every((p) => p.categoria.slug === 'frutas'));

  const busca = await visitante('GET', '/api/produtos?busca=tomat');
  assert.equal(busca.dados.produtos[0].nome, 'Tomate italiano');

  const curinga = await visitante('GET', '/api/produtos?busca=%25');
  assert.equal(curinga.dados.produtos.length, 0, '% não pode virar curinga no LIKE');

  assert.equal((await visitante('GET', '/api/rota-que-nao-existe')).status, 404);

  const { dados: { loja } } = await visitante('GET', '/api/loja');
  assert.ok(Number.isFinite(loja.latitude) && Number.isFinite(loja.longitude));
  assert.ok(loja.raioEntregaKm > 0);
  assert.ok(banana.imagem.endsWith('.jpg'), 'produtos demonstrativos usam fotos');
});

test('produto vencido some da loja', async () => {
  const visitante = criarCliente();
  db.prepare("UPDATE produtos SET data_limite = '2020-01-01' WHERE nome = 'Rúcula'").run();
  const { dados } = await visitante('GET', '/api/produtos');
  assert.ok(!dados.produtos.some((p) => p.nome === 'Rúcula'));
});

test('cadastro, login e proteção de rotas', async () => {
  const cliente = criarCliente();
  assert.equal((await cliente('POST', '/api/pedidos', { itens: [] })).status, 401);

  const fraco = await cliente('POST', '/api/auth/cadastro', { nome: 'Ana', email: 'ana@teste.com', senha: '123', endereco: ENDERECO });
  assert.equal(fraco.status, 400);

  const cad = await cliente('POST', '/api/auth/cadastro', { nome: 'Ana Souza', email: 'ANA@teste.com', senha: 'senha12345', telefone: '(11) 91234-5678', endereco: ENDERECO });
  assert.equal(cad.status, 201);
  assert.equal(cad.dados.usuario.tipo, 'cliente');

  const senhaNoBanco = db.prepare('SELECT senha_hash FROM usuarios WHERE email = ?').get('ana@teste.com').senha_hash;
  assert.ok(senhaNoBanco.startsWith('$2'), 'senha precisa estar em hash');

  const repetido = await criarCliente()('POST', '/api/auth/cadastro', { nome: 'Outra', email: 'ana@teste.com', senha: 'senha12345', endereco: ENDERECO });
  assert.equal(repetido.status, 409);

  assert.equal((await cliente('GET', '/api/admin/resumo')).status, 403);
  const pagina = await cliente('GET', '/admin/');
  assert.equal(pagina.status, 403);

  const anonimo = await criarCliente()('GET', '/admin/');
  assert.equal(anonimo.status, 302);

  const errado = criarCliente();
  for (let i = 0; i < 5; i++) await errado('POST', '/api/auth/login', { email: 'ana@teste.com', senha: 'errada000' });
  const bloqueado = await errado('POST', '/api/auth/login', { email: 'ana@teste.com', senha: 'senha12345' });
  assert.equal(bloqueado.status, 429);

  const naoJson = await fetch(`${base}/api/auth/login`, { method: 'POST', body: 'email=a', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
  assert.equal(naoJson.status, 415);
});

test('pedido: preço vem do servidor, estoque baixa, cancelamento devolve', async () => {
  const cliente = criarCliente();
  await cliente('POST', '/api/auth/login', { email: 'bia@teste.com', senha: 'x' }); // conta não existe
  const cad = await cliente('POST', '/api/auth/cadastro', { nome: 'Bia Lima', email: 'bia@teste.com', senha: 'senha12345', endereco: ENDERECO });
  assert.equal(cad.status, 201);

  const banana = db.prepare("SELECT * FROM produtos WHERE nome = 'Banana prata'").get();
  const abacaxi = db.prepare("SELECT * FROM produtos WHERE nome = 'Abacaxi pérola'").get();
  const melancia = db.prepare("SELECT * FROM produtos WHERE nome = 'Melancia'").get();

  const conferido = await cliente('POST', '/api/carrinho/conferir', { itens: [{ produtoId: abacaxi.id, quantidade: 50 }] });
  assert.equal(conferido.dados.itens[0].quantidade, abacaxi.estoque);
  assert.ok(conferido.dados.itens[0].aviso);

  const semEstoque = await cliente('POST', '/api/pedidos', { itens: [{ produtoId: melancia.id, quantidade: 1 }], formaPagamento: 'pix', novoEndereco: ENDERECO });
  assert.equal(semEstoque.status, 409);

  const { dados: { enderecos } } = await cliente('GET', '/api/enderecos');
  const pedido = await cliente('POST', '/api/pedidos', {
    itens: [{ produtoId: banana.id, quantidade: 2, precoCentavos: 1 }, { produtoId: banana.id, quantidade: 1 }],
    formaPagamento: 'credito',
    enderecoId: enderecos[0].id,
    totalCentavos: 1,
  });
  assert.equal(pedido.status, 201);
  assert.equal(pedido.dados.pedido.totalCentavos, banana.preco_venda_centavos * 3, 'total recalculado no servidor');
  assert.equal(pedido.dados.pedido.itens[0].quantidade, 3, 'itens repetidos somados');
  const estoqueDepois = db.prepare('SELECT estoque FROM produtos WHERE id = ?').get(banana.id).estoque;
  assert.equal(estoqueDepois, banana.estoque - 3);

  const meus = await cliente('GET', '/api/pedidos');
  assert.equal(meus.dados.pedidos.length, 1);
  const outro = criarCliente();
  await outro('POST', '/api/auth/cadastro', { nome: 'Caio Reis', email: 'caio@teste.com', senha: 'senha12345', endereco: ENDERECO });
  assert.equal((await outro('GET', `/api/pedidos/${pedido.dados.pedido.id}`)).status, 404, 'cliente não vê pedido de outro');

  const admin = criarCliente();
  const login = await admin('POST', '/api/auth/login', { email: 'admin@teste.com', senha: 'senhaAdmin123' });
  assert.equal(login.status, 200);
  assert.equal(login.dados.usuario.tipo, 'admin');
  const cancelado = await admin('PATCH', `/api/admin/pedidos/${pedido.dados.pedido.id}/status`, { status: 'cancelado' });
  assert.equal(cancelado.status, 200);
  assert.equal(cancelado.dados.pedido.statusPagamento, 'estornado_simulado');
  assert.equal(db.prepare('SELECT estoque FROM produtos WHERE id = ?').get(banana.id).estoque, banana.estoque);

  const deNovo = await admin('PATCH', `/api/admin/pedidos/${pedido.dados.pedido.id}/status`, { status: 'em_preparacao' });
  assert.equal(deNovo.status, 409, 'pedido cancelado não volta');
});

test('admin: produtos, ofertas, exclusão protegida e fluxo de entrega', async () => {
  const admin = criarCliente();
  await admin('POST', '/api/auth/login', { email: 'admin@teste.com', senha: 'senhaAdmin123' });

  const resumo = await admin('GET', '/api/admin/resumo');
  assert.equal(resumo.status, 200);
  assert.ok(resumo.dados.estoqueBaixo.some((p) => p.nome === 'Abacaxi pérola'));
  assert.ok(resumo.dados.vencidos.some((p) => p.nome === 'Rúcula'));

  const base = { nome: 'Uva niágara', descricao: 'Doce', categoriaId: 1, unidade: 'bandeja', precoOriginalCentavos: 990, estoque: 10 };
  const ofertaRuim = await admin('POST', '/api/admin/produtos', { ...base, emOferta: true, precoPromocionalCentavos: 1200, dataLimite: '2099-01-01' });
  assert.equal(ofertaRuim.status, 400);
  const semData = await admin('POST', '/api/admin/produtos', { ...base, emOferta: true, precoPromocionalCentavos: 700 });
  assert.equal(semData.status, 400);
  const imagemRuim = await admin('POST', '/api/admin/produtos', { ...base, imagem: 'javascript:alert(1)' });
  assert.equal(imagemRuim.status, 400);

  const criado = await admin('POST', '/api/admin/produtos', { ...base, emOferta: true, precoPromocionalCentavos: 690, dataLimite: '2099-01-01' });
  assert.equal(criado.status, 201);
  assert.equal(criado.dados.produto.descontoPercentual, 30);
  const uvaId = criado.dados.produto.id;

  const semOferta = await admin('PUT', `/api/admin/produtos/${uvaId}`, { ...base, emOferta: false, precoPromocionalCentavos: 1 });
  assert.equal(semOferta.dados.produto.precoVendaCentavos, 990);

  const desativado = await admin('PATCH', `/api/admin/produtos/${uvaId}/ativo`, { ativo: false });
  assert.equal(desativado.dados.produto.ativo, false);
  assert.equal((await criarCliente()('GET', `/api/produtos/${uvaId}`)).status, 404);

  // entregador
  const ent = await admin('POST', '/api/admin/entregadores', { nome: 'Davi Entregas', email: 'davi@teste.com', senha: 'entrega123' });
  assert.equal(ent.status, 201);

  const cliente = criarCliente();
  await cliente('POST', '/api/auth/cadastro', { nome: 'Edu Melo', email: 'edu@teste.com', senha: 'senha12345', endereco: ENDERECO });
  const cenoura = db.prepare("SELECT id FROM produtos WHERE nome = 'Cenoura'").get();
  const pedido = (await cliente('POST', '/api/pedidos', { itens: [{ produtoId: cenoura.id, quantidade: 2 }], formaPagamento: 'pix', novoEndereco: ENDERECO })).dados.pedido;

  const excluir = await admin('DELETE', `/api/admin/produtos/${cenoura.id}`);
  assert.equal(excluir.status, 409, 'produto vendido não pode ser excluído');
  assert.equal((await admin('DELETE', `/api/admin/produtos/${uvaId}`)).status, 200);

  assert.equal((await admin('PATCH', `/api/admin/pedidos/${pedido.id}/status`, { status: 'em_preparacao' })).status, 200);
  const semEntregador = await admin('PATCH', `/api/admin/pedidos/${pedido.id}/status`, { status: 'saiu_para_entrega' });
  assert.equal(semEntregador.status, 409);
  assert.equal((await admin('PATCH', `/api/admin/pedidos/${pedido.id}/entregador`, { entregadorId: ent.dados.entregador.id })).status, 200);

  const entregador = criarCliente();
  await entregador('POST', '/api/auth/login', { email: 'davi@teste.com', senha: 'entrega123' });
  assert.equal((await entregador('GET', '/api/admin/pedidos')).status, 403);
  const minhas = await entregador('GET', '/api/entregas');
  assert.equal(minhas.dados.entregas.length, 1);
  assert.equal((await entregador('PATCH', `/api/entregas/${pedido.id}/status`, { status: 'cancelado' })).status, 400);
  assert.equal((await entregador('PATCH', `/api/entregas/${pedido.id}/status`, { status: 'saiu_para_entrega' })).status, 200);
  const fim = await entregador('PATCH', `/api/entregas/${pedido.id}/status`, { status: 'entregue' });
  assert.equal(fim.dados.entrega.status, 'entregue');

  const visto = await cliente('GET', `/api/pedidos/${pedido.id}`);
  assert.equal(visto.dados.pedido.status, 'entregue');
  assert.equal(visto.dados.pedido.entregador.nome, 'Davi Entregas');

  // admin desativa o entregador: a sessão dele perde acesso na hora
  await admin('PATCH', `/api/admin/entregadores/${ent.dados.entregador.id}/ativo`, { ativo: false });
  assert.equal((await entregador('GET', '/api/entregas')).status, 401);
});
