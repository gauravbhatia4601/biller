import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Configuration helper
 * Loads and validates configuration from environment variables
 */
export const config = {
  apiKey: process.env.INVOICE_GENERATOR_API_KEY || '',
  
  company: {
    name: process.env.COMPANY_NAME || 'Technioz',
    tagline: process.env.COMPANY_TAGLINE || 'Innovative Solutions Seamless Integration',
    logo: process.env.COMPANY_LOGO_URL || 'logo.png',
    phone: process.env.COMPANY_PHONE || '+91 9803683577',
    email: process.env.COMPANY_EMAIL || 'info@technioz.com',
    address: process.env.COMPANY_ADDRESS || 'Jalandhar, Punjab',
    city: process.env.COMPANY_CITY || 'Jalandhar',
    country: process.env.COMPANY_COUNTRY || 'India',
    vatId: process.env.COMPANY_VAT_ID || ''
  }
};

/**
 * Validate configuration
 * @returns {boolean} True if configuration is valid
 */
export function validateConfig() {
  return !!config.apiKey;
}
