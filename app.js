// app.js — monta o aplicativo Express (sem ligar o servidor).
// Separar app.js de server.js permite testar a API sem abrir uma porta fixa.

require('dotenv').config({ quiet: true });

const path = require('path');
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');

// 1) O banco precisa existir ANTES de carregar rotas e controllers
const { inicializarBanco } = require('./database/inicializar');
inicializarBanco();

const SessaoSQLiteStore = require('./database/sessaoStore');
const { carregarUsuario, exigirPapelPagina } = require('./middlewares/autenticacao');
const { cabecalhosSeguranca, exigirJson } = require('./middlewares/seguranca');
const { rotaNaoEncontrada, tratarErros } = require('./middlewares/erros');
const rotasApi = require('./routes');

const producao = process.env.NODE_ENV === 'production';

let segredoSessao = process.env.SESSION_SECRET;
if (!segredoSessao) {
  if (producao) throw new Error('Defina SESSION_SECRET nas variáveis de ambiente.');
  segredoSessao = crypto.randomBytes(32).toString('hex');
  console.warn('[aviso] SESSION_SECRET não definido no .env. Usando um segredo temporário.');
}

const app = express();
app.disable('x-powered-by'); // não anuncia que o servidor usa Express

// Em hospedagens como o Render existe um "proxy" na frente do Node (HTTPS).
if (producao) app.set('trust proxy', 1);

app.use(cabecalhosSeguranca);
app.use(express.json({ limit: '100kb' }));

// 2) Sessão de login guardada em cookie seguro
app.use(session({
  name: 'vf.sid',
  secret: segredoSessao,
  store: new SessaoSQLiteStore(),
  resave: false,
  saveUninitialized: false, // só cria cookie quando alguém faz login
  rolling: true, // cada acesso renova o prazo
  cookie: {
    httpOnly: true, // o JavaScript da página não consegue ler o cookie
    sameSite: 'lax', // o cookie não vai em requisições vindas de outros sites
    secure: producao, // em produção, só via HTTPS
    maxAge: 1000 * 60 * 60 * 8, // 8 horas
  },
}));
app.use(carregarUsuario);

// 3) API REST
app.use('/api', exigirJson, rotasApi);
app.use('/api', rotaNaoEncontrada);

// 4) Páginas restritas: só são entregues depois de conferir o papel no servidor
app.use('/admin', exigirPapelPagina('admin'), express.static(path.join(__dirname, 'painel-admin'), { extensions: ['html'] }));
app.use('/entregas', exigirPapelPagina('entregador'), express.static(path.join(__dirname, 'painel-entregador'), { extensions: ['html'] }));

// 5) Loja (arquivos públicos). O service worker nunca deve ficar preso em cache.
app.get('/sw.js', (req, res, next) => {
  res.set('Cache-Control', 'no-cache');
  next();
});
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

// 6) Página 404 e tratamento de erros
app.use((req, res) => res.status(404).sendFile(path.join(__dirname, 'public', '404.html')));
app.use(tratarErros);

module.exports = app;
