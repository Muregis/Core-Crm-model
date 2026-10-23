const db = require('../config/database');
const logger = require('../utils/logger');

// @desc    Get all products for current tenant
// @route   GET /api/products
// @access  Private
const getProducts = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { category, search, status = 'active' } = req.query;

    let where = 'WHERE tenant_id = ?';
    const params = [tenantId];

    if (status && status !== 'all') {
      where += ' AND status = ?';
      params.push(status);
    }
    if (category) {
      where += ' AND category = ?';
      params.push(category);
    }
    if (search) {
      where += ' AND (name LIKE ? OR sku LIKE ?)';
      const like = `%${search}%`;
      params.push(like, like);
    }

    const products = await db.query(
      `SELECT * FROM products ${where} ORDER BY name ASC`,
      params
    );

    res.json({
      success: true,
      data: { products }
    });
  } catch (error) {
    logger.error('Get products error:', error);
    res.status(500).json({ success: false, message: 'Server error while fetching products' });
  }
};

// @desc    Create product in catalog
// @route   POST /api/products
// @access  Private
const createProduct = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const {
      name,
      sku,
      category = 'General',
      unit = 'unit',
      unitPriceKes,
      costPriceKes = 0,
      taxRate = 16.0,
      stockQuantity = 0
    } = req.body;

    if (!name || !sku || unitPriceKes === undefined) {
      return res.status(400).json({ success: false, message: 'Name, SKU, and Unit Price are required' });
    }

    const result = await db.query(
      `INSERT INTO products (
        tenant_id, name, sku, category, unit, unit_price_kes,
        cost_price_kes, tax_rate, stock_quantity, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [
        tenantId,
        String(name).trim(),
        String(sku).trim().toUpperCase(),
        category,
        unit,
        parseFloat(unitPriceKes),
        parseFloat(costPriceKes || 0),
        parseFloat(taxRate !== undefined ? taxRate : 16.0),
        parseInt(stockQuantity || 0, 10)
      ]
    );

    const created = await db.query('SELECT * FROM products WHERE id = ?', [result.insertId]);

    res.status(201).json({
      success: true,
      message: 'Product added to catalog',
      data: { product: created[0] }
    });
  } catch (error) {
    if (/UNIQUE|constraint failed/i.test(error.message)) {
      return res.status(409).json({ success: false, message: 'A product with this SKU already exists' });
    }
    logger.error('Create product error:', error);
    res.status(500).json({ success: false, message: 'Server error while creating product' });
  }
};

// @desc    Update product
// @route   PUT /api/products/:id
// @access  Private
const updateProduct = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const id = req.params.id;
    const {
      name,
      sku,
      category,
      unit,
      unitPriceKes,
      costPriceKes,
      taxRate,
      stockQuantity,
      status
    } = req.body;

    const existing = await db.query('SELECT * FROM products WHERE id = ? AND tenant_id = ?', [id, tenantId]);
    if (!existing.length) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    await db.query(
      `UPDATE products SET
         name = COALESCE(?, name),
         sku = COALESCE(?, sku),
         category = COALESCE(?, category),
         unit = COALESCE(?, unit),
         unit_price_kes = COALESCE(?, unit_price_kes),
         cost_price_kes = COALESCE(?, cost_price_kes),
         tax_rate = COALESCE(?, tax_rate),
         stock_quantity = COALESCE(?, stock_quantity),
         status = COALESCE(?, status),
         updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND tenant_id = ?`,
      [
        name ? String(name).trim() : null,
        sku ? String(sku).trim().toUpperCase() : null,
        category || null,
        unit || null,
        unitPriceKes !== undefined ? parseFloat(unitPriceKes) : null,
        costPriceKes !== undefined ? parseFloat(costPriceKes) : null,
        taxRate !== undefined ? parseFloat(taxRate) : null,
        stockQuantity !== undefined ? parseInt(stockQuantity, 10) : null,
        status || null,
        id,
        tenantId
      ]
    );

    const updated = await db.query('SELECT * FROM products WHERE id = ?', [id]);

    res.json({ success: true, message: 'Product updated', data: { product: updated[0] } });
  } catch (error) {
    logger.error('Update product error:', error);
    res.status(500).json({ success: false, message: 'Server error while updating product' });
  }
};

// @desc    Delete product
// @route   DELETE /api/products/:id
// @access  Private
const deleteProduct = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const id = req.params.id;

    await db.query('DELETE FROM products WHERE id = ? AND tenant_id = ?', [id, tenantId]);
    res.json({ success: true, message: 'Product deleted' });
  } catch (error) {
    logger.error('Delete product error:', error);
    res.status(500).json({ success: false, message: 'Server error while deleting product' });
  }
};

module.exports = {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct
};
