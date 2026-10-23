const request = require('supertest');
const app = require('../server');

describe('Parcels API & Tenant Isolation (Land pack)', () => {
  let tenant1Token;
  let tenant2Token;

  beforeEach(async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    const res1 = await request(app).post('/api/auth/register').send({
      email: `land1-${suffix}@tenant1.com`,
      password: 'password123',
      firstName: 'Land',
      lastName: 'One',
      phone: `+254700${String(Date.now()).slice(-6)}`,
      role: 'admin',
      tenantName: `Land Co One ${suffix}`
    });
    expect(res1.statusCode).toBeLessThan(300);
    tenant1Token = res1.body.data.token;

    const res2 = await request(app).post('/api/auth/register').send({
      email: `land2-${suffix}@tenant2.com`,
      password: 'password123',
      firstName: 'Land',
      lastName: 'Two',
      phone: `+254711${String(Date.now()).slice(-6)}`,
      role: 'admin',
      tenantName: `Land Co Two ${suffix}`
    });
    expect(res2.statusCode).toBeLessThan(300);
    tenant2Token = res2.body.data.token;
  });

  it('creates a parcel for the current tenant', async () => {
    const res = await request(app)
      .post('/api/parcels')
      .set('Authorization', `Bearer ${tenant1Token}`)
      .send({
        titleRef: 'LR-1234/1',
        plotNumber: 'Plot A',
        name: 'Kiambu Road parcel',
        sizeAcres: 0.25,
        county: 'Kiambu',
        ward: 'Ruiru',
        status: 'available',
        listPriceKes: 4500000
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.parcel.title_ref).toBe('LR-1234/1');
    expect(res.body.data.parcel.status).toBe('available');
  });

  it('lists only the current tenant parcels and supports status filter', async () => {
    await request(app)
      .post('/api/parcels')
      .set('Authorization', `Bearer ${tenant1Token}`)
      .send({ titleRef: 'T1-AVAIL', status: 'available', county: 'Nairobi', listPriceKes: 1000000 });

    await request(app)
      .post('/api/parcels')
      .set('Authorization', `Bearer ${tenant1Token}`)
      .send({ titleRef: 'T1-SOLD', status: 'sold', county: 'Nairobi', listPriceKes: 2000000 });

    await request(app)
      .post('/api/parcels')
      .set('Authorization', `Bearer ${tenant2Token}`)
      .send({ titleRef: 'T2-OTHER', status: 'available', county: 'Mombasa' });

    const list = await request(app)
      .get('/api/parcels')
      .set('Authorization', `Bearer ${tenant1Token}`);

    expect(list.statusCode).toBe(200);
    const titles = list.body.data.parcels.map((p) => p.title_ref);
    expect(titles).toEqual(expect.arrayContaining(['T1-AVAIL', 'T1-SOLD']));
    expect(titles).not.toContain('T2-OTHER');

    const filtered = await request(app)
      .get('/api/parcels?status=available')
      .set('Authorization', `Bearer ${tenant1Token}`);

    expect(filtered.statusCode).toBe(200);
    expect(filtered.body.data.parcels.every((p) => p.status === 'available')).toBe(true);
  });

  it('rejects cross-tenant read and update', async () => {
    const created = await request(app)
      .post('/api/parcels')
      .set('Authorization', `Bearer ${tenant1Token}`)
      .send({ titleRef: 'ISO-001', status: 'available' });

    expect(created.statusCode).toBe(201);
    const id = created.body.data.parcel.id;

    const getOther = await request(app)
      .get(`/api/parcels/${id}`)
      .set('Authorization', `Bearer ${tenant2Token}`);
    expect(getOther.statusCode).toBe(404);

    const updateOther = await request(app)
      .put(`/api/parcels/${id}`)
      .set('Authorization', `Bearer ${tenant2Token}`)
      .send({ status: 'sold' });
    expect(updateOther.statusCode).toBe(404);
  });

  it('records status history on status change', async () => {
    const created = await request(app)
      .post('/api/parcels')
      .set('Authorization', `Bearer ${tenant1Token}`)
      .send({ titleRef: 'HIST-001', status: 'available' });

    const id = created.body.data.parcel.id;

    const updated = await request(app)
      .put(`/api/parcels/${id}`)
      .set('Authorization', `Bearer ${tenant1Token}`)
      .send({ status: 'reserved', statusNote: 'Deposit received' });

    expect(updated.statusCode).toBe(200);
    expect(updated.body.data.parcel.status).toBe('reserved');

    const detail = await request(app)
      .get(`/api/parcels/${id}`)
      .set('Authorization', `Bearer ${tenant1Token}`);

    expect(detail.statusCode).toBe(200);
    expect(detail.body.data.statusHistory.length).toBeGreaterThanOrEqual(2);
    expect(detail.body.data.statusHistory[0].to_status).toBe('reserved');
  });

  it('enforces unique title_ref per tenant', async () => {
    const first = await request(app)
      .post('/api/parcels')
      .set('Authorization', `Bearer ${tenant1Token}`)
      .send({ titleRef: 'DUP-REF', status: 'available' });
    expect(first.statusCode).toBe(201);

    const second = await request(app)
      .post('/api/parcels')
      .set('Authorization', `Bearer ${tenant1Token}`)
      .send({ titleRef: 'DUP-REF', status: 'available' });
    expect(second.statusCode).toBe(409);
  });
});
