const express = require('express');
const { body } = require('express-validator');
const NotificationController = require('../controllers/NotificationController');
const { validateRequest, sanitizeInput } = require('../middleware/validateRequest');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);

const testNotificationValidation = [
  body('fcmToken')
    .notEmpty()
    .withMessage('El token FCM es requerido')
    .isString()
    .withMessage('El token FCM debe ser una cadena válida'),
  
  body('title')
    .optional()
    .isLength({ max: 100 })
    .withMessage('El título no puede exceder 100 caracteres'),
  
  body('message')
    .optional()
    .isLength({ max: 500 })
    .withMessage('El mensaje no puede exceder 500 caracteres')
];

const groupNotificationValidation = [
  body('title')
    .notEmpty()
    .withMessage('El título es requerido')
    .isLength({ min: 1, max: 100 })
    .withMessage('El título debe tener entre 1 y 100 caracteres'),
  
  body('message')
    .notEmpty()
    .withMessage('El mensaje es requerido')
    .isLength({ min: 1, max: 500 })
    .withMessage('El mensaje debe tener entre 1 y 500 caracteres')
];

const userNotificationValidation = [
  body('userId')
    .isInt({ min: 1 })
    .withMessage('El ID del usuario debe ser un número entero positivo'),
  
  body('title')
    .notEmpty()
    .withMessage('El título es requerido')
    .isLength({ min: 1, max: 100 })
    .withMessage('El título debe tener entre 1 y 100 caracteres'),
  
  body('message')
    .notEmpty()
    .withMessage('El mensaje es requerido')
    .isLength({ min: 1, max: 500 })
    .withMessage('El mensaje debe tener entre 1 y 500 caracteres')
];

const fcmTokenValidation = [
  body('fcmToken')
    .notEmpty()
    .withMessage('El token FCM es requerido')
    .isString()
    .withMessage('El token FCM debe ser una cadena válida')
];


router.post('/test', 
  requireAdmin,
  sanitizeInput,
  testNotificationValidation, 
  validateRequest, 
  NotificationController.sendTestNotification
);

router.post('/broadcast-admins', 
  requireAdmin,
  sanitizeInput,
  groupNotificationValidation, 
  validateRequest, 
  NotificationController.sendToAllAdmins
);

router.post('/send-to-user', 
  requireAdmin,
  sanitizeInput,
  userNotificationValidation, 
  validateRequest, 
  NotificationController.sendToUser
);

router.get('/users-with-fcm', 
  requireAdmin,
  NotificationController.getUsersWithFCM
);

router.post('/daily-summary', 
  requireAdmin,
  NotificationController.sendDailySummary
);


router.post('/validate-fcm', 
  sanitizeInput,
  fcmTokenValidation, 
  validateRequest, 
  NotificationController.validateFCMToken
);

module.exports = router;