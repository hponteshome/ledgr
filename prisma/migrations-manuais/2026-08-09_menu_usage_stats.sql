CREATE TABLE IF NOT EXISTS "menu_usage_stats" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "path" VARCHAR(160) NOT NULL,
    "label" VARCHAR(100),
    "module_label" VARCHAR(100),
    "hit_count" INTEGER NOT NULL DEFAULT 0,
    "last_used_at" TIMESTAMP(6) NOT NULL DEFAULT now(),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT now(),

    CONSTRAINT "menu_usage_stats_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "menu_usage_stats_path_key" ON "menu_usage_stats"("path");
