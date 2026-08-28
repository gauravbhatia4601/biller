// Shared notification types — safe to import from client and server code.
// Must NOT import anything from mongoose or other server-only modules.

export type NotificationType = 'invoice_generated' | 'invoice_overdue'

export type NotificationDTO = {
  id: string
  type: NotificationType
  invoiceId: string
  invoiceNumber: string
  customerName: string
  title: string
  message: string
  read: boolean
  readAt: string | null // ISO
  lastNotifiedAt: string // ISO — the sort key AND the client ping key
  notifyCount: number
  amountDue: number
  currency: string
  dueDate: string | null // 'YYYY-MM-DD' snapshot (overdue only)
  resolvedAt: string | null // ISO — set when invoice is paid/deleted
  createdAt: string // ISO
}

export type NotificationListResponse = {
  items: NotificationDTO[]
  unreadCount: number
  serverTime: string
}

export type NotificationPostBody =
  | { action: 'mark-read'; id: string }
  | { action: 'mark-all-read' }