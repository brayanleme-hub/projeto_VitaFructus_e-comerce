// database/sessaoStore.js
// Guarda as sessões de login no próprio SQLite (tabela "sessoes").
// Sem isso, o express-session guardaria na memória e todo mundo seria
// deslogado sempre que o servidor reiniciasse (e o "npm run dev" reinicia a cada Ctrl+S).

const session = require('express-session');
const db = require('./conexao');

const UM_DIA = 24 * 60 * 60 * 1000;

class SessaoSQLiteStore extends session.Store {
  constructor() {
    super();
    this.sqlBuscar = db.prepare('SELECT dados, expira_em FROM sessoes WHERE sid = ?');
    this.sqlSalvar = db.prepare(`
      INSERT INTO sessoes (sid, dados, expira_em) VALUES (?, ?, ?)
      ON CONFLICT(sid) DO UPDATE SET dados = excluded.dados, expira_em = excluded.expira_em
    `);
    this.sqlApagar = db.prepare('DELETE FROM sessoes WHERE sid = ?');
    this.sqlRenovar = db.prepare('UPDATE sessoes SET expira_em = ? WHERE sid = ?');
    this.sqlLimpar = db.prepare('DELETE FROM sessoes WHERE expira_em < ?');

    this.limparExpiradas();
    // A cada 15 min apaga sessões vencidas. unref() não impede o Node de encerrar.
    setInterval(() => this.limparExpiradas(), 15 * 60 * 1000).unref();
  }

  expiracao(sessao) {
    const expira = sessao && sessao.cookie && sessao.cookie.expires;
    return expira ? new Date(expira).getTime() : Date.now() + UM_DIA;
  }

  limparExpiradas() {
    this.sqlLimpar.run(Date.now());
  }

  get(sid, callback) {
    try {
      const linha = this.sqlBuscar.get(sid);
      if (!linha || linha.expira_em < Date.now()) return callback(null, null);
      callback(null, JSON.parse(linha.dados));
    } catch (erro) {
      callback(erro);
    }
  }

  set(sid, sessao, callback = () => {}) {
    try {
      this.sqlSalvar.run(sid, JSON.stringify(sessao), this.expiracao(sessao));
      callback(null);
    } catch (erro) {
      callback(erro);
    }
  }

  destroy(sid, callback = () => {}) {
    try {
      this.sqlApagar.run(sid);
      callback(null);
    } catch (erro) {
      callback(erro);
    }
  }

  touch(sid, sessao, callback = () => {}) {
    try {
      this.sqlRenovar.run(this.expiracao(sessao), sid);
      callback(null);
    } catch (erro) {
      callback(erro);
    }
  }
}

module.exports = SessaoSQLiteStore;
