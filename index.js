// app.js - configuración inicial del proyecto Artesanos.com

const express = require('express');
const path = require('path');
const mysql = require('mysql2');
const session = require('express-session');
const bodyParser = require('body-parser');
const fileUpload = require('express-fileupload');
const http = require('http');
const { Server } = require('socket.io');

const app = express();

// --- INICIO DE MIDDLEWARES IMPORTANTES (EL ORDEN ES CRÍTICO) ---
// Sirve archivos estáticos (CSS, JS, imágenes)
app.use(express.static("./public"));

// Procesadores del cuerpo de la petición para formularios y JSON
app.use(bodyParser.urlencoded({ extended: false })); // Para datos de formularios URL-encoded
app.use(bodyParser.json()); // Para datos JSON
app.use(fileUpload()); // Para manejar la subida de archivos (multipart/form-data)

// Middleware de sesión
const sessionMiddleware = session({
  secret: 'clave_secreta_artesanos', // ¡CAMBIA ESTO POR UNA CLAVE MÁS SEGURA EN PRODUCCIÓN!
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // Usar 'true' si estás en HTTPS en producción
});
app.use(sessionMiddleware);
// --- FIN DE MIDDLEWARES IMPORTANTES ---

// Configuraciones de Pug
app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));

// Conexión MySQL
const db = mysql.createConnection({
  port:3306,
  host: 'localhost',
  user: 'u219074299_gustavo',
  password: 'Z9Bmel8a8',
  database: 'u219074299_artesano'
});

db.connect(err => {
  if (err) throw err;
  console.log('✅ Conectado a la base de datos MySQL');
});

// Middleware para compartir la conexión DB y la sesión en el objeto req/res.locals
app.use((req, res, next) => {
  req.db = db;
  res.locals.session = req.session;
  next();
});

// Configuración de Socket.io
const httpServer = http.createServer(app);
const io = new Server(httpServer);

// Adjuntar el middleware de sesión de Express a Socket.io
io.engine.use(sessionMiddleware);

// Objeto para mapear userId a socket.id para enviar mensajes a usuarios específicos
const connectedUsers = {}; // { userId: socket.id }

io.on('connection', (socket) => {
  console.log(`⚡️ Socket.io: Nuevo cliente conectado: ${socket.id}`);

  // Cuando el cliente emite su userId (después de login)
  socket.on('setUserId', (data) => {
    const userId = data.userId;
    if (userId) {
      connectedUsers[userId] = socket.id;
      console.log(`✅ Socket.io: (Desde cliente setUserId) Usuario ID ${userId} asociado a socket ${socket.id}. Usuarios conectados: `, Object.keys(connectedUsers));
    } else {
      console.log(`🔴 Socket.io: Intento de setUserId sin ID válido desde socket ${socket.id}.`);
    }
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Socket.io: Cliente desconectado: ${socket.id}`);
    // Eliminar la asociación cuando el usuario se desconecta
    for (const id in connectedUsers) {
      if (connectedUsers[id] === socket.id) {
        delete connectedUsers[id];
        console.log(`❌ Socket.io: Usuario ID ${id} desasociado. Usuarios conectados restantes: `, Object.keys(connectedUsers));
        break;
      }
    }
  });

  socket.on('error', (error) => {
    console.error(`🚨 Socket.io: Error en socket ${socket.id}:`, error);
  });
});

// Hacer que la instancia de io y connectedUsers estén disponibles en las rutas
app.set('io', io);
app.set('connectedUsers', connectedUsers);


// --- Rutas de la aplicación (DEBEN IR DESPUÉS DE LOS MIDDLEWARES) ---
const authRoutes = require('./routes/auth');
const interfazRoutes = require('./routes/interfaz');
const imagenesRoutes = require('./routes/imagenes');
const amistadRoutes = require('./routes/amistad');
const comentarioRoutes = require('./routes/comentario');
const compartirRoutes = require('./routes/compartir');


app.use('/comentarios', comentarioRoutes);
app.use('/compartir', compartirRoutes);
app.use('/amistad', amistadRoutes);
app.use('/imagenes', imagenesRoutes);
app.use('/', authRoutes); // Rutas de autenticación (login, register, logout)
app.use('/', interfazRoutes); // Rutas de la interfaz principal (feed, perfil, buscar)


// CAMBIO CLAVE AQUÍ: La ruta raíz ahora siempre renderiza index.pug
app.get('/', (req, res) => {
  res.render('index');
});

// Manejo de errores 404 (ruta no encontrada)
app.use((req, res, next) => {
    res.status(404).send("Lo siento, no se pudo encontrar esa página.");
});


// Inicio del servidor HTTP (no de la app de Express directamente)
const PORT = 3000;
httpServer.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});
