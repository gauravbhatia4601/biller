import { NextResponse } from 'next/server'
import Invoice from '@/models/Invoice'
import { connectDB } from '@/lib/db'
import { config } from '@/config/config'

// GET /api/templates/[id] - Get single template
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await connectDB()
    const template = await Invoice.findOne({ _id: params.id, isTemplate: true })
    
    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }
    
    return NextResponse.json(template)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT /api/templates/[id] - Update template
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await connectDB()
    const body = await request.json()
    
    // Merge with default company data
    const templateData = {
      ...body,
      isTemplate: true,
      company: {
        ...config.company,
        ...(body.company || {}),
      },
    }
    
    const template = await Invoice.findByIdAndUpdate(
      params.id,
      templateData,
      { new: true, runValidators: true }
    )
    
    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }
    
    return NextResponse.json(template)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE /api/templates/[id] - Delete template
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await connectDB()
    const template = await Invoice.findByIdAndDelete(params.id)
    
    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }
    
    return NextResponse.json({ message: 'Template deleted successfully' })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
