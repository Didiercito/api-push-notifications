const { User } = require('../models');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { verifyFCMToken } = require('../config/firebase');
const NotificationService = require('../service/NotificationService');

class AuthController {
  
  async register(req, res) {
    try {
      const { firstName, lastName, email, password, fcmToken, role = 'employee' } = req.body;

      const existingUser = await User.findOne({ where: { email } });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'El email ya está registrado'
        });
      }

      const user = await User.create({
        firstName,
        lastName,
        email,
        password,
        fcmToken,
        role
      });

      const token = jwt.sign(
        { 
          userId: user.id, 
          email: user.email, 
          role: user.role 
        },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      if (fcmToken) {
        try {
          await NotificationService.sendTestNotification(fcmToken, user.firstName);
        } catch (error) {
          console.log('No se pudo enviar notificación de bienvenida:', error.message);
        }
      }

      res.status(201).json({
        success: true,
        message: 'Usuario registrado exitosamente',
        data: {
          user: {
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            role: user.role
          },
          token
        }
      });

    } catch (error) {
      console.error('Error en registro:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  async login(req, res) {
    try {
      const { email, password, fcmToken } = req.body;

      const user = await User.findOne({ where: { email } });
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Credenciales inválidas'
        });
      }

      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          message: 'Credenciales inválidas'
        });
      }

      if (fcmToken) {
        await user.update({ fcmToken });
      }

      const token = jwt.sign(
        { 
          userId: user.id, 
          email: user.email, 
          role: user.role 
        },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.json({
        success: true,
        message: 'Login exitoso',
        data: {
          user: {
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            role: user.role
          },
          token
        }
      });

    } catch (error) {
      console.error('Error en login:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  async updateFCMToken(req, res) {
    try {
      const { fcmToken } = req.body;
      const { userId } = req.user;

      if (!fcmToken) {
        return res.status(400).json({
          success: false,
          message: 'Token FCM es requerido'
        });
      }

      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado'
        });
      }

      await user.update({ fcmToken });

      res.json({
        success: true,
        message: 'Token FCM actualizado exitosamente'
      });

    } catch (error) {
      console.error('Error actualizando token FCM:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  async getProfile(req, res) {
    try {
      const { userId } = req.user;

      const user = await User.findByPk(userId, {
        attributes: ['id', 'firstName', 'lastName', 'email', 'role', 'createdAt']
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado'
        });
      }

      res.json({
        success: true,
        data: { user }
      });

    } catch (error) {
      console.error('Error obteniendo perfil:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  async getEmployees(req, res) {
    try {
      const { role } = req.user;

      if (role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Acceso denegado. Solo administradores pueden ver empleados'
        });
      }

      const employees = await User.findAll({
        where: { role: 'employee' },
        attributes: ['id', 'firstName', 'lastName', 'email', 'createdAt']
      });

      res.json({
        success: true,
        data: {
          employees,
          count: employees.length
        }
      });

    } catch (error) {
      console.error('Error obteniendo empleados:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }
}

module.exports = new AuthController();