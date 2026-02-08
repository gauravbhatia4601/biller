'use client'

import { useState, useEffect } from 'react'
import { useDispatch } from 'react-redux'
import { AppDispatch } from '@/store'
import { createClient, updateClient } from '@/store/slices/clientSlice'
import { Modal, ModalBody, ModalFooter, ModalHeader, TextInput, Textarea, Button } from 'flowbite-react'

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

interface ClientFormProps {
  client?: Client | null
  onClose: () => void
  onSave: () => void
}

export default function ClientForm({ client, onClose, onSave }: ClientFormProps) {
  const dispatch = useDispatch<AppDispatch>()
  const [formData, setFormData] = useState<Client>({
    name: '',
    company: '',
    address: '',
    city: '',
    country: '',
    phone: '',
    email: '',
    vatId: '',
    notes: '',
  })

  useEffect(() => {
    if (client) {
      setFormData({
        name: client.name || '',
        company: client.company || '',
        address: client.address || '',
        city: client.city || '',
        country: client.country || '',
        phone: client.phone || '',
        email: client.email || '',
        vatId: client.vatId || '',
        notes: client.notes || '',
      })
    }
  }, [client])

  const handleChange = (field: keyof Client, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (client?._id) {
        await dispatch(updateClient({ id: client._id, data: formData }))
      } else {
        await dispatch(createClient(formData))
      }
      onSave()
      onClose()
    } catch (error) {
      console.error('Error saving client:', error)
    }
  }

  return (
    <Modal show={true} onClose={onClose} size="xl">
      <ModalHeader>
        {client ? 'Edit Client' : 'Add New Client'}
      </ModalHeader>
      <ModalBody>
        <form id="client-form" onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label htmlFor="name" className="block mb-1 text-xs font-medium text-gray-700">
              Name <span className="text-red-500">*</span>
            </label>
            <TextInput
              id="name"
              sizing="sm"
              required
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="company" className="block mb-1 text-xs font-medium text-gray-700">Company</label>
              <TextInput
                id="company"
                sizing="sm"
                value={formData.company}
                onChange={(e) => handleChange('company', e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="email" className="block mb-1 text-xs font-medium text-gray-700">Email</label>
              <TextInput
                id="email"
                sizing="sm"
                type="email"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="phone" className="block mb-1 text-xs font-medium text-gray-700">Phone</label>
              <TextInput
                id="phone"
                sizing="sm"
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="vatId" className="block mb-1 text-xs font-medium text-gray-700">VAT ID</label>
              <TextInput
                id="vatId"
                sizing="sm"
                value={formData.vatId}
                onChange={(e) => handleChange('vatId', e.target.value)}
              />
            </div>
          </div>

          <div>
            <label htmlFor="address" className="block mb-1 text-xs font-medium text-gray-700">Address</label>
            <TextInput
              id="address"
              sizing="sm"
              value={formData.address}
              onChange={(e) => handleChange('address', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="city" className="block mb-1 text-xs font-medium text-gray-700">City</label>
              <TextInput
                id="city"
                sizing="sm"
                value={formData.city}
                onChange={(e) => handleChange('city', e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="country" className="block mb-1 text-xs font-medium text-gray-700">Country</label>
              <TextInput
                id="country"
                sizing="sm"
                value={formData.country}
                onChange={(e) => handleChange('country', e.target.value)}
              />
            </div>
          </div>

          <div>
            <label htmlFor="notes" className="block mb-1 text-xs font-medium text-gray-700">Notes</label>
            <Textarea
              id="notes"
              rows={3}
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              className="text-sm"
            />
          </div>
        </form>
      </ModalBody>
      <ModalFooter>
        <div className="flex justify-end gap-2 w-full">
          <Button size="sm" color="gray" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" color="blue" type="submit" form="client-form">
            {client ? 'Update' : 'Create'} Client
          </Button>
        </div>
      </ModalFooter>
    </Modal>
  )
}
