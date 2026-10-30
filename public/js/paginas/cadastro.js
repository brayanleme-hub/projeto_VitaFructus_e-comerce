// js/paginas/cadastro.js
import { iniciarLayout } from '../layout.js';
import { api } from '../api.js';
import { camposEndereco, aplicarMascaraCep, aplicarMascaraTelefone, lerEndereco, validarEndereco, mostrarErro, comBotaoOcupado } from '../formularios.js';
import { parametro, destinoSeguro } from '../util.js';

async function iniciar() {
  const usuario = await iniciarLayout();
  const voltar = parametro('voltar');
  if (voltar) document.getElementById('link-login').href = `/login.html?voltar=${encodeURIComponent(voltar)}`;
  if (usuario) location.replace(destinoSeguro(voltar, '/'));

  const form = document.getElementById('form-cadastro');
  const caixaErro = document.getElementById('erro-cadastro');
  document.getElementById('campos-endereco').innerHTML = camposEndereco('cad');
  aplicarMascaraCep(form.querySelector('[name="cep"]'));
  aplicarMascaraTelefone(form.telefone);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nome = form.nome.value.trim();
    const email = form.email.value.trim();
    const senha = form.senha.value;
    const endereco = lerEndereco(document.getElementById('campos-endereco'));

    // Validação rápida no navegador; o servidor confere tudo de novo
    if (nome.length < 2) return mostrarErro(caixaErro, 'Digite seu nome completo.', form.nome);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return mostrarErro(caixaErro, 'Digite um e-mail válido, como nome@exemplo.com.', form.email);
    if (senha.length < 8) return mostrarErro(caixaErro, 'A senha precisa ter pelo menos 8 caracteres.', form.senha);
    if (senha !== form.confirmar.value) return mostrarErro(caixaErro, 'As duas senhas não são iguais.', form.confirmar);
    const erroEndereco = validarEndereco(endereco);
    if (erroEndereco) return mostrarErro(caixaErro, erroEndereco);

    try {
      await comBotaoOcupado(form.querySelector('button[type="submit"]'), 'Criando conta...', () =>
        api('/api/auth/cadastro', { metodo: 'POST', corpo: { nome, email, senha, telefone: form.telefone.value, endereco } }));
      location.href = destinoSeguro(voltar, '/?bemvindo=1');
    } catch (erro) {
      mostrarErro(caixaErro, erro.message);
    }
  });
}

iniciar();
