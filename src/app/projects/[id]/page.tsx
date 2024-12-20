import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import { DirectoryTree } from '@/components/directory-tree'

export default async function ProjectPage({
  params: { id },
}: {
  params: { id: string }
}) {
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      items: {
        orderBy: { order: 'asc' },
      },
    },
  })

  if (!project) {
    notFound()
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">{project.name}</h1>
      <DirectoryTree items={project.items} />
    </div>
  )
} 