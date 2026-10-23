const express = require('express');
const { protect } = require('../middleware/auth');
const db = require('../config/database');

const router = express.Router();

router.use(protect);

// GET /api/tasks - List tenant tasks
router.get('/', async (req, res) => {
  try {
    const tasks = await db.query(
      `SELECT t.*, 
        (u.first_name || ' ' || u.last_name) as assigned_to_name,
        (c.first_name || ' ' || c.last_name) as customer_name,
        (l.first_name || ' ' || l.last_name) as lead_name,
        d.title as deal_title
       FROM tasks t
       LEFT JOIN users u ON t.assigned_to = u.id
       LEFT JOIN customers c ON t.customer_id = c.id
       LEFT JOIN leads l ON t.lead_id = l.id
       LEFT JOIN deals d ON t.deal_id = d.id
       WHERE t.tenant_id = ?
       ORDER BY CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END, t.due_date ASC`,
      [req.user.tenant_id]
    );
    res.json({ success: true, data: { tasks } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error while fetching tasks' });
  }
});

// GET /api/tasks/:id - Get single task
router.get('/:id', async (req, res) => {
  try {
    const tasks = await db.query(
      `SELECT t.*, 
        (u.first_name || ' ' || u.last_name) as assigned_to_name,
        (c.first_name || ' ' || c.last_name) as customer_name,
        (l.first_name || ' ' || l.last_name) as lead_name,
        d.title as deal_title
       FROM tasks t
       LEFT JOIN users u ON t.assigned_to = u.id
       LEFT JOIN customers c ON t.customer_id = c.id
       LEFT JOIN leads l ON t.lead_id = l.id
       LEFT JOIN deals d ON t.deal_id = d.id
       WHERE t.id = ? AND t.tenant_id = ?`,
      [req.params.id, req.user.tenant_id]
    );

    if (tasks.length === 0) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    res.json({ success: true, data: { task: tasks[0] } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error while fetching task' });
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

// PATCH /api/tasks/:id - Update task
router.patch('/:id', async (req, res) => {
  try {
    const taskId = req.params.id;
    const existing = await db.query(
      'SELECT * FROM tasks WHERE id = ? AND tenant_id = ?',
      [taskId, req.user.tenant_id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    const task = existing[0];
    const {
      title = task.title,
      description = task.description,
      status = task.status,
      priority = task.priority,
      taskType = task.task_type,
      dueDate = task.due_date,
      assignedTo = task.assigned_to
    } = req.body;

    const completedDate = status === 'completed' && task.status !== 'completed'
      ? new Date().toISOString()
      : (status !== 'completed' ? null : task.completed_date);

    await db.query(
      `UPDATE tasks SET
        title = ?,
        description = ?,
        status = ?,
        priority = ?,
        task_type = ?,
        due_date = ?,
        assigned_to = ?,
        completed_date = ?,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND tenant_id = ?`,
      [
        title,
        description,
        status,
        priority,
        taskType,
        dueDate,
        assignedTo,
        completedDate,
        taskId,
        req.user.tenant_id
      ]
    );

    res.json({ success: true, message: 'Task updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error while updating task' });
  }
});

// DELETE /api/tasks/:id - Delete task
router.delete('/:id', async (req, res) => {
  try {
    const result = await db.query(
      'DELETE FROM tasks WHERE id = ? AND tenant_id = ?',
      [req.params.id, req.user.tenant_id]
    );

    res.json({ success: true, message: 'Task deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error while deleting task' });
  }
});

module.exports = router;
