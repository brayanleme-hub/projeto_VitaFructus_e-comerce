// database/inicializar.js
// 1) Cria as tabelas (schema.sql)
// 2) Cadastra categorias e produtos demonstrativos, se o banco estiver vazio
// 3) Cria o administrador inicial pelas variáveis ADMIN_EMAIL / ADMIN_SENHA, se existirem

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const db = require('./conexao');
const { daquiDias } = require('../utils/datas');

const CATEGORIAS = [
  { nome: 'Frutas', slug: 'frutas' },
  { nome: 'Verduras', slug: 'verduras' },
  { nome: 'Legumes', slug: 'legumes' },
];

// Produtos DEMONSTRATIVOS. Preços em centavos.
// oferta: { preco, dias } -> preço promocional e quantos dias até a data-limite
const PRODUTOS_DEMO = [
  { nome: 'Banana prata', cat: 'frutas', unidade: 'kg', preco: 599, estoque: 40, img: 'banana', oferta: { preco: 399, dias: 2 },
    descricao: 'Bem madura e docinha, ótima para vitaminas, bolos e doces.' },
  { nome: 'Maçã gala', cat: 'frutas', unidade: 'kg', preco: 1149, estoque: 30, img: 'maca',
    descricao: 'Crocante e suculenta, vinda da serra catarinense.' },
  { nome: 'Laranja pera', cat: 'frutas', unidade: 'kg', preco: 449, estoque: 60, img: 'laranja',
    descricao: 'Muito suco e pouca semente. A preferida para o suco da manhã.' },
  { nome: 'Manga palmer', cat: 'frutas', unidade: 'unidade', preco: 549, estoque: 25, img: 'manga',
    descricao: 'Polpa firme, sem fiapos e bem perfumada.' },
  { nome: 'Morango', cat: 'frutas', unidade: 'bandeja', preco: 899, estoque: 15, img: 'morango', oferta: { preco: 649, dias: 1 },
    descricao: 'Bandeja de 250 g, no ponto para consumir hoje ou amanhã.' },
  { nome: 'Abacaxi pérola', cat: 'frutas', unidade: 'unidade', preco: 799, estoque: 3, img: 'abacaxi',
    descricao: 'Doce e pouco ácido, já escolhido no ponto.' },
  { nome: 'Melancia', cat: 'frutas', unidade: 'unidade', preco: 2490, estoque: 0, img: 'melancia',
    descricao: 'Inteira, cerca de 8 kg. Vermelhinha por dentro.' },
  { nome: 'Abacate', cat: 'frutas', unidade: 'kg', preco: 699, estoque: 18, img: 'abacate', oferta: { preco: 449, dias: 2 },
    descricao: 'Maduro, pronto para guacamole ou vitamina.' },
  { nome: 'Alface crespa', cat: 'verduras', unidade: 'unidade', preco: 349, estoque: 35, img: 'alface',
    descricao: 'Pé inteiro, folhas firmes e fresquinhas.' },
  { nome: 'Couve manteiga', cat: 'verduras', unidade: 'maço', preco: 399, estoque: 20, img: 'couve',
    descricao: 'Maço com folhas largas, ideal para refogar ou suco verde.' },
  { nome: 'Rúcula', cat: 'verduras', unidade: 'maço', preco: 450, estoque: 12, img: 'rucula', oferta: { preco: 299, dias: 1 },
    descricao: 'Sabor marcante, perfeita para saladas e pizzas.' },
  { nome: 'Brócolis ninja', cat: 'verduras', unidade: 'unidade', preco: 899, estoque: 10, img: 'brocolis',
    descricao: 'Cabeça firme e verdinha, rende bem no vapor.' },
  { nome: 'Batata', cat: 'legumes', unidade: 'kg', preco: 549, estoque: 80, img: 'batata',
    descricao: 'Batata lavada, boa para fritar, assar ou fazer purê.' },
  { nome: 'Cenoura', cat: 'legumes', unidade: 'kg', preco: 499, estoque: 50, img: 'cenoura',
    descricao: 'Cenouras médias e crocantes.' },
  { nome: 'Tomate italiano', cat: 'legumes', unidade: 'kg', preco: 749, estoque: 22, img: 'tomate', oferta: { preco: 499, dias: 1 },
    descricao: 'Bem vermelho e maduro, o ponto certo para molho.' },
  { nome: 'Abobrinha', cat: 'legumes', unidade: 'kg', preco: 599, estoque: 4, img: 'abobrinha',
    descricao: 'Abobrinha italiana, casca lisa e macia.' },
  { nome: 'Cebola', cat: 'legumes', unidade: 'kg', preco: 459, estoque: 70, img: 'cebola',
    descricao: 'Cebola amarela, base de quase todo tempero.' },
];

