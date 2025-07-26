const QRService = require('../service/QRService'); 
const { QRCode } = require('../models'); 

class QRController {

  async generateQR(req, res) {
    try {
      const { type, description, regenerate = false } = req.body;
      const { userId, role } = req.user;

      if (role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Acceso denegado. Solo administradores pueden generar códigos QR'
        });
      }

      if (!['entry', 'exit'].includes(type)) {
        return res.status(400).json({
          success: false,
          message: 'Tipo de QR inválido. Debe ser "entry" o "exit"'
        });
      }

      const result = await QRService.createQRCode(type, userId, description, regenerate);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: result.error
        });
      }

      res.status(201).json({
        success: true,
        message: 'Código QR generado exitosamente',
        data: result
      });

    } catch (error) {
      console.error('Error generando QR:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  // Generar par de QRs (entrada y salida)
  async generateQRPair(req, res) {
    try {
      const { companyName = 'Mi Empresa' } = req.body;
      const { userId, role } = req.user;

      // Solo administradores pueden generar QRs
      if (role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Acceso denegado. Solo administradores pueden generar códigos QR'
        });
      }

      const result = await QRService.generateQRPair(userId, companyName);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: result.error
        });
      }

      res.status(201).json({
        success: true,
        message: result.message,
        data: result.qrPair
      });

    } catch (error) {
      console.error('Error generando par de QRs:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  // Obtener códigos QR activos
  async getQRCodes(req, res) {
    try {
      const { type, includeImages = 'false' } = req.query;
      const { role } = req.user;

      // Solo administradores pueden ver todos los QRs
      if (role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Acceso denegado. Solo administradores pueden ver los códigos QR'
        });
      }

      const shouldIncludeImages = includeImages === 'true';
      const result = await QRService.getActiveQRCodes(type, shouldIncludeImages);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: result.error
        });
      }

      res.json({
        success: true,
        data: {
          qrCodes: result.qrCodes,
          count: result.qrCodes.length
        }
      });

    } catch (error) {
      console.error('Error obteniendo QRs:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  // Validar código QR (para escaneo)
  async validateQR(req, res) {
    try {
      const { qrCode } = req.body;

      if (!qrCode) {
        return res.status(400).json({
          success: false,
          message: 'Código QR es requerido'
        });
      }

      const result = await QRService.validateQRCode(qrCode);

      if (!result.valid) {
        return res.status(400).json({
          success: false,
          message: result.error
        });
      }

      res.json({
        success: true,
        message: 'Código QR válido',
        data: result.qrRecord
      });

    } catch (error) {
      console.error('Error validando QR:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  // Obtener un QR específico con imagen
  async getQRCode(req, res) {
    try {
      const { qrId } = req.params;
      const { role } = req.user;

      // Solo administradores pueden ver QRs específicos
      if (role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Acceso denegado. Solo administradores pueden ver códigos QR'
        });
      }

      const qrRecord = await QRCode.findByPk(qrId);

      if (!qrRecord) {
        return res.status(404).json({
          success: false,
          message: 'Código QR no encontrado'
        });
      }

      // Generar imagen QR
      const qrImage = await QRService.generateQRImage(qrRecord.code, { width: 300 });

      res.json({
        success: true,
        data: {
          qrRecord: {
            id: qrRecord.id,
            code: qrRecord.code,
            type: qrRecord.type,
            description: qrRecord.description,
            isActive: qrRecord.isActive,
            createdAt: qrRecord.createdAt
          },
          qrImage: qrImage.success ? qrImage.dataURL : null
        }
      });

    } catch (error) {
      console.error('Error obteniendo QR específico:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }

  // Desactivar código QR
  async deactivateQR(req, res) {
    try {
      const { qrId } = req.params;
      const { userId } = req.user;

      const result = await QRService.deactivateQRCode(qrId, userId);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: result.error
        });
      }

      res.json({
        success: true,
        message: result.message
      });

    } catch (error) {
      console.error('Error desactivando QR:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
      });
    }
  }
}

module.exports = new QRController();