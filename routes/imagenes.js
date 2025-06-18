// routes/imagenes.js
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

// Middleware para verificar autenticación
function isAuthenticated(req, res, next) {
    if (req.session.usuario) {
        next();
    } else {
        res.status(401).json({ exito: false, mensaje: 'No autorizado. Por favor, inicia sesión.' });
    }
}

router.post('/subir', isAuthenticated, (req, res) => {
    const { titulo, descripcion } = req.body;
    const imagen = req.files?.imagen;
    const db = req.db;
    const usuarioId = req.session.usuario.id;

    if (!imagen) {
        return res.status(400).json({ exito: false, mensaje: 'No se envió la imagen' });
    }

    const nombreArchivo = Date.now() + '_' + imagen.name;
    const rutaDestino = path.join(__dirname, '..', 'public', 'uploads', nombreArchivo);

    imagen.mv(rutaDestino, err => {
        if (err) {
            console.error('Error al mover imagen:', err);
            return res.status(500).json({ exito: false, mensaje: 'Error al subir la imagen al servidor.' });
        }

        const rutaRelativa = '/uploads/' + nombreArchivo;

        const buscarAlbum = 'SELECT id FROM albumes WHERE usuario_id = ? AND titulo = ? LIMIT 1';
        db.query(buscarAlbum, [usuarioId, 'Publicaciones'], (err, resultado) => {
            if (err) {
                console.error('Error al buscar álbum:', err);
                fs.unlink(rutaDestino, (unlinkErr) => {
                    if (unlinkErr) console.error('Error al borrar imagen tras error de BD:', unlinkErr);
                });
                return res.status(500).json({ exito: false, mensaje: 'Error al buscar el álbum del usuario.' });
            }

            if (resultado.length > 0) {
                insertarImagen(resultado[0].id);
            } else {
                const crearAlbum = 'INSERT INTO albumes (usuario_id, titulo) VALUES (?, ?)';
                db.query(crearAlbum, [usuarioId, 'Publicaciones'], (err, resultado2) => {
                    if (err) {
                        console.error('Error al crear álbum:', err);
                        fs.unlink(rutaDestino, (unlinkErr) => {
                            if (unlinkErr) console.error('Error al borrar imagen tras error de BD:', unlinkErr);
                        });
                        return res.status(500).json({ exito: false, mensaje: 'Error al crear el álbum del usuario.' });
                    }
                    insertarImagen(resultado2.insertId);
                });
            }
        });

        function insertarImagen(albumId) {
            const insertarImg = 'INSERT INTO imagenes (album_id, ruta_imagen, titulo, descripcion) VALUES (?, ?, ?, ?)';
            db.query(insertarImg, [albumId, rutaRelativa, titulo, descripcion], err => {
                if (err) {
                    console.error('Error al insertar imagen en DB:', err);
                    fs.unlink(rutaDestino, (unlinkErr) => {
                        if (unlinkErr) console.error('Error al borrar imagen tras error de BD:', unlinkErr);
                    });
                    return res.status(500).json({ exito: false, mensaje: 'Error al guardar la imagen en la base de datos.' });
                }

                res.json({
                    exito: true,
                    mensaje: 'Imagen subida exitosamente.',
                    imagen: {
                        ruta_imagen: rutaRelativa,
                        titulo,
                        descripcion
                    }
                });
            });
        }
    });
});

// Ruta POST para añadir un comentario a una imagen (Callbacks)
router.post('/comentar', isAuthenticated, (req, res) => {
    const db = req.db;
    const { imagen_id, contenido } = req.body;
    const usuarioId = req.session.usuario.id;

    if (!contenido || contenido.trim() === '') {
        return res.status(400).json({ exito: false, mensaje: 'El comentario no puede estar vacío.' });
    }

    const query = 'INSERT INTO comentarios (imagen_id, autor_id, contenido) VALUES (?, ?, ?)';
    db.query(query, [imagen_id, usuarioId, contenido], (err, result) => {
        if (err) {
            console.error('Error al insertar comentario:', err);
            return res.status(500).json({ exito: false, mensaje: 'Error al añadir el comentario.' });
        }

        const queryComentarioCompleto = `
            SELECT c.id AS comentario_id, c.contenido, c.creado_en, u.id AS autor_comentario_id, u.nombre AS autor_comentario_nombre, u.apellido AS autor_comentario_apellido, u.username AS autor_comentario_username
            FROM comentarios c
            JOIN usuarios u ON c.autor_id = u.id
            WHERE c.id = ?;
        `;
        db.query(queryComentarioCompleto, [result.insertId], (err2, comentarioCompleto) => {
            if (err2) {
                console.error('Error al obtener comentario completo:', err2);
                return res.status(500).json({ exito: false, mensaje: 'Comentario añadido, pero hubo un error al recuperar sus datos.' });
            }
            res.json({ exito: true, mensaje: 'Comentario añadido.', comentario: comentarioCompleto[0] });
        });
    });
});

// Ruta POST para compartir una imagen (Callbacks)
// La URL original es /compartir.
router.post('/compartir', isAuthenticated, (req, res) => { // SIN async
    const db = req.db;
    const { imagen_id, usuario_destino } = req.body;
    const usuarioQueComparteId = req.session.usuario.id;

    if (!usuario_destino) {
        return res.status(400).json({ exito: false, mensaje: 'Debe especificar un usuario para compartir.' });
    }
    const parsedUsuarioRecibeId = parseInt(usuario_destino, 10);

    if (usuarioQueComparteId === parsedUsuarioRecibeId) {
        return res.status(400).json({ exito: false, mensaje: 'No puedes compartir una imagen contigo mismo.' });
    }

    // CAMBIO CLAVE AQUI: Cambiar 'comparticiones' a 'compartidos'
    const query = 'INSERT INTO compartidos (imagen_id, usuario_que_comparte_id, usuario_recibe_id) VALUES (?, ?, ?)';
    db.query(query, [imagen_id, usuarioQueComparteId, parsedUsuarioRecibeId], (err, result) => {
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
