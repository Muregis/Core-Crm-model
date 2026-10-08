const { Queue } = require('bullmq');
const connection = require('./connection');

// Instantiate queues
const emailQueue = new Queue('email', { connection });
const reportQueue = new Queue('report', { connection });
const importQueue = new Queue('import', { connection });

module.exports = {
  emailQueue,
  reportQueue,
  importQueue,
};
