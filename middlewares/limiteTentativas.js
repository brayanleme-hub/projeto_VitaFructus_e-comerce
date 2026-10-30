// middlewares/limiteTentativas.js
// Proteção básica contra quem tenta adivinhar senhas:
// depois de 5 tentativas erradas para o mesmo e-mail (no mesmo IP),
// o login fica bloqueado por 15 minutos.

const MAXIMO_TENTATIVAS = 5;
const JANELA_MS = 15 * 60 * 1000;

const tentativas = new Map(); // chave -> { falhas, primeiraFalha }

function chave(req) {
  const email = String((req.body && req.body.email) || '').trim().toLowerCase();
  return `${req.ip}|${email}`;
}

function verificarBloqueio(req, res, next) {
  const registro = tentativas.get(chave(req));
  if (registro && Date.now() - registro.primeiraFalha > JANELA_MS) {
    tentativas.delete(chave(req));
  } else if (registro && registro.falhas >= MAXIMO_TENTATIVAS) {
    const minutos = Math.ceil((JANELA_MS - (Date.now() - registro.primeiraFalha)) / 60000);
    return res.status(429).json({
      erro: `Muitas tentativas de login. Tente de novo em ${minutos} minuto(s).`,
    });
  }
  next();
}

function registrarFalha(req) {
  const k = chave(req);
  const registro = tentativas.get(k) || { falhas: 0, primeiraFalha: Date.now() };
  registro.falhas += 1;
  tentativas.set(k, registro);
}

function limparFalhas(req) {
  tentativas.delete(chave(req));
}

module.exports = { verificarBloqueio, registrarFalha, limparFalhas };
