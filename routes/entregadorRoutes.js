// routes/entregadorRoutes.js — entregas do entregador logado (prefixo /api/entregas)
const { Router } = require('express');
const entregador = require('../controllers/entregadorController');
const { exigirPapel } = require('../middlewares/autenticacao');

const router = Router();
router.use(exigirPapel('entregador'));

router.get('/', entregador.listar);
router.patch('/:id/status', entregador.atualizarStatus);

module.exports = router;
