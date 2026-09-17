CREATE TABLE "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" text DEFAULT 'info' NOT NULL,
	"title" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"url" text DEFAULT '' NOT NULL,
	"actor_id" text,
	"actor_name" text DEFAULT '' NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "assignee_id" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "assignee_name" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notifications_user_read_idx" ON "notifications" USING btree ("user_id","read_at");--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tasks_assignee_idx" ON "tasks" USING btree ("assignee_id");