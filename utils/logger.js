const { createLogger, format, transports } = require('winston');
const config = require('../config');

module.exports = createLogger({
  transports: new transports.File({
    filename: config.logFileName,
    format: format.combine(
      format.timestamp({ format: 'MMM-DD-YYYY HH:mm:ss' }),
      format.align(),
      format.printf((info) => `${[info.timestamp]}: ${info.level}: ${info.message}`)
    ),
  }),
});
