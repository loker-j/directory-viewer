import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export { prisma }

export async function getProject(id: string) {
  return prisma.project.findUnique({
    where: { id },
    include: {
      items: {
        orderBy: {
          order: 'asc',
        },
      },
    },
  })
}

export async function createDirectoryStructure(
  projectId: string,
  items: any[]
) {
  return prisma.$transaction(
    items.map((item) =>
      prisma.project.update({
        where: { id: projectId },
        data: {
          items: {
            create: item
          }
        }
      })
    )
  )
}

export async function getSharedProject(token: string) {
  return prisma.project.findUnique({
    where: { shareToken: token },
    include: {
      items: {
        orderBy: {
          order: 'asc',
        },
      },
    },
  })
} 