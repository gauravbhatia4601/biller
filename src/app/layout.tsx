import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { ThemeModeScript } from 'flowbite-react'
import './globals.css'
import { Providers } from './providers'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Biller - Professional Invoice Management',
  description: 'Generate and manage professional invoices',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="light" suppressHydrationWarning>
      <head>
        <ThemeModeScript mode="light" />
      </head>
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
