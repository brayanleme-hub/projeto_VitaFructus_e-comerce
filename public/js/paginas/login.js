// js/paginas/login.js
import { iniciarLayout } from '../layout.js';
import { api } from '../api.js';
import { mostrarErro, comBotaoOcupado } from '../formularios.js';
import { parametro, destinoSeguro } from '../util.js';

const DESTINO_POR_PAPEL = { admin: '/admin/', entregador: '/entregas/', cliente: '/' };

async function iniciar() {
  const usuario = await iniciarLayout();
  const voltar = parametro('voltar');
  if (voltar) document.getElementById('link-cadastro').href = `/cadastro.html?voltar=${encodeURIComponent(voltar)}`;
  if (usuario) location.replace(destinoSeguro(voltar, DESTINO_POR_PAPEL[usuario.tipo]));

  const form = document.getElementById('form-login');
  const caixaErro = document.getElementById('erro-login');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = form.email.value.trim();
    const senha = form.senha.value;
    if (!email) return mostrarErro(caixaErro, 'Digite seu e-mail.', form.email);
    if (!senha) return mostrarErro(caixaErro, 'Digite sua senha.', form.senha);

    try {
      const { usuario: logado } = await comBotaoOcupado(form.querySelector('button'), 'Entrando...', () =>
        api('/api/auth/login', { metodo: 'POST', corpo: { email, senha } }));
      location.href = destinoSeguro(voltar, DESTINO_POR_PAPEL[logado.tipo]);
    } catch (erro) {
      mostrarErro(caixaErro, erro.message);
      form.senha.value = '';
    }
  });
}

iniciar();
