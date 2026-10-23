jest.mock('../src/config/database', () => ({ query: jest.fn() }));
const migrate = require('../scripts/migrate');
const splitStatements = migrate.splitStatements;

describe('migrate.splitStatements', () => {
  test('does not discard CREATE TABLE after leading comments', () => {
    const sql = `-- header
-- more

CREATE TABLE IF NOT EXISTS tenants (
  id INT PRIMARY KEY
);

INSERT IGNORE INTO tenants (id, name) VALUES (1, 'Default');
`;
    const stmts = splitStatements(sql);
    expect(stmts.length).toBeGreaterThanOrEqual(2);
    expect(stmts[0]).toMatch(/CREATE TABLE IF NOT EXISTS tenants/i);
    expect(stmts[1]).toMatch(/INSERT IGNORE INTO tenants/i);
  });

  test('preserves semicolons inside strings', () => {
    const sql = `UPDATE jobs SET error_message = 'failed; retry';`;
    const stmts = splitStatements(sql);
    expect(stmts).toHaveLength(1);
    expect(stmts[0]).toContain('failed; retry');
  });
});
