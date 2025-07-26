const express = require('express');
const { body } = require('express-validator');
const QRController = require('../controllers/QRController');
const { validateRequest, sanitizeInput } = require('../middleware/validateRequest');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateToken);

const generateQRPairValidation = [
  body('companyName')
    .optional()
    .isString()
    .withMessage('El nombre de la empresa debe ser texto')
];

const validateQRValidation = [
  body('qrCode')
    .notEmpty()
    .withMessage('El código QR es requerido')
];

router.post('/generate-pair', 
  requireAdmin,
  sanitizeInput,
  generateQRPairValidation, 
  validateRequest, 
  QRController.generateQRPair
);

router.get('/list', 
  requireAdmin,
  QRController.getQRCodes
);

router.post('/validate', 
  sanitizeInput,
  validateQRValidation, 
  validateRequest, 
  QRController.validateQR
);

module.exports = router;