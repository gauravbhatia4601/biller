import { NextResponse } from 'next/server'
import Invoice from '@/models/Invoice'
import { connectDB } from '@/lib/db'
import { config } from '@/config/config'

// GET /api/templates - Get all templates
export async function GET() {
  try {
    await connectDB()
    const templates = await Invoice.find({ isTemplate: true }).sort({ templateName: 1 })
    return NextResponse.json(templates)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST /api/templates - Create new template
export async function POST(request: Request) {
  try {
    await connectDB()
    const body = await request.json()
    
    // Merge with default company data
    const templateData = {
      ...body,
      isTemplate: true,
      company: {
        ...config.company,
        ...body.company,
      },
    }
    
    const template = new Invoice(templateData)
    await template.save()
    return NextResponse.json(template, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
