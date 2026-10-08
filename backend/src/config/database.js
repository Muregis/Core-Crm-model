const mysql = require('mysql2/promise');
const logger = require('../utils/logger');

// Auto-fallback to sqlite for local dev without mysql
const useSqlite = !process.env.DB_HOST || process.env.DB_HOST === 'localhost';

if (useSqlite) {
  logger.info('Using SQLite database for local development fallback');
  module.exports = require('./database-sqlite');
} else {
  class Database {
    constructor() {
      this.pool = mysql.createPool({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'kenya_crm',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
      });

      this.testConnection();
    }

    async testConnection() {
      try {
        const connection = await this.pool.getConnection();
        logger.info('Database connected successfully');
        connection.release();
      } catch (error) {
        logger.error('Database connection failed:', error);
        // Do not exit process, let it keep retrying or fail gracefully
      }
    }

    async query(sql, params = []) {
      const [rows] = await this.pool.execute(sql, params);
      return rows;
    }

    async transaction(callback) {
      const connection = await this.pool.getConnection();
      try {
        await connection.beginTransaction();
        const result = await callback(connection);
        await connection.commit();
        return result;
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    }

    async close() {
      await this.pool.end();
    }
  }

  module.exports = new Database();
}
