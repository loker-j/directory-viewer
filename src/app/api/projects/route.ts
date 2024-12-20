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
      parentId: null, // 先设置为 null，后面更新
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
    // 使用事务和批量插入来提高性能
    return await prisma.$transaction(async (tx) => {
      // 每次批量插入1000条记录
      const BATCH_SIZE = 1000
      for (let i = 0; i < itemsToCreate.length; i += BATCH_SIZE) {
        const batch = itemsToCreate.slice(i, i + BATCH_SIZE)
        await tx.item.createMany({
          data: batch
        })
      }

      // 获取所有创建的记录
      const createdItems = await tx.item.findMany({
        where: { projectId },
        orderBy: { order: 'asc' }
      })

      // 更新父子关系
      const itemMap = new Map(createdItems.map(item => [item.order, item]))
      const updates: { where: { id: string }, data: { parentId: string } }[] = []

      // 根据 parentChildMap 更新父子关系
      for (const [parentOrder, childrenOrders] of parentChildMap.entries()) {
        const parentItem = itemMap.get(parentOrder)
        if (parentItem) {
          for (const childOrder of childrenOrders) {
            const childItem = itemMap.get(childOrder)
            if (childItem) {
              updates.push({
                where: { id: childItem.id },
                data: { parentId: parentItem.id }
              })
            }
          }
        }
      }

      // 批量更新父子关系
      if (updates.length > 0) {
        for (let i = 0; i < updates.length; i += BATCH_SIZE) {
          const batch = updates.slice(i, i + BATCH_SIZE)
          await Promise.all(
            batch.map(update =>
              tx.item.update(update)
            )
          )
        }
      }

      // 返回更新后的记录
      return await tx.item.findMany({
        where: { projectId },
        orderBy: { order: 'asc' }
      })
    })
  } catch (error) {
    console.error('批量处理项目时出错:', error)
    throw error
  }
}

export async function POST(req: Request) {
  console.log('接收到 POST 请求')
  try {
    const formData = await req.formData()
    const name = formData.get('name') as string
    const structureStr = formData.get('structure') as string
    
    if (!name || !structureStr) {
      console.log('缺少必要参数')
      return NextResponse.json({ 
        message: '缺少必要的参数'
      }, { status: 400 })
    }

    let structure: DirectoryItem[]
    try {
      structure = JSON.parse(structureStr)
    } catch (error) {
      console.error('解析结构数据失败:', error)
      return NextResponse.json({ 
        message: '无效的目录结构数据'
      }, { status: 400 })
    }

    // 创建项目
    const project = await prisma.project.create({
      data: {
        name,
        updatedAt: new Date(),
      }
    })

    // 处理目录项
    const items = await processItems(structure, project.id)

    const result = {
      ...project,
      items
    }

    console.log('项目创建成功:', result)
    return NextResponse.json(result)
  } catch (error) {
    console.error('处理请求时出错:', error)
    
    return NextResponse.json({ 
      message: '创建项目失败',
      error: error instanceof Error ? error.message : '未知错误'
    }, { status: 500 })
  }
}