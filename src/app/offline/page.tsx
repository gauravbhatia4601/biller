import Link from 'next/link'

export const metadata = {
  title: 'Offline - Biller',
}

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <div className="max-w-sm">
        <svg
          className="mx-auto mb-6 h-16 w-16 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m-9.303 3.376C8.24 19.398 15.76 19.398 21.303 16.126M12 15.75h.007v-.008H12v.008Zm-.008-9.758c2.02.067 3.877.822 5.344 2.05m-9.855-1.795A8.966 8.966 0 0 1 12 5.25c2.28 0 4.36.847 5.946 2.244M3.182 8.907A8.97 8.97 0 0 1 8.999 5.33"
          />
        </svg>
        <h1 className="mb-2 text-2xl font-bold text-gray-900">You&apos;re offline</h1>
        <p className="mb-6 text-gray-600">
          Biller needs an internet connection to load your invoices. Check your
          connection and try again.
        </p>
        <Link
          href="/"
          className="inline-block rounded-lg bg-[#0f172a] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#1e293b]"
        >
          Try again
        </Link>
      </div>
    </main>
  )
}