// database/conexao.js
// Abre (ou cria) o arquivo do banco SQLite e exporta a conexão.
// Todos os outros arquivos usam ESTA mesma conexão.

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

// O caminho pode ser trocado pela variável DB_ARQUIVO (os testes usam isso)
const arquivo = process.env.DB_ARQUIVO
  ? path.resolve(process.env.DB_ARQUIVO)
  : path.join(__dirname, 'vitafructus.db');

fs.mkdirSync(path.dirname(arquivo), { recursive: true });

const db = new Database(arquivo);

// WAL: melhora o desempenho quando há leituras e escritas ao mesmo tempo
db.pragma('journal_mode = WAL');
// O SQLite vem com as chaves estrangeiras DESLIGADAS. Aqui ligamos.
db.pragma('foreign_keys = ON');

module.exports = db;
