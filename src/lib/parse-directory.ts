interface DirectoryItem {
  name: string
  type: 'file' | 'folder'
  level: number
  children?: DirectoryItem[]
}

export function parseDirectoryText(text: string): DirectoryItem[] {
  // 移除 BOM 和空行，过滤 HTML
  const lines = text
    .replace(/^\uFEFF/, '') // 移除 BOM
    .split('\n')
    .map(line => line.replace(/\r$/, '')) // 处理 Windows 换行符
    .filter(line => line.trim() && !line.includes('<!DOCTYPE') && !line.includes('<html'))

  const items: DirectoryItem[] = []
  const stack: { item: DirectoryItem, level: number }[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    
    // 计算缩进级别和提取名称
    let level = 0
    let name = line.trim()

    // 处理树形符号的情况
    if (line.match(/^[│├└]/)) {
      // 计算树形符号的缩进级别
      const treeMatch = line.match(/^([│ ]*[├└]──\s*)/)
      if (treeMatch) {
        const indent = treeMatch[1]
        level = Math.floor((indent.match(/[│├└]/g) || []).length - 1)
        name = line.substring(indent.length).trim()
      }
    } else {
      // 处理空格缩进的情况
      const spaceMatch = line.match(/^(\s+)/)
      if (spaceMatch) {
        level = Math.floor(spaceMatch[1].length / 2)
        name = line.substring(spaceMatch[1].length)
      }
    }

    // 创建新项目
    const item: DirectoryItem = {
      name,
      type: name.includes('.') ? 'file' : 'folder',
      level,
      children: []
    }

    // 找到正确的父节点
    while (stack.length > 0 && stack[stack.length - 1].level >= level) {
      stack.pop()
    }

    if (stack.length === 0) {
      items.push(item)
    } else {
      const parent = stack[stack.length - 1].item
      parent.children = parent.children || []
      parent.children.push(item)
    }

    if (item.type === 'folder') {
      stack.push({ item, level })
    }
  }

  return items
} 