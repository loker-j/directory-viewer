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
  console.log('输入的目录结构:', JSON.stringify(items, null, 2))
  
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

  console.log('准备创建的项目数量:', itemsToCreate.length)
  console.log('父子关系映射:', JSON.stringify(Array.from(parentChildMap.entries()), null, 2))

  try {
    // 分步骤执行，不使用事务
    console.log('开始批量创建记录...')
    // 1. 批量创建记录
    const BATCH_SIZE = 1000
    for (let i = 0; i < itemsToCreate.length; i += BATCH_SIZE) {
      const batch = itemsToCreate.slice(i, i + BATCH_SIZE)
      console.log(`创建第 ${i/BATCH_SIZE + 1} 批记录，数量:`, batch.length)
      await prisma.item.createMany({
        data: batch
      })
    }

    // 2. 获取创建的记录
    console.log('获取已创建的记录...')
    const createdItems = await prisma.item.findMany({
      where: { projectId },
      orderBy: { order: 'asc' }
    })
    console.log('成功获取记录，数量:', createdItems.length)

    // 3. 准备更新父子关系
    const itemMap = new Map(createdItems.map(item => [item.order, item]))
    const updates: { where: { id: string }, data: { parentId: string } }[] = []

    // 4. 构建更新数据
    console.log('构建父子关系更新数据...')
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
    console.log('需要更新的父子关系数量:', updates.length)

    // 5. 分批执行更新
    if (updates.length > 0) {
      console.log('开始更新父子关系...')
      const UPDATE_BATCH_SIZE = 50 // 使用更小的批次大小
      for (let i = 0; i < updates.length; i += UPDATE_BATCH_SIZE) {
        const batch = updates.slice(i, i + UPDATE_BATCH_SIZE)
        console.log(`更新第 ${i/UPDATE_BATCH_SIZE + 1} 批父子关系，数量:`, batch.length)
        await Promise.all(
          batch.map(update =>
            prisma.item.update(update)
          )
        )
      }
    }

    // 6. 返回最终结果
    console.log('获取最终结果...')
    const finalItems = await prisma.item.findMany({
      where: { projectId },
      orderBy: { order: 'asc' }
    })
    console.log('处理完成，返回项目数量:', finalItems.length)
    return finalItems

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