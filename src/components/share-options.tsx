import { useState } from 'react'
import { Button } from '@/components/ui/button'
import QRCode from 'qrcode'
import { Check, Copy, QrCode } from 'lucide-react'

interface ShareOptionsProps {
  url: string
  projectName: string
}

export function ShareOptions({ url, projectName }: ShareOptionsProps) {
  const [copied, setCopied] = useState(false)

  const handleCopyClick = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('复制失败:', err)
    }
  }

  const handleDownloadQR = async () => {
    try {
      const dataUrl = await QRCode.toDataURL(url, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      })
      
      const link = document.createElement('a')
      link.href = dataUrl
      link.download = `${projectName}-目录分享二维码.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (err) {
      console.error('生成二维码失败:', err)
    }
  }

  return (
    <div className="flex flex-col sm:flex-row items-center gap-4 justify-center mt-2 mb-6">
      <div className="relative flex items-center w-full max-w-xl">
        <input
          type="text"
          value={url}
          readOnly
          className="w-full px-3 py-2 border rounded-lg bg-background text-sm pr-24"
        />
        <Button
          variant="ghost"
          size="sm"
          className="absolute right-0 h-full px-3 gap-2"
          onClick={handleCopyClick}
        >
          {copied ? (
            <>
              <Check className="h-4 w-4" />
              <span>已复制</span>
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" />
              <span>复制链接</span>
            </>
          )}
        </Button>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={handleDownloadQR}
        className="whitespace-nowrap gap-2"
      >
        <QrCode className="h-4 w-4" />
        <span>下载二维码</span>
      </Button>
    </div>
  )
} 