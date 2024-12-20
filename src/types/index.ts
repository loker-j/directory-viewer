export interface User {
  id: string
  email: string
  createdAt: Date
}

export interface Project {
  id: string
  userId: string
  name: string
  createdAt: Date
  updatedAt: Date
  shareToken?: string
  expireAt?: Date
  isPasswordProtected: boolean
  password?: string
}

export interface DirectoryItem {
  id: string
  projectId: string
  parentId?: string
  name: string
  type: 'file' | 'folder'
  level: number
  size?: number
  modifiedAt?: Date
  order: number
  children?: DirectoryItem[]
} 