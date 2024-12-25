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
  console.log('输入项目数量:', items.length)
  
  const itemsToCreate: CreateItem[] = []
  const parentChildMap = new Map<string, string>() // 使用临时ID记录父子关系
  let tempId = 0

  // 扁平化处理所有项目
  function flattenItems(item: DirectoryItem, parentTempId: string | null = null) {
    const currentTempId = `temp_${tempId++}`
    
    itemsToCreate.push({
      name: item.name,
      type: item.type,
      level: item.level,
      order: tempId - 1,
      parentId: null,
      projectId: projectId
    })

    if (parentTempId !== null) {
      parentChildMap.set(currentTempId, parentTempId)
    }

    if (item.children?.length) {
      for (const child of item.children) {
        flattenItems(child, currentTempId)
      }
    }
  }

  // 处理所有项目
  for (const item of items) {
    flattenItems(item)
  }
  console.log('扁平化后的项目数量:', itemsToCreate.length)

  try {
    // 分批处理，每批100个
    const BATCH_SIZE = 100
    const batches: CreateItem[][] = []
    for (let i = 0; i < itemsToCreate.length; i += BATCH_SIZE) {
      batches.push(itemsToCreate.slice(i, i + BATCH_SIZE))
    }
    console.log(`分成 ${batches.length} 个批次处理...`)

    const createdItems: Array<{ id: string, order: number }> = []
    
    // 串行处理每个批次
    for (let i = 0; i < batches.length; i++) {
      console.log(`处理第 ${i + 1}/${batches.length} 批`)
      // 创建记录
      await prisma.item.createMany({
        data: batches[i],
        skipDuplicates: true
      })

      // 获取这批次创建的记录
      const batchItems = await prisma.item.findMany({
        where: {
          projectId,
          order: {
            in: batches[i].map(item => item.order)
          }
        },
        select: {
          id: true,
          order: true
        }
      })
      createdItems.push(...batchItems)
    }

    // 构建 order 到 id 的映射
    const orderToId = new Map(createdItems.map(item => [item.order, item.id]))
    const tempIdToId = new Map<string, string>()

    // 构建临时ID到实际ID的映射
    itemsToCreate.forEach((item, index) => {
      const id = orderToId.get(item.order)
      if (id) {
        tempIdToId.set(`temp_${index}`, id)
      }
    })

    // 更新父子关系
    const updates: { id: string, parentId: string }[] = []
    
    for (const [childTempId, parentTempId] of parentChildMap.entries()) {
      const childId = tempIdToId.get(childTempId)
      const parentId = tempIdToId.get(parentTempId)
      
      if (childId && parentId) {
        updates.push({
          id: childId,
          parentId: parentId
        })
      }
    }
    console.log('需要更新父子关系的数量:', updates.length)

    // 分批执行更新
    const UPDATE_BATCH_SIZE = 100
    for (let i = 0; i < updates.length; i += UPDATE_BATCH_SIZE) {
      const batch = updates.slice(i, i + UPDATE_BATCH_SIZE)
      const values = batch.map(update => `('${update.id}', '${update.parentId}')`).join(',')
      const sql = `
        UPDATE directory_items AS t
        SET parent_id = c.parent_id
        FROM (VALUES ${values}) AS c(id, parent_id)
        WHERE t.id = c.id;
      `
      await prisma.$executeRawUnsafe(sql)
    }
    console.log('父子关系更新完成')

    // 返回处理结果
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
    const batchNumber = parseInt(formData.get('batchNumber') as string || '1')
    const totalBatches = parseInt(formData.get('totalBatches') as string || '1')
    
    console.log('请求参数:', {
      name,
      structureLength: structureStr?.length,
      projectId,
      isLastBatch,
      totalItems,
      batchNumber,
      totalBatches
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
      console.log('目��结构解析成功')
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
    console.log(`开始处理第 ${batchNumber}/${totalBatches} 批目录项...`)
    const items = await processItems(structure, project.id)

    const result = {
      ...project,
      items: isLastBatch ? items : undefined // 只在最后一批返回完整的项目数据
    }

    console.log(`第 ${batchNumber}/${totalBatches} 批处理成功`)
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