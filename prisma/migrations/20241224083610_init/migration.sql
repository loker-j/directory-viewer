-- CreateTable
CREATE TABLE "directory_projects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shareToken" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "directory_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "directory_items" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'file',
    "level" INTEGER NOT NULL,
    "parent_id" TEXT,
    "order" INTEGER NOT NULL,
    "project_id" TEXT NOT NULL,

    CONSTRAINT "directory_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "directory_projects_shareToken_key" ON "directory_projects"("shareToken");

-- AddForeignKey
ALTER TABLE "directory_items" ADD CONSTRAINT "directory_items_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "directory_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "directory_items" ADD CONSTRAINT "directory_items_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "directory_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
