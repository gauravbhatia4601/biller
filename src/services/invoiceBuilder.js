import InvoiceGenerator from './invoiceGenerator.js';
import fs from 'fs';
import path from 'path';
import axios from 'axios';

/**
 * Invoice Builder
 * Constructs invoice data in the format required by invoice-generator.com API
 */
class InvoiceBuilder {
  constructor(invoiceGenerator) {
    this.generator = invoiceGenerator;
  }

  /**
   * Get logo URL - converts local file or remote URL to base64 data URL
   * The invoice-generator.com API requires base64 encoded images, not URLs
   * @param {string} logoPath - Local file path or URL
   * @returns {Promise<string|null>} Base64 data URL
   */
  /**
   * Main function to get logo as data URL
   */
  async getLogoUrl(logoPath) {
    if (!logoPath) return null;
    
    if (logoPath.startsWith('http://') || logoPath.startsWith('https://')) {
      return await this.fetchLogoFromUrl(logoPath);
    }
    
    return await this.readLogoFromFile(logoPath);
  }

  /**
   * Fetch logo from URL and convert to data URL
   */
  async fetchLogoFromUrl(url) {
    console.log(`📷 Fetching logo file content from URL: ${url}`);
    try {
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 15000,
        maxRedirects: 10,
        validateStatus: (status) => status >= 200 && status < 300,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'image/png,image/jpeg,image/gif,image/webp,image/svg+xml,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });
      
      const imageBuffer = Buffer.from(response.data);
      const contentType = response.headers['content-type'] || '';
      
      console.log(`📷 Fetched file content - Size: ${(imageBuffer.length / 1024).toFixed(2)} KB, Content-Type: ${contentType}`);
      
      // Check if response is HTML instead of image
      if (this.isHtmlResponse(imageBuffer)) {
        const imageUrl = this.extractImageUrlFromHtml(imageBuffer.toString('utf-8'), url);
        if (imageUrl && imageUrl !== url) {
          console.log(`📷 Fetching actual image file from: ${imageUrl}`);
          return await this.getLogoUrl(imageUrl);
        }
        console.error(`❌ Could not find valid image URL in HTML response.`);
        return null;
      }
      
      // Validate image format
      if (!this.isValidImage(imageBuffer, contentType)) {
        console.error(`❌ URL does not appear to be a valid image. Content-Type: ${contentType}`);
        return null;
      }
      
      const mimeType = this.detectMimeType(imageBuffer, contentType, url);
      return this.convertToDataUrl(imageBuffer, mimeType);
    } catch (error) {
      this.logFetchError(error, url);
      return null;
    }
  }

  /**
   * Check if response is HTML instead of image
   */
  isHtmlResponse(buffer) {
    const content = buffer.toString('utf-8');
    return content.trim().startsWith('<!DOCTYPE') || 
           content.trim().startsWith('<html') || 
           content.trim().startsWith('<?xml');
  }

