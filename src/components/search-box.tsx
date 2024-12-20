import { useState, useEffect } from 'react'
import { Search, ChevronUp, ChevronDown } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface SearchBoxProps {
  onSearch: (query: string) => void
  totalMatches: number
  currentMatch: number
  onNavigate: (direction: 'prev' | 'next') => void
}

export function SearchBox({ 
  onSearch, 
  totalMatches, 
  currentMatch, 
  onNavigate 
}: SearchBoxProps) {
  const [query, setQuery] = useState('')
  const [isSticky, setIsSticky] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      onSearch(query)
    }, 300)

    return () => clearTimeout(timer)
  }, [query, onSearch])

  useEffect(() => {
    const handleScroll = () => {
      const searchBox = document.getElementById('search-box')
      if (!searchBox) return

      const rect = searchBox.getBoundingClientRect()
      const shouldStick = rect.top <= 24
      setIsSticky(shouldStick)
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div className="mb-12">
      <div id="search-box" className="h-[1px] mb-4" />
      <div className={cn(
        "w-full max-w-md mx-auto transition-all duration-200",
        isSticky 
          ? "fixed top-6 left-1/2 -translate-x-1/2 px-4 py-3 bg-background/95 backdrop-blur-sm shadow-lg rounded-lg z-50"
          : "relative"
      )}>
        <div className="relative">
          <Input
            type="text"
            placeholder="搜索文件或文件夹..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10 pr-32 h-10 shadow-sm"
          />
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          
          {query && (
            <div className="absolute right-0 top-0 h-full flex items-center gap-1 mr-2">
              {totalMatches > 0 && (
                <span className="text-sm text-muted-foreground">
                  {currentMatch + 1}/{totalMatches}
                </span>
              )}
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => onNavigate('prev')}
                  disabled={totalMatches === 0}
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => onNavigate('next')}
                  disabled={totalMatches === 0}
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 