const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  key: {
    type: String,
    unique: true,
    required: true
  },
  value: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  type: {
    type: String,
    enum: ['string', 'number', 'boolean', 'json', 'array'],
    default: 'string'
  },
  description: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Static method to get a setting
settingsSchema.statics.get = async function(key, defaultValue = null) {
  const setting = await this.findOne({ key });
  return setting ? setting.value : defaultValue;
};

// Static method to set a setting
settingsSchema.statics.set = async function(key, value, type = 'string') {
  return await this.findOneAndUpdate(
    { key },
    { value, type },
    { upsert: true, new: true }
  );
};

module.exports = mongoose.model('Settings', settingsSchema);