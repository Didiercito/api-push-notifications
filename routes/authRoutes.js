const express = require('express');
const { body } = require('express-validator');
const AuthController = require('../controllers/AuthController');
const { validateRequest, sanitizeInput } = require('../middleware/validateRequest');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

const registerValidation = [
  body('firstName')
    .isLength({ min: 2, max: 50 })
    .withMessage('El nombre debe tener entre 2 y 50 caracteres')
    .matches(/^[a-zA-ZÀ-ÿ\s]+$/)
    .withMessage('El nombre solo puede contener letras y espacios'),
  
  body('lastName')
    .isLength({ min: 2, max: 50 })
    .withMessage('El apellido debe tener entre 2 y 50 caracteres')
    .matches(/^[a-zA-ZÀ-ÿ\s]+$/)
    .withMessage('El apellido solo puede contener letras y espacios'),
  
  body('email')
    .isEmail()
    .withMessage('Debe ser un email válido')
    .normalizeEmail(),
  
  body('password')
    .isLength({ min: 6 })
    .withMessage('La contraseña debe tener al menos 6 caracteres'),
  
  body('role')
    .optional()
    .isIn(['admin', 'employee'])
    .withMessage('El rol debe ser admin o employee'),
  
  body('fcmToken')
    .optional()
    .isString()
    .withMessage('El token FCM debe ser una cadena válida')
];

const loginValidation = [
  body('email')
    .isEmail()
    .withMessage('Debe ser un email válido')
    .normalizeEmail(),
  
  body('password')
    .notEmpty()
    .withMessage('La contraseña es requerida'),
  
  body('fcmToken')
    .optional()
    .isString()
    .withMessage('El token FCM debe ser una cadena válida')
];

const fcmTokenValidation = [
  body('fcmToken')
    .notEmpty()
    .withMessage('El token FCM es requerido')
    .isString()
    .withMessage('El token FCM debe ser una cadena válida')
];

router.post('/register', 
  sanitizeInput,
  registerValidation, 
  validateRequest, 
  AuthController.register
);

router.post('/login', 
  sanitizeInput,
  loginValidation, 
  validateRequest, 
  AuthController.login
);

router.use(authenticateToken);

router.get('/profile', AuthController.getProfile);

router.put('/fcm-token', 
  sanitizeInput,
  fcmTokenValidation, 
  validateRequest, 
  AuthController.updateFCMToken
);

router.get('/employees', requireAdmin, AuthController.getEmployees);

module.exports = router;