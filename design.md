# 项目设计文档

## 目录结构 
/
├── README.md # 项目说明文档
├── package.json # 项目依赖配置
├── package-lock.json # 依赖版本锁定文件
├── next.config.ts # Next.js 配置文件
├── public/ # 静态资源目录
├── src/ # 源代码目录
│ ├── app/ # Next.js 13+ App Router 目录
│ ├── components/ # React 组件
│ ├── lib/ # 工具函数库
│ └── types/ # TypeScript 类型定义
└── design.md # 本设计文档

## 技术栈

- **框架**: Next.js (App Router)
- **语言**: TypeScript
- **样式**: Tailwind CSS
- **包管理**: npm/yarn

## 技术要点

### 1. Next.js App Router
- 使用 Next.js 13+ 的 App Router 架构
- 支持服务端组件（Server Components）
- 支持流式渲染（Streaming）
- 内置路由系统

### 2. TypeScript 集成
- 严格的类型检查
- 类型定义文件管理
- 接口类型定义

### 3. 样式解决方案
- Tailwind CSS 工具类
- CSS Modules 支持
- 响应式设计

### 4. 性能优化
- 图片优化
- 代码分割
- 静态生成
- 增量静态再生成（ISR）

### 5. 开发工具
- ESLint 代码检查
- Prettier 代码格式化
- Husky Git Hooks

## 注意事项
- 确保遵循 Next.js 最佳实践
- 保持组件的可复用性
- 注重代码质量和性能优化
- 维护良好的文档

## 功能需求
### 1. 目录文件上传与解析
 支持特定格式的 .txt 文件上传
 文件格式规范：
 - 使用缩进或特殊符号表示层级关系
 - 支持文件夹和文件的区分
 - 支持文件大小和修改日期等元数据（可选）
### 2. 目录可视化展示
 树形结构展示
 支持文件夹的展开/折叠
 支持搜索和过滤功能
 响应式布局，适配移动端
 支持深色/浅色主题切换
### 3. 分享功能
 生成唯一的分享链接
 设置分享链接的有效期
 可选密码保护
 支持生成二维码便于移动端访问
### 4. 用户系统
 用户注册和登录
 历史记录管理
 已分享目录的管理（查看、删除、更新）
 访问统计和分析
## 技术实现
### 1. 数据库设计
sql
// 用户表
users {
id: string
email: string
password: string
created_at: timestamp
}
// 目录项目表
directory_projects {
id: string
user_id: string
name: string
created_at: timestamp
updated_at: timestamp
share_token: string
expire_at: timestamp
is_password_protected: boolean
password: string?
}
// 目录结构表
directory_items {
id: string
project_id: string
parent_id: string?
name: string
type: enum('file', 'folder')
level: number
size: number?
modified_at: timestamp?
order: number
}
### 2. API 设计
typescript
interface API {
// 文件上传相关
POST /api/upload
POST /api/parse-directory
// 目录管理
GET /api/projects
GET /api/projects/:id
PUT /api/projects/:id
DELETE /api/projects/:id
// 分享相关
POST /api/share/:projectId
GET /api/shared/:token
PUT /api/shared/:token/password
}

### 3. 性能考虑
- 大文件解析时使用 Web Workers
- 使用虚拟滚动处理大量目录项
- 目录结构缓存
- CDN 加速静态资源

### 4. 安全考虑
- 文件上传大小限制
- 文件类型验证
- 分享链接的访问控制
- 防止恶意解析攻击

## 部署架构
- 使用 Vercel 部署前端应用
- 使用 PostgreSQL 或 MongoDB 存储数据
- 文件解析服务可选择独立部署
- 考虑使用 Redis 做缓存层

## 后续优化方向
- 支持更多文件格式的导入
- 添加目录结构对比功能
- 支持导出为其他格式
- 添加协作功能
- 提供 API 接口供第三方调用