function criarTabelas() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  db.exec(sql);
}

function cadastrarDadosDemonstrativos() {
  const { total } = db.prepare('SELECT COUNT(*) AS total FROM produtos').get();
  if (total > 0) return false; // já tem produtos: não mexe em nada

  const inserirCategoria = db.prepare('INSERT OR IGNORE INTO categorias (nome, slug) VALUES (?, ?)');
  const buscarCategoria = db.prepare('SELECT id FROM categorias WHERE slug = ?');
  const inserirProduto = db.prepare(`
    INSERT INTO produtos (nome, descricao, categoria_id, unidade, preco_original_centavos,
                          preco_venda_centavos, imagem, estoque, data_limite, em_oferta)
    VALUES (@nome, @descricao, @categoria_id, @unidade, @preco_original, @preco_venda,
            @imagem, @estoque, @data_limite, @em_oferta)
  `);

  // transaction(): ou grava tudo, ou não grava nada
  const cadastrar = db.transaction(() => {
    for (const c of CATEGORIAS) inserirCategoria.run(c.nome, c.slug);
    for (const p of PRODUTOS_DEMO) {
      inserirProduto.run({
        nome: p.nome,
        descricao: p.descricao,
        categoria_id: buscarCategoria.get(p.cat).id,
        unidade: p.unidade,
        preco_original: p.preco,
        preco_venda: p.oferta ? p.oferta.preco : p.preco,
        imagem: `/img/produtos/${p.img}.jpg`,
        estoque: p.estoque,
        data_limite: p.oferta ? daquiDias(p.oferta.dias) : null,
        em_oferta: p.oferta ? 1 : 0,
      });
    }
  });
  cadastrar();
  return true;
}

// Cria o admin inicial SOMENTE se:
// - as variáveis ADMIN_EMAIL e ADMIN_SENHA estiverem definidas no .env, e
// - ainda não existir nenhum administrador.
// Nenhuma senha fica escrita no código.
function criarAdminPeloAmbiente() {
  const { ADMIN_EMAIL, ADMIN_SENHA, ADMIN_NOME } = process.env;
  if (!ADMIN_EMAIL || !ADMIN_SENHA) return false;

  const existe = db.prepare("SELECT 1 FROM usuarios WHERE tipo = 'admin' LIMIT 1").get();
  if (existe) return false;

  if (ADMIN_SENHA.length < 8) {
    console.warn('[admin] ADMIN_SENHA precisa ter pelo menos 8 caracteres. Admin NÃO criado.');
    return false;
  }

  const hash = bcrypt.hashSync(ADMIN_SENHA, 10);
  db.prepare(`
    INSERT INTO usuarios (nome, email, senha_hash, tipo) VALUES (?, ?, ?, 'admin')
    ON CONFLICT(email) DO UPDATE SET tipo = 'admin', senha_hash = excluded.senha_hash
  `).run(ADMIN_NOME || 'Administrador', ADMIN_EMAIL.trim().toLowerCase(), hash);
  console.log(`[admin] Administrador criado: ${ADMIN_EMAIL}`);
  return true;
}

function inicializarBanco() {
  criarTabelas();
  const criouDemo = cadastrarDadosDemonstrativos();
  if (criouDemo && process.env.NODE_ENV !== 'test') {
    console.log('[banco] Tabelas criadas e produtos demonstrativos cadastrados.');
  }
  criarAdminPeloAmbiente();
}

module.exports = { inicializarBanco };
