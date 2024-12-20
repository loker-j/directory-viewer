import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // 清理现有数据
  await prisma.item.deleteMany()
  await prisma.project.deleteMany()

  // 创建示例项目
  const project = await prisma.project.create({
    data: {
      name: '示例项目',
      updatedAt: new Date(),
    }
  })

  // 创建示例目录结构
  await prisma.item.createMany({
    data: [
      {
        projectId: project.id,
        name: '根目录',
        type: 'folder',
        level: 0,
        order: 0,
      },
      {
        projectId: project.id,
        name: '文档',
        type: 'folder',
        level: 1,
        order: 1,
      },
      {
        projectId: project.id,
        name: 'README.md',
        type: 'file',
        level: 2,
        order: 2,
      },
    ],
  })

  console.log('数据库初始化完成')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  }) 