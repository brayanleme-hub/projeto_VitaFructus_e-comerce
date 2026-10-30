-- ============================================================
-- VitaFructus — estrutura do banco de dados (SQLite)
-- Este arquivo é executado automaticamente pelo database/inicializar.js.
-- "IF NOT EXISTS" garante que rodar de novo não apaga nada.
-- Preços SEMPRE em centavos (INTEGER) para evitar erro de arredondamento.
-- ============================================================

-- D1 CLIENTES (no DFD): usuários do sistema. O campo "tipo" separa os papéis.
CREATE TABLE IF NOT EXISTS usuarios (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  nome        TEXT    NOT NULL CHECK (length(trim(nome)) >= 2),
  email       TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  senha_hash  TEXT    NOT NULL,
  telefone    TEXT,
  tipo        TEXT    NOT NULL DEFAULT 'cliente'
                      CHECK (tipo IN ('cliente', 'admin', 'entregador')),
  ativo       INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
  criado_em   TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Endereços de entrega (um cliente pode ter vários)
CREATE TABLE IF NOT EXISTS enderecos (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  cep         TEXT    NOT NULL CHECK (length(cep) = 8),
  logradouro  TEXT    NOT NULL,
  numero      TEXT    NOT NULL,
  complemento TEXT,
  bairro      TEXT    NOT NULL,
  cidade      TEXT    NOT NULL,
  uf          TEXT    NOT NULL CHECK (length(uf) = 2),
  criado_em   TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- D2 PRODUTOS E PROMOÇÕES
CREATE TABLE IF NOT EXISTS categorias (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  nome  TEXT NOT NULL UNIQUE,
  slug  TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS produtos (
  id                       INTEGER PRIMARY KEY AUTOINCREMENT,
  nome                     TEXT    NOT NULL CHECK (length(trim(nome)) >= 2),
  descricao                TEXT    NOT NULL DEFAULT '',
  categoria_id             INTEGER NOT NULL REFERENCES categorias(id),
  unidade                  TEXT    NOT NULL
                           CHECK (unidade IN ('kg', 'unidade', 'bandeja', 'maço', 'dúzia')),
  preco_original_centavos  INTEGER NOT NULL CHECK (preco_original_centavos > 0),
  preco_venda_centavos     INTEGER NOT NULL CHECK (preco_venda_centavos > 0),
  imagem                   TEXT    NOT NULL DEFAULT '/img/produtos/padrao.svg',
  estoque                  INTEGER NOT NULL DEFAULT 0 CHECK (estoque >= 0),
  -- data-limite de comercialização no formato AAAA-MM-DD (opcional)
  data_limite              TEXT    CHECK (data_limite IS NULL OR date(data_limite) = data_limite),
  em_oferta                INTEGER NOT NULL DEFAULT 0 CHECK (em_oferta IN (0, 1)),
  ativo                    INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
  criado_em                TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  atualizado_em            TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  -- Regras de negócio garantidas pelo próprio banco:
  -- 1) Em oferta: preço de venda menor que o original E data-limite obrigatória.
  CHECK (em_oferta = 0 OR (preco_venda_centavos < preco_original_centavos AND data_limite IS NOT NULL)),
  -- 2) Fora de oferta: preço de venda igual ao original.
  CHECK (em_oferta = 1 OR preco_venda_centavos = preco_original_centavos)
);

-- D3 PEDIDOS E ITENS
CREATE TABLE IF NOT EXISTS pedidos (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id        INTEGER NOT NULL REFERENCES usuarios(id),
  -- cópia do endereço no momento da compra (não muda se o cliente editar depois)
  endereco_entrega  TEXT    NOT NULL,
  total_centavos    INTEGER NOT NULL CHECK (total_centavos > 0),
  forma_pagamento   TEXT    NOT NULL CHECK (forma_pagamento IN ('pix', 'debito', 'credito')),
  status_pagamento  TEXT    NOT NULL DEFAULT 'aprovado_simulado'
                            CHECK (status_pagamento IN ('aprovado_simulado', 'estornado_simulado')),
  status            TEXT    NOT NULL DEFAULT 'pendente'
                            CHECK (status IN ('pendente', 'em_preparacao', 'saiu_para_entrega', 'entregue', 'cancelado')),
  entregador_id     INTEGER REFERENCES usuarios(id),
  criado_em         TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  atualizado_em     TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS itens_pedido (
  id                       INTEGER PRIMARY KEY AUTOINCREMENT,
  pedido_id                INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  -- RESTRICT: o banco não deixa excluir um produto que já foi vendido
  produto_id               INTEGER NOT NULL REFERENCES produtos(id) ON DELETE RESTRICT,
  -- cópia do nome e do preço no momento da compra
  nome_produto             TEXT    NOT NULL,
  unidade                  TEXT    NOT NULL,
  preco_unitario_centavos  INTEGER NOT NULL CHECK (preco_unitario_centavos > 0),
  quantidade               INTEGER NOT NULL CHECK (quantidade > 0),
  subtotal_centavos        INTEGER NOT NULL CHECK (subtotal_centavos = preco_unitario_centavos * quantidade)
);

-- Sessões de login (para o usuário continuar logado mesmo se o servidor reiniciar)
CREATE TABLE IF NOT EXISTS sessoes (
  sid        TEXT    PRIMARY KEY,
  dados      TEXT    NOT NULL,
  expira_em  INTEGER NOT NULL
);

-- Índices para deixar as buscas mais rápidas
CREATE INDEX IF NOT EXISTS idx_produtos_categoria ON produtos(categoria_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_usuario    ON pedidos(usuario_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_status     ON pedidos(status);
CREATE INDEX IF NOT EXISTS idx_pedidos_entregador ON pedidos(entregador_id);
CREATE INDEX IF NOT EXISTS idx_itens_pedido       ON itens_pedido(pedido_id);
CREATE INDEX IF NOT EXISTS idx_enderecos_usuario  ON enderecos(usuario_id);
