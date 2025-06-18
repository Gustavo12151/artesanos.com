// routes/interfaz.js
const express = require('express');
const router = express.Router();

// Middleware para verificar autenticación
function isAuthenticated(req, res, next) {
    if (req.session.usuario) {
        next();
    } else {
        res.redirect('/login');
    }
}

// Función auxiliar para obtener comentarios de múltiples imágenes (ahora con callbacks)
function getComentariosParaImagenes(db, imagenes, callback) {
    if (imagenes.length === 0) {
        return callback(null, []);
    }

    let processedCount = 0;
    const imagenesConComentarios = [];

    imagenes.forEach((imagen, index) => {
        const queryComentarios = `
            SELECT c.id AS comentario_id, c.contenido, c.creado_en, u.id AS autor_comentario_id, u.nombre AS autor_comentario_nombre, u.apellido AS autor_comentario_apellido, u.username AS autor_comentario_username
            FROM comentarios c
            JOIN usuarios u ON c.autor_id = u.id
            WHERE c.imagen_id = ?
            ORDER BY c.creado_en ASC;
        `;
        db.query(queryComentarios, [imagen.imagen_id], (err, comentarios) => {
            if (err) {
                console.error(`Error al obtener comentarios para imagen ${imagen.imagen_id}:`, err);
                imagenesConComentarios[index] = { ...imagen, comentarios: [] }; // Devolver con comentarios vacíos
            } else {
                imagenesConComentarios[index] = { ...imagen, comentarios: comentarios };
            }

            processedCount++;
            if (processedCount === imagenes.length) {
                callback(null, imagenesConComentarios);
            }
        });
    });
}


// 1. Ruta GET para la interfaz principal
router.get('/interfaz', isAuthenticated, (req, res) => {
    const db = req.db;
    const usuarioId = req.session.usuario.id;

    // Consulta 1: Imágenes compartidas por contactos
    const queryImagenes = `
        SELECT i.id AS imagen_id, i.ruta_imagen, i.titulo, i.descripcion, u.id AS autor_id, u.nombre AS autor_nombre, u.apellido AS autor_apellido, u.username AS autor_username
        FROM imagenes i
        JOIN albumes a ON i.album_id = a.id
        JOIN usuarios u ON a.usuario_id = u.id
        JOIN amistades f ON (
            (f.destinatario_id = u.id AND f.solicitante_id = ?) OR
            (f.solicitante_id = u.id AND f.destinatario_id = ?)
        )
        WHERE f.estado = 'aceptada' AND a.usuario_id != ?
        ORDER BY i.creado_en DESC
        LIMIT 20;
    `;
    db.query(queryImagenes, [usuarioId, usuarioId, usuarioId], (errImagenes, imagenesData) => {
        if (errImagenes) {
            console.error('Error al obtener imágenes en interfaz:', errImagenes);
            return res.status(500).send('Error interno del servidor al cargar la interfaz.');
        }

        // Consulta 2: Solicitudes de amistad PENDIENTES
        const querySolicitudes = `
            SELECT a.id AS solicitud_id, u.id AS solicitante_id, u.nombre, u.apellido, u.username
            FROM amistades a
            JOIN usuarios u ON a.solicitante_id = u.id
            WHERE a.destinatario_id = ? AND a.estado = 'pendiente'
            ORDER BY a.fecha_solicitud DESC;
        `;
        db.query(querySolicitudes, [usuarioId], (errSolicitudes, solicitudesPendientes) => {
            if (errSolicitudes) {
                console.error('Error al obtener solicitudes en interfaz:', errSolicitudes);
                return res.status(500).send('Error interno del servidor al cargar la interfaz.');
            }

            // Consulta 3: Todos los usuarios (para el selector de compartir)
            const queryTodosUsuarios = `SELECT id, nombre, apellido, username FROM usuarios;`;
            db.query(queryTodosUsuarios, (errTodosUsuarios, todosLosUsuarios) => { // CAMBIADO a queryTodosUsuarios
                if (errTodosUsuarios) {
                    console.error('Error al obtener usuarios en interfaz:', errTodosUsuarios);
                    return res.status(500).send('Error interno del servidor al cargar la interfaz.');
                }

                // Obtener comentarios para las imágenes obtenidas (usando la función auxiliar con callbacks)
                getComentariosParaImagenes(db, imagenesData, (errComentarios, imagenesConComentarios) => {
                    if (errComentarios) {
                        console.error('Error al obtener comentarios en interfaz:', errComentarios);
                        imagenesConComentarios = imagenesData.map(img => ({...img, comentarios: []}));
                    }

                    res.render('interfaz', {
                        session: req.session,
                        imagenes: imagenesConComentarios,
                        solicitudesPendientes: solicitudesPendientes,
                        usuariosRed: todosLosUsuarios // PASANDO usuariosRed
                    });
                });
            });
        });
    });
});

