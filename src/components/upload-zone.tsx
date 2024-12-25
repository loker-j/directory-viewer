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
      setProgress(25)

      // 解析整个目录结构
      console.log('开始解析目录结构...')
      const rootItems = parseDirectoryText(text)
      console.log('解析后的目录结构:', rootItems)
      setProgress(50)

      // 扁平化处理，同时保存父子关系
      interface FlatItem {
        name: string
        type: string
        level: number
        order: number
        parentOrder: number | null
      }

      const flatItems: FlatItem[] = []
      let order = 0

      function flattenItems(items: DirectoryItem[], parentOrder: number | null = null) {
        items.forEach(item => {
          const currentOrder = order++
          flatItems.push({
            name: item.name,
            type: item.type,
            level: item.level,
            order: currentOrder,
            parentOrder
          })

          if (item.children?.length) {
            flattenItems(item.children, currentOrder)
          }
        })
      }

      flattenItems(rootItems)
      console.log('扁平化后的项目数量:', flatItems.length)

      // 分批处理
      const BATCH_SIZE = 1000
      const batches: FlatItem[][] = []
      for (let i = 0; i < flatItems.length; i += BATCH_SIZE) {
        batches.push(flatItems.slice(i, i + BATCH_SIZE))
      }
      console.log(`分成 ${batches.length} 个批次处理`)

      // 串行处理每个批次
      let projectId: string | null = null
      
      for (let i = 0; i < batches.length; i++) {
        const formData = new FormData()
        if (i === 0) {
          formData.append('name', file.name.replace(/\.[^/.]+$/, ''))
        }
        formData.append('structure', JSON.stringify(batches[i]))
        if (projectId) {
          formData.append('projectId', projectId)
        }
        formData.append('batchNumber', String(i + 1))
        formData.append('totalBatches', String(batches.length))
        formData.append('isLastBatch', String(i === batches.length - 1))

        // 添加重试逻辑
        let retryCount = 0
        const maxRetries = 3
        
        while (retryCount < maxRetries) {
          try {
            console.log(`发送第 ${i + 1}/${batches.length} 批`)
            const response = await fetch('/api/projects', { 
              method: 'POST', 
              body: formData 
            })

            if (!response.ok) {
              throw new Error('创建项目失败')
            }

            const result = await response.json()
            if (i === 0) {
              projectId = result.id
              console.log('项目创建成功:', projectId)
            }
            break
          } catch (error) {
            console.error(`第 ${i + 1} 批处理失败:`, error)
            retryCount++
            if (retryCount === maxRetries) throw error
            // 指数退避重试
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000))
          }
        }

        // 更新进度
        setProgress(50 + Math.floor((i + 1) / batches.length * 50))
        
        // 每批处理后等待一段时间，避免触发限制
        await new Promise(resolve => setTimeout(resolve, 1000))
      }

      // 完成进度
      setProgress(100)

      // 延迟跳转，让用户看到100%进度
      await new Promise(resolve => setTimeout(resolve, 500))
      if (projectId) {
        router.push(`/projects/${projectId}`)
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