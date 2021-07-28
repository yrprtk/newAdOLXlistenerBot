const mongoose = require('mongoose');

const listenSchema = new mongoose.Schema({
  chatId: {
    type: String,
    required: [true, 'Please fill chatId'],
    lowercase: true,
    trim: true,
  },
  link: {
    type: String,
    lowercase: true,
    trim: true,
  },
  created: {
    type: Date,
    default: Date.now,
  },
  updated: {
    type: Date,
    default: Date.now,
  },
  state: {
    type: String,
  },
  filter: {
    blackList: [String],
    excludeWord: String,
  },
});

const Listen = mongoose.model('Listen', listenSchema);
module.exports = Listen;
