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
  const parentChildMap = new Map<number, number[]>()

  function processItem(item: DirectoryItem, parentOrder: number | null = null) {
    const currentOrder = order
    itemsToCreate.push({
      name: item.name,
      type: item.type,
      level: item.level,
      order: currentOrder,
      parentId: null,
      projectId: projectId
    })

    if (item.children?.length) {
      const childrenOrders: number[] = []
      order++
      
      for (const child of item.children) {
        childrenOrders.push(order)
        processItem(child, currentOrder)
      }
      
      if (childrenOrders.length > 0) {
        parentChildMap.set(currentOrder, childrenOrders)
      }
    } else {
      order++
    }
  }

  // 处理所有项目
  for (const item of items) {
    processItem(item)
  }

  try {
    console.log('开始批量创建记录...')
    
    // 使用更大的批次大小来减少数据库操作次数
    const BATCH_SIZE = 2000
    const chunks: CreateItem[][] = []
    
    // 预先分块
    for (let i = 0; i < itemsToCreate.length; i += BATCH_SIZE) {
      chunks.push(itemsToCreate.slice(i, i + BATCH_SIZE))
    }
    
    // 并行处理每个块
    console.log(`分成 ${chunks.length} 个批次处理...`)
    await Promise.all(
      chunks.map(async (chunk, index) => {
        console.log(`处理第 ${index + 1}/${chunks.length} 批`)
        await prisma.item.createMany({
          data: chunk,
          skipDuplicates: true // 跳过重复记录
        })
      })
    )

    // 获取创建的记录，使用游标分页来处理大量数据
    console.log('获取已创建的记录...')
    const createdItems = await prisma.item.findMany({
      where: { projectId },
      orderBy: { order: 'asc' },
      take: itemsToCreate.length // 限制返回数量
    })
    console.log('成功获取记录，数量:', createdItems.length)

    // 构建更新数据
    console.log('构建父子关系更新数据...')
    const itemMap = new Map(createdItems.map(item => [item.order, item]))
    const updates: { id: string, parentId: string }[] = []

    for (const [parentOrder, childrenOrders] of parentChildMap.entries()) {
      const parentItem = itemMap.get(parentOrder)
      if (parentItem) {
        for (const childOrder of childrenOrders) {
          const childItem = itemMap.get(childOrder)
          if (childItem) {
            updates.push({
              id: childItem.id,
              parentId: parentItem.id
            })
          }
        }
      }
    }

    // 使用事务批量更新父子关系
    if (updates.length > 0) {
      console.log('开始更新父子关系...')
      const UPDATE_BATCH_SIZE = 500 // 增加批次大小
      const updateChunks: typeof updates[] = []
      
      for (let i = 0; i < updates.length; i += UPDATE_BATCH_SIZE) {
        updateChunks.push(updates.slice(i, i + UPDATE_BATCH_SIZE))
      }

      // 串行处理更新批次
      for (let i = 0; i < updateChunks.length; i++) {
        const chunk = updateChunks[i]
        console.log(`更新第 ${i + 1}/${updateChunks.length} 批父子关系`)
        
        // 构建批量更新 SQL
        const values = chunk.map(update => `('${update.id}', '${update.parentId}')`).join(',')
        const sql = `
          UPDATE directory_items AS t
          SET parent_id = c.parent_id
          FROM (VALUES ${values}) AS c(id, parent_id)
          WHERE t.id = c.id;
        `
        
        // 添加重试机制
        let retryCount = 0
        const maxRetries = 3
        
        while (retryCount < maxRetries) {
          try {
            await prisma.$executeRawUnsafe(sql)
            break // 如果成功，跳出重试循环
          } catch (error: any) {
            retryCount++
            console.log(`第 ${i + 1} 批更新失败，尝试第 ${retryCount} 次重试...`)
            
            if (retryCount === maxRetries) {
              throw error // 如果达到最大重试次数，抛出错误
            }
            
            // 等待一段时间后重试
            await new Promise(resolve => setTimeout(resolve, 1000 * retryCount))
          }
        }
        
        // 每批次处理完后等待一小段时间
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    // 返回最终结果
    console.log('获取最终结果...')
    return await prisma.item.findMany({
      where: { projectId },
      orderBy: { order: 'asc' },
      take: itemsToCreate.length
    })

  } catch (error: any) {
    console.error('批量处理项目时出错:', error)
    console.error('错误详情:', {
      name: error.name,
      message: error.message,
      code: error.code,
      stack: error.stack
    })
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
    
    console.log('请求参数:', {
      name,
      structureLength: structureStr?.length
    })
    
    if (!name || !structureStr) {
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

    // 创建项目
    console.log('开始创建项目...')
    const project = await prisma.project.create({
      data: {
        name,
        updatedAt: new Date(),
      }
    })
    console.log('项目创建成功:', project)

    // 处理目录项
    console.log('开始处理目录项...')
    const items = await processItems(structure, project.id)

    const result = {
      ...project,
      items
    }

    console.log('项目创建成功，返回结果')
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