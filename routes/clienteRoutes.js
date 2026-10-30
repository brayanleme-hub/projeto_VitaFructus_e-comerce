// routes/clienteRoutes.js — rotas do cliente logado (pedidos e endereços)
const { Router } = require('express');
const pedidos = require('../controllers/pedidosController');
const enderecos = require('../controllers/enderecosController');
const { exigirLogin } = require('../middlewares/autenticacao');

const router = Router();

// Todas as rotas abaixo exigem login
router.use(['/pedidos', '/enderecos'], exigirLogin);

router.get('/enderecos', enderecos.listar);
router.post('/enderecos', enderecos.criar);

router.post('/pedidos', pedidos.criar);
router.get('/pedidos', pedidos.listarMeus);
router.get('/pedidos/:id', pedidos.obterMeu);

module.exports = router;
