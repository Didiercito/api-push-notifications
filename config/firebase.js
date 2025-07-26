const admin = require('firebase-admin');
const path = require('path');

let firebaseApp = null;

const initializeFirebase = async () => {
  try {
    if (!firebaseApp) {
      const serviceAccountPath = path.join(__dirname, 'push-notification-12564-firebase-adminsdk-fbsvc-396f2151b3.json');
      
      const fs = require('fs');
      if (!fs.existsSync(serviceAccountPath)) {
        throw new Error(`Archivo firebase-service-account.json no encontrado en: ${serviceAccountPath}`);
      }

      const serviceAccount = require(serviceAccountPath);
      
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id
      });
      
      console.log(`🔥 Firebase Admin inicializado para proyecto: ${serviceAccount.project_id}`);
    }
    return firebaseApp;
  } catch (error) {
    console.error('❌ Error inicializando Firebase:', error.message);
    throw error;
  }
};

const getMessaging = () => {
  if (!firebaseApp) {
    throw new Error('Firebase no ha sido inicializado. Llama primero a initializeFirebase()');
  }
  return admin.messaging();
};

const getAuth = () => {
  if (!firebaseApp) {
    throw new Error('Firebase no ha sido inicializado. Llama primero a initializeFirebase()');
  }
  return admin.auth();
};

const verifyFCMToken = async (token) => {
  try {
    if (!token || typeof token !== 'string') {
      return { valid: false, error: 'Token no válido' };
    }
    
    const message = {
      data: { test: 'true' },
      token: token,
      android: { priority: 'high' },
      apns: { headers: { 'apns-priority': '10' } }
    };
    
    await getMessaging().send(message);
    return { valid: true };
  } catch (error) {
    return { 
      valid: false, 
      error: error.code || error.message 
    };
  }
};

const sendTestNotification = async (fcmToken) => {
  try {
    const message = {
      notification: {
        title: '🧪 Notificación de Prueba',
        body: 'Si recibes esto, Firebase está funcionando correctamente!'
      },
      data: {
        test: 'true',
        timestamp: new Date().toISOString()
      },
      token: fcmToken
    };

    const response = await getMessaging().send(message);
    return { success: true, messageId: response };
  } catch (error) {
    throw new Error(`Error enviando notificación de prueba: ${error.message}`);
  }
};

module.exports = {
  initializeFirebase,
  getMessaging,
  getAuth,
  verifyFCMToken,
  sendTestNotification
};