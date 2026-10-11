const express = require('express');
const { protect } = require('../middleware/auth');
const db = require('../config/database');

const router = express.Router();

router.use(protect);

// GET /api/tasks - List tenant tasks
router.get('/', async (req, res) => {
  try {
    const tasks = await db.query(
      `SELECT t.*, (u.first_name || ' ' || u.last_name) as assigned_to_name
       FROM tasks t
       LEFT JOIN users u ON t.assigned_to = u.id
       WHERE t.tenant_id = ?
       ORDER BY t.due_date ASC`,
      [req.user.tenant_id]
    );
    res.json({ success: true, data: { tasks } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error while fetching tasks' });
  }
});

// POST /api/tasks - Create new task
router.post('/', async (req, res) => {
  try {
    const { title, description, taskType, priority, dueDate, customerId, leadId, dealId, assignedTo } = req.body;
    if (!title) {
      return res.status(400).json({ success: false, message: 'Task title is required' });
    }

    const result = await db.query(
      `INSERT INTO tasks (tenant_id, title, description, task_type, priority, due_date, customer_id, lead_id, deal_id, assigned_to, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.tenant_id,
        title,
        description || null,
        taskType || 'call',
        priority || 'medium',
        dueDate || null,
        customerId || null,
        leadId || null,
        dealId || null,
        assignedTo || req.user.id,
        req.user.id
      ]
    );

    res.status(201).json({ success: true, message: 'Task created successfully', taskId: result.insertId });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error while creating task' });
  }
});

module.exports = router;