// 2. Ruta GET para buscar amigos (ya adaptada a callbacks)
router.get('/buscar-amigo-ajax', isAuthenticated, (req, res) => {
    const db = req.db;
    const { nombre } = req.query; // El término de búsqueda
    const currentUserId = req.session.usuario.id;

    console.log(`[Backend DEBUG] Solicitud a /buscar-amigo-ajax recibida. Término: "${nombre}"`);

    if (!nombre || nombre.trim() === '') {
        console.log('[Backend DEBUG] Término de búsqueda vacío. Devolviendo 400.');
        return res.status(400).json({ exito: false, mensaje: 'El término de búsqueda no puede estar vacío.' });
    }

    const searchTerm = `%${nombre.trim()}%`;
    const query = `
        SELECT id, nombre, apellido, username
        FROM usuarios
        WHERE (nombre LIKE ? OR apellido LIKE ? OR username LIKE ?) AND id != ?;
    `;
    db.query(query, [searchTerm, searchTerm, searchTerm, currentUserId], (err, resultados) => {
        if (err) {
            console.error('[Backend ERROR] Error al buscar amigos (AJAX):', err);
            return res.status(500).json({ exito: false, mensaje: 'Error interno al buscar amigos.' });
        }
        console.log(`[Backend DEBUG] Búsqueda exitosa. Resultados encontrados: ${resultados.length}`);
        res.json(resultados);
    });
});

// 3. Ruta GET para ver el propio perfil (sin ID en la URL)
router.get('/perfil', isAuthenticated, (req, res) => {
    const db = req.db;
    const perfilId = req.session.usuario.id; // El propio ID del usuario logueado

    // Consulta 1: Obtener detalles del usuario del perfil
    const queryUsuario = 'SELECT id, username, nombre, apellido, email, informacion_personal, intereses, antecedentes, imagen_principal, modo_portafolio FROM usuarios WHERE id = ?';
    db.query(queryUsuario, [perfilId], (errUsuario, usuarioResult) => {
        if (errUsuario) {
            console.error('Error al obtener datos del perfil:', errUsuario);
            return res.status(500).send('Error al cargar perfil.');
        }

        if (usuarioResult.length === 0) {
            return res.status(404).send('Perfil no encontrado.');
        }

        const usuarioPerfil = usuarioResult[0];

        // Consulta 2: Obtener imágenes subidas por este usuario
        const queryImagenesUsuario = `
            SELECT i.id AS imagen_id, i.ruta_imagen, i.titulo, i.descripcion, i.creado_en
            FROM imagenes i
            JOIN albumes a ON i.album_id = a.id
            WHERE a.usuario_id = ?
            ORDER BY i.creado_en DESC;
        `;
        db.query(queryImagenesUsuario, [perfilId], (errImg, imagenesUsuario) => {
            if (errImg) {
                console.error('Error al obtener imágenes del perfil:', errImg);
                imagenesUsuario = []; // Asegurarse de que sea un array vacío si hay error
            }

            // Consulta 3: Obtener todos los usuarios para el modal de compartir en el perfil
            const queryTodosUsuarios = `SELECT id, nombre, apellido, username FROM usuarios;`;
            db.query(queryTodosUsuarios, (errTodosUsuarios, todosLosUsuarios) => { // CAMBIADO a queryTodosUsuarios
                if (errTodosUsuarios) {
                    console.error('Error al obtener usuarios para perfil:', errTodosUsuarios);
                    todosLosUsuarios = []; // Asegurarse de que sea un array vacío si hay error
                }

                // Obtener comentarios para las imágenes del usuario
                getComentariosParaImagenes(db, imagenesUsuario, (errComentarios, imagenesPerfilConComentarios) => {
                    if (errComentarios) {
                        console.error('Error al obtener comentarios de imágenes de perfil:', errComentarios);
                        imagenesPerfilConComentarios = imagenesUsuario.map(img => ({...img, comentarios: []}));
                    }

                    res.render('perfil', {
                        title: `Perfil de ${usuarioPerfil.username}`,
                        session: req.session,
                        usuario: usuarioPerfil,
                        imagenes: imagenesPerfilConComentarios,
                        isOwnProfile: true, // Flag para el frontend
                        usuariosRed: todosLosUsuarios // PASANDO usuariosRed AQUI TAMBIEN
                    });
                });
            });
        });
    });
});

