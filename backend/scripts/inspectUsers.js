const db = require('../src/config/database');

async function inspect() {
  const users = await db.query(
    'SELECT u.id, u.tenant_id, u.first_name, u.last_name, u.email, u.role, t.name as tenant_name, t.industry FROM users u JOIN tenants t ON u.tenant_id = t.id ORDER BY u.tenant_id, u.id'
  );
  console.log('Users in system:');
  users.forEach((u) => {
    console.log(`Tenant ${u.tenant_id} [${u.tenant_name} (${u.industry})]: User #${u.id} - ${u.first_name} ${u.last_name} (${u.role}) - ${u.email}`);
  });

  const deals = await db.query(
    'SELECT d.id, d.tenant_id, d.title, d.value, d.status, d.created_by FROM deals d'
  );
  console.log('\nDeals in system:');
  deals.forEach((d) => {
    console.log(`Tenant ${d.tenant_id}: Deal #${d.id} "${d.title}" - KES ${d.value} (${d.status}) created_by User #${d.created_by}`);
  });

  process.exit(0);
}

inspect();
