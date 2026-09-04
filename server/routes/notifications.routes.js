const express = require('express');
const Notification = require('../models/Notification');
const { ok } = require('../utils/response');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const genId = require('../utils/id');

const router = express.Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { recipientId, read } = req.query;
    const filter = {};
    if (recipientId) filter.recipientId = recipientId;
    if (read != null) filter.read = read === 'true';
    const rows = await Notification.find(filter).sort({ createdAt: -1 });
    return ok(res, rows);
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    if (!req.body.recipientId) throw new ApiError(400, 'MISSING_RECIPIENT', 'recipientId is required.');
    if (!req.body.message) throw new ApiError(400, 'MISSING_MESSAGE', 'message is required.');
    const notification = await Notification.create({
      id: genId('notif'),
      recipientId: req.body.recipientId,
      role: req.body.role,
      type: req.body.type,
      title: req.body.title,
      message: req.body.message,
      relatedEntity: req.body.relatedEntity,
      read: false,
    });
    return ok(res, notification, 201);
  })
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const notification = await Notification.findOne({ id: req.params.id });
    if (!notification) throw new ApiError(404, 'NOT_FOUND', 'Notification not found.');
    if (req.body.read != null) notification.read = !!req.body.read;
    await notification.save();
    return ok(res, notification);
  })
);

module.exports = router;
