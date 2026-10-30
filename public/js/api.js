// js/api.js
// Uma única função para conversar com o servidor usando fetch().
// Ela já envia JSON, lê a resposta e transforma erros em exceções com mensagem clara.

export class ErroApi extends Error {
  constructor(mensagem, status) {
    super(mensagem);
    this.status = status;
  }
}

export async function api(url, { metodo = 'GET', corpo } = {}) {
  let resposta;
  try {
    resposta = await fetch(url, {
      method: metodo,
      headers: corpo ? { 'Content-Type': 'application/json' } : {},
      body: corpo ? JSON.stringify(corpo) : undefined,
      credentials: 'same-origin', // envia o cookie de sessão
    });
  } catch {
    throw new ErroApi('Sem conexão com o servidor. Confira sua internet e tente de novo.', 0);
  }

  let dados = {};
  try {
    dados = await resposta.json();
  } catch {
    /* resposta sem JSON */
  }

  if (!resposta.ok) {
    throw new ErroApi(dados.erro || `Erro ${resposta.status}`, resposta.status);
  }
  return dados;
}

// Usuário logado (ou null). Guardado para não perguntar ao servidor várias vezes.
let usuarioPromise = null;
export function usuarioAtual({ recarregar = false } = {}) {
  if (!usuarioPromise || recarregar) {
    usuarioPromise = api('/api/auth/eu')
      .then((d) => d.usuario)
      .catch(() => null);
  }
  return usuarioPromise;
}
