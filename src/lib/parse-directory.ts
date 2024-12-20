interface DirectoryItem {
  name: string
  type: 'file' | 'folder'
  level: number
  children?: DirectoryItem[]
}

export function parseDirectoryText(text: string): DirectoryItem[] {
  const lines = text.split('\n').filter(line => line.trim())
  const items: DirectoryItem[] = []
  const stack: DirectoryItem[] = []

  lines.forEach(line => {
    // 计算缩进级别（每个缩进是 "│   " 或 "    " 或 "├   " 或 "└   "）
    const indentMatch = line.match(/^([│├└\s]+)/)?.[1] || ''
    const level = Math.floor(indentMatch.length / 4)
    
    // 提取名称（移除前缀符号和空格）
    const name = line.replace(/^[│├└─\s]+/, '').trim()
    if (!name) return

    // 创建项目
    const item: DirectoryItem = {
      name,
      type: name.includes('.') ? 'file' : 'folder',
      level,
      children: [],
    }

    // 找到父节点
    while (stack.length > level) {
      stack.pop()
    }

    if (stack.length === 0) {
      items.push(item)
    } else {
      const parent = stack[stack.length - 1]
      parent.children?.push(item)
    }

    if (item.type === 'folder') {
      stack.push(item)
    }
  })

  return items
} 