// js/formularios.js — ajudas para formulários (endereço, erros, máscaras)
import { escapar } from './util.js';

const UFS = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');

// HTML dos campos de endereço. "prefixo" evita ids repetidos na mesma página.
export function camposEndereco(prefixo = 'end') {
  return `
    <div class="campo c2"><label for="${prefixo}-cep">CEP</label><input class="entrada" id="${prefixo}-cep" name="cep" inputmode="numeric" autocomplete="postal-code" placeholder="00000-000" maxlength="9" required></div>
    <div class="campo c4"><label for="${prefixo}-logradouro">Rua / Avenida</label><input class="entrada" id="${prefixo}-logradouro" name="logradouro" autocomplete="address-line1" required></div>
    <div class="campo c2"><label for="${prefixo}-numero">Número</label><input class="entrada" id="${prefixo}-numero" name="numero" required maxlength="10"></div>
    <div class="campo c4"><label for="${prefixo}-complemento">Complemento (opcional)</label><input class="entrada" id="${prefixo}-complemento" name="complemento" autocomplete="address-line2" maxlength="60"></div>
    <div class="campo c2"><label for="${prefixo}-bairro">Bairro</label><input class="entrada" id="${prefixo}-bairro" name="bairro" required></div>
    <div class="campo c3"><label for="${prefixo}-cidade">Cidade</label><input class="entrada" id="${prefixo}-cidade" name="cidade" autocomplete="address-level2" required value="São Paulo"></div>
    <div class="campo c1" style="grid-column: span 1"><label for="${prefixo}-uf">UF</label>
      <select class="entrada" id="${prefixo}-uf" name="uf" required>${UFS.map((uf) => `<option${uf === 'SP' ? ' selected' : ''}>${uf}</option>`).join('')}</select>
    </div>`;
}

// Máscara simples de CEP: 04230000 -> 04230-000
export function aplicarMascaraCep(input) {
  input.addEventListener('input', () => {
    const n = input.value.replace(/\D/g, '').slice(0, 8);
    input.value = n.length > 5 ? `${n.slice(0, 5)}-${n.slice(5)}` : n;
  });
}

export function aplicarMascaraTelefone(input) {
  input.addEventListener('input', () => {
    const n = input.value.replace(/\D/g, '').slice(0, 11);
    if (n.length <= 2) input.value = n;
    else if (n.length <= 6) input.value = `(${n.slice(0, 2)}) ${n.slice(2)}`;
    else if (n.length <= 10) input.value = `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
    else input.value = `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
  });
}

// Lê os campos de endereço de dentro de um elemento
export function lerEndereco(raiz) {
  const valor = (nome) => raiz.querySelector(`[name="${nome}"]`).value.trim();
  return {
    cep: valor('cep'),
    logradouro: valor('logradouro'),
    numero: valor('numero'),
    complemento: valor('complemento'),
    bairro: valor('bairro'),
    cidade: valor('cidade'),
    uf: valor('uf'),
  };
}

// Validação no navegador (o servidor valida tudo de novo)
export function validarEndereco(e) {
  if (e.cep.replace(/\D/g, '').length !== 8) return 'O CEP precisa ter 8 números.';
  if (e.logradouro.length < 3) return 'Preencha a rua.';
  if (!e.numero) return 'Preencha o número.';
  if (e.bairro.length < 2) return 'Preencha o bairro.';
  if (e.cidade.length < 2) return 'Preencha a cidade.';
  return null;
}

// Mostra a mensagem de erro numa caixa de aviso e marca o campo, se informado
export function mostrarErro(caixa, mensagem, campo) {
  caixa.hidden = !mensagem;
  caixa.innerHTML = mensagem ? `<p>${escapar(mensagem)}</p>` : '';
  document.querySelectorAll('[aria-invalid="true"]').forEach((c) => c.removeAttribute('aria-invalid'));
  if (campo) {
    campo.setAttribute('aria-invalid', 'true');
    campo.focus();
  } else if (mensagem) {
    caixa.scrollIntoView({ block: 'center' });
  }
}

// Desativa o botão enquanto a requisição acontece (evita clique duplo)
export async function comBotaoOcupado(botao, textoOcupado, funcao) {
  const textoOriginal = botao.innerHTML;
  botao.disabled = true;
  botao.textContent = textoOcupado;
  try {
    return await funcao();
  } finally {
    botao.disabled = false;
    botao.innerHTML = textoOriginal;
  }
}
