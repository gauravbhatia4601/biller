'use client'

import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { AppDispatch, RootState } from '@/store'
import { fetchClients, deleteClient } from '@/store/slices/clientSlice'
import Navigation from '@/components/Navigation'
import ClientForm from '@/components/ClientForm'
import { Table, TableBody, TableCell, TableHead, TableHeadCell, TableRow, Button, Spinner } from 'flowbite-react'
import { HiOutlinePlus, HiOutlinePencil, HiOutlineTrash } from 'react-icons/hi'

interface Client {
  _id?: string
  name: string
  company?: string
  address?: string
  city?: string
  country?: string
  phone?: string
  email?: string
  vatId?: string
  notes?: string
}

export default function ClientsPage() {
  const dispatch = useDispatch<AppDispatch>()
  const { clients, loading } = useSelector((state: RootState) => state.clients)
  const [showForm, setShowForm] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)

  useEffect(() => {
    dispatch(fetchClients())
  }, [dispatch])

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this client?')) {
      await dispatch(deleteClient(id))
      dispatch(fetchClients())
    }
  }

  const handleEdit = (client: Client) => {
    setEditingClient(client)
    setShowForm(true)
  }

  const handleAdd = () => {
    setEditingClient(null)
    setShowForm(true)
  }

  const handleFormClose = () => {
    setShowForm(false)
    setEditingClient(null)
  }

  const handleFormSave = () => {
    dispatch(fetchClients())
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <main className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Clients</h2>
          <Button size="xs" color="blue" onClick={handleAdd}>
            <HiOutlinePlus className="h-4 w-4 mr-1" />
            Add Client
          </Button>
        </div>

        {clients.length === 0 ? (
          <div className="text-center py-12">
            <h3 className="text-lg font-semibold text-gray-700 mb-2">No clients yet</h3>
            <p className="text-gray-500 text-sm mb-4">Add your first client to get started</p>
            <Button size="sm" color="blue" onClick={handleAdd}>
              <HiOutlinePlus className="h-4 w-4 mr-1" />
              Add Client
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table hoverable>
              <TableHead>
                <TableHeadCell>Name</TableHeadCell>
                <TableHeadCell>Company</TableHeadCell>
                <TableHeadCell>Email</TableHeadCell>
                <TableHeadCell>Phone</TableHeadCell>
                <TableHeadCell>Location</TableHeadCell>
                <TableHeadCell>Actions</TableHeadCell>
              </TableHead>
              <TableBody className="divide-y">
                {clients.map((client) => (
                  <TableRow key={client._id} className="bg-white">
                    <TableCell className="font-medium text-gray-900">
                      {client.name}
                    </TableCell>
                    <TableCell className="text-sm">{client.company || '-'}</TableCell>
                    <TableCell className="text-sm">{client.email || '-'}</TableCell>
                    <TableCell className="text-sm">{client.phone || '-'}</TableCell>
                    <TableCell className="text-sm">
                      {[client.city, client.country].filter(Boolean).join(', ') || '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          size="xs"
                          color="light"
                          onClick={() => handleEdit(client)}
                          title="Edit"
                        >
                          <HiOutlinePencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="xs"
                          color="failure"
                          onClick={() => handleDelete(client._id!)}
                          title="Delete"
                        >
                          <HiOutlineTrash className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {showForm && (
          <ClientForm
            client={editingClient}
            onClose={handleFormClose}
            onSave={handleFormSave}
          />
        )}
      </main>
    </div>
  )
}
