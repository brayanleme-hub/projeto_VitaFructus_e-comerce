// controllers/authController.js
// P1 do DFD — Gerenciar clientes: cadastro, login, logout e "quem sou eu".

const bcrypt = require('bcryptjs');
const db = require('../database/conexao');
const validar = require('../utils/validacoes');
const { ErroHttp } = require('../utils/erros');
const limite = require('../middlewares/limiteTentativas');

const CUSTO_BCRYPT = 10;
// Hash "falso" usado quando o e-mail não existe, para o tempo de resposta
// ser parecido e ninguém descobrir quais e-mails estão cadastrados.
const HASH_FALSO = bcrypt.hashSync('senha-que-nao-existe', CUSTO_BCRYPT);

function usuarioPublico(u) {
  return { id: u.id, nome: u.nome, email: u.email, telefone: u.telefone, tipo: u.tipo };
}

// Cria uma sessão NOVA ao entrar (evita "fixação de sessão")
function iniciarSessao(req, usuarioId) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((erro) => {
      if (erro) return reject(erro);
      req.session.usuarioId = usuarioId;
      req.session.save((erro2) => (erro2 ? reject(erro2) : resolve()));
    });
  });
}

// POST /api/auth/cadastro
async function cadastrar(req, res) {
  const dados = req.body || {};
  const nome = validar.texto(dados.nome, 'nome', { min: 2, max: 80 });
  const email = validar.email(dados.email);
  const senha = validar.senha(dados.senha);
  const telefone = validar.telefone(dados.telefone);
  const endereco = validar.endereco(dados.endereco);

  const jaExiste = db.prepare('SELECT 1 FROM usuarios WHERE email = ?').get(email);
  if (jaExiste) throw new ErroHttp(409, 'Este e-mail já está cadastrado. Tente entrar na sua conta.');

  const senhaHash = await bcrypt.hash(senha, CUSTO_BCRYPT);

  // Usuário e endereço são gravados juntos (transação)
  const criar = db.transaction(() => {
    const { lastInsertRowid } = db
      .prepare("INSERT INTO usuarios (nome, email, senha_hash, telefone, tipo) VALUES (?, ?, ?, ?, 'cliente')")
      .run(nome, email, senhaHash, telefone);
    db.prepare(`
      INSERT INTO enderecos (usuario_id, cep, logradouro, numero, complemento, bairro, cidade, uf)
      VALUES (@usuario_id, @cep, @logradouro, @numero, @complemento, @bairro, @cidade, @uf)
    `).run({ usuario_id: lastInsertRowid, ...endereco });
    return Number(lastInsertRowid);
  });
  const id = criar();

  await iniciarSessao(req, id);
  const usuario = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(id);
  res.status(201).json({ mensagem: 'Conta criada com sucesso!', usuario: usuarioPublico(usuario) });
}

// POST /api/auth/login
async function entrar(req, res) {
  const dados = req.body || {};
  const email = validar.email(dados.email);
  if (typeof dados.senha !== 'string' || dados.senha === '') throw new ErroHttp(400, 'Digite sua senha.');

  const usuario = db.prepare('SELECT * FROM usuarios WHERE email = ?').get(email);
  const senhaConfere = await bcrypt.compare(dados.senha, usuario ? usuario.senha_hash : HASH_FALSO);

  if (!usuario || !senhaConfere || !usuario.ativo) {
    limite.registrarFalha(req);
    // Mensagem genérica de propósito: não diz se o erro foi no e-mail ou na senha
    throw new ErroHttp(401, 'E-mail ou senha incorretos.');
  }

  limite.limparFalhas(req);
  await iniciarSessao(req, usuario.id);
  res.json({ mensagem: `Olá, ${usuario.nome.split(' ')[0]}!`, usuario: usuarioPublico(usuario) });
}

// POST /api/auth/logout
function sair(req, res) {
  req.session.destroy(() => {
    res.clearCookie('vf.sid');
    res.json({ mensagem: 'Você saiu da sua conta.' });
  });
}

// GET /api/auth/eu — devolve o usuário logado (ou null)
function quemSouEu(req, res) {
  res.json({ usuario: req.usuario ? usuarioPublico(req.usuario) : null });
}

module.exports = { cadastrar, entrar, sair, quemSouEu };
