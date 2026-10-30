// scripts/criar-admin.js
// Cria (ou promove) a conta de ADMINISTRADOR pelo terminal.
// Uso:  npm run criar-admin
// A senha é digitada na hora e salva só como hash. Nada fica escrito no código.

require('dotenv').config({ quiet: true });
const readline = require('readline');
const bcrypt = require('bcryptjs');
const { inicializarBanco } = require('../database/inicializar');
const db = require('../database/conexao');
const validar = require('../utils/validacoes');

inicializarBanco();

const terminal = readline.createInterface({ input: process.stdin, output: process.stdout });
const perguntar = (texto) => new Promise((resolve) => terminal.question(texto, resolve));

async function principal() {
  console.log('\n=== Criar administrador do VitaFructus ===\n');
  try {
    const nome = validar.texto(await perguntar('Nome: '), 'nome', { min: 2, max: 80 });
    const email = validar.email(await perguntar('E-mail: '));
    const senha = validar.senha(await perguntar('Senha (mínimo 8 caracteres): '));
    const confirmacao = await perguntar('Repita a senha: ');
    if (senha !== confirmacao) throw new Error('As senhas não são iguais.');

    const hash = await bcrypt.hash(senha, 10);
    const existente = db.prepare('SELECT id FROM usuarios WHERE email = ?').get(email);
    if (existente) {
      db.prepare("UPDATE usuarios SET nome = ?, senha_hash = ?, tipo = 'admin', ativo = 1 WHERE id = ?").run(nome, hash, existente.id);
      console.log(`\nConta ${email} agora é ADMINISTRADORA (senha atualizada).`);
    } else {
      db.prepare("INSERT INTO usuarios (nome, email, senha_hash, tipo) VALUES (?, ?, ?, 'admin')").run(nome, email, hash);
      console.log(`\nAdministrador ${email} criado!`);
    }
    console.log('Entre em http://localhost:3000/login.html e depois acesse /admin\n');
  } catch (erro) {
    console.error(`\nNão foi possível criar o administrador: ${erro.message}\n`);
    process.exitCode = 1;
  } finally {
    terminal.close();
  }
}

principal();
