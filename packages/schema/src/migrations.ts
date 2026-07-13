/**
 * GENERATED FILE. Do not edit by hand.
 *
 * Embedded copy of the drizzle migrations under packages/schema/migrations,
 * in the shape drizzle-orm/expo-sqlite/migrator expects ({ journal,
 * migrations }). Metro cannot import .sql files, so the SQL is inlined here.
 *
 * Whenever src/schema.ts changes, run "pnpm generate" in packages/schema to
 * regenerate both the migration files and this module. A test asserts this
 * module matches the files on disk, so a stale copy fails CI.
 */

export const journal = {
  "version": "7",
  "dialect": "sqlite",
  "entries": [
    {
      "idx": 0,
      "version": "6",
      "when": 1783919731717,
      "tag": "0000_tearful_vargas",
      "breakpoints": true
    }
  ]
};

const m0000 = "CREATE TABLE `access_log` (\n\t`id` text PRIMARY KEY NOT NULL,\n\t`at` text NOT NULL,\n\t`actor` text DEFAULT 'owner' NOT NULL,\n\t`what` text NOT NULL,\n\t`patient_id` text\n);\n--> statement-breakpoint\nCREATE INDEX `access_log_at_idx` ON `access_log` (`at`);--> statement-breakpoint\nCREATE TABLE `change_log` (\n\t`id` text PRIMARY KEY NOT NULL,\n\t`at` text NOT NULL,\n\t`actor` text DEFAULT 'owner' NOT NULL,\n\t`entity` text NOT NULL,\n\t`entity_id` text NOT NULL,\n\t`patient_id` text,\n\t`action` text NOT NULL,\n\t`detail` text\n);\n--> statement-breakpoint\nCREATE INDEX `change_log_entity_idx` ON `change_log` (`entity`,`entity_id`);--> statement-breakpoint\nCREATE INDEX `change_log_at_idx` ON `change_log` (`at`);--> statement-breakpoint\nCREATE TABLE `contacts` (\n\t`id` text PRIMARY KEY NOT NULL,\n\t`patient_id` text NOT NULL,\n\t`name` text NOT NULL,\n\t`relation` text,\n\t`phone` text,\n\t`kind` text DEFAULT 'other' NOT NULL,\n\t`sort_order` integer DEFAULT 0 NOT NULL,\n\t`created_at` text NOT NULL,\n\t`updated_at` text NOT NULL,\n\t`archived_at` text,\n\tFOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action\n);\n--> statement-breakpoint\nCREATE INDEX `contacts_patient_idx` ON `contacts` (`patient_id`);--> statement-breakpoint\nCREATE TABLE `med_fills` (\n\t`id` text PRIMARY KEY NOT NULL,\n\t`medication_id` text NOT NULL,\n\t`fill_date` text NOT NULL,\n\t`day_supply` integer NOT NULL,\n\t`quantity` integer,\n\t`source` text DEFAULT 'manual' NOT NULL,\n\t`created_at` text NOT NULL,\n\tFOREIGN KEY (`medication_id`) REFERENCES `medications`(`id`) ON UPDATE no action ON DELETE no action\n);\n--> statement-breakpoint\nCREATE INDEX `med_fills_medication_idx` ON `med_fills` (`medication_id`);--> statement-breakpoint\nCREATE TABLE `medications` (\n\t`id` text PRIMARY KEY NOT NULL,\n\t`patient_id` text NOT NULL,\n\t`name` text NOT NULL,\n\t`strength` text,\n\t`form` text,\n\t`sig` text,\n\t`doses_per_day` integer,\n\t`prn` integer DEFAULT false NOT NULL,\n\t`schedule_anchor` text,\n\t`prescriber` text,\n\t`pharmacy` text,\n\t`pharmacy_phone` text,\n\t`rx_number` text,\n\t`rxcui` text,\n\t`high_alert` integer DEFAULT false NOT NULL,\n\t`notes` text,\n\t`active` integer DEFAULT true NOT NULL,\n\t`created_at` text NOT NULL,\n\t`updated_at` text NOT NULL,\n\t`archived_at` text,\n\tFOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action\n);\n--> statement-breakpoint\nCREATE INDEX `medications_patient_idx` ON `medications` (`patient_id`);--> statement-breakpoint\nCREATE TABLE `patients` (\n\t`id` text PRIMARY KEY NOT NULL,\n\t`full_name` text NOT NULL,\n\t`preferred_name` text,\n\t`photo_uri` text,\n\t`dob` text,\n\t`relationship` text,\n\t`pronouns` text,\n\t`conditions` text DEFAULT '[]' NOT NULL,\n\t`allergies` text DEFAULT '[]' NOT NULL,\n\t`notes` text,\n\t`attestation_text` text,\n\t`attestation_at` text,\n\t`created_at` text NOT NULL,\n\t`updated_at` text NOT NULL,\n\t`archived_at` text\n);\n--> statement-breakpoint\nCREATE TABLE `settings` (\n\t`key` text PRIMARY KEY NOT NULL,\n\t`value` text,\n\t`updated_at` text NOT NULL\n);\n";

export const migrations: Record<string, string> = {
  m0000,
};

export default { journal, migrations };