// 4. Ruta GET para ver perfiles de otros usuarios (con ID en la URL)
router.get('/perfil/:id', isAuthenticated, (req, res) => {
    const db = req.db;
    const perfilId = parseInt(req.params.id); // ID del perfil que se está visitando
    const currentUserId = req.session.usuario.id; // ID del usuario logueado

    if (isNaN(perfilId)) {
        return res.status(400).send('ID de usuario inválido.');
    }

    if (perfilId === currentUserId) {
        return res.redirect('/perfil'); // Redirigir al perfil propio si el ID es el del usuario logueado
    }

    // Consulta 1: Obtener detalles del usuario del perfil
    const queryUsuario = 'SELECT id, username, nombre, apellido, email, informacion_personal, intereses, antecedentes, imagen_principal, modo_portafolio FROM usuarios WHERE id = ?';
    db.query(queryUsuario, [perfilId], (errUsuario, usuarioResult) => {
        if (errUsuario) {
            console.error('Error al obtener datos del perfil:', errUsuario);
            return res.status(500).send('Error al cargar perfil.');
        }

        if (usuarioResult.length === 0) {
            return res.status(404).send('Perfil no encontrado.');
        }

        const usuarioPerfil = usuarioResult[0];

        // Consulta 2: Obtener imágenes subidas por este usuario
        const queryImagenesUsuario = `
            SELECT i.id AS imagen_id, i.ruta_imagen, i.titulo, i.descripcion, i.creado_en
            FROM imagenes i
            JOIN albumes a ON i.album_id = a.id
            WHERE a.usuario_id = ?
            ORDER BY i.creado_en DESC;
        `;
        db.query(queryImagenesUsuario, [perfilId], (errImg, imagenesUsuario) => {
            if (errImg) {
                console.error('Error al obtener imágenes del perfil:', errImg);
                imagenesUsuario = [];
            }

            // Consulta 3: Obtener todos los usuarios para el modal de compartir en el perfil
            const queryTodosUsuarios = `SELECT id, nombre, apellido, username FROM usuarios;`;
            db.query(queryTodosUsuarios, (errTodosUsuarios, todosLosUsuarios) => { // CAMBIADO a queryTodosUsuarios
                if (errTodosUsuarios) {
                    console.error('Error al obtener usuarios para perfil:', errTodosUsuarios);
                    todosLosUsuarios = [];
                }

                // Obtener comentarios para las imágenes del usuario
                getComentariosParaImagenes(db, imagenesUsuario, (errComentarios, imagenesPerfilConComentarios) => {
                    if (errComentarios) {
                        console.error('Error al obtener comentarios de imágenes de perfil:', errComentarios);
                        imagenesPerfilConComentarios = imagenesUsuario.map(img => ({...img, comentarios: []}));
                    }

                    res.render('perfil', {
                        title: `Perfil de ${usuarioPerfil.username}`,
                        session: req.session,
                        usuario: usuarioPerfil,
                        imagenes: imagenesPerfilConComentarios,
                        isOwnProfile: false, // Flag para el frontend
                        usuariosRed: todosLosUsuarios // PASANDO usuariosRed AQUI TAMBIEN
                    });
                });
            });
        });
    });
});


module.exports = router;
