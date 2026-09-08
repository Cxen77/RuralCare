const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  role: { type: String, enum: ['user', 'assistant', 'system', 'tool'], required: true },
  content: { type: String, default: '' },
  tool_calls: { type: mongoose.Schema.Types.Mixed },
  tool_call_id: { type: String },
  name: { type: String },
  timestamp: { type: Date, default: Date.now }
}, { _id: false });

const ConversationSchema = new mongoose.Schema({
  conversationId: { type: String, required: true, unique: true, index: true },
  patientId: { type: String, index: true },
  title: { type: String },
  messages: [MessageSchema],
  context: {
    specialty: { type: String },
    doctorId: { type: String },
    doctorName: { type: String },
    pharmacyId: { type: String },
    pharmacyName: { type: String },
    prescriptionId: { type: String },
    location: {
      latitude: { type: Number },
      longitude: { type: Number }
    }
  },
  lastActive: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('Conversation', ConversationSchema);
