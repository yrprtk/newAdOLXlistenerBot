const TelegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');
const childProcess = require('child_process');
const Listen = require('./models/Listen');
const { isDuplicateLink, isValidLink, validateFilter } = require('./utils/utils');
const logger = require('./utils/logger');
require('dotenv').config();

(async () => {
  try {
    await mongoose.connect(process.env.DB_URL, {
      useUnifiedTopology: true,
      useNewUrlParser: true,
    });

    const commands = [
      { command: '/add', description: 'Add listen link' },
      { command: '/cancel', description: 'Cancel selected action' },
      { command: '/delete', description: 'Delete listen link' },
      { command: '/list', description: 'View listening links' },
      { command: '/start', description: 'Start or restart work' },
      { command: '/help', description: 'Open help' },
    ];

    const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

    bot.setMyCommands(commands);

    bot.on('message', async (msg) => {
      const messageId = msg.message_id;
      const chatId = msg.chat.id;
      const message = msg.text;
      const linkWithWaitState = await Listen.findOne({ chatId, state: { $ne: null } });
      if (linkWithWaitState) {
        if (message === '/cancel') {
          return Listen.deleteOne({ _id: linkWithWaitState._id });
        }
        if (message === '/start') {
          await Listen.deleteMany({ chatId });
          return bot.sendMessage(chatId, `Welcome! This bot help you track new OLX ads. To view commands press /help.`);
        }

        if (linkWithWaitState.state === 'waitLinkToListen') {
          if ((await isValidLink(message)) && !(await isDuplicateLink(chatId, message))) {
            await Listen.updateOne(linkWithWaitState, { link: message, state: 'waitFilter' });
            return bot.sendMessage(chatId, `Enter filter (/cancel or /skip): `);
          }
          return bot.deleteMessage(chatId, messageId);
        }
        if (linkWithWaitState.state === 'waitFilter') {
          if (message === '/skip') {
            await Listen.updateOne(linkWithWaitState, { state: null });
            return bot.sendMessage(chatId, `Listening link has been added (/list).`);
          }
          const filter = validateFilter(message);
          if (filter) {
            await Listen.updateOne(linkWithWaitState, { filter, state: null });
            return bot.sendMessage(chatId, `Listening link has been added (/list).`);
          }
          return bot.deleteMessage(chatId, messageId);
        }
        if (linkWithWaitState.state === 'waitLinkToDelete') {
          const { deletedCount } = await Listen.deleteOne({ chatId, link: message });
          if (deletedCount) {
            await Listen.deleteOne(linkWithWaitState);
            return bot.sendMessage(chatId, `Listening link has been deleted (/list).`);
          }
          return bot.deleteMessage(chatId, messageId);
        }
      }
      if (message === '/add') {
        await Listen.create({ chatId, state: 'waitLinkToListen' });
        return bot.sendMessage(chatId, `Enter olx link you want to listen (/cancel): `);
      }
      if (message === '/delete') {
        await Listen.create({ chatId, state: 'waitLinkToDelete' });
        return bot.sendMessage(chatId, `Enter olx link you don't want to listen (/cancel): `);
      }
      if (message === '/list') {
        let str = "You haven't listened links (/add).";
        const list = await Listen.find({ chatId });
        if (list.length) {
          str = '';
          for (let i = 0; i < list.length; i++) {
            str += `${list[i].link}\n`;
          }
        }
        return bot.sendMessage(chatId, str);
      }
      if (message === '/start') {
        await Listen.deleteMany({ chatId });
        return bot.sendMessage(chatId, `Welcome! This bot help you track new OLX ads. To view commands press /help.`);
      }
      if (message === '/help') {
        let str = 'Use the following commands to controll me: \n';
        for (let i = 0; i < commands.length; i++) {
          str += `\n ${commands[i].command} - ${commands[i].description}`;
        }
        return bot.sendMessage(chatId, str);
      }
      return bot.deleteMessage(chatId, messageId);
    });

    function listenStart() {
      const child = childProcess.fork('listen.js');

      child.on('message', (message) => {
        const { chatId, msg } = JSON.parse(message);
        bot.sendMessage(chatId, msg).catch((error) => {
          const { statusCode } = error.response;
          if (statusCode === 400 || statusCode === 403) {
            return Listen.deleteMany({ chatId });
          }
          throw new Error(error);
        });
      });

      child.on('close', () => {
        listenStart();
      });
    }
    listenStart();
    logger.info(`bot started`);
  } catch (error) {
    logger.error(`in index: ${error.message}`);
  }
})();

// при копировании из росширения удалить " вокруг масива блек листа и удалить екранирование
// не рабатівает росширение если в начале нету линк и не всегда откріваеться
