// routes/adminRoutes.js — área administrativa (prefixo /api/admin)
// O exigirPapel('admin') no topo protege TODAS as rotas deste arquivo.
const { Router } = require('express');
const admin = require('../controllers/adminController');
const { exigirPapel } = require('../middlewares/autenticacao');

const router = Router();
router.use(exigirPapel('admin'));

router.get('/resumo', admin.resumo);

router.get('/produtos', admin.listarProdutos);
router.post('/produtos', admin.criarProduto);
router.put('/produtos/:id', admin.atualizarProduto);
router.patch('/produtos/:id/ativo', admin.alterarAtivoProduto);
router.delete('/produtos/:id', admin.excluirProduto);

router.get('/pedidos', admin.listarPedidos);
router.get('/pedidos/:id', admin.obterPedido);
router.patch('/pedidos/:id/status', admin.atualizarStatusPedido);
router.patch('/pedidos/:id/entregador', admin.atribuirEntregador);

router.get('/entregadores', admin.listarEntregadores);
router.post('/entregadores', admin.criarEntregador);
router.patch('/entregadores/:id/ativo', admin.alterarAtivoEntregador);

module.exports = router;
