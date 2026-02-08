import mongoose from 'mongoose';

const clientSchema = new mongoose.Schema({
  name: { type: String, required: true },
  company: { type: String, default: '' },
  address: { type: String, default: '' },
  city: { type: String, default: '' },
  country: { type: String, default: '' },
  phone: { type: String, default: '' },
  email: { type: String, default: '' },
  vatId: { type: String, default: '' },
  notes: { type: String, default: '' }
}, {
  timestamps: true
});

// Index for faster searches
clientSchema.index({ name: 1, company: 1 });

const Client = mongoose.models.Client || mongoose.model('Client', clientSchema);

export default Client;
