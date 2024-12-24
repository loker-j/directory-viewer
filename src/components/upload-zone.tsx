'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { parseDirectoryText } from '@/lib/parse-directory'
import { formatFileSize } from '@/lib/utils'

interface DirectoryItem {
  name: string
  type: string
  level: number
  children?: DirectoryItem[]
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const CHUNK_SIZE = 1024 * 1024; // 1MB

export function UploadZone() {
  const router = useRouter()
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy'
    }
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const readFileInChunks = async (file: File) => {
    let text = ''
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE)
    let currentChunk = 0

    const readNextChunk = async (start: number): Promise<string> => {
      const end = Math.min(start + CHUNK_SIZE, file.size)
      const blob = file.slice(start, end)
      const chunkText = await blob.text()
      currentChunk++
      setProgress(Math.floor((currentChunk / totalChunks) * 100))
      return chunkText
    }

    for (let start = 0; start < file.size; start += CHUNK_SIZE) {
      text += await readNextChunk(start)
    }

    return text
  }

  const processFile = async (file: File) => {
    console.log('开始处理文件:', file.name, '大小:', formatFileSize(file.size))
    
    try {
      if (file.size > MAX_FILE_SIZE) {
        throw new Error(`文件大小超过限制 (最大 ${formatFileSize(MAX_FILE_SIZE)})`)
      }

      setProgress(0)
      const text = await readFileInChunks(file)
      console.log('文件读取完成')

      // 分块处理大文件
      const CHUNK_SIZE = 10000 // 每次处理的行数
      const lines = text.split('\n')
      const totalChunks = Math.ceil(lines.length / CHUNK_SIZE)
      let processedItems: DirectoryItem[] = []

      for (let i = 0; i < lines.length; i += CHUNK_SIZE) {
        const chunk = lines.slice(i, i + CHUNK_SIZE).join('\n')
        const chunkItems = parseDirectoryText(chunk)
        processedItems = processedItems.concat(chunkItems)
        
        // 更新进度
        const progress = Math.round((i + CHUNK_SIZE) / lines.length * 100)
        setProgress(Math.min(progress, 99)) // 保留最后1%给上传过程
      }

      console.log('解析后的目录结构:', processedItems)

      const formData = new FormData()
      formData.append('name', file.name.replace(/\.[^/.]+$/, ''))
      formData.append('structure', JSON.stringify(processedItems))

      console.log('发送请求到服务器...')
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 300000) // 5分钟超时

      try {
        const response = await fetch('/api/projects', {
          method: 'POST',
          body: formData,
          signal: controller.signal,
        })

        clearTimeout(timeoutId)
        console.log('服务器响应状态:', response.status)
        
        // 检查响应状态
        if (!response.ok) {
          const data = await response.json()
          console.error('服务器返回错误:', data)
          throw new Error(data.message || data.error || '上传失败')
        }

        // 完成进度
        setProgress(100)
        
        const data = await response.json()
        console.log('创建项目成功:', data)
        
        // 延迟跳转，让用户看到100%进度
        await new Promise(resolve => setTimeout(resolve, 500))
        router.push(`/projects/${data.id}`)
      } catch (error) {
        console.error('API 请求错误:', error)
        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error('处理时间较长，请稍后查看项目列表')
        }
        throw error
      }
    } catch (error) {
      console.error('处理文件时出错:', error)
      throw error
    }
  }

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    setIsProcessing(true)

    try {
      const file = e.dataTransfer.files[0]
      console.log('拖放的文件:', file?.name)
      
      if (!file) {
        throw new Error('请上传文件')
      }
      if (!file.name.endsWith('.txt')) {
        throw new Error('请上传 .txt 文件')
      }
      await processFile(file)
    } catch (error) {
      console.error('处理拖放文件时出错:', error)
      alert(error instanceof Error ? error.message : '上传失败')
    } finally {
      setIsProcessing(false)
      setProgress(0)
    }
  }, [router])

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsProcessing(true)
    try {
      if (!file.name.endsWith('.txt')) {
        throw new Error('请上传 .txt 文件')
      }
      await processFile(file)
    } catch (error) {
      console.error('处理选择的文件时出错:', error)
      alert(error instanceof Error ? error.message : '上传失败')
    } finally {
      setIsProcessing(false)
      setProgress(0)
      e.target.value = ''
    }
  }, [router])

  return (
    <div
      className={`p-8 border-2 border-dashed rounded-lg transition-colors ${
        isDragging ? 'border-primary bg-primary/5' : 'border-border'
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <p className="text-sm text-muted-foreground mb-4">
        {isProcessing
          ? progress > 0 
            ? `正在处理文件... ${progress}%`
            : '正在处理文件...'
          : '拖放目录文件到这里，或点击选择文件'}
      </p>
      <p className="text-xs text-muted-foreground mb-4">
        支持的最大文件大小：{formatFileSize(MAX_FILE_SIZE)}
      </p>
      <input
        type="file"
        accept=".txt"
        className="hidden"
        id="file-input"
        onChange={handleFileSelect}
        disabled={isProcessing}
      />
      <label htmlFor="file-input">
        <Button 
          type="button"
          size="lg" 
          disabled={isProcessing}
          className="cursor-pointer"
        >
          {isProcessing ? '处理中...' : '选择文件'}
        </Button>
      </label>
    </div>
  )
} 