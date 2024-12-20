-- CreateTable
CREATE TABLE "directory_projects" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "share_token" TEXT,
    "expire_at" DATETIME
);

-- CreateTable
CREATE TABLE "directory_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "project_id" TEXT NOT NULL,
    "parent_id" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'file',
    "level" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    CONSTRAINT "directory_items_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "directory_projects" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "directory_items_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "directory_items" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "directory_projects_share_token_key" ON "directory_projects"("share_token");
