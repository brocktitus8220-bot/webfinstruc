CREATE TYPE "public"."account_type" AS ENUM('checking', 'savings', 'credit', 'brokerage', 'retirement');--> statement-breakpoint
CREATE TYPE "public"."accounts_mode" AS ENUM('sample', 'plaid', 'skip');--> statement-breakpoint
CREATE TYPE "public"."allocation_bucket" AS ENUM('tax', 'operating', 'ownerPay', 'savings');--> statement-breakpoint
CREATE TYPE "public"."asset_class" AS ENUM('equity', 'fixed_income', 'cash', 'fund', 'other');--> statement-breakpoint
CREATE TYPE "public"."filing_status" AS ENUM('single', 'married_joint', 'married_separate', 'head_of_household', 'qualifying_surviving_spouse');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('draft', 'sent', 'paid', 'overdue');--> statement-breakpoint
CREATE TYPE "public"."safe_harbor_method" AS ENUM('prior_year_100', 'prior_year_110', 'current_year_90');--> statement-breakpoint
CREATE TYPE "public"."transaction_kind" AS ENUM('income', 'expense', 'transfer');--> statement-breakpoint
CREATE TYPE "public"."transaction_source" AS ENUM('plaid', 'manual', 'other');--> statement-breakpoint
CREATE TYPE "public"."us_state" AS ENUM('AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY');--> statement-breakpoint
CREATE TYPE "public"."user_type" AS ENUM('freelancer', 'founder', 'creator', 'other');--> statement-breakpoint
CREATE TYPE "public"."workspace_kind" AS ENUM('business', 'personal');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"name" text NOT NULL,
	"institution" text NOT NULL,
	"type" "account_type" NOT NULL,
	"mask" text NOT NULL,
	"balance_cents" bigint DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"custodian" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "allocation_rules" (
	"user_id" text NOT NULL,
	"bucket" "allocation_bucket" NOT NULL,
	"basis_points" integer NOT NULL,
	CONSTRAINT "allocation_rules_user_id_bucket_pk" PRIMARY KEY("user_id","bucket")
);
--> statement-breakpoint
CREATE TABLE "holdings" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"symbol" text NOT NULL,
	"name" text NOT NULL,
	"asset_class" "asset_class" NOT NULL,
	"quantity_milli" bigint NOT NULL,
	"price_cents" bigint NOT NULL,
	"market_value_cents" bigint NOT NULL,
	"cost_basis_cents" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"number" text NOT NULL,
	"client" text NOT NULL,
	"issue_date" date NOT NULL,
	"due_date" date NOT NULL,
	"amount_cents" bigint NOT NULL,
	"status" "invoice_status" NOT NULL,
	"paid_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "onboarding" (
	"user_id" text PRIMARY KEY NOT NULL,
	"filing_status" "filing_status",
	"state" "us_state",
	"accounts_mode" "accounts_mode",
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "tax_settings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"tax_year" integer NOT NULL,
	"filing_status" "filing_status" NOT NULL,
	"state" "us_state" NOT NULL,
	"effective_rate_basis_points" integer NOT NULL,
	"prior_year_total_tax_cents" bigint NOT NULL,
	"prior_year_agi_cents" bigint NOT NULL,
	"safe_harbor_method" "safe_harbor_method" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"account_id" text NOT NULL,
	"date" date NOT NULL,
	"amount_cents" bigint NOT NULL,
	"kind" "transaction_kind" NOT NULL,
	"description" text NOT NULL,
	"counterparty" text,
	"category" text NOT NULL,
	"source" "transaction_source" NOT NULL,
	"pending" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"user_type" "user_type",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"kind" "workspace_kind" NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allocation_rules" ADD CONSTRAINT "allocation_rules_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holdings" ADD CONSTRAINT "holdings_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding" ADD CONSTRAINT "onboarding_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_settings" ADD CONSTRAINT "tax_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_workspace_idx" ON "accounts" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "holdings_account_idx" ON "holdings" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "invoices_workspace_idx" ON "invoices" USING btree ("workspace_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_workspace_number_idx" ON "invoices" USING btree ("workspace_id","number");--> statement-breakpoint
CREATE INDEX "transactions_workspace_date_idx" ON "transactions" USING btree ("workspace_id","date");--> statement-breakpoint
CREATE INDEX "transactions_account_date_idx" ON "transactions" USING btree ("account_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "workspaces_user_kind_idx" ON "workspaces" USING btree ("user_id","kind");