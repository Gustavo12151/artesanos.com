// routes/comentarios.js
const express = require('express');
const router = express.Router();

function isAuthenticated(req, res, next) {
    if (req.session.usuario) {
        next();
    } else {
        res.status(401).json({ exito: false, mensaje: 'No autorizado. Por favor, inicia sesión.' });
    }
}

router.post('/agregar', isAuthenticated, (req, res) => { // SIN async
    const { imagen_id, contenido } = req.body;
    const autor_id = req.session.usuario.id; // Quien comenta
    const db = req.db;

    if (!contenido || contenido.trim() === '') {
        return res.status(400).json({ exito: false, mensaje: 'El comentario no puede estar vacío.' });
    }

    const sql = 'INSERT INTO comentarios (imagen_id, autor_id, contenido) VALUES (?, ?, ?)';
    db.query(sql, [imagen_id, autor_id, contenido], (err, result) => { // Callback aquí
        if (err) {
            console.error('Error al insertar comentario:', err);
            return res.status(500).json({ exito: false, mensaje: 'Error al guardar comentario.' });
        }

        // Obtener el comentario completo recién insertado y la información del autor de la imagen
        const queryComentarioCompleto = `
            SELECT c.id AS comentario_id, c.contenido, c.creado_en,
                   u.id AS autor_comentario_id, u.nombre AS autor_comentario_nombre, u.apellido AS autor_comentario_apellido, u.username AS autor_comentario_username,
                   img.titulo AS titulo_imagen, img_album.usuario_id AS autor_imagen_id
            FROM comentarios c
            JOIN usuarios u ON c.autor_id = u.id
            JOIN imagenes img ON c.imagen_id = img.id
            JOIN albumes img_album ON img.album_id = img_album.id
            WHERE c.id = ?;
        `;
        db.query(queryComentarioCompleto, [result.insertId], (err2, rows) => { // Callback aquí
            if (err2) {
                console.error('Error al obtener comentario completo después de insertar:', err2);
                return res.status(500).json({ exito: false, mensaje: 'Comentario añadido (sin detalles completos).' });
            }

            const nuevoComentario = rows[0];
            // const autorImagenId = nuevoComentario.autor_imagen_id; // Ya no se usa para Socket.io

            console.log(`✅ Comentario: Nuevo comentario de ${autor_id} en imagen ${imagen_id}.`);

            // Eliminada la lógica de notificación de Socket.io
            res.json({ exito: true, mensaje: 'Comentario añadido.', comentario: nuevoComentario });
        });
    });
});

module.exports = router;
