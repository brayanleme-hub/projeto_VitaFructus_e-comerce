// routes/authRoutes.js — cadastro, login e logout (prefixo /api/auth)
const { Router } = require('express');
const auth = require('../controllers/authController');
const { verificarBloqueio } = require('../middlewares/limiteTentativas');

const router = Router();

router.post('/cadastro', auth.cadastrar);
router.post('/login', verificarBloqueio, auth.entrar);
router.post('/logout', auth.sair);
router.get('/eu', auth.quemSouEu);

module.exports = router;
