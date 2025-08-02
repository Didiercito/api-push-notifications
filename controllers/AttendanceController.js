const { User, Attendance, QRCode } = require('../models');
const NotificationService = require('../service/NotificationService');
const { Op } = require('sequelize');

class AttendanceController {
  async scanQR(req, res) {
    try {
      const { qrCode } = req.body;
      const { userId } = req.user;

      if (!qrCode) {
        return res.status(400).json({
          success: false,
          message: 'Código QR es requerido'
        });
      }

      // Verificar que el código QR existe y está activo
      const qrRecord = await QRCode.findOne({
        where: {
          code: qrCode,
          isActive: true
        }
      });

      if (!qrRecord) {
        return res.status(400).json({
          success: false,
          message: 'Código QR inválido o inactivo'
        });
      }

      // Obtener información del usuario
      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado'
        });
      }

      // Verificar si ya marcó este tipo de asistencia hoy
      const today = new Date().toISOString().split('T')[0];
      const existingAttendance = await Attendance.findOne({
        where: {
          userId,
          type: qrRecord.type,
          timestamp: {
            [Op.gte]: new Date(today)
          }
        }
      });

      if (existingAttendance) {
        return res.status(400).json({
          success: false,
          message: `Ya marcaste ${qrRecord.type === 'entry' ? 'entrada' : 'salida'} hoy`
        });
      }

      // Si es salida, verificar que tenga entrada
      if (qrRecord.type === 'exit') {
        const entryToday = await Attendance.findOne({
          where: {
            userId,
            type: 'entry',
            timestamp: {
              [Op.gte]: new Date(today)
            }
          }
        });

        if (!entryToday) {
          return res.status(400).json({
            success: false,
            message: 'Debes marcar entrada antes de marcar salida'
          });
        }
      }

      // Registrar asistencia
      const attendance = await Attendance.create({
        userId,
        type: qrRecord.type,
        qrCode: qrRecord.code,
        timestamp: new Date()
      });

      // Preparar datos para notificación
      const fullName = `${user.firstName} ${user.lastName}`;
      const time = new Date().toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit'
      });

      // Enviar notificación a administradores
      try {
        if (qrRecord.type === 'entry') {
          await NotificationService.notifyAttendanceEntry(fullName, time);
        } else {
          await NotificationService.notifyAttendanceExit(fullName, time);
        }
      } catch (error) {
        console.log('Error enviando notificación:', error.message);
      }

      // Calcular horas trabajadas si es salida
      let workedHours = null;
      if (qrRecord.type === 'exit') {
        const lastEntry = await Attendance.findOne({
          where: {
            userId,
            type: 'entry',
            timestamp: {
              [Op.lt]: attendance.timestamp,
              [Op.gte]: new Date(today)
            }
          },
          order: [['timestamp', 'DESC']]
        });

        if (lastEntry) {
          const diffMs = attendance.timestamp - lastEntry.timestamp;
          const diffHours = diffMs / (1000 * 60 * 60);
          workedHours = parseFloat(diffHours.toFixed(2));
        }
      }

      // Determinar mensaje de respuesta
      const typeMessage = qrRecord.type === 'entry' ? 'ENTRADA' : 'SALIDA';
      const greeting = qrRecord.type === 'entry' 
        ? `¡HOLA ${user.firstName.toUpperCase()}! QUE TENGAS BUEN DÍA HOY`
        : `¡HASTA MAÑANA ${user.firstName.toUpperCase()}! BUEN DESCANSO`;

      const responseData = {
        attendance: {
          id: attendance.id,
          type: attendance.type,
          timestamp: attendance.timestamp
        },
        animation: {
          type: typeMessage,
          greeting,
          time,
          user: fullName
        }
      };

      if (workedHours !== null) {
        responseData.workedHours = workedHours;
      }

      res.json({
        success: true,
        message: `${typeMessage} registrada exitosamente`,
        data: responseData
      });

    } catch (error) {
      console.error('Error escaneando QR:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  // Obtener asistencias del día (para admins)
  async getTodayAttendances(req, res) {
    try {
      const { role } = req.user;

      if (role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Acceso denegado. Solo administradores pueden ver asistencias'
        });
      }

      const today = new Date().toISOString().split('T')[0];

      const attendances = await Attendance.findAll({
        where: {
          timestamp: {
            [Op.gte]: new Date(today)
          }
        },
        include: [{
          model: User,
          as: 'user',
          attributes: ['id', 'firstName', 'lastName', 'email']
        }],
        order: [['timestamp', 'DESC']]
      });

      res.json({
        success: true,
        data: {
          attendances,
          count: attendances.length,
          date: today
        }
      });

    } catch (error) {
      console.error('Error obteniendo asistencias:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  // Obtener mis asistencias
  async getMyAttendances(req, res) {
    try {
      const { userId } = req.user;
      const { startDate, endDate } = req.query;

      // Fechas por defecto (último mes)
      const defaultEndDate = new Date();
      const defaultStartDate = new Date();
      defaultStartDate.setMonth(defaultStartDate.getMonth() - 1);

      const start = startDate ? new Date(startDate) : defaultStartDate;
      const end = endDate ? new Date(endDate) : defaultEndDate;

      const attendances = await Attendance.findAll({
        where: {
          userId,
          timestamp: {
            [Op.between]: [start, end]
          }
        },
        order: [['timestamp', 'DESC']]
      });

      res.json({
        success: true,
        data: {
          attendances,
          count: attendances.length,
          period: {
            startDate: start,
            endDate: end
          }
        }
      });

    } catch (error) {
      console.error('Error obteniendo mis asistencias:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  // Obtener estadísticas de asistencia (para admins)
  async getAttendanceStats(req, res) {
    try {
      const { role } = req.user;

      if (role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Acceso denegado. Solo administradores pueden ver estadísticas'
        });
      }

      const today = new Date().toISOString().split('T')[0];

      // Contar empleados totales
      const totalEmployees = await User.count({
        where: { role: 'employee' }
      });

      // Contar empleados que marcaron entrada hoy
      const employeesWithEntry = await Attendance.count({
        where: {
          type: 'entry',
          timestamp: {
            [Op.gte]: new Date(today)
          }
        },
        distinct: true,
        col: 'userId'
      });

      // Contar empleados que marcaron salida hoy
      const employeesWithExit = await Attendance.count({
        where: {
          type: 'exit',
          timestamp: {
            [Op.gte]: new Date(today)
          }
        },
        distinct: true,
        col: 'userId'
      });

      res.json({
        success: true,
        data: {
          date: today,
          totalEmployees,
          employeesWithEntry,
          employeesWithExit,
          absentEmployees: totalEmployees - employeesWithEntry,
          attendanceRate: totalEmployees > 0 ? (employeesWithEntry / totalEmployees * 100).toFixed(1) : 0
        }
      });

    } catch (error) {
      console.error('Error obteniendo estadísticas:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  async getMyStatus(req, res) {
    try {
      const { userId } = req.user;
      const today = new Date().toISOString().split('T')[0];

      const todayAttendances = await Attendance.findAll({
        where: {
          userId,
          timestamp: {
            [Op.gte]: new Date(today)
          }
        },
        order: [['timestamp', 'ASC']]
      });

      const hasEntry = todayAttendances.some(att => att.type === 'entry');
      const hasExit = todayAttendances.some(att => att.type === 'exit');

      let status = 'not_started'; 
      if (hasEntry && hasExit) {
        status = 'completed'; 
      } else if (hasEntry) {
        status = 'in_progress'; 
      }

      res.json({
        success: true,
        data: {
          status,
          hasEntry,
          hasExit,
          attendances: todayAttendances,
          date: today
        }
      });

    } catch (error) {
      console.error('Error obteniendo mi estado:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }
}

module.exports = new AttendanceController();