import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

interface DirectoryItem {
  name: string
  type: string
  level: number
  children?: DirectoryItem[]
}

interface CreateItem {
  name: string
  type: string
  level: number
  order: number
  parentId: string | null
  projectId: string
}

async function processItems(items: DirectoryItem[], projectId: string) {
  console.log('开始处理目录项，项目ID:', projectId)
  
  let order = 0
  const itemsToCreate: CreateItem[] = []

  // 扁平化处理所有项目
  function flattenItems(item: DirectoryItem) {
    const currentOrder = order++
    itemsToCreate.push({
      name: item.name,
      type: item.type,
      level: item.level,
      order: currentOrder,
      parentId: null,
      projectId: projectId
    })

    if (item.children?.length) {
      for (const child of item.children) {
        flattenItems(child)
      }
    }
  }

  // 处理所有项目
  for (const item of items) {
    flattenItems(item)
  }

  try {
    console.log('开始批量创建记录...')
    
    // 使用更大的批次大小来减少数据库��作次数
    const BATCH_SIZE = 5000
    const chunks: CreateItem[][] = []
    
    // 预先分块
    for (let i = 0; i < itemsToCreate.length; i += BATCH_SIZE) {
      chunks.push(itemsToCreate.slice(i, i + BATCH_SIZE))
    }

    // 串行处理每个块，避免数据库连接过载
    console.log(`分成 ${chunks.length} 个批次处理...`)
    const createdItems: Array<{
      id: string
      order: number
      level: number
      type: string
    }> = []
    
    for (let i = 0; i < chunks.length; i++) {
      console.log(`处理第 ${i + 1}/${chunks.length} 批`)
      await prisma.item.createMany({
        data: chunks[i],
        skipDuplicates: true
      })
      
      // 获取这批次创建的记录
      const batchItems = await prisma.item.findMany({
        where: {
          projectId,
          order: {
            in: chunks[i].map(item => item.order)
          }
        },
        select: {
          id: true,
          order: true,
          level: true,
          type: true
        }
      })
      createdItems.push(...batchItems)
    }

    // 按 order 排序所有项目
    createdItems.sort((a, b) => a.order - b.order)

    // 更新父子关系
    const updates: { id: string, parentId: string }[] = []
    
    for (let i = 0; i < createdItems.length; i++) {
      const current = createdItems[i]
      if (current.level === 0) continue // 根级别项目不需要父项

      // 向前查找第一个 level 比当前小的项目作为父项
      for (let j = i - 1; j >= 0; j--) {
        const potential = createdItems[j]
        if (potential.level < current.level && potential.type === 'folder') {
          updates.push({
            id: current.id,
            parentId: potential.id
          })
          break
        }
      }
    }

    // 分批执行更新
    if (updates.length > 0) {
      const UPDATE_BATCH_SIZE = 1000
      for (let i = 0; i < updates.length; i += UPDATE_BATCH_SIZE) {
        const chunk = updates.slice(i, i + UPDATE_BATCH_SIZE)
        const values = chunk.map(update => `('${update.id}', '${update.parentId}')`).join(',')
        const sql = `
          UPDATE directory_items AS t
          SET parent_id = c.parent_id
          FROM (VALUES ${values}) AS c(id, parent_id)
          WHERE t.id = c.id;
        `
        await prisma.$executeRawUnsafe(sql)
      }
    }

    // 返回最终结果
    console.log('获取最终结果...')
    return await prisma.item.findMany({
      where: { projectId },
      orderBy: { order: 'asc' }
    })

  } catch (error: any) {
    console.error('批量处理项目时出错:', error)
    throw error
  }
}

export async function POST(req: Request) {
  console.log('接收到 POST 请求')
  try {
    console.log('开始解析请求数据...')
    const formData = await req.formData()
    const name = formData.get('name') as string
    const structureStr = formData.get('structure') as string
    const projectId = formData.get('projectId') as string
    const isLastBatch = formData.get('isLastBatch') === 'true'
    const totalItems = parseInt(formData.get('totalItems') as string || '0')
    
    console.log('请求参数:', {
      name,
      structureLength: structureStr?.length,
      projectId,
      isLastBatch,
      totalItems
    })
    
    if (!structureStr) {
      console.log('缺少必要参数')
      return NextResponse.json({ 
        message: '缺少必要的参数'
      }, { status: 400 })
    }

    let structure: DirectoryItem[]
    try {
      console.log('解析目录结构数据...')
      structure = JSON.parse(structureStr)
      console.log('目录结构解析成功')
    } catch (error) {
      console.error('解析结构数据失败:', error)
      return NextResponse.json({ 
        message: '无效的目录结构数据'
      }, { status: 400 })
    }

    let project
    if (!projectId) {
      // 首次请求，创建新项目
      if (!name) {
        return NextResponse.json({ 
          message: '缺少项目名称'
        }, { status: 400 })
      }
      
      console.log('开始创建项目...')
      project = await prisma.project.create({
        data: {
          name,
          updatedAt: new Date(),
        }
      })
      console.log('项目创建成功:', project)
    } else {
      // 后续请求，获取已存在的项目
      project = await prisma.project.findUnique({
        where: { id: projectId }
      })
      
      if (!project) {
        return NextResponse.json({ 
          message: '项目不存在'
        }, { status: 404 })
      }
    }

    // 处理目录项
    console.log('开始处理目录项...')
    const items = await processItems(structure, project.id)

    const result = {
      ...project,
      items: isLastBatch ? items : undefined // 只在最后一批返回完整的项目数据
    }

    console.log('批次处理成功')
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('处理请求时出错:', error)
    console.error('错误详情:', {
      name: error.name,
      message: error.message,
      code: error.code,
      stack: error.stack
    })
    
    return NextResponse.json({ 
      message: '创建项目失败',
      error: error instanceof Error ? error.message : '未知错误'
    }, { status: 500 })
  }
}