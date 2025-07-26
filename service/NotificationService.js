const { getMessaging } = require('../config/firebase');
const { User } = require('../models');

class NotificationService {
  async sendToDevice(fcmToken, title, body, data = {}) {
    try {
      if (!fcmToken || typeof fcmToken !== 'string') {
        throw new Error('Token FCM inválido');
      }

      const message = {
        notification: {
          title,
          body
        },
        data: {
          ...data,
          timestamp: new Date().toISOString()
        },
        token: fcmToken,
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            channelId: 'attendance_channel'
          }
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1
            }
          },
          headers: {
            'apns-priority': '10'
          }
        }
      };

      const response = await getMessaging().send(message);
      console.log('✅ Notificación enviada exitosamente:', response);
      return { success: true, messageId: response };
    } catch (error) {
      console.error('❌ Error enviando notificación:', error);

      if (error.code === 'messaging/registration-token-not-registered') {
        console.log('🔄 Token FCM no registrado, debería actualizarse');
      }
      
      return { success: false, error: error.message };
    }
  }

  async sendToMultiple(fcmTokens, title, body, data = {}) {
    try {
      if (!Array.isArray(fcmTokens) || fcmTokens.length === 0) {
        throw new Error('Lista de tokens FCM inválida');
      }

      const message = {
        notification: {
          title,
          body
        },
        data: {
          ...data,
          timestamp: new Date().toISOString()
        },
        tokens: fcmTokens,
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            channelId: 'attendance_channel'
          }
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1
            }
          },
          headers: {
            'apns-priority': '10'
          }
        }
      };

      const response = await getMessaging().sendMulticast(message);
      console.log('✅ Notificaciones multicast enviadas:', {
        successCount: response.successCount,
        failureCount: response.failureCount
      });

      return {
        success: true,
        successCount: response.successCount,
        failureCount: response.failureCount,
        responses: response.responses
      };
    } catch (error) {
      console.error('❌ Error enviando notificaciones multicast:', error);
      return { success: false, error: error.message };
    }
  }

  async sendToAllAdmins(title, body, data = {}) {
    try {
      const admins = await User.findAll({
        where: {
          role: 'admin',
          fcmToken: {
            [require('sequelize').Op.not]: null
          }
        },
        attributes: ['id', 'firstName', 'lastName', 'fcmToken']
      });
      
      if (admins.length === 0) {
        console.log('⚠️ No se encontraron administradores activos con tokens FCM');
        return { success: false, message: 'No hay administradores disponibles' };
      }

      const tokens = admins.map(admin => admin.fcmToken).filter(token => token);
      
      if (tokens.length === 0) {
        console.log('⚠️ No se encontraron tokens FCM válidos para administradores');
        return { success: false, message: 'No hay tokens FCM válidos' };
      }

      return await this.sendToMultiple(tokens, title, body, data);
    } catch (error) {
      console.error('❌ Error enviando notificación a administradores:', error);
      return { success: false, error: error.message };
    }
  }

  async notifyAttendanceEntry(employeeName, time, isLate = false) {
    const title = isLate ? '🔴 Llegada Tardía' : '🟢 Nueva Entrada';
    const body = `${employeeName} marcó entrada - ${time}`;
    const data = {
      type: 'attendance_entry',
      employee: employeeName,
      time: time,
      isLate: isLate.toString()
    };

    return await this.sendToAllAdmins(title, body, data);
  }

  async notifyAttendanceExit(employeeName, time, isEarly = false) {
    const title = isEarly ? '🟡 Salida Temprana' : '🟡 Nueva Salida';
    const body = `${employeeName} marcó salida - ${time}`;
    const data = {
      type: 'attendance_exit',
      employee: employeeName,
      time: time,
      isEarly: isEarly.toString()
    };

    return await this.sendToAllAdmins(title, body, data);
  }

  async notifyMissingEntry(employeeName) {
    const title = '⚠️ Empleado sin Entrada';
    const body = `${employeeName} no ha marcado entrada hoy`;
    const data = {
      type: 'missing_entry',
      employee: employeeName
    };

    return await this.sendToAllAdmins(title, body, data);
  }

  async notifyDailySummary(totalEmployees, presentCount, absentCount) {
    const title = '📊 Resumen Diario';
    const body = `Presentes: ${presentCount}/${totalEmployees} - Ausentes: ${absentCount}`;
    const data = {
      type: 'daily_summary',
      totalEmployees: totalEmployees.toString(),
      presentCount: presentCount.toString(),
      absentCount: absentCount.toString()
    };

    return await this.sendToAllAdmins(title, body, data);
  }

  async sendTestNotification(fcmToken, userName = 'Usuario') {
    const title = '🧪 Notificación de Prueba';
    const body = `¡Hola ${userName}! Firebase está funcionando correctamente`;
    const data = {
      type: 'test',
      timestamp: new Date().toISOString()
    };

    return await this.sendToDevice(fcmToken, title, body, data);
  }

  async validateFCMToken(token) {
    try {
      const testMessage = {
        data: { test: 'true' },
        token: token
      };
      
      await getMessaging().send(testMessage);
      return { valid: true };
    } catch (error) {
      return { 
        valid: false, 
        error: error.code || error.message 
      };
    }
  }

  async subscribeToTopic(fcmToken, topic) {
    try {
      const response = await getMessaging().subscribeToTopic([fcmToken], topic);
      console.log(`✅ Token suscrito al tópico ${topic}:`, response);
      return { success: true, response };
    } catch (error) {
      console.error(`❌ Error suscribiendo al tópico ${topic}:`, error);
      return { success: false, error: error.message };
    }
  }

  async unsubscribeFromTopic(fcmToken, topic) {
    try {
      const response = await getMessaging().unsubscribeFromTopic([fcmToken], topic);
      console.log(`✅ Token desuscrito del tópico ${topic}:`, response);
      return { success: true, response };
    } catch (error) {
      console.error(`❌ Error desuscribiendo del tópico ${topic}:`, error);
      return { success: false, error: error.message };
    }
  }

  async sendToTopic(topic, title, body, data = {}) {
    try {
      const message = {
        notification: {
          title,
          body
        },
        data: {
          ...data,
          timestamp: new Date().toISOString()
        },
        topic: topic,
        android: {
          priority: 'high'
        },
        apns: {
          headers: {
            'apns-priority': '10'
          }
        }
      };

      const response = await getMessaging().send(message);
      console.log(`✅ Notificación enviada al tópico ${topic}:`, response);
      return { success: true, messageId: response };
    } catch (error) {
      console.error(`❌ Error enviando notificación al tópico ${topic}:`, error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new NotificationService();