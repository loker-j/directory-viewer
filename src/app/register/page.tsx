'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function RegisterPage() {
  const router = useRouter()
  const [error, setError] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsLoading(true)
    setError('')

    const formData = new FormData(event.currentTarget)
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const confirmPassword = formData.get('confirmPassword') as string

    if (password !== confirmPassword) {
      setError('两次输入的密码不一致')
      setIsLoading(false)
      return
    }

    try {
      console.log('发送注册请求:', { email })
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      let data
      try {
        const text = await response.text()
        data = text ? JSON.parse(text) : {}
      } catch (e) {
        console.error('解析响应失败:', e)
        throw new Error('服务器响应格式错误')
      }

      if (!response.ok) {
        throw new Error(data.message || '注册失败')
      }

      console.log('注册成功:', data)
      router.push('/login')
    } catch (error) {
      console.error('注册错误:', error)
      setError(error instanceof Error ? error.message : '注册时发生错误')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="container flex h-screen w-screen flex-col items-center justify-center">
      <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
        <div className="flex flex-col space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">注册账号</h1>
          <p className="text-sm text-muted-foreground">
            创建一个新账号开始使用
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Input
              name="email"
              type="email"
              placeholder="name@example.com"
              required
            />
          </div>
          <div className="space-y-2">
            <Input
              name="password"
              type="password"
              placeholder="密码（至少6个字符）"
              required
              minLength={6}
            />
          </div>
          <div className="space-y-2">
            <Input
              name="confirmPassword"
              type="password"
              placeholder="确认密码"
              required
              minLength={6}
            />
          </div>

          {error && (
            <div className="text-sm text-red-500">
              {error}
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? '注册中...' : '注册'}
          </Button>
        </form>

        <div className="text-center text-sm">
          已有账号？{' '}
          <Link
            href="/login"
            className="underline hover:text-primary"
          >
            立即登录
          </Link>
        </div>
      </div>
    </div>
  )
} 