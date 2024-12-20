'use client'

import Link from 'next/link'

export function Nav() {
  return (
    <nav className="border-b">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold">
          目录查看器
        </Link>
      </div>
    </nav>
  )
} 