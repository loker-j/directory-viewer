'use client'

import { useState } from 'react'
import { ChevronRight, ChevronDown, File, Folder } from 'lucide-react'
import { formatFileSize } from '@/lib/utils'

interface DirectoryItem {
  id: string
  name: string
  type: string
  level: number
  size: number | null
  modifiedAt: Date | null
  parentId: string | null
}

interface DirectoryTreeProps {
  items: DirectoryItem[]
}

interface TreeNode {
  item: DirectoryItem
  children: TreeNode[]
}

function buildTree(items: DirectoryItem[]): TreeNode[] {
  const itemMap = new Map<string, TreeNode>()
  const roots: TreeNode[] = []

  // 创建所有节点
  items.forEach(item => {
    itemMap.set(item.id, { item, children: [] })
  })

  // 构建树结构
  items.forEach(item => {
    const node = itemMap.get(item.id)!
    if (item.parentId) {
      const parent = itemMap.get(item.parentId)
      if (parent) {
        parent.children.push(node)
      }
    } else {
      roots.push(node)
    }
  })

  return roots
}

function TreeNode({ node, level = 0 }: { node: TreeNode; level?: number }) {
  const [isOpen, setIsOpen] = useState(false)
  const hasChildren = node.children.length > 0
  const Icon = hasChildren ? (isOpen ? ChevronDown : ChevronRight) : node.item.type === 'folder' ? Folder : File
  const iconColor = node.item.type === 'folder' ? 'text-blue-500' : 'text-gray-500'

  const handleIconClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (hasChildren) {
      setIsOpen(!isOpen)
    }
  }

  const handleItemClick = () => {
    if (node.item.type === 'folder') {
      setIsOpen(!isOpen)
    }
  }

  return (
    <div>
      <div
        className={`flex items-center py-1 px-2 hover:bg-gray-100 cursor-pointer ${
          level > 0 ? 'ml-4' : ''
        }`}
        onClick={handleItemClick}
      >
        <div 
          className="p-1 hover:bg-gray-200 rounded"
          onClick={handleIconClick}
        >
          <Icon className={`w-4 h-4 ${iconColor}`} />
        </div>
        <span className="flex-1 ml-2">{node.item.name}</span>
      </div>
      {isOpen && hasChildren && (
        <div className="ml-2">
          {node.children.map(child => (
            <TreeNode key={child.item.id} node={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

export function DirectoryTree({ items }: DirectoryTreeProps) {
  const tree = buildTree(items)

  return (
    <div className="border rounded-lg p-2 bg-white">
      {tree.map(node => (
        <TreeNode key={node.item.id} node={node} />
      ))}
    </div>
  )
} 