const QRCode = require('qrcode');
const { QRCode: QRModel } = require('../models');

class QRService {
  async generateQRImage(text, options = {}) {
    try {
      const defaultOptions = {
        type: 'image/png',
        quality: 0.92,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        width: 256,
        ...options
      };

      const qrCodeDataURL = await QRCode.toDataURL(text, defaultOptions);
      return {
        success: true,
        dataURL: qrCodeDataURL,
        text
      };
    } catch (error) {
      console.error('❌ Error generando QR image:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async generateQRSVG(text, options = {}) {
    try {
      const defaultOptions = {
        type: 'svg',
        quality: 0.92,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        width: 256,
        ...options
      };

      const qrCodeSVG = await QRCode.toString(text, defaultOptions);
      return {
        success: true,
        svg: qrCodeSVG,
        text
      };
    } catch (error) {
      console.error('❌ Error generando QR SVG:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  generateUniqueCode(type, prefix = 'QR') {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `${prefix}_${type.toUpperCase()}_${timestamp}_${random}`.toUpperCase();
  }

  async createQRCode(type, createdBy, description = null, regenerate = false) {
    try {
      if (regenerate) {
        await QRModel.update(
          { isActive: false },
          {
            where: {
              type,
              createdBy,
              isActive: true
            }
          }
        );
      }

      let code;
      let attempts = 0;
      const maxAttempts = 5;
      
      do {
        code = this.generateUniqueCode(type);
        attempts++;
        
        const existing = await QRModel.findOne({ where: { code } });
        if (!existing) break;
        
        if (attempts >= maxAttempts) {
          throw new Error('No se pudo generar un código único después de varios intentos');
        }
      } while (attempts < maxAttempts);

      const qrRecord = await QRModel.create({
        code,
        type,
        createdBy,
        description: description || `QR ${type} generado automáticamente`
      });

      const qrImage = await this.generateQRImage(qrRecord.code, {
        width: 300,
        margin: 2
      });

      if (!qrImage.success) {
        throw new Error('Error generando imagen QR');
      }

      return {
        success: true,
        qrRecord: {
          id: qrRecord.id,
          code: qrRecord.code,
          type: qrRecord.type,
          description: qrRecord.description,
          isActive: qrRecord.isActive,
          createdAt: qrRecord.createdAt
        },
        qrImage: qrImage.dataURL
      };
    } catch (error) {
      console.error('❌ Error creando QR code:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Obtener QR activos con sus imágenes
  async getActiveQRCodes(type = null, includeImages = false) {
    try {
      let qrCodes;
      
      if (type) {
        qrCodes = await QRModel.findAll({
          where: { 
            type,
            isActive: true 
          },
          include: [{
            model: require('../models').User,
            as: 'creator',
            attributes: ['id', 'firstName', 'lastName', 'email']
          }],
          order: [['createdAt', 'DESC']]
        });
      } else {
        qrCodes = await QRModel.findAll({
          where: { isActive: true },
          include: [{
            model: require('../models').User,
            as: 'creator',
            attributes: ['id', 'firstName', 'lastName', 'email']
          }],
          order: [['createdAt', 'DESC']]
        });
      }

      const result = [];
      
      for (const qr of qrCodes) {
        const qrData = {
          id: qr.id,
          code: qr.code,
          type: qr.type,
          description: qr.description,
          createdAt: qr.createdAt,
          creator: qr.creator
        };

        if (includeImages) {
          const qrImage = await this.generateQRImage(qr.code, { width: 200 });
          qrData.qrImage = qrImage.success ? qrImage.dataURL : null;
        }

        result.push(qrData);
      }

      return {
        success: true,
        qrCodes: result
      };
    } catch (error) {
      console.error('❌ Error obteniendo QR codes:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async validateQRCode(scannedCode) {
    try {
      const qrRecord = await QRModel.findOne({
        where: {
          code: scannedCode,
          isActive: true
        }
      });
      
      if (!qrRecord) {
        return {
          valid: false,
          error: 'Código QR no encontrado o inactivo'
        };
      }

      return {
        valid: true,
        qrRecord: {
          id: qrRecord.id,
          code: qrRecord.code,
          type: qrRecord.type,
          description: qrRecord.description
        }
      };
    } catch (error) {
      console.error('❌ Error validando QR code:', error);
      return {
        valid: false,
        error: 'Error validando código QR'
      };
    }
  }

  async deactivateQRCode(qrId, userId) {
    try {
      const qrRecord = await QRModel.findByPk(qrId);
      
      if (!qrRecord) {
        return {
          success: false,
          error: 'Código QR no encontrado'
        };
      }

      const { User } = require('../models');
      const user = await User.findByPk(userId);
      if (user.role !== 'admin' && qrRecord.createdBy !== userId) {
        return {
          success: false,
          error: 'No tienes permiso para desactivar este código QR'
        };
      }

      qrRecord.isActive = false;
      await qrRecord.save();

      return {
        success: true,
        message: 'Código QR desactivado exitosamente'
      };
    } catch (error) {
      console.error('❌ Error desactivando QR code:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async generateQRPair(createdBy, companyName = 'Empresa') {
    try {
      const entryDescription = `QR de ENTRADA - ${companyName}`;
      const exitDescription = `QR de SALIDA - ${companyName}`;

      await QRModel.update(
        { isActive: false },
        {
          where: {
            createdBy,
            isActive: true
          }
        }
      );

      const entryQR = await this.createQRCode('entry', createdBy, entryDescription, false);
      if (!entryQR.success) {
        throw new Error('Error creando QR de entrada');
      }

      const exitQR = await this.createQRCode('exit', createdBy, exitDescription, false);
      if (!exitQR.success) {
        throw new Error('Error creando QR de salida');
      }

      return {
        success: true,
        qrPair: {
          entry: entryQR,
          exit: exitQR
        },
        message: 'Par de códigos QR generados exitosamente'
      };
    } catch (error) {
      console.error('❌ Error generando par de QR:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async generateCustomQR(data, options = {}) {
    try {
      const qrData = typeof data === 'object' ? JSON.stringify(data) : data;
      
      const qrImage = await this.generateQRImage(qrData, {
        width: options.width || 256,
        margin: options.margin || 1,
        color: {
          dark: options.darkColor || '#000000',
          light: options.lightColor || '#FFFFFF'
        }
      });

      return qrImage;
    } catch (error) {
      console.error('❌ Error generando QR personalizado:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new QRService();