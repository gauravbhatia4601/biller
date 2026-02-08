import { NextResponse } from 'next/server'
import Client from '@/models/Client'
import { connectDB } from '@/lib/db'

// GET /api/clients - Get all clients
export async function GET() {
  try {
    await connectDB()
    const clients = await Client.find().sort({ name: 1 })
    return NextResponse.json(clients)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST /api/clients - Create new client
export async function POST(request: Request) {
  try {
    await connectDB()
    const body = await request.json()
    const client = new Client(body)
    await client.save()
    return NextResponse.json(client, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
