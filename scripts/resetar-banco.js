// scripts/resetar-banco.js
// APAGA o banco e cria tudo de novo com os produtos demonstrativos.
// Útil antes da apresentação: as ofertas ganham datas-limite novas a partir de hoje.
// Uso:  npm run resetar-banco
// Atenção: clientes, pedidos e admins são apagados. Depois rode "npm run criar-admin".

const fs = require('fs');
const path = require('path');

const arquivo = process.env.DB_ARQUIVO
  ? path.resolve(process.env.DB_ARQUIVO)
  : path.join(__dirname, '..', 'database', 'vitafructus.db');

for (const extra of ['', '-wal', '-shm']) {
  try {
    fs.unlinkSync(arquivo + extra);
  } catch (erro) {
    if (erro.code === 'EBUSY' || erro.code === 'EPERM') {
      console.error('O banco está em uso. Pare o servidor (Ctrl + C) e rode o comando de novo.');
      process.exit(1);
    }
  }
}

require('dotenv').config({ quiet: true });
const { inicializarBanco } = require('../database/inicializar');
inicializarBanco();
console.log('Banco recriado com os produtos demonstrativos.');
console.log('Agora crie o administrador: npm run criar-admin');
