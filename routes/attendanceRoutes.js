const express = require('express');
const { body, query } = require('express-validator');
const AttendanceController = require('../controllers/AttendanceController');
const { validateRequest, sanitizeInput } = require('../middleware/validateRequest');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);

const scanQRValidation = [
  body('qrCode')
    .notEmpty()
    .withMessage('El código QR es requerido')
    .isString()
    .withMessage('El código QR debe ser una cadena válida')
];

const dateRangeValidation = [
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('La fecha de inicio debe tener formato válido (YYYY-MM-DD)'),
  
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('La fecha de fin debe tener formato válido (YYYY-MM-DD)')
];

router.post('/scan', 
  sanitizeInput,
  scanQRValidation, 
  validateRequest, 
  AttendanceController.scanQR
);

router.get('/my-status', 
  AttendanceController.getMyStatus
);

router.get('/my-attendances', 
  dateRangeValidation,
  validateRequest,
  AttendanceController.getMyAttendances
);


router.get('/today', 
  requireAdmin,
  AttendanceController.getTodayAttendances
);

router.get('/stats', 
  requireAdmin,
  AttendanceController.getAttendanceStats
);

module.exports = router;