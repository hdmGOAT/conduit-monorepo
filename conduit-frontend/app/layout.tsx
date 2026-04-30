import React from 'react'
import './globals.css'
import TopBar from '@/components/topbar'
import { Fraunces, Space_Grotesk } from 'next/font/google'

const fraunces = Fraunces({ variable: '--font-display', subsets: ['latin'], weight: ['400','500','600','700'] })
const space = Space_Grotesk({ variable: '--font-body', subsets: ['latin'], weight: ['400','500','600','700'] })

export const metadata = {
  title: 'Conduit',
  description: 'Run communities like a product',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${space.variable} h-full antialiased`}>
      <body className="bg-gray-50 text-ink">
        <TopBar />
        <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
          {children}
        </main>
      </body>
    </html>
  )
}
