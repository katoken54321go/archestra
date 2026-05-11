ALTER TABLE "agents" ADD COLUMN "deleted_at" timestamp;
ALTER TABLE "conversations" ADD COLUMN "deleted_at" timestamp;
ALTER TABLE "knowledge_bases" ADD COLUMN "deleted_at" timestamp;
ALTER TABLE "knowledge_base_connectors" ADD COLUMN "deleted_at" timestamp;
ALTER TABLE "limits" ADD COLUMN "deleted_at" timestamp;
ALTER TABLE "mcp_server_installation_request" ADD COLUMN "deleted_at" timestamp;
ALTER TABLE "optimization_rules" ADD COLUMN "deleted_at" timestamp;
ALTER TABLE "schedule_triggers" ADD COLUMN "deleted_at" timestamp with time zone;
ALTER TABLE "team" ADD COLUMN "deleted_at" timestamp;

DROP INDEX "agents_slug_idx";
CREATE UNIQUE INDEX "agents_slug_idx" ON "agents" USING btree ("slug") WHERE "agents"."slug" IS NOT NULL AND "agents"."deleted_at" IS NULL;

DROP INDEX "agents_personal_gateway_per_member_idx";
CREATE UNIQUE INDEX "agents_personal_gateway_per_member_idx" ON "agents" USING btree ("organization_id", "author_id") WHERE "agents"."agent_type" = 'mcp_gateway' AND "agents"."is_personal_gateway" = true AND "agents"."deleted_at" IS NULL;
