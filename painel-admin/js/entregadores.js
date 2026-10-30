// painel-admin/js/entregadores.js — cadastrar e ativar/desativar entregadores
import { iniciarPainel } from '/js/painel.js';
import { api } from '/js/api.js';
import { avisar } from '/js/layout.js';
import { escapar, telefoneFormatado } from '/js/util.js';
import { mostrarErro, comBotaoOcupado, aplicarMascaraTelefone } from '/js/formularios.js';

const form = document.getElementById('form-entregador');
const caixaErro = document.getElementById('erro-entregador');
let entregadores = [];

async function carregar() {
  ({ entregadores } = await api('/api/admin/entregadores'));
  document.getElementById('corpo-tabela').innerHTML = entregadores.length
    ? entregadores.map((e) => `<tr>
        <td><strong>${escapar(e.nome)}</strong></td>
        <td>${escapar(e.email)}${e.telefone ? `<br><span class="dica">${telefoneFormatado(e.telefone)}</span>` : ''}</td>
        <td class="numero">${e.entregasAtivas}</td>
        <td><span class="selo ${e.ativo ? '' : 'selo--inativo'}">${e.ativo ? 'Ativo' : 'Desativado'}</span></td>
        <td class="numero"><button class="botao botao--claro botao--pequeno" type="button" data-ativo="${e.id}">${e.ativo ? 'Desativar' : 'Ativar'}</button></td>
      </tr>`).join('')
    : '<tr><td colspan="5" class="vazio">Nenhum entregador cadastrado ainda.</td></tr>';
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const corpo = { nome: form.nome.value.trim(), email: form.email.value.trim(), telefone: form.telefone.value, senha: form.senha.value };
  if (corpo.nome.length < 2) return mostrarErro(caixaErro, 'Digite o nome.', form.nome);
  if (!corpo.email.includes('@')) return mostrarErro(caixaErro, 'Digite um e-mail válido.', form.email);
  if (corpo.senha.length < 8) return mostrarErro(caixaErro, 'A senha precisa ter pelo menos 8 caracteres.', form.senha);
  try {
    const { mensagem } = await comBotaoOcupado(form.querySelector('button'), 'Cadastrando...', () =>
      api('/api/admin/entregadores', { metodo: 'POST', corpo }));
    mostrarErro(caixaErro, null);
    form.reset();
    avisar(mensagem);
    carregar();
  } catch (erro) {
    mostrarErro(caixaErro, erro.message);
  }
});

document.getElementById('corpo-tabela').addEventListener('click', async (e) => {
  const botao = e.target.closest('[data-ativo]');
  if (!botao) return;
  const entregador = entregadores.find((x) => x.id === Number(botao.dataset.ativo));
  try {
    const { mensagem } = await api(`/api/admin/entregadores/${entregador.id}/ativo`, { metodo: 'PATCH', corpo: { ativo: !entregador.ativo } });
    avisar(mensagem);
    carregar();
  } catch (erro) {
    avisar(erro.message, { tipo: 'erro' });
  }
});

async function iniciar() {
  await iniciarPainel('admin');
  aplicarMascaraTelefone(form.telefone);
  carregar().catch((erro) => avisar(erro.message, { tipo: 'erro' }));
}

iniciar();
