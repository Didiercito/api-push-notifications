const NotificationService = require('../service/NotificationService');
const { User } = require('../models');

class NotificationController {

  async sendTestNotification(req, res) {
    try {
      const { fcmToken, title, message } = req.body;
      const { role } = req.user;

      if (role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Acceso denegado. Solo administradores pueden enviar notificaciones'
        });
      }

      if (!fcmToken) {
        return res.status(400).json({
          success: false,
          message: 'Token FCM es requerido'
        });
      }

      const testTitle = title || '🧪 Notificación de Prueba';
      const testMessage = message || 'Esta es una notificación de prueba desde el panel de administración';

      const result = await NotificationService.sendToDevice(
        fcmToken,
        testTitle,
        testMessage,
        { type: 'test', timestamp: new Date().toISOString() }
      );

      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: 'Error enviando notificación',
          error: result.error
        });
      }

      res.json({
        success: true,
        message: 'Notificación de prueba enviada exitosamente',
        data: {
          messageId: result.messageId
        }
      });

    } catch (error) {
      console.error('Error enviando notificación de prueba:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  // Enviar notificación a todos los administradores
  async sendToAllAdmins(req, res) {
    try {
      const { title, message } = req.body;
      const { role } = req.user;

      // Solo administradores pueden enviar notificaciones grupales
      if (role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Acceso denegado. Solo administradores pueden enviar notificaciones'
        });
      }

      if (!title || !message) {
        return res.status(400).json({
          success: false,
          message: 'Título y mensaje son requeridos'
        });
      }

      const result = await NotificationService.sendToAllAdmins(
        title,
        message,
        { type: 'admin_broadcast', timestamp: new Date().toISOString() }
      );

      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: 'Error enviando notificación',
          error: result.error || result.message
        });
      }

      res.json({
        success: true,
        message: 'Notificación enviada a todos los administradores',
        data: {
          successCount: result.successCount,
          failureCount: result.failureCount
        }
      });

    } catch (error) {
      console.error('Error enviando notificación a admins:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  // Enviar notificación a un usuario específico
  async sendToUser(req, res) {
    try {
      const { userId, title, message } = req.body;
      const { role } = req.user;

      // Solo administradores pueden enviar notificaciones a usuarios específicos
      if (role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Acceso denegado. Solo administradores pueden enviar notificaciones'
        });
      }

      if (!userId || !title || !message) {
        return res.status(400).json({
          success: false,
          message: 'ID de usuario, título y mensaje son requeridos'
        });
      }

      // Buscar el usuario y su token FCM
      const user = await User.findByPk(userId, {
        attributes: ['id', 'firstName', 'lastName', 'fcmToken']
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado'
        });
      }

      if (!user.fcmToken) {
        return res.status(400).json({
          success: false,
          message: 'El usuario no tiene token FCM registrado'
        });
      }

      const result = await NotificationService.sendToDevice(
        user.fcmToken,
        title,
        message,
        { 
          type: 'direct_message', 
          timestamp: new Date().toISOString(),
          targetUser: `${user.firstName} ${user.lastName}`
        }
      );

      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: 'Error enviando notificación',
          error: result.error
        });
      }

      res.json({
        success: true,
        message: `Notificación enviada a ${user.firstName} ${user.lastName}`,
        data: {
          messageId: result.messageId,
          user: {
            id: user.id,
            name: `${user.firstName} ${user.lastName}`
          }
        }
      });

    } catch (error) {
      console.error('Error enviando notificación a usuario:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  // Obtener lista de usuarios con tokens FCM válidos
  async getUsersWithFCM(req, res) {
    try {
      const { role } = req.user;

      // Solo administradores pueden ver la lista
      if (role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Acceso denegado. Solo administradores pueden ver esta información'
        });
      }

      const users = await User.findAll({
        where: {
          fcmToken: {
            [require('sequelize').Op.not]: null
          }
        },
        attributes: ['id', 'firstName', 'lastName', 'email', 'role'],
        order: [['firstName', 'ASC']]
      });

      res.json({
        success: true,
        data: {
          users,
          count: users.length
        }
      });

    } catch (error) {
      console.error('Error obteniendo usuarios con FCM:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  // Validar token FCM
  async validateFCMToken(req, res) {
    try {
      const { fcmToken } = req.body;

      if (!fcmToken) {
        return res.status(400).json({
          success: false,
          message: 'Token FCM es requerido'
        });
      }

      const result = await NotificationService.validateFCMToken(fcmToken);

      res.json({
        success: true,
        data: {
          valid: result.valid,
          error: result.error || null
        }
      });

    } catch (error) {
      console.error('Error validando token FCM:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  // Enviar resumen diario (para ser llamado por cron o manualmente)
  async sendDailySummary(req, res) {
    try {
      const { role } = req.user;

      // Solo administradores pueden enviar resumen diario
      if (role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Acceso denegado. Solo administradores pueden enviar resumen diario'
        });
      }

      // Obtener estadísticas del día
      const totalEmployees = await User.count({
        where: { role: 'employee' }
      });

      const today = new Date().toISOString().split('T')[0];
      const { Attendance } = require('../models');

      const presentCount = await Attendance.count({
        where: {
          type: 'entry',
          timestamp: {
            [require('sequelize').Op.gte]: new Date(today)
          }
        },
        distinct: true,
        col: 'userId'
      });

      const absentCount = totalEmployees - presentCount;

      const result = await NotificationService.notifyDailySummary(
        totalEmployees,
        presentCount,
        absentCount
      );

      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: 'Error enviando resumen diario',
          error: result.error || result.message
        });
      }

      res.json({
        success: true,
        message: 'Resumen diario enviado exitosamente',
        data: {
          totalEmployees,
          presentCount,
          absentCount,
          successCount: result.successCount,
          failureCount: result.failureCount
        }
      });

    } catch (error) {
      console.error('Error enviando resumen diario:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }
}

module.exports = new NotificationController();