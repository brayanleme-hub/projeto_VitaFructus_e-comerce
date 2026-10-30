// routes/lojaRoutes.js — rotas públicas da loja (não exigem login)
const { Router } = require('express');
const produtos = require('../controllers/produtosController');
const { dadosDaLoja } = require('../utils/loja');

const router = Router();

// Endereço e coordenadas da loja (página Onde estamos)
router.get('/loja', (req, res) => res.json({ loja: dadosDaLoja() }));

router.get('/categorias', produtos.listarCategorias);
router.get('/produtos', produtos.listar);
router.get('/produtos/:id', produtos.obter);
router.post('/carrinho/conferir', produtos.conferirCarrinho);

module.exports = router;
