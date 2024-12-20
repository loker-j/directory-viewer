'use client'

import { useEffect, useState, useCallback } from 'react'
import { DirectoryTree } from '@/components/directory-tree'
import { ShareOptions } from '@/components/share-options'
import { SearchBox } from '@/components/search-box'
import { ArrowUp } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface PageProps {
  params: {
    id: string
  }
}

export default function ProjectPage({ params }: PageProps) {
  const [project, setProject] = useState<any>(null)
  const [error, setError] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [currentMatch, setCurrentMatch] = useState(0)
  const [matchedItems, setMatchedItems] = useState<string[]>([])
  const [showScrollTop, setShowScrollTop] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > window.innerHeight)
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  useEffect(() => {
    async function fetchProject() {
      try {
        const response = await fetch(`/api/projects/${params.id}`)
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.message || '加载项目失败')
        }

        setProject(data)
      } catch (error) {
        console.error('获取项目数据失败:', error)
        setError(error instanceof Error ? error.message : '加载失败')
      } finally {
        setIsLoading(false)
      }
    }

    fetchProject()
  }, [params.id])

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query.toLowerCase())
  }, [])

  const handleMatchesUpdate = useCallback((matches: string[], currentIndex: number) => {
    setMatchedItems(matches)
    setCurrentMatch(currentIndex)
  }, [])

  const handleNavigate = useCallback((direction: 'prev' | 'next') => {
    if (matchedItems.length === 0) return

    let newIndex = currentMatch
    if (direction === 'next') {
      newIndex = (currentMatch + 1) % matchedItems.length
    } else {
      newIndex = (currentMatch - 1 + matchedItems.length) % matchedItems.length
    }
    setCurrentMatch(newIndex)
  }, [currentMatch, matchedItems])

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <p>加载中...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <p className="text-red-500">{error}</p>
        </div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <p>项目不存在</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-center mb-2">
            {project.name}
          </h1>
          <ShareOptions 
            url={typeof window !== 'undefined' ? window.location.href : ''} 
            projectName={project.name}
          />
          <SearchBox 
            onSearch={handleSearch}
            totalMatches={matchedItems.length}
            currentMatch={currentMatch}
            onNavigate={handleNavigate}
          />
          <DirectoryTree 
            items={project.items} 
            searchQuery={searchQuery}
            currentMatchIndex={currentMatch}
            onMatchesUpdate={handleMatchesUpdate}
          />
        </div>
      </div>
      {showScrollTop && (
        <Button
          variant="outline"
          size="sm"
          className="fixed bottom-6 right-6 h-8 w-8 p-0 rounded-full shadow-lg bg-background/95 backdrop-blur-sm"
          onClick={scrollToTop}
        >
          <ArrowUp className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
} 