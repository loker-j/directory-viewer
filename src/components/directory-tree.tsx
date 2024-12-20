'use client'

import { useState, useEffect, useMemo } from 'react'
import { ChevronRight, ChevronDown, Folder, File } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DirectoryItem {
  id: string
  name: string
  type: string
  parentId: string | null
  level: number
}

interface DirectoryTreeProps {
  items: DirectoryItem[]
  searchQuery?: string
  currentMatchIndex: number
  onMatchesUpdate: (matches: string[], currentIndex: number) => void
}

export function DirectoryTree({ 
  items, 
  searchQuery = '',
  currentMatchIndex,
  onMatchesUpdate
}: DirectoryTreeProps) {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const [matchedItems, setMatchedItems] = useState<string[]>([])

  // 构建父子关系映射
  const itemsMap = useMemo(() => {
    const map = new Map<string | null, DirectoryItem[]>()
    items.forEach(item => {
      const parentItems = map.get(item.parentId) || []
      parentItems.push(item)
      map.set(item.parentId, parentItems)
    })
    return map
  }, [items])

  // 搜索处理
  useEffect(() => {
    if (!searchQuery) {
      setMatchedItems([])
      onMatchesUpdate([], -1)
      return
    }

    const matches: string[] = []
    const parentIds = new Set<string>()

    // 查找匹配项及其所有父项
    const findMatchesAndParents = (item: DirectoryItem) => {
      if (item.name.toLowerCase().includes(searchQuery)) {
        matches.push(item.id)
        // 查找所有父项
        let currentParentId = item.parentId
        while (currentParentId) {
          parentIds.add(currentParentId)
          const parent = items.find(i => i.id === currentParentId)
          if (parent) {
            currentParentId = parent.parentId
          } else {
            break
          }
        }
      }
    }

    items.forEach(findMatchesAndParents)

    // 自动展开包含匹配项的文件夹
    setExpandedItems(new Set([...parentIds]))
    setMatchedItems(matches)
    onMatchesUpdate(matches, matches.length > 0 ? 0 : -1)
  }, [searchQuery, items, onMatchesUpdate])

  // 当前匹配项变化时，滚动到视图
  useEffect(() => {
    if (matchedItems.length > 0 && currentMatchIndex >= 0) {
      const element = document.getElementById(`item-${matchedItems[currentMatchIndex]}`)
      element?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [currentMatchIndex, matchedItems])

  const toggleExpand = (itemId: string) => {
    const newExpanded = new Set(expandedItems)
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId)
    } else {
      newExpanded.add(itemId)
    }
    setExpandedItems(newExpanded)
  }

  const renderItem = (item: DirectoryItem) => {
    const isExpanded = expandedItems.has(item.id)
    const children = itemsMap.get(item.id) || []
    const hasChildren = children.length > 0
    const isMatched = matchedItems.includes(item.id)
    const isCurrentMatch = matchedItems[currentMatchIndex] === item.id
    const isFolder = item.type === 'folder'

    return (
      <div key={item.id}>
        <div 
          id={`item-${item.id}`}
          className={cn(
            "flex items-center py-1 px-2 rounded hover:bg-accent/50 cursor-pointer",
            isMatched && "bg-yellow-100 dark:bg-yellow-900/30",
            isCurrentMatch && "ring-2 ring-primary"
          )}
          style={{ paddingLeft: `${item.level * 1.5}rem` }}
          onClick={() => isFolder && toggleExpand(item.id)}
        >
          {isFolder && (
            <div className="w-4 h-4 mr-1">
              {hasChildren && (
                isExpanded ? 
                  <ChevronDown className="w-4 h-4" /> : 
                  <ChevronRight className="w-4 h-4" />
              )}
            </div>
          )}
          {isFolder ? (
            <Folder className="w-4 h-4 mr-2 text-blue-500" />
          ) : (
            <File className="w-4 h-4 mr-2 text-gray-500" />
          )}
          <span className={cn(
            "text-sm",
            isMatched && "font-medium",
            isCurrentMatch && "text-primary"
          )}>
            {item.name}
          </span>
        </div>
        {isFolder && isExpanded && hasChildren && (
          <div>
            {children.map(child => renderItem(child))}
          </div>
        )}
      </div>
    )
  }

  const rootItems = itemsMap.get(null) || []

  return (
    <div className="border rounded-lg p-4 bg-background">
      {rootItems.map(item => renderItem(item))}
    </div>
  )
} 