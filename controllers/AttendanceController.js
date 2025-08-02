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

      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado'
        });
      }

      const today = new Date().toISOString().split('T')[0];
      const todayStart = new Date(today);

      const existingAttendance = await Attendance.findOne({
        where: {
          userId,
          type: qrRecord.type,
          timestamp: {
            [Op.gte]: todayStart
          }
        }
      });

      if (existingAttendance) {
        return res.status(400).json({
          success: false,
          message: `Ya marcaste ${qrRecord.type === 'entry' ? 'entrada' : 'salida'} hoy`
        });
      }

      if (qrRecord.type === 'exit') {
        const entryToday = await Attendance.findOne({
          where: {
            userId,
            type: 'entry',
            timestamp: {
              [Op.gte]: todayStart
            }
          },
          order: [['timestamp', 'ASC']]
        });

        if (!entryToday) {
          return res.status(400).json({
            success: false,
            message: 'Debes marcar entrada antes de marcar salida'
          });
        }
      }

      const now = new Date();
      const attendance = await Attendance.create({
        userId,
        type: qrRecord.type,
        qrCode: qrRecord.code,
        timestamp: now
      });

      const fullName = `${user.firstName} ${user.lastName}`;
      const time = now.toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit'
      });

      try {
        if (qrRecord.type === 'entry') {
          await NotificationService.notifyAttendanceEntry(fullName, time);
        } else {
          await NotificationService.notifyAttendanceExit(fullName, time);
        }
      } catch (error) {
        console.log('Error enviando notificación:', error.message);
      }

      let workedHours = null;

      if (qrRecord.type === 'exit') {
        const entryToday = await Attendance.findOne({
          where: {
            userId,
            type: 'entry',
            timestamp: {
              [Op.gte]: todayStart
            }
          },
          order: [['timestamp', 'ASC']]
        });

        if (entryToday) {
          const diffMs = now - new Date(entryToday.timestamp);
          const hours = Math.floor(diffMs / 3600000);
          const minutes = Math.floor((diffMs % 3600000) / 60000);
          workedHours = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        }
      }

      const typeMessage = qrRecord.type === 'entry' ? 'ENTRADA' : 'SALIDA';
      const greeting = qrRecord.type === 'entry'
        ? `¡HOLA ${user.firstName.toUpperCase()}! QUE TENGAS BUEN DÍA HOY`
        : `¡HASTA MAÑANA ${user.firstName.toUpperCase()}! BUEN DESCANSO`;

      res.json({
        success: true,
        message: `${typeMessage} registrada exitosamente`,
        data: {
          attendance: {
            id: attendance.id,
            type: attendance.type,
            timestamp: attendance.timestamp,
            workedHours
          },
          animation: {
            type: typeMessage,
            greeting,
            time,
            user: fullName
          }
        }
      });

    } catch (error) {
      console.error('Error escaneando QR:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

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
            [require('sequelize').Op.gte]: new Date(today)
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

  async getMyAttendances(req, res) {
    try {
      const { userId } = req.user;
      const { startDate, endDate } = req.query;

      const defaultEndDate = new Date();
      const defaultStartDate = new Date();
      defaultStartDate.setMonth(defaultStartDate.getMonth() - 1);

      const start = startDate ? new Date(startDate) : defaultStartDate;
      const end = endDate ? new Date(endDate) : defaultEndDate;

      const attendances = await Attendance.findAll({
        where: {
          userId,
          timestamp: {
            [require('sequelize').Op.between]: [start, end]
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
            [require('sequelize').Op.gte]: new Date(today)
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
            [require('sequelize').Op.gte]: new Date(today)
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
            [require('sequelize').Op.gte]: new Date(today)
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