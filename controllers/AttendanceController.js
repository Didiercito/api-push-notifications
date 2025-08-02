const { User, Attendance, QRCode } = require('../models');
const NotificationService = require('../service/NotificationService');
const { Op } = require('sequelize');

class AttendanceController {
  async scanQR(req, res) {
    console.log('\n=== INICIO SCAN QR DEBUG ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    console.log('User info:', JSON.stringify(req.user, null, 2));
    
    try {
      const { qrCode } = req.body;
      const { userId } = req.user;

      console.log('Extracted qrCode:', qrCode);
      console.log('Extracted userId:', userId);

      if (!qrCode) {
        console.log('❌ ERROR: No QR code provided');
        return res.status(400).json({
          success: false,
          message: 'Código QR es requerido'
        });
      }

      console.log('🔍 Buscando QR en base de datos...');
      // Verificar que el código QR existe y está activo
      const qrRecord = await QRCode.findOne({
        where: {
          code: qrCode,
          isActive: true
        }
      });

      console.log('QR Record encontrado:', qrRecord ? 'SÍ' : 'NO');
      if (qrRecord) {
        console.log('QR Details:', {
          id: qrRecord.id,
          code: qrRecord.code,
          type: qrRecord.type,
          isActive: qrRecord.isActive
        });
      }

      if (!qrRecord) {
        console.log('❌ ERROR: QR Code no encontrado o inactivo');
        return res.status(400).json({
          success: false,
          message: 'Código QR inválido o inactivo'
        });
      }

      console.log('🔍 Usuario escaneando:', userId);
      console.log('🔍 Tipo de QR:', qrRecord.type);

      console.log('🔍 Buscando usuario...');
      // Obtener información del usuario
      const user = await User.findByPk(userId);
      console.log('Usuario encontrado:', user ? 'SÍ' : 'NO');
      if (user) {
        console.log('User details:', {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role
        });
      }

      if (!user) {
        console.log('❌ ERROR: Usuario no encontrado');
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado'
        });
      }

      console.log('🔍 Verificando asistencias del día...');
      const today = new Date().toISOString().split('T')[0];
      console.log('🔍 Fecha de hoy:', today);

      // ✅ NUEVA LÓGICA MEJORADA - Verificar entrada y salida por separado
      console.log('🔍 Verificando si ya tiene entrada hoy...');
      const hasEntryToday = await Attendance.findOne({
        where: {
          userId,
          type: 'entry',
          timestamp: {
            [Op.gte]: new Date(today)
          }
        },
        attributes: ['id', 'userId', 'type', 'timestamp']
      });

      console.log('🔍 Entrada previa encontrada:', hasEntryToday ? 'SÍ' : 'NO');
      if (hasEntryToday) {
        console.log('Entrada existente:', {
          id: hasEntryToday.id,
          type: hasEntryToday.type,
          timestamp: hasEntryToday.timestamp
        });
      }

      console.log('🔍 Verificando si ya tiene salida hoy...');
      const hasExitToday = await Attendance.findOne({
        where: {
          userId,
          type: 'exit',
          timestamp: {
            [Op.gte]: new Date(today)
          }
        },
        attributes: ['id', 'userId', 'type', 'timestamp']
      });

      console.log('🔍 Salida previa encontrada:', hasExitToday ? 'SÍ' : 'NO');
      if (hasExitToday) {
        console.log('Salida existente:', {
          id: hasExitToday.id,
          type: hasExitToday.type,
          timestamp: hasExitToday.timestamp
        });
      }

      // ✅ VALIDACIONES ESPECÍFICAS POR TIPO DE QR
      if (qrRecord.type === 'entry') {
        console.log('🔍 Validando QR de ENTRADA...');
        if (hasEntryToday) {
          console.log('❌ ERROR: Ya marcó entrada hoy');
          return res.status(400).json({
            success: false,
            message: 'Ya marcaste entrada hoy'
          });
        }
        console.log('✅ Validación de entrada PASÓ - puede marcar entrada');
      } else if (qrRecord.type === 'exit') {
        console.log('🔍 Validando QR de SALIDA...');
        if (!hasEntryToday) {
          console.log('❌ ERROR: No hay entrada previa para poder marcar salida');
          return res.status(400).json({
            success: false,
            message: 'Debes marcar entrada antes de marcar salida'
          });
        }
        if (hasExitToday) {
          console.log('❌ ERROR: Ya marcó salida hoy');
          return res.status(400).json({
            success: false,
            message: 'Ya marcaste salida hoy'
          });
        }
        console.log('✅ Validación de salida PASÓ - puede marcar salida');
      } else {
        console.log('❌ ERROR: Tipo de QR no válido');
        return res.status(400).json({
          success: false,
          message: 'Tipo de código QR no válido'
        });
      }

      console.log('✅ Todas las validaciones pasaron, creando asistencia...');

      // Registrar asistencia
      const attendanceData = {
        userId,
        type: qrRecord.type,
        qrCode: qrRecord.code,
        timestamp: new Date()
      };

      console.log('Datos de asistencia a crear:', attendanceData);

      const attendance = await Attendance.create(attendanceData);
      console.log('✅ Asistencia creada exitosamente:', {
        id: attendance.id,
        type: attendance.type,
        timestamp: attendance.timestamp
      });

      // Preparar datos para notificación
      const fullName = `${user.firstName} ${user.lastName}`;
      const time = new Date().toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit'
      });

      console.log('📢 Intentando enviar notificación...');
      // Enviar notificación a administradores
      try {
        if (qrRecord.type === 'entry') {
          await NotificationService.notifyAttendanceEntry(fullName, time);
          console.log('✅ Notificación de entrada enviada');
        } else {
          await NotificationService.notifyAttendanceExit(fullName, time);
          console.log('✅ Notificación de salida enviada');
        }
      } catch (error) {
        console.log('⚠️ Error enviando notificación (no crítico):', error.message);
        // Continuar sin notificación - no es crítico
      }

      // Calcular horas trabajadas si es salida
      let workedHours = null;
      if (qrRecord.type === 'exit') {
        console.log('🔍 Calculando horas trabajadas...');
        const lastEntry = await Attendance.findOne({
          where: {
            userId,
            type: 'entry',
            timestamp: {
              [Op.lt]: attendance.timestamp,
              [Op.gte]: new Date(today)
            }
          },
          order: [['timestamp', 'DESC']],
          attributes: ['id', 'timestamp']
        });

        if (lastEntry) {
          const diffMs = attendance.timestamp - lastEntry.timestamp;
          const diffHours = diffMs / (1000 * 60 * 60);
          workedHours = parseFloat(diffHours.toFixed(2));
          console.log('Horas trabajadas calculadas:', workedHours);
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

      console.log('📤 Enviando respuesta exitosa:', JSON.stringify(responseData, null, 2));

      res.json({
        success: true,
        message: `${typeMessage} registrada exitosamente`,
        data: responseData
      });

      console.log('✅ SCAN QR COMPLETADO EXITOSAMENTE');

    } catch (error) {
      console.error('💥 ERROR CRÍTICO EN SCAN QR:');
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      
      // Si es error de base de datos
      if (error.name === 'SequelizeValidationError') {
        console.error('Errores de validación:', error.errors);
      }
      
      if (error.name === 'SequelizeDatabaseError') {
        console.error('Error de base de datos:', error.sql);
      }

      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        debug: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Resto de métodos existentes...
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

      const totalEmployees = await User.count({
        where: { role: 'employee' }
      });

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