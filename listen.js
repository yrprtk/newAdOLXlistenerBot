const mongoose = require('mongoose');
const crontab = require('node-crontab');
const Listen = require('./models/Listen');
const config = require('./config');
const { listen } = require('./utils/utils');
const logger = require('./utils/logger');
require('dotenv').config();

(async () => {
  try {
    await mongoose.connect(process.env.DB_URL, {
      useUnifiedTopology: true,
      useNewUrlParser: true,
    });
    crontab.scheduleJob(`*/${config.listenMin} * * * *`, async () => {
      const tasks = await Listen.find();
      for (const task of tasks) {
        const obj = await listen(task);
        if (obj) {
          process.send(JSON.stringify(obj));
        }
      }
    });
    logger.info(`listen started`);
  } catch (error) {
    logger.error(`in listen: ${error.message}`);
  }
})();
