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
    
    // 直接创建所有记录（因为每个请求的数据量已经很小了）
    const createdItems = await prisma.item.createMany({
      data: itemsToCreate,
      skipDuplicates: true
    })

    // 获取创建的记录
    const items = await prisma.item.findMany({
      where: {
        projectId,
        order: {
          in: itemsToCreate.map(item => item.order)
        }
      },
      select: {
        id: true,
        order: true,
        level: true,
        type: true
      },
      orderBy: {
        order: 'asc'
      }
    })

    // 更新父子关系
    const updates: { id: string, parentId: string }[] = []
    
    for (let i = 0; i < items.length; i++) {
      const current = items[i]
      if (current.level === 0) continue

      // 向前查找第一个 level 比当前小的文件夹作为父项
      for (let j = i - 1; j >= 0; j--) {
        const potential = items[j]
        if (potential.level < current.level && potential.type === 'folder') {
          updates.push({
            id: current.id,
            parentId: potential.id
          })
          break
        }
      }
    }

    // 执行更新
    if (updates.length > 0) {
      const values = updates.map(update => `('${update.id}', '${update.parentId}')`).join(',')
      const sql = `
        UPDATE directory_items AS t
        SET parent_id = c.parent_id
        FROM (VALUES ${values}) AS c(id, parent_id)
        WHERE t.id = c.id;
      `
      await prisma.$executeRawUnsafe(sql)
    }

    // 返回处理结果
    return items
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