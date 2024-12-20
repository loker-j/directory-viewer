import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

const registerSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址'),
  password: z.string().min(6, '密码至少需要6个字符'),
})

export async function POST(req: Request) {
  try {
    // 测试数据库连接
    await prisma.$connect()
    console.log('数据库连接成功')

    // 解析请求体
    const body = await req.json()
    console.log('收到注册请求:', { email: body.email })

    // 验证数据
    const { email, password } = registerSchema.parse(body)
    console.log('数据验证通过')

    try {
      // 检查用户是否存在
      const existingUser = await prisma.user.findUnique({
        where: { email },
      })
      console.log('检查用户是否存在:', { exists: !!existingUser })

      if (existingUser) {
        return new Response(
          JSON.stringify({ message: '该邮箱已被注册' }),
          {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
            },
          }
        )
      }

      // 创建新用户
      const hashedPassword = await bcrypt.hash(password, 10)
      console.log('密码加密完成')

      const user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
        },
      })
      console.log('用户创建成功:', { userId: user.id })

      return new Response(
        JSON.stringify({
          success: true,
          message: '注册成功',
          userId: user.id,
        }),
        {
          status: 201,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    } catch (dbError) {
      console.error('数据库操作错误:', dbError)
      throw dbError
    }
  } catch (error) {
    console.error('注册过程中发生错误:', error)
    
    if (error instanceof z.ZodError) {
      return new Response(
        JSON.stringify({
          success: false,
          message: error.errors[0].message,
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    }

    // 检查是否是 Prisma 错误
    if (error instanceof Error) {
      console.error('错误类型:', error.constructor.name)
      console.error('错误详情:', error.message)
      console.error('错误堆栈:', error.stack)
    }

    return new Response(
      JSON.stringify({
        success: false,
        message: '注册失败，请稍后重试',
        error: error instanceof Error ? error.message : '未知错误',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )
  } finally {
    await prisma.$disconnect()
  }
} 