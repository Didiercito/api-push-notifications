const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const WorkSchedule = sequelize.define('WorkSchedule', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  dayOfWeek: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 0,
      max: 6
    },
    comment: '0=Domingo, 1=Lunes, 2=Martes, 3=Miércoles, 4=Jueves, 5=Viernes, 6=Sábado'
  },
  startTime: {
    type: DataTypes.TIME,
    allowNull: false
  },
  endTime: {
    type: DataTypes.TIME,
    allowNull: false
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  graceMinutes: {
    type: DataTypes.INTEGER,
    defaultValue: 15,
    comment: 'Minutos de tolerancia para llegadas tarde'
  }
}, {
  tableName: 'work_schedules',
  timestamps: true
});

WorkSchedule.associate = function(models) {
  WorkSchedule.belongsTo(models.User, {
    foreignKey: 'userId',
    as: 'user'
  });
};

WorkSchedule.getCurrentSchedule = async function(userId = null) {
  const today = new Date().getDay(); 
  
  if (userId) {
    const userSchedule = await this.findOne({
      where: {
        userId: userId,
        dayOfWeek: today,
        isActive: true
      }
    });
    if (userSchedule) return userSchedule;
  }
  
  return await this.findOne({
    where: {
      userId: null, 
      dayOfWeek: today,
      isActive: true
    }
  });
};

WorkSchedule.isWithinWorkHours = async function(userId = null, time = new Date()) {
  const schedule = await this.getCurrentSchedule(userId);
  if (!schedule) return { valid: true, message: 'Sin horario configurado' };

  const currentTime = time.toTimeString().substring(0, 8); 
  const startTime = schedule.startTime;
  const endTime = schedule.endTime;

  const timeToMinutes = (timeStr) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const currentMinutes = timeToMinutes(currentTime);
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);

  return {
    valid: currentMinutes >= startMinutes && currentMinutes <= endMinutes,
    schedule: schedule,
    currentTime: currentTime,
    isLate: currentMinutes > (startMinutes + schedule.graceMinutes),
    minutesLate: Math.max(0, currentMinutes - (startMinutes + schedule.graceMinutes))
  };
};

module.exports = WorkSchedule;