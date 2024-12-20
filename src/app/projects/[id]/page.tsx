'use client'

import { useEffect, useState } from 'react'
import { DirectoryTree } from '@/components/directory-tree'
import { ShareOptions } from '@/components/share-options'

interface PageProps {
  params: {
    id: string
  }
}

export default function ProjectPage({ params }: PageProps) {
  const [project, setProject] = useState<any>(null)
  const [error, setError] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)

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
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-2">
          {project.name}
        </h1>
        <ShareOptions 
          url={typeof window !== 'undefined' ? window.location.href : ''} 
          projectName={project.name}
        />
        <DirectoryTree items={project.items} />
      </div>
    </div>
  )
} 