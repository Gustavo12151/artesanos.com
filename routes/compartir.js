const express = require('express');
const router = express.Router();

console.log('✅ routes/compartir.js cargado.');

// Middleware para verificar autenticación
function isAuthenticated(req, res, next) {
    if (req.session.usuario) {
        next();
    } else {
        if (req.accepts('html')) {
            res.redirect('/login');
        } else {
            res.status(401).json({ exito: false, mensaje: 'No autorizado. Por favor, inicia sesión.' });
        }
    }
}

// Ruta POST para compartir una imagen
router.post('/', isAuthenticated, (req, res) => {
    console.log('➡️ POST /compartir recibido en compartir.js');
    const db = req.db;
    const { imagen_id, usuario_destino } = req.body;
    const usuarioQueComparteId = req.session.usuario.id; // Esta variable está bien, es el ID del usuario.

    if (!usuario_destino) {
        return res.status(400).json({ exito: false, mensaje: 'Debe especificar un usuario para compartir.' });
    }
    const parsedUsuarioRecibeId = parseInt(usuario_destino, 10);

    if (usuarioQueComparteId === parsedUsuarioRecibeId) {
        return res.status(400).json({ exito: false, mensaje: 'No puedes compartir una imagen contigo mismo.' });
    }

    // CAMBIO CLAVE AQUI: Cambiar 'usuario_que_comparte_id' a 'usuario_origen'
    const sql = 'INSERT INTO compartidos (imagen_id, usuario_origen, usuario_destino) VALUES (?, ?, ?)';
    db.query(sql, [imagen_id, usuarioQueComparteId, parsedUsuarioRecibeId], (err, result) => {
        if (err) {
            console.error('Error al registrar compartición:', err);
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({ exito: false, mensaje: 'Esta imagen ya ha sido compartida con este usuario.' });
            }
            return res.status(500).json({ exito: false, mensaje: 'Error al compartir la imagen.' });
        }
        res.json({ exito: true, mensaje: 'Imagen compartida exitosamente.' });
    });
});

module.exports = router;
