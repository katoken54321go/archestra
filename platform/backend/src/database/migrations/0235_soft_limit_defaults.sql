ALTER TABLE "limits" ADD COLUMN "organization_id" text;--> statement-breakpoint
ALTER TABLE "limits" ADD COLUMN "cleanup_interval" varchar;--> statement-breakpoint
ALTER TABLE "limits" ADD COLUMN "is_default_user_limit" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "default_user_limit_value" integer;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "default_user_limit_model" jsonb;--> statement-breakpoint
ALTER TABLE "limits" ADD CONSTRAINT "limits_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "limits_organization_idx" ON "limits" USING btree ("organization_id");
