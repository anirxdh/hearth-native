CREATE TABLE `access_log` (
	`id` text PRIMARY KEY NOT NULL,
	`at` text NOT NULL,
	`actor` text DEFAULT 'owner' NOT NULL,
	`what` text NOT NULL,
	`patient_id` text
);
--> statement-breakpoint
CREATE INDEX `access_log_at_idx` ON `access_log` (`at`);--> statement-breakpoint
CREATE TABLE `change_log` (
	`id` text PRIMARY KEY NOT NULL,
	`at` text NOT NULL,
	`actor` text DEFAULT 'owner' NOT NULL,
	`entity` text NOT NULL,
	`entity_id` text NOT NULL,
	`patient_id` text,
	`action` text NOT NULL,
	`detail` text
);
--> statement-breakpoint
CREATE INDEX `change_log_entity_idx` ON `change_log` (`entity`,`entity_id`);--> statement-breakpoint
CREATE INDEX `change_log_at_idx` ON `change_log` (`at`);--> statement-breakpoint
CREATE TABLE `contacts` (
	`id` text PRIMARY KEY NOT NULL,
	`patient_id` text NOT NULL,
	`name` text NOT NULL,
	`relation` text,
	`phone` text,
	`kind` text DEFAULT 'other' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`archived_at` text,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `contacts_patient_idx` ON `contacts` (`patient_id`);--> statement-breakpoint
CREATE TABLE `med_fills` (
	`id` text PRIMARY KEY NOT NULL,
	`medication_id` text NOT NULL,
	`fill_date` text NOT NULL,
	`day_supply` integer NOT NULL,
	`quantity` integer,
	`source` text DEFAULT 'manual' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`medication_id`) REFERENCES `medications`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `med_fills_medication_idx` ON `med_fills` (`medication_id`);--> statement-breakpoint
CREATE TABLE `medications` (
	`id` text PRIMARY KEY NOT NULL,
	`patient_id` text NOT NULL,
	`name` text NOT NULL,
	`strength` text,
	`form` text,
	`sig` text,
	`doses_per_day` integer,
	`prn` integer DEFAULT false NOT NULL,
	`schedule_anchor` text,
	`prescriber` text,
	`pharmacy` text,
	`pharmacy_phone` text,
	`rx_number` text,
	`rxcui` text,
	`high_alert` integer DEFAULT false NOT NULL,
	`notes` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`archived_at` text,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `medications_patient_idx` ON `medications` (`patient_id`);--> statement-breakpoint
CREATE TABLE `patients` (
	`id` text PRIMARY KEY NOT NULL,
	`full_name` text NOT NULL,
	`preferred_name` text,
	`photo_uri` text,
	`dob` text,
	`relationship` text,
	`pronouns` text,
	`conditions` text DEFAULT '[]' NOT NULL,
	`allergies` text DEFAULT '[]' NOT NULL,
	`notes` text,
	`attestation_text` text,
	`attestation_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`archived_at` text
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text,
	`updated_at` text NOT NULL
);
