const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
  process.env.DB_NAME || 'attendance_db',
  process.env.DB_USER || 'root',
  process.env.DB_PASSWORD || '',
  {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    dialect: 'mysql',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    define: {
      timestamps: true,
      underscored: false,
      charset: 'utf8mb4',
      collate: 'utf8mb4_unicode_ci'
    }
  }
);

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log('🔗 Conexión a MySQL establecida correctamente');
    
    if (process.env.NODE_ENV === 'development') {
      await sequelize.sync({ alter: true });
      console.log('📊 Modelos sincronizados con la base de datos');
    }
    
  } catch (error) {
    console.error('❌ Error conectando a la base de datos:', error.message);
    throw error;
  }
};

const closeDB = async () => {
  try {
    await sequelize.close();
    console.log('🔒 Conexión a la base de datos cerrada');
  } catch (error) {
    console.error('❌ Error cerrando la conexión:', error.message);
  }
};

// Función de prueba de conexión
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    return { success: true, message: 'Conexión exitosa' };
  } catch (error) {
    return { success: false, message: error.message };
  }
};

module.exports = { 
  sequelize, 
  connectDB, 
  closeDB, 
  testConnection 
};