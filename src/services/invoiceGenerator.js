import axios from 'axios';
import fs from 'fs';
import path from 'path';

/**
 * Clean duplicate path segments
 * Removes duplicate full path prefixes like /Users/.../Users/...
 */
function cleanPath(filePath) {
  if (!filePath) return filePath;
  
  // Normalize first
  let cleaned = path.normalize(filePath);
  
  // Check for duplicate path patterns
  const parts = cleaned.split(path.sep).filter(p => p);
  
  // Look for the pattern where we have duplicate segments
  for (let i = 1; i < parts.length; i++) {
    const firstSegment = parts[0];
    if (parts[i] === firstSegment && i > 0) {
      let matchCount = 0;
      for (let j = 0; j < i && (i + j) < parts.length; j++) {
        if (parts[j] === parts[i + j]) {
          matchCount++;
        } else {
          break;
        }
      }
      
      if (matchCount >= 2) {
        cleaned = path.sep + parts.slice(i).join(path.sep);
        break;
      }
    }
  }
  
  return cleaned;
}

/**
 * Invoice Generator Class
 * Uses invoice-generator.com API to generate professional invoices
 */
class InvoiceGenerator {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseURL = 'https://invoice-generator.com';
    this.headers = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    };
  }

  /**
   * Generate a PDF invoice
   * @param {Object} invoiceData - Invoice data object
   * @param {string} outputPath - Path to save the PDF file
   * @returns {Promise<string>} Path to the generated PDF
   */
  async generatePDF(invoiceData, outputPath = null) {
    try {
      // Log the payload structure (without full base64 data)
      const logPayload = { ...invoiceData };
      if (logPayload.logo) {
        logPayload.logo = logPayload.logo.substring(0, 50) + '... (base64 data)';
      }
      console.log('📤 Sending invoice data to API:', JSON.stringify(logPayload, null, 2));
      
      const response = await axios.post(
        this.baseURL,
        invoiceData,
        {
          headers: this.headers,
          responseType: 'arraybuffer'
        }
      );

      // Handle output path - normalize to prevent duplication
      let fullPath;
      if (outputPath) {
        const cleaned = cleanPath(outputPath);
        const normalized = path.normalize(cleaned);
        
        if (path.isAbsolute(normalized)) {
          fullPath = normalized;
        } else {
          fullPath = path.resolve(process.cwd(), normalized);
        }
      } else {
        const filename = `invoice_${invoiceData.number || Date.now()}.pdf`;
        fullPath = path.resolve(process.cwd(), 'public', 'invoices', filename);
      }
      
      // Final normalization and cleaning
      fullPath = cleanPath(path.normalize(fullPath));
      
      // Ensure directory exists
      const outputDir = path.dirname(fullPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      fs.writeFileSync(fullPath, response.data);
      console.log(`✅ Invoice PDF generated successfully: ${path.basename(fullPath)}`);
      
      return fullPath;
    } catch (error) {
      if (error.response) {
        console.error('❌ API Error:', error.response.status, error.response.statusText);
        console.error('Response:', error.response.data.toString());
      } else {
        console.error('❌ Error generating invoice:', error.message);
      }
      throw error;
    }
  }

  /**
   * Generate an e-invoice in UBL XML format
   * @param {Object} invoiceData - Invoice data object
   * @param {string} outputPath - Path to save the XML file
   * @returns {Promise<string>} Path to the generated XML
   */
  async generateEInvoice(invoiceData, outputPath = null) {
    try {
      const response = await axios.post(
        `${this.baseURL}/ubl`,
        invoiceData,
        {
          headers: this.headers,
          responseType: 'arraybuffer'
        }
      );

      const filename = outputPath || `invoice_${invoiceData.number || Date.now()}.xml`;
      const fullPath = path.resolve(process.cwd(), 'public', 'invoices', filename);
      
      // Ensure directory exists
      const outputDir = path.dirname(fullPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      fs.writeFileSync(fullPath, response.data);
      console.log(`✅ E-Invoice XML generated successfully: ${filename}`);
      
      return fullPath;
    } catch (error) {
      if (error.response) {
        console.error('❌ API Error:', error.response.status, error.response.statusText);
        console.error('Response:', error.response.data.toString());
      } else {
        console.error('❌ Error generating e-invoice:', error.message);
      }
      throw error;
    }
  }

  /**
   * Format company information for the 'from' field
   * @param {Object} companyInfo - Company information object
   * @returns {string} Formatted company string
   */
  formatCompanyInfo(companyInfo) {
    const lines = [];
    
    if (companyInfo.name) {
      lines.push(companyInfo.name);
    }
    
    if (companyInfo.tagline) {
      lines.push(companyInfo.tagline);
    }
    
    if (companyInfo.address) {
      lines.push(companyInfo.address);
    }
    
    if (companyInfo.city || companyInfo.country) {
      const location = [companyInfo.city, companyInfo.country].filter(Boolean).join(', ');
      if (location) lines.push(location);
    }
    
    if (companyInfo.phone) {
      lines.push(`Phone: ${companyInfo.phone}`);
    }
    
    if (companyInfo.email) {
      lines.push(`Email: ${companyInfo.email}`);
    }
    
    if (companyInfo.vatId) {
      lines.push(`VAT ID: ${companyInfo.vatId}`);
    }
    
    return lines.join('\n');
  }

  /**
   * Format customer information for the 'to' field
   * @param {Object} customerInfo - Customer information object
   * @returns {string} Formatted customer string
   */
  formatCustomerInfo(customerInfo) {
    const lines = [];
    
    if (customerInfo.name) {
      lines.push(customerInfo.name);
    }
    
    if (customerInfo.company) {
      lines.push(customerInfo.company);
    }
    
    if (customerInfo.address) {
      lines.push(customerInfo.address);
    }
    
    if (customerInfo.city || customerInfo.country) {
      const location = [customerInfo.city, customerInfo.country].filter(Boolean).join(', ');
      if (location) lines.push(location);
    }
    
    if (customerInfo.phone) {
      lines.push(`Phone: ${customerInfo.phone}`);
    }
    
    if (customerInfo.email) {
      lines.push(`Email: ${customerInfo.email}`);
    }
    
    if (customerInfo.vatId) {
      lines.push(`VAT ID: ${customerInfo.vatId}`);
    }
    
    return lines.join('\n');
  }
}

export default InvoiceGenerator;
