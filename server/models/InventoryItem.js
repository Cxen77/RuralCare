const mongoose = require('mongoose');

// Field names match the pharmacy portal's catalog rows so backend + local state merge cleanly.
const InventoryItemSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    pharmacyId: { type: String, required: true },
    medicine: { type: String, required: true },
    generic: { type: String },
    form: { type: String, default: 'Tablet' },
    manufacturer: { type: String },
    quantity: { type: Number, default: 0 },
    price: { type: Number, default: 0 },
    batch: { type: String },
    expiry: { type: String },
    isJanAushadhi: { type: Boolean, default: false },
    reorderLevel: { type: Number, default: 10 },
  },
  { timestamps: true }
);

InventoryItemSchema.index({ pharmacyId: 1 });

module.exports = mongoose.model('InventoryItem', InventoryItemSchema);
