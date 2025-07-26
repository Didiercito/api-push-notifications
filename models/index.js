const User = require('./user');
const Attendance = require('./attendance');
const QRCode = require('./qrcode');

User.hasMany(Attendance, {
  foreignKey: 'userId',
  as: 'attendances'
});

Attendance.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user'
});

User.hasMany(QRCode, {
  foreignKey: 'createdBy',
  as: 'qrCodes'
});

QRCode.belongsTo(User, {
  foreignKey: 'createdBy',
  as: 'creator'
});

module.exports = {
  User,
  Attendance,
  QRCode
};