// middlewares/seguranca.js
// Cabeçalhos HTTP de segurança e uma checagem simples nas requisições da API.

function cabecalhosSeguranca(req, res, next) {
  res.set({
    'X-Content-Type-Options': 'nosniff', // o navegador não "adivinha" o tipo do arquivo
    'X-Frame-Options': 'DENY', // o site não pode ser aberto dentro de um iframe de outro site
    'Referrer-Policy': 'same-origin',
    // geolocation=(self): só o próprio site pode pedir a localização (página Onde estamos)
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self)',
  });
  next();
}

// Toda requisição que altera dados (POST, PUT, PATCH, DELETE) precisa vir em JSON.
// Formulários de outros sites não conseguem enviar JSON sem permissão do servidor,
// então isso ajuda a barrar ataques do tipo CSRF.
function exigirJson(req, res, next) {
  const alteraDados = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
  const temCorpo = req.headers['transfer-encoding'] !== undefined || Number(req.headers['content-length'] || 0) > 0;
  if (alteraDados && temCorpo && !req.is('application/json')) {
    return res.status(415).json({ erro: 'Envie os dados no formato JSON.' });
  }
  if (alteraDados) {
    const origem = req.headers.origin;
    if (origem && origem !== `${req.protocol}://${req.get('host')}`) {
      return res.status(403).json({ erro: 'Origem da requisição não permitida.' });
    }
  }
  next();
}

module.exports = { cabecalhosSeguranca, exigirJson };
