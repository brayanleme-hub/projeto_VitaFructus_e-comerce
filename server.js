// server.js — ponto de entrada: liga o servidor na porta configurada.
const os = require('os');
const app = require('./app');

const PORTA = Number(process.env.PORT) || 3000;

app.listen(PORTA, () => {
  console.log(`\nVitaFructus rodando em http://localhost:${PORTA}`);

  // Mostra o endereço para abrir no celular (mesmo Wi-Fi)
  for (const interfaces of Object.values(os.networkInterfaces())) {
    for (const rede of interfaces || []) {
      if (rede.family === 'IPv4' && !rede.internal) {
        console.log(`No celular (mesmo Wi-Fi): http://${rede.address}:${PORTA}`);
      }
    }
  }
  console.log('Para parar: Ctrl + C\n');
});
