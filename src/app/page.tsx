import { UploadZone } from '@/components/upload-zone'

export default function Home() {
  return (
    <main className="container mx-auto p-4 space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold">目录结构查看器</h1>
        <p className="text-sm text-muted-foreground">
          快速查看和分析文件夹的目录结构
        </p>
      </div>

      <div className="max-w-2xl mx-auto space-y-6">
        <UploadZone />

        <div className="text-center space-y-4">
          <h2 className="text-lg font-semibold">使用方法</h2>
          <ol className="list-decimal space-y-2 text-sm text-muted-foreground inline-block text-left">
            <li>打开百度网盘网页版，找到要分析的文件夹</li>
            <li>右键点击文件夹，选择"生成目录文件.txt"</li>
            <li>将生成的 txt 文件上传到本网站</li>
            <li>等待处理完成后即可查看目录结构</li>
          </ol>
        </div>

        <footer className="text-center text-sm text-muted-foreground">
          <p>式钦出品</p>
        </footer>
      </div>
    </main>
  )
}
