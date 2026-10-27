CREATE TYPE "public"."account_connection" AS ENUM('sample', 'plaid', 'csv', 'manual');--> statement-breakpoint
CREATE TYPE "public"."connection_status" AS ENUM('active', 'login_required', 'pending_expiration', 'error');--> statement-breakpoint
CREATE TYPE "public"."reward_category" AS ENUM('dining', 'groceries', 'gas', 'travel', 'transit', 'streaming', 'online_shopping', 'drugstores', 'entertainment', 'utilities', 'software', 'other');--> statement-breakpoint
CREATE TYPE "public"."reward_type" AS ENUM('cashback', 'points', 'miles');--> statement-breakpoint
ALTER TYPE "public"."transaction_source" ADD VALUE 'csv' BEFORE 'other';--> statement-breakpoint
CREATE TABLE "credit_card_profiles" (
	"account_id" text PRIMARY KEY NOT NULL,
	"preset" text,
	"credit_limit_cents" bigint,
	"apr_basis_points" integer,
	"annual_fee_cents" bigint DEFAULT 0 NOT NULL,
	"statement_day" integer,
	"due_day" integer,
	"reward_type" "reward_type" NOT NULL,
	"point_value_hundredths_of_cent" integer NOT NULL,
	"base_rate_basis_points" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_card_reward_rates" (
	"account_id" text NOT NULL,
	"category" "reward_category" NOT NULL,
	"rate_basis_points" integer NOT NULL,
	"annual_cap_cents" bigint,
	CONSTRAINT "credit_card_reward_rates_account_id_category_pk" PRIMARY KEY("account_id","category")
);
--> statement-breakpoint
CREATE TABLE "plaid_items" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"workspace_id" text NOT NULL,
	"plaid_item_id" text NOT NULL,
	"access_token_encrypted" text NOT NULL,
	"institution_name" text NOT NULL,
	"status" "connection_status" DEFAULT 'active' NOT NULL,
	"error_code" text,
	"cursor" text,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "connection" "account_connection" DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "plaid_item_id" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "plaid_account_id" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "external_id" text;--> statement-breakpoint
ALTER TABLE "credit_card_profiles" ADD CONSTRAINT "credit_card_profiles_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_card_reward_rates" ADD CONSTRAINT "credit_card_reward_rates_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plaid_items" ADD CONSTRAINT "plaid_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plaid_items" ADD CONSTRAINT "plaid_items_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "plaid_items_plaid_item_idx" ON "plaid_items" USING btree ("plaid_item_id");--> statement-breakpoint
CREATE INDEX "plaid_items_user_idx" ON "plaid_items" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_plaid_item_id_plaid_items_id_fk" FOREIGN KEY ("plaid_item_id") REFERENCES "public"."plaid_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_plaid_account_idx" ON "accounts" USING btree ("plaid_account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "transactions_account_external_idx" ON "transactions" USING btree ("account_id","external_id");