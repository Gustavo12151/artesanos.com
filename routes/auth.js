const express = require('express');
const router = express.Router();

// GET - Página principal (normalmente redirige al login o interfaz)
router.get('/', (req, res) => {
  res.redirect('/login');
});

// GET - mostrar formulario de login
router.get('/login', (req, res) => {
  res.render('login', { mensaje: null });
});

// POST - procesar login
router.post('/login', (req, res) => { // Función SIN async
  const { email, password } = req.body;
  const db = req.db;

  console.log(`[Backend DEBUG - Auth] Intento de login para email: ${email}`);

  // Usar db.query() con callback
  const query = 'SELECT * FROM usuarios WHERE email = ? AND contraseña = ?';
  db.query(query, [email, password], (err, results) => { // Callback aquí
    if (err) {
      console.error('[Backend ERROR - Auth] Error al procesar login:', err);
      return res.status(500).render('login', { mensaje: 'Error interno del servidor. Inténtalo de nuevo más tarde.' });
    }

    if (results.length > 0) {
      req.session.usuario = results[0];
      console.log(`[Backend DEBUG - Auth] Login exitoso para usuario: ${email}`);
      res.redirect('/interfaz');
    } else {
      console.log(`[Backend DEBUG - Auth] Login fallido para email: ${email} - Credenciales incorrectas.`);
      res.render('login', { mensaje: 'Credenciales incorrectas' });
    }
  });
});

// GET - mostrar formulario de registro
router.get('/register', (req, res) => {
  res.render('register', { mensaje: null });
});

// POST - procesar registro
router.post('/register', (req, res) => { // Función SIN async
  const { nombre, apellido, email, password } = req.body;
  const db = req.db;

  console.log(`[Backend DEBUG - Auth] Intento de registro para email: ${email}`);

  // Verificar si el email ya está registrado - Usar db.query() con callback
  const verificar = 'SELECT id FROM usuarios WHERE email = ?';
  db.query(verificar, [email], (err, resultadosVerificacion) => { // Callback aquí
    if (err) {
      console.error('[Backend ERROR - Auth] Error al verificar email en registro:', err);
      return res.status(500).render('register', { mensaje: 'Error interno del servidor al verificar email.' });
    }

    if (resultadosVerificacion.length > 0) {
      console.log(`[Backend DEBUG - Auth] Registro fallido: El email ${email} ya está registrado.`);
      res.render('register', { mensaje: 'El email ya está registrado' });
    } else {
      // Insertar nuevo usuario - Usar db.query() con callback
      const insertar = 'INSERT INTO usuarios (nombre, apellido, email, contraseña) VALUES (?, ?, ?, ?)';
      db.query(insertar, [nombre, apellido, email, password], err => { // Callback aquí
        if (err) {
          console.error('[Backend ERROR - Auth] Error al insertar usuario en registro:', err);
          return res.status(500).render('register', { mensaje: 'Error interno del servidor al registrarse.' });
        }
        console.log(`[Backend DEBUG - Auth] Usuario ${email} registrado con éxito.`);
        res.render('login', { mensaje: '¡Registro exitoso! Por favor, inicia sesión.' });
      });
    }
  });
});

// Ruta para cerrar sesión
router.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error('Error al destruir sesión:', err);
      return res.status(500).send('Error al cerrar sesión.');
    }
    res.redirect('/login');
  });
});

module.exports = router;
