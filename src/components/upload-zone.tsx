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

// 添加进度状态接口
interface ProgressStatus {
  stage: '读取文件' | '解析结构' | '处理数据' | '完成'
  progress: number
  currentBatch?: number
  totalBatches?: number
  detail?: string
}

export function UploadZone() {
  const router = useRouter()
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [progressStatus, setProgressStatus] = useState<ProgressStatus>({
    stage: '读取文件',
    progress: 0
  })

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
      setProgressStatus({
        stage: '读取文件',
        progress: Math.floor((currentChunk / totalChunks) * 100),
        detail: `${formatFileSize(end)} / ${formatFileSize(file.size)}`
      })
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

      // 读取文件
      setProgressStatus({ stage: '读取文件', progress: 0 })
      const text = await readFileInChunks(file)
      console.log('文件读取完成')

      // 解析结构
      setProgressStatus({ stage: '解析结构', progress: 0 })
      console.log('开始解析目录结构...')
      const rootItems = parseDirectoryText(text)
      console.log('解析后的目录结构:', rootItems)
      setProgressStatus({ stage: '解析结构', progress: 100 })

      // 扁平化处理
      setProgressStatus({ 
        stage: '处理数据', 
        progress: 0,
        detail: '扁平化处理中...'
      })

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
        setProgressStatus({
          stage: '处理数据',
          progress: Math.floor((i / batches.length) * 100),
          currentBatch: i + 1,
          totalBatches: batches.length,
          detail: `正在处理第 ${i + 1}/${batches.length} 批`
        })

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
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000))
          }
        }

        await new Promise(resolve => setTimeout(resolve, 1000))
      }

      setProgressStatus({
        stage: '完成',
        progress: 100,
        detail: '处理完成，即将跳转...'
      })

      await new Promise(resolve => setTimeout(resolve, 1000))
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
      setProgressStatus({ stage: '读取文件', progress: 0 })
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
      setProgressStatus({ stage: '读取文件', progress: 0 })
      e.target.value = ''
    }
  }, [router])

  const renderProgress = () => (
    <div className="space-y-4">
      <div className="space-y-2 text-center">
        <p className="text-sm text-muted-foreground">
          {progressStatus.stage}... {progressStatus.progress}%
        </p>
        {progressStatus.detail && (
          <p className="text-xs text-muted-foreground">
            {progressStatus.detail}
          </p>
        )}
        {progressStatus.currentBatch && progressStatus.totalBatches && (
          <div className="w-full bg-secondary rounded-full h-2.5 dark:bg-gray-700">
            <div 
              className="bg-primary h-2.5 rounded-full transition-all duration-300" 
              style={{ width: `${progressStatus.progress}%` }}
            />
          </div>
        )}
      </div>
      <div className="flex justify-center">
        <Button 
          type="button"
          size="lg" 
          disabled
          className="cursor-not-allowed"
        >
          处理中...
        </Button>
      </div>
    </div>
  )

  return (
    <div
      className={`p-8 border-2 border-dashed rounded-lg transition-colors ${
        isDragging ? 'border-primary bg-primary/5' : 'border-border'
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isProcessing ? (
        renderProgress()
      ) : (
        <div className="text-center space-y-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              拖放目录文件到这里，或点击选择文件
            </p>
            <p className="text-xs text-muted-foreground">
              支持的最大文件大小：{formatFileSize(MAX_FILE_SIZE)}
            </p>
          </div>
          <div className="flex justify-center">
            <Button 
              variant="default"
              size="lg" 
              disabled={isProcessing}
              onClick={() => {
                const input = document.getElementById('file-input') as HTMLInputElement
                input?.click()
              }}
            >
              选择文件
            </Button>
          </div>
        </div>
      )}
      <input
        type="file"
        accept=".txt"
        className="hidden"
        id="file-input"
        onChange={handleFileSelect}
        disabled={isProcessing}
      />
    </div>
  )
} 