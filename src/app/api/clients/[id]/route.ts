import { NextResponse } from 'next/server'
import Client from '@/models/Client'
import { connectDB } from '@/lib/db'

// GET /api/clients/[id] - Get single client
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await connectDB()
    const client = await Client.findById(params.id)
    
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }
    
    return NextResponse.json(client)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT /api/clients/[id] - Update client
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await connectDB()
    const body = await request.json()
    const client = await Client.findByIdAndUpdate(
      params.id,
      body,
      { new: true, runValidators: true }
    )
    
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }
    
    return NextResponse.json(client)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE /api/clients/[id] - Delete client
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    await connectDB()
    const client = await Client.findByIdAndDelete(params.id)
    
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }
    
    return NextResponse.json({ message: 'Client deleted successfully' })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
