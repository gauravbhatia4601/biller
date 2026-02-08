import mongoose from 'mongoose';

const invoiceSchema = new mongoose.Schema({
  // Company Information
  company: {
    name: { type: String, required: true },
    tagline: { type: String, default: '' },
    logo: { type: String, default: '' },
    phone: { type: String, default: '' },
    email: { type: String, default: '' },
    address: { type: String, default: '' },
    city: { type: String, default: '' },
    country: { type: String, default: '' },
    vatId: { type: String, default: '' }
  },
  
  // Customer Information
  customer: {
    name: { type: String, required: true },
    company: { type: String, default: '' },
    address: { type: String, default: '' },
    city: { type: String, default: '' },
    country: { type: String, default: '' },
    phone: { type: String, default: '' },
    email: { type: String, default: '' },
    vatId: { type: String, default: '' }
  },
  
  // Invoice Details
  invoice: {
    number: { type: String, required: true, unique: true },
    date: { type: String, required: true },
    dueDate: { type: String, default: '' },
    currency: { type: String, default: 'USD' },
    paymentTerms: { type: String, default: '' },
    purchaseOrder: { type: String, default: '' }
  },
  
  // Line Items
  items: [{
    name: { type: String, required: true },
    description: { type: String, default: '' },
    quantity: { type: Number, required: true, min: 0 },
    unit_cost: { type: Number, required: true, min: 0 }
  }],
  
  // Fields Configuration
  fields: {
    tax: { type: String, default: '%', enum: ['%', 'true', 'false'] },
    discounts: { type: Boolean, default: false },
    shipping: { type: Boolean, default: false }
  },
  
  // Financial Details
  financial: {
    tax: { type: Number, default: 0, min: 0 },
    shipping: { type: Number, default: 0, min: 0 },
    discounts: { type: Number, default: 0, min: 0 },
    amountPaid: { type: Number, default: 0, min: 0 }
  },
  
  // Custom Fields
  customFields: [{
    name: { type: String, required: true },
    value: { type: String, required: true }
  }],
  
  // Account Details
  accountDetails: {
    bankName: { type: String, default: '' },
    accountHolderName: { type: String, default: '' },
    accountNumber: { type: String, default: '' },
    iban: { type: String, default: '' },
    swiftBic: { type: String, default: '' },
    branchName: { type: String, default: '' },
    branchAddress: { type: String, default: '' }
  },
  
  // Additional Information
  notes: { type: String, default: '' },
  terms: { type: String, default: '' },
  
  // Metadata
  isTemplate: { type: Boolean, default: false },
  templateName: { type: String, default: '' },
  pdfPath: { type: String, default: '' },
  generatedAt: { type: Date, default: Date.now },
  status: { type: String, enum: ['unpaid', 'partial', 'paid'], default: 'unpaid' },
  amountPaid: { type: Number, default: 0, min: 0 }
}, {
  timestamps: true
});

// Calculate subtotal
invoiceSchema.virtual('subtotal').get(function() {
  return this.items.reduce((sum, item) => {
    return sum + (item.quantity * item.unit_cost);
  }, 0);
});

// Calculate total
invoiceSchema.virtual('total').get(function() {
  let total = this.subtotal;
  
  // Apply discount
  if (this.fields.discounts && this.financial.discounts) {
    total -= this.financial.discounts;
  }
  
  // Apply tax
  if (this.fields.tax === '%' && this.financial.tax > 0) {
    total += (total * this.financial.tax / 100);
  } else if (this.financial.tax > 0) {
    total += this.financial.tax;
  }
  
  // Apply shipping
  if (this.fields.shipping && this.financial.shipping) {
    total += this.financial.shipping;
  }
  
  return total;
});

invoiceSchema.set('toJSON', { virtuals: true });

const Invoice = mongoose.models.Invoice || mongoose.model('Invoice', invoiceSchema);

export default Invoice;
