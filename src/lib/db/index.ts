import { PrismaClient } from '@prisma/client'

declare global {
  var prisma: PrismaClient | undefined
}

const validateDatabaseUrl = (url: string | undefined) => {
  if (!url) {
    throw new Error('DATABASE_URL is not defined')
  }
  if (!url.startsWith('postgresql://') && !url.startsWith('postgres://')) {
    throw new Error('DATABASE_URL must start with postgresql:// or postgres://')
  }
  return url
}

const prismaClientSingleton = () => {
  console.log('初始化 Prisma 客户端...')
  const databaseUrl = validateDatabaseUrl(process.env.DATABASE_URL)
  console.log('DATABASE_URL:', databaseUrl)
  
  return new PrismaClient({
    log: ['query', 'error', 'warn'],
    datasources: {
      db: {
        url: databaseUrl
      }
    }
  })
}

const prisma = global.prisma ?? prismaClientSingleton()

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma
}

export { prisma }