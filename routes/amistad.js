// routes/amistad.js
const express = require('express');
const router = express.Router();

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

// 1. Ruta POST para ENVIAR solicitud de amistad
router.post('/solicitar', isAuthenticated, (req, res) => { // SIN async
    const db = req.db;
    const solicitanteId = req.session.usuario.id;
    const destinatarioId = req.body.amigo_id;

    if (!destinatarioId) {
        return res.status(400).json({ exito: false, mensaje: 'ID de amigo no proporcionado.' });
    }

    const parsedDestinatarioId = parseInt(destinatarioId, 10);

    if (solicitanteId === parsedDestinatarioId) {
        return res.status(400).json({ exito: false, mensaje: 'No puedes enviarte una solicitud a ti mismo.' });
    }

    const checkQuery = `
        SELECT id, estado FROM amistades
        WHERE (solicitante_id = ? AND destinatario_id = ?)
           OR (solicitante_id = ? AND destinatario_id = ?);
    `;
    db.query(checkQuery, [solicitanteId, parsedDestinatarioId, parsedDestinatarioId, solicitanteId], (err, result) => {
        if (err) {
            console.error('Error al verificar solicitud existente:', err);
            return res.status(500).json({ exito: false, mensaje: 'Error interno al verificar solicitud.' });
        }

        if (result.length > 0) {
            const estadoActual = result[0].estado;
            let mensaje = '';
            if (estadoActual === 'pendiente') {
                mensaje = 'Ya existe una solicitud pendiente con este usuario.';
            } else if (estadoActual === 'aceptada') {
                mensaje = 'Ya eres amigo de este usuario.';
            } else if (estadoActual === 'rechazada') {
                mensaje = 'La solicitud fue previamente rechazada o cancelada por alguna de las partes.';
            }
            return res.status(400).json({ exito: false, mensaje: mensaje });
        }

        const insertQuery = 'INSERT INTO amistades (solicitante_id, destinatario_id, estado) VALUES (?, ?, "pendiente")';
        db.query(insertQuery, [solicitanteId, parsedDestinatarioId], (err, insertResult) => {
            if (err) {
                console.error('Error al enviar solicitud de amistad:', err);
                return res.status(500).json({ exito: false, mensaje: 'Error al enviar la solicitud de amistad.' });
            }
            
            console.log(`✅ Amistad: Solicitud de amistad enviada de ${solicitanteId} a ${parsedDestinatarioId}.`);
            res.json({ exito: true, mensaje: 'Solicitud de amistad enviada con éxito.' });
        });
    });
});

// 2. Ruta POST para ACEPTAR solicitud de amistad
router.post('/aceptar', isAuthenticated, (req, res) => { // SIN async
    const db = req.db;
    const usuarioId = req.session.usuario.id; // Quien ACEPTA
    const { solicitud_id } = req.body;

    if (!solicitud_id) {
        return res.status(400).json({ exito: false, mensaje: 'ID de solicitud no proporcionado.' });
    }

    // Primero, obtener el ID del solicitante de la amistad para fines de log o futuras notificaciones
    const getSolicitanteIdQuery = 'SELECT solicitante_id FROM amistades WHERE id = ? AND destinatario_id = ? AND estado = "pendiente"';
    db.query(getSolicitanteIdQuery, [solicitud_id, usuarioId], (err, solicitanteResult) => {
        if (err) {
            console.error('Error al obtener solicitante para aceptar:', err);
            return res.status(500).json({ exito: false, mensaje: 'Error interno al procesar solicitud.' });
        }
        if (solicitanteResult.length === 0) {
            return res.status(400).json({ exito: false, mensaje: 'La solicitud no pudo ser aceptada (no encontrada, no es tuya, o ya fue procesada).' });
        }
        // const solicitanteId = solicitanteResult[0].solicitante_id; // Ya no se usa directamente para Socket.io

        const updateQuery = `
            UPDATE amistades
            SET estado = 'aceptada'
            WHERE id = ? AND destinatario_id = ? AND estado = 'pendiente';
        `;
        db.query(updateQuery, [solicitud_id, usuarioId], (err, result) => {
            if (err) {
                console.error('Error al aceptar solicitud de amistad:', err);
                return res.status(500).json({ exito: false, mensaje: 'Error interno al aceptar la solicitud de amistad.' });
            }
            if (result.affectedRows === 0) {
                return res.status(400).json({ exito: false, mensaje: 'La solicitud no pudo ser aceptada (no encontrada, no es tuya, o ya fue procesada).' });
            }
            console.log(`✅ Amistad: Solicitud ID ${solicitud_id} aceptada por usuario ${usuarioId}.`);
            res.json({ exito: true, mensaje: 'Solicitud de amistad aceptada con éxito.' });
        });
    });
});

// 3. Ruta POST para RECHAZAR solicitud de amistad
router.post('/rechazar', isAuthenticated, (req, res) => { // SIN async
    const db = req.db;
    const usuarioId = req.session.usuario.id; // Quien RECHAZA
    const { solicitud_id } = req.body;

    if (!solicitud_id) {
        return res.status(400).json({ exito: false, mensaje: 'ID de solicitud no proporcionado.' });
    }

    // Primero, obtener el ID del solicitante de la amistad para fines de log o futuras notificaciones
    const getSolicitanteIdQuery = 'SELECT solicitante_id FROM amistades WHERE id = ? AND destinatario_id = ? AND estado = "pendiente"';
    db.query(getSolicitanteIdQuery, [solicitud_id, usuarioId], (err, solicitanteResult) => {
        if (err) {
            console.error('Error al obtener solicitante para rechazar:', err);
            return res.status(500).json({ exito: false, mensaje: 'Error interno al procesar solicitud.' });
        }
        if (solicitanteResult.length === 0) {
            return res.status(400).json({ exito: false, mensaje: 'La solicitud no pudo ser rechazada (no encontrada, no es tuya, o ya fue procesada).' });
        }
        // const solicitanteId = solicitanteResult[0].solicitante_id; // Ya no se usa directamente para Socket.io


        const query = `
            UPDATE amistades
            SET estado = 'rechazada'
            WHERE id = ? AND destinatario_id = ? AND estado = 'pendiente';
        `;
        db.query(query, [solicitud_id, usuarioId], (err, result) => {
            if (err) {
                console.error('Error al rechazar solicitud de amistad:', err);
                return res.status(500).json({ exito: false, mensaje: 'Error interno al rechazar la solicitud de amistad.' });
            }
            if (result.affectedRows === 0) {
                return res.status(400).json({ exito: false, mensaje: 'La solicitud no pudo ser rechazada (no encontrada, no es tuya, o ya fue procesada).' });
            }
            console.log(`✅ Amistad: Solicitud ID ${solicitud_id} rechazada por usuario ${usuarioId}.`);
            res.json({ exito: true, mensaje: 'Solicitud de amistad rechazada con éxito.' });
        });
    });
});

module.exports = router;
