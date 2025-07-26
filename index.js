require('dotenv').config();
const app = require('./app');
const { connectDB } = require('./config/database');
const { initializeFirebase } = require('./config/firebase');

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    await connectDB();
    console.log('✅ Base de datos MySQL conectada');
    
    await initializeFirebase();

    app.listen(PORT, () => {
      console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
      console.log(`📡 API disponible en http://localhost:${PORT}/api`);
    });
  } catch (error) {
    console.error('❌ Error al iniciar servidor:', error);
    process.exit(1);
  }
}

startServer();