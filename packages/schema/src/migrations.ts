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
    },
    {
      "idx": 1,
      "version": "6",
      "when": 1783983290202,
      "tag": "0001_lean_nebula",
      "breakpoints": true
    },
    {
      "idx": 2,
      "version": "6",
      "when": 1784065921000,
      "tag": "0002_mysterious_black_knight",
      "breakpoints": true
    },
    {
      "idx": 3,
      "version": "6",
      "when": 1784099190076,
      "tag": "0003_old_wraith",
      "breakpoints": true
    }
  ]
};

const m0000 = "CREATE TABLE `access_log` (\n\t`id` text PRIMARY KEY NOT NULL,\n\t`at` text NOT NULL,\n\t`actor` text DEFAULT 'owner' NOT NULL,\n\t`what` text NOT NULL,\n\t`patient_id` text\n);\n--> statement-breakpoint\nCREATE INDEX `access_log_at_idx` ON `access_log` (`at`);--> statement-breakpoint\nCREATE TABLE `change_log` (\n\t`id` text PRIMARY KEY NOT NULL,\n\t`at` text NOT NULL,\n\t`actor` text DEFAULT 'owner' NOT NULL,\n\t`entity` text NOT NULL,\n\t`entity_id` text NOT NULL,\n\t`patient_id` text,\n\t`action` text NOT NULL,\n\t`detail` text\n);\n--> statement-breakpoint\nCREATE INDEX `change_log_entity_idx` ON `change_log` (`entity`,`entity_id`);--> statement-breakpoint\nCREATE INDEX `change_log_at_idx` ON `change_log` (`at`);--> statement-breakpoint\nCREATE TABLE `contacts` (\n\t`id` text PRIMARY KEY NOT NULL,\n\t`patient_id` text NOT NULL,\n\t`name` text NOT NULL,\n\t`relation` text,\n\t`phone` text,\n\t`kind` text DEFAULT 'other' NOT NULL,\n\t`sort_order` integer DEFAULT 0 NOT NULL,\n\t`created_at` text NOT NULL,\n\t`updated_at` text NOT NULL,\n\t`archived_at` text,\n\tFOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action\n);\n--> statement-breakpoint\nCREATE INDEX `contacts_patient_idx` ON `contacts` (`patient_id`);--> statement-breakpoint\nCREATE TABLE `med_fills` (\n\t`id` text PRIMARY KEY NOT NULL,\n\t`medication_id` text NOT NULL,\n\t`fill_date` text NOT NULL,\n\t`day_supply` integer NOT NULL,\n\t`quantity` integer,\n\t`source` text DEFAULT 'manual' NOT NULL,\n\t`created_at` text NOT NULL,\n\tFOREIGN KEY (`medication_id`) REFERENCES `medications`(`id`) ON UPDATE no action ON DELETE no action\n);\n--> statement-breakpoint\nCREATE INDEX `med_fills_medication_idx` ON `med_fills` (`medication_id`);--> statement-breakpoint\nCREATE TABLE `medications` (\n\t`id` text PRIMARY KEY NOT NULL,\n\t`patient_id` text NOT NULL,\n\t`name` text NOT NULL,\n\t`strength` text,\n\t`form` text,\n\t`sig` text,\n\t`doses_per_day` integer,\n\t`prn` integer DEFAULT false NOT NULL,\n\t`schedule_anchor` text,\n\t`prescriber` text,\n\t`pharmacy` text,\n\t`pharmacy_phone` text,\n\t`rx_number` text,\n\t`rxcui` text,\n\t`high_alert` integer DEFAULT false NOT NULL,\n\t`notes` text,\n\t`active` integer DEFAULT true NOT NULL,\n\t`created_at` text NOT NULL,\n\t`updated_at` text NOT NULL,\n\t`archived_at` text,\n\tFOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action\n);\n--> statement-breakpoint\nCREATE INDEX `medications_patient_idx` ON `medications` (`patient_id`);--> statement-breakpoint\nCREATE TABLE `patients` (\n\t`id` text PRIMARY KEY NOT NULL,\n\t`full_name` text NOT NULL,\n\t`preferred_name` text,\n\t`photo_uri` text,\n\t`dob` text,\n\t`relationship` text,\n\t`pronouns` text,\n\t`conditions` text DEFAULT '[]' NOT NULL,\n\t`allergies` text DEFAULT '[]' NOT NULL,\n\t`notes` text,\n\t`attestation_text` text,\n\t`attestation_at` text,\n\t`created_at` text NOT NULL,\n\t`updated_at` text NOT NULL,\n\t`archived_at` text\n);\n--> statement-breakpoint\nCREATE TABLE `settings` (\n\t`key` text PRIMARY KEY NOT NULL,\n\t`value` text,\n\t`updated_at` text NOT NULL\n);\n";

const m0001 = "CREATE TABLE `documents` (\n\t`id` text PRIMARY KEY NOT NULL,\n\t`patient_id` text NOT NULL,\n\t`title` text NOT NULL,\n\t`category` text DEFAULT 'other' NOT NULL,\n\t`file_name` text NOT NULL,\n\t`mime_type` text NOT NULL,\n\t`added_at` text NOT NULL,\n\t`archived_at` text,\n\tFOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action\n);\n--> statement-breakpoint\nCREATE INDEX `documents_patient_idx` ON `documents` (`patient_id`);--> statement-breakpoint\nCREATE TABLE `lab_results` (\n\t`id` text PRIMARY KEY NOT NULL,\n\t`patient_id` text NOT NULL,\n\t`name` text NOT NULL,\n\t`value` text NOT NULL,\n\t`unit` text,\n\t`ref_low` text,\n\t`ref_high` text,\n\t`abnormal` integer DEFAULT false NOT NULL,\n\t`collected_on` text NOT NULL,\n\t`source` text,\n\t`note` text,\n\t`created_at` text NOT NULL,\n\tFOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action\n);\n--> statement-breakpoint\nCREATE INDEX `labs_patient_idx` ON `lab_results` (`patient_id`,`collected_on`);--> statement-breakpoint\nCREATE TABLE `observations` (\n\t`id` text PRIMARY KEY NOT NULL,\n\t`patient_id` text NOT NULL,\n\t`kind` text NOT NULL,\n\t`text` text NOT NULL,\n\t`at` text NOT NULL,\n\t`created_at` text NOT NULL,\n\tFOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action\n);\n--> statement-breakpoint\nCREATE INDEX `observations_patient_idx` ON `observations` (`patient_id`,`at`);--> statement-breakpoint\nCREATE TABLE `timeline_events` (\n\t`id` text PRIMARY KEY NOT NULL,\n\t`patient_id` text NOT NULL,\n\t`kind` text NOT NULL,\n\t`title` text NOT NULL,\n\t`detail` text,\n\t`happened_on` text NOT NULL,\n\t`created_at` text NOT NULL,\n\tFOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action\n);\n--> statement-breakpoint\nCREATE INDEX `timeline_patient_idx` ON `timeline_events` (`patient_id`,`happened_on`);--> statement-breakpoint\nCREATE TABLE `vitals` (\n\t`id` text PRIMARY KEY NOT NULL,\n\t`patient_id` text NOT NULL,\n\t`kind` text NOT NULL,\n\t`value` integer NOT NULL,\n\t`value2` integer,\n\t`unit` text NOT NULL,\n\t`recorded_on` text NOT NULL,\n\t`recorded_at` text NOT NULL,\n\t`note` text,\n\t`created_at` text NOT NULL,\n\tFOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action\n);\n--> statement-breakpoint\nCREATE INDEX `vitals_patient_kind_idx` ON `vitals` (`patient_id`,`kind`,`recorded_at`);";

const m0002 = "CREATE TABLE `appointments` (\n\t`id` text PRIMARY KEY NOT NULL,\n\t`patient_id` text NOT NULL,\n\t`provider` text NOT NULL,\n\t`specialty` text,\n\t`location` text,\n\t`phone` text,\n\t`on_date` text NOT NULL,\n\t`at_time` text,\n\t`driver` text,\n\t`bring` text,\n\t`purpose` text,\n\t`post_visit_notes` text,\n\t`status` text DEFAULT 'scheduled' NOT NULL,\n\t`created_at` text NOT NULL,\n\t`updated_at` text NOT NULL,\n\t`archived_at` text,\n\tFOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action\n);\n--> statement-breakpoint\nCREATE INDEX `appointments_patient_idx` ON `appointments` (`patient_id`,`on_date`);--> statement-breakpoint\nCREATE TABLE `wf_execution_inputs` (\n\t`id` text PRIMARY KEY NOT NULL,\n\t`execution_id` text NOT NULL,\n\t`node_property_id` text NOT NULL,\n\t`values` text NOT NULL,\n\tFOREIGN KEY (`execution_id`) REFERENCES `wf_executions`(`id`) ON UPDATE no action ON DELETE no action\n);\n--> statement-breakpoint\nCREATE INDEX `wf_exec_inputs_idx` ON `wf_execution_inputs` (`execution_id`);--> statement-breakpoint\nCREATE TABLE `wf_execution_outputs` (\n\t`id` text PRIMARY KEY NOT NULL,\n\t`execution_id` text NOT NULL,\n\t`node_id` text NOT NULL,\n\t`output` text NOT NULL,\n\t`at` text NOT NULL,\n\tFOREIGN KEY (`execution_id`) REFERENCES `wf_executions`(`id`) ON UPDATE no action ON DELETE no action\n);\n--> statement-breakpoint\nCREATE INDEX `wf_exec_outputs_idx` ON `wf_execution_outputs` (`execution_id`,`node_id`);--> statement-breakpoint\nCREATE TABLE `wf_executions` (\n\t`id` text PRIMARY KEY NOT NULL,\n\t`workflow_id` text NOT NULL,\n\t`workflow_version` integer NOT NULL,\n\t`patient_id` text,\n\t`status` text NOT NULL,\n\t`awaiting_node_id` text,\n\t`error` text,\n\t`started_at` text NOT NULL,\n\t`finished_at` text,\n\tFOREIGN KEY (`workflow_id`) REFERENCES `wf_workflows`(`id`) ON UPDATE no action ON DELETE no action\n);\n--> statement-breakpoint\nCREATE INDEX `wf_exec_workflow_idx` ON `wf_executions` (`workflow_id`,`started_at`);--> statement-breakpoint\nCREATE TABLE `wf_node_properties` (\n\t`id` text PRIMARY KEY NOT NULL,\n\t`node_id` text NOT NULL,\n\t`name` text NOT NULL,\n\t`label` text,\n\t`input_node_id` text,\n\t`hidden` integer DEFAULT false NOT NULL,\n\t`values` text DEFAULT '[]' NOT NULL,\n\tFOREIGN KEY (`node_id`) REFERENCES `wf_nodes`(`id`) ON UPDATE no action ON DELETE no action\n);\n--> statement-breakpoint\nCREATE INDEX `wf_props_node_idx` ON `wf_node_properties` (`node_id`);--> statement-breakpoint\nCREATE TABLE `wf_nodes` (\n\t`id` text PRIMARY KEY NOT NULL,\n\t`workflow_id` text NOT NULL,\n\t`type` text NOT NULL,\n\t`description` text NOT NULL,\n\t`position_x` integer NOT NULL,\n\t`position_y` integer NOT NULL,\n\tFOREIGN KEY (`workflow_id`) REFERENCES `wf_workflows`(`id`) ON UPDATE no action ON DELETE no action\n);\n--> statement-breakpoint\nCREATE INDEX `wf_nodes_workflow_idx` ON `wf_nodes` (`workflow_id`);--> statement-breakpoint\nCREATE TABLE `wf_workflows` (\n\t`id` text PRIMARY KEY NOT NULL,\n\t`key` text NOT NULL,\n\t`name` text NOT NULL,\n\t`description` text NOT NULL,\n\t`category` text NOT NULL,\n\t`est_minutes` integer NOT NULL,\n\t`replaces_hours` text NOT NULL,\n\t`version` integer NOT NULL,\n\t`created_at` text NOT NULL\n);\n";

const m0003 = "ALTER TABLE `patients` ADD `sex` text;";

export const migrations: Record<string, string> = {
  m0000,
  m0001,
  m0002,
  m0003,
};

export default { journal, migrations };
