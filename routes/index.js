// routes/index.js — junta todas as rotas da API (tudo fica sob /api)
const { Router } = require('express');

const router = Router();

router.get('/status', (req, res) => {
  res.json({ ok: true, mensagem: 'Servidor VitaFructus funcionando' });
});

router.use('/auth', require('./authRoutes'));
router.use('/admin', require('./adminRoutes'));
router.use('/entregas', require('./entregadorRoutes'));
router.use('/', require('./lojaRoutes'));
router.use('/', require('./clienteRoutes'));

module.exports = router;
