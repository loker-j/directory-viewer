import { UploadZone } from '@/components/upload-zone'

export default function Home() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto text-center">
        <h1 className="text-4xl font-bold mb-4">
          在线目录结构展示工具
        </h1>
        <p className="text-lg text-muted-foreground mb-8">
          上传目录文件，生成可分享的在线目录结构
        </p>
        <UploadZone />
      </div>
    </div>
  )
}
