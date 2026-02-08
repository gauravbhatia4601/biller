import { NextResponse } from 'next/server'
import Invoice from '@/models/Invoice'
import { connectDB } from '@/lib/db'
import { config } from '@/config/config'

// POST /api/templates/[id]/create-invoice - Create invoice from template
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await connectDB()
    const template = await Invoice.findOne({ _id: params.id, isTemplate: true })
    
    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }
    
    const body = await request.json()
    const templateData = template.toObject()
    
    // Create new invoice from template
    const invoiceData: any = {
      ...templateData,
      isTemplate: false,
      templateName: '',
      invoice: {
        ...templateData.invoice,
        ...(body.invoice || {}),
        number: body.invoice?.number || `INV-${Date.now()}`,
      },
      company: {
        ...config.company,
        ...templateData.company,
      },
    }
    
    delete invoiceData._id
    delete invoiceData.pdfPath
    delete invoiceData.createdAt
    delete invoiceData.updatedAt
    
    const invoice = new Invoice(invoiceData)
    await invoice.save()
    
    return NextResponse.json(invoice, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
