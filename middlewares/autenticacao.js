// middlewares/autenticacao.js
// Os "porteiros" do sistema. A permissão é SEMPRE conferida aqui no servidor;
// esconder botões no frontend é só conforto visual, não segurança.

const path = require('path');
const db = require('../database/conexao');

const sqlUsuario = db.prepare('SELECT id, nome, email, telefone, tipo, ativo FROM usuarios WHERE id = ?');

// Roda em toda requisição: se houver sessão, busca o usuário no banco.
// Buscar no banco (e não só confiar na sessão) garante que um usuário
// desativado pelo admin perca o acesso na hora.
function carregarUsuario(req, res, next) {
  const idSessao = req.session && req.session.usuarioId;
  if (!idSessao) return next();

  const usuario = sqlUsuario.get(idSessao);
  if (!usuario || !usuario.ativo) {
    return req.session.destroy(() => next());
  }
  req.usuario = usuario;
  next();
}

// Para rotas da API que exigem login
function exigirLogin(req, res, next) {
  if (!req.usuario) {
    return res.status(401).json({ erro: 'Entre na sua conta para continuar.' });
  }
  next();
}

// Para rotas da API que exigem um papel específico. Ex.: exigirPapel('admin')
function exigirPapel(...papeis) {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({ erro: 'Entre na sua conta para continuar.' });
    }
    if (!papeis.includes(req.usuario.tipo)) {
      return res.status(403).json({ erro: 'Você não tem permissão para acessar este recurso.' });
    }
    next();
  };
}

// Para PÁGINAS (painel admin e área do entregador): redireciona em vez de devolver JSON
function exigirPapelPagina(...papeis) {
  return (req, res, next) => {
    if (!req.usuario) {
      const voltar = encodeURIComponent(req.originalUrl);
      return res.redirect(`/login.html?voltar=${voltar}`);
    }
    if (!papeis.includes(req.usuario.tipo)) {
      return res.status(403).sendFile(path.join(__dirname, '..', 'public', 'acesso-negado.html'));
    }
    // páginas restritas não devem ficar guardadas em cache
    res.set('Cache-Control', 'no-store');
    next();
  };
}

module.exports = { carregarUsuario, exigirLogin, exigirPapel, exigirPapelPagina };