  /**
   * Extract image URL from HTML content
   */
  extractImageUrlFromHtml(htmlContent, baseUrl) {
    console.warn(`⚠️  URL returned HTML instead of image. Attempting to extract image URL from HTML...`);
    
    const imgPatterns = [
      /<img[^>]+src=['"]([^'"]+\.(png|jpg|jpeg|gif|webp|svg)(?:\?[^'"]*)?)['"]/i,
      /src=['"]([^'"]+\.(png|jpg|jpeg|gif|webp|svg)(?:\?[^'"]*)?)['"]/i,
      /url\(['"]?([^'")]+\.(png|jpg|jpeg|gif|webp|svg)(?:\?[^'")]*)?)['"]?\)/i,
      /href=['"]([^'"]+\.(png|jpg|jpeg|gif|webp|svg)(?:\?[^'"]*)?)['"]/i,
      /['"]([\/][^'"]+\.(png|jpg|jpeg|gif|webp|svg)(?:\?[^'"]*)?)['"]/i,
    ];
    
    for (const pattern of imgPatterns) {
      const match = htmlContent.match(pattern);
      if (match && match[1]) {
        const imageUrl = this.normalizeImageUrl(match[1], baseUrl);
        console.log(`📷 Found image URL in HTML: ${imageUrl}`);
        return imageUrl;
      }
    }
    
    return null;
  }

  /**
   * Normalize relative image URL to absolute URL
   */
  normalizeImageUrl(imageUrl, baseUrl) {
    if (imageUrl.startsWith('/')) {
      const urlObj = new URL(baseUrl);
      return `${urlObj.origin}${imageUrl}`;
    }
    if (!imageUrl.startsWith('http')) {
      const urlObj = new URL(baseUrl);
      return `${urlObj.origin}/${imageUrl}`;
    }
    return imageUrl;
  }

  /**
   * Validate if buffer contains a valid image
   */
  isValidImage(buffer, contentType) {
    const imageFormat = this.detectImageFormat(buffer);
    const isValid = imageFormat !== null;
    
    if (isValid) {
      console.log(`✅ Validated image format: ${imageFormat}`);
    }
    
    return isValid || contentType.startsWith('image/');
  }

  /**
   * Detect image format from magic bytes
   */
  detectImageFormat(buffer) {
    if (buffer.length >= 4 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
      return 'PNG';
    }
    if (buffer.length >= 3 && buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
      return 'JPEG';
    }
    if (buffer.length >= 3 && buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
      return 'GIF';
    }
    if (buffer.length >= 4 && buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) {
      return 'WebP';
    }
    if (buffer.length > 0 && buffer.toString('utf-8', 0, Math.min(100, buffer.length)).trim().startsWith('<svg')) {
      return 'SVG';
    }
    return null;
  }

  /**
   * Detect MIME type from buffer, content type, or file extension
   */
  detectMimeType(buffer, contentType, url) {
    if (contentType && contentType.startsWith('image/')) {
      return contentType;
    }
    
    const format = this.detectImageFormat(buffer);
    if (format) {
      const mimeMap = {
        'PNG': 'image/png',
        'JPEG': 'image/jpeg',
        'GIF': 'image/gif',
        'WebP': 'image/webp',
        'SVG': 'image/svg+xml'
      };
      if (mimeMap[format]) {
        return mimeMap[format];
      }
    }
    
    // Fallback to extension-based detection
    return this.getMimeTypeFromExtension(url);
  }

  /**
   * Get MIME type from file extension
   */
  getMimeTypeFromExtension(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeMap = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.webp': 'image/webp'
    };
    return mimeMap[ext] || 'image/png';
  }

  /**
   * Convert image buffer to data URL
   */
  convertToDataUrl(buffer, mimeType) {
    const imageBase64 = buffer.toString('base64');
    const dataUrl = `data:${mimeType};base64,${imageBase64}`;
    console.log(`✅ Successfully processed image (${(buffer.length / 1024).toFixed(2)} KB, ${mimeType})`);
    console.log(`📦 Returning data URL format (${dataUrl.length} chars)`);
    return dataUrl;
  }

  /**
   * Log fetch error details
   */
  logFetchError(error, url) {
    console.error(`❌ Error fetching logo from URL: ${error.message}`);
    if (error.response) {
      console.error(`   Status: ${error.response.status} ${error.response.statusText}`);
      console.error(`   Content-Type: ${error.response.headers['content-type']}`);
      console.error(`   URL: ${error.config?.url || url}`);
    } else if (error.request) {
      console.error(`   No response received. URL might be unreachable.`);
    }
  }

  /**
   * Read logo from local file and convert to data URL
   */
  async readLogoFromFile(logoPath) {
    try {
      const logoPathResolved = path.isAbsolute(logoPath) 
        ? logoPath 
        : path.join(process.cwd(), 'public', logoPath);
      
      if (!fs.existsSync(logoPathResolved)) {
        console.warn(`⚠️  Logo file not found: ${logoPathResolved}`);
        return null;
      }
      
      const imageBuffer = fs.readFileSync(logoPathResolved);
      const mimeType = this.getMimeTypeFromExtension(logoPathResolved);
      return this.convertToDataUrl(imageBuffer, mimeType);
    } catch (error) {
      console.warn(`⚠️  Error reading logo file: ${error.message}`);
      return null;
    }
  }

  /**
   * Build invoice data from structured input
   * @param {Object} data - Structured invoice data
   * @returns {Promise<Object>} API-ready invoice data
   */
  async buildInvoiceData(data) {
    // Fetch and convert logo to base64 if provided
    const logoBase64 = await this.getLogoUrl(data.company?.logo);
    
    const invoiceData = {
      // Company information (From)
      from: this.generator.formatCompanyInfo(data.company),
      
      // Customer information (Bill To)
      to: this.generator.formatCustomerInfo(data.customer),
      
      // Logo - invoice-generator.com API expects data URL format: data:image/png;base64,{base64}
      // Only include if we have valid logo data
      ...(logoBase64 && { logo: logoBase64 }),
      
      // Invoice details
      number: data.invoice.number,
      date: data.invoice.date,
      currency: data.invoice.currency || 'USD',
      
      // Payment terms
      payment_terms: data.invoice.paymentTerms || null,
      due_date: data.invoice.dueDate || null,
      
      // Line items
      items: data.items.map(item => ({
        name: item.name,
        description: item.description || null,
        quantity: item.quantity,
        unit_cost: item.unit_cost
      })),
      
      // Subtotal fields configuration
      fields: {
        tax: data.fields?.tax || '%',
        discounts: data.fields?.discounts !== false,
        shipping: data.fields?.shipping !== false
      },
      
      // Financial amounts
      tax: data.financial?.tax || 0,
      shipping: data.financial?.shipping || 0,
      discounts: data.financial?.discounts || 0,
      amount_paid: data.financial?.amountPaid || 0,
      
      // Additional information
      notes: data.notes || null,
      terms: data.terms || null
    };
    
    // Add account details as separate custom fields (one per row)
    if (data.accountDetails) {
      if (!invoiceData.custom_fields) {
        invoiceData.custom_fields = [];
      }
      
      const acc = data.accountDetails;
      
      if (acc.bankName && acc.bankName.trim()) {
        invoiceData.custom_fields.push({
          name: 'Bank Name',
          value: `${acc.bankName.trim()}  `
        });
      }
      
      if (acc.accountHolderName && acc.accountHolderName.trim()) {
        invoiceData.custom_fields.push({
          name: 'Account Holder',
          value: `${acc.accountHolderName.trim()}  `
        });
      }
      
      if (acc.accountNumber && acc.accountNumber.trim()) {
        invoiceData.custom_fields.push({
          name: 'Account Number',
          value: `${acc.accountNumber.trim()}  `
        });
      }
      
      if (acc.iban && acc.iban.trim()) {
        invoiceData.custom_fields.push({
          name: 'IBAN',
          value: `${acc.iban.trim()}  `
        });
      }
      
      if (acc.swiftBic && acc.swiftBic.trim()) {
        invoiceData.custom_fields.push({
          name: 'SWIFT/BIC',
          value: `${acc.swiftBic.trim()}  `
        });
      }
      
      if (acc.branchAddress && acc.branchAddress.trim()) {
        invoiceData.custom_fields.push({
          name: 'Branch Address',
          value: `  ${acc.branchAddress.trim()}  `
        });
      }
    }

    // Add custom fields if provided
    if (data.customFields && data.customFields.length > 0) {
      if (!invoiceData.custom_fields) {
        invoiceData.custom_fields = [];
      }
      invoiceData.custom_fields.push(...data.customFields.map(field => ({
        name: field.name,
        value: field.value
      })));
    }

    // Add purchase order if provided
    if (data.invoice?.purchaseOrder) {
      if (!invoiceData.custom_fields) {
        invoiceData.custom_fields = [];
      }
      invoiceData.custom_fields.push({
        name: 'Purchase Order',
        value: data.invoice.purchaseOrder
      });
    }

    // Add ship_to if different from billing address
    if (data.shipTo) {
      invoiceData.ship_to = this.generator.formatCustomerInfo(data.shipTo);
    }

    return invoiceData;
  }

  /**
   * Generate invoice from structured data
   * @param {Object} data - Structured invoice data
   * @param {string} outputPath - Optional output path
   * @returns {Promise<string>} Path to generated PDF
   */
  async generateInvoice(data, outputPath = null) {
    const invoiceData = await this.buildInvoiceData(data);
    console.log('📦 Invoice payload keys:', Object.keys(invoiceData));
    console.log('📦 Logo included:', invoiceData.logo ? 'Yes' : 'No');
    if (invoiceData.logo) {
      // Log first and last 20 chars of base64 to verify it's valid
      console.log('📦 Logo:', invoiceData.logo);
      const logoPreview = invoiceData.logo.length > 40 
        ? `${invoiceData.logo.substring(0, 20)}...${invoiceData.logo.substring(invoiceData.logo.length - 20)}`
        : invoiceData.logo;
      console.log('📦 Logo base64 preview:', logoPreview);
      console.log('📦 Logo length:', invoiceData.logo.length, 'chars');
    }
    const filename = outputPath || `invoice_${data.invoice.number.replace(/\s+/g, '_')}.pdf`;
    return await this.generator.generatePDF(invoiceData, filename);
  }

  /**
   * Generate e-invoice from structured data
   * @param {Object} data - Structured invoice data
   * @param {string} outputPath - Optional output path
   * @returns {Promise<string>} Path to generated XML
   */
  async generateEInvoice(data, outputPath = null) {
    const invoiceData = await this.buildInvoiceData(data);
    const filename = outputPath || `invoice_${data.invoice.number.replace(/\s+/g, '_')}.xml`;
    return await this.generator.generateEInvoice(invoiceData, filename);
  }
}

export { InvoiceBuilder };
