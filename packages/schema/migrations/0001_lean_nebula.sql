CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`patient_id` text NOT NULL,
	`title` text NOT NULL,
	`category` text DEFAULT 'other' NOT NULL,
	`file_name` text NOT NULL,
	`mime_type` text NOT NULL,
	`added_at` text NOT NULL,
	`archived_at` text,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `documents_patient_idx` ON `documents` (`patient_id`);--> statement-breakpoint
CREATE TABLE `lab_results` (
	`id` text PRIMARY KEY NOT NULL,
	`patient_id` text NOT NULL,
	`name` text NOT NULL,
	`value` text NOT NULL,
	`unit` text,
	`ref_low` text,
	`ref_high` text,
	`abnormal` integer DEFAULT false NOT NULL,
	`collected_on` text NOT NULL,
	`source` text,
	`note` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `labs_patient_idx` ON `lab_results` (`patient_id`,`collected_on`);--> statement-breakpoint
CREATE TABLE `observations` (
	`id` text PRIMARY KEY NOT NULL,
	`patient_id` text NOT NULL,
	`kind` text NOT NULL,
	`text` text NOT NULL,
	`at` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `observations_patient_idx` ON `observations` (`patient_id`,`at`);--> statement-breakpoint
CREATE TABLE `timeline_events` (
	`id` text PRIMARY KEY NOT NULL,
	`patient_id` text NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`detail` text,
	`happened_on` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `timeline_patient_idx` ON `timeline_events` (`patient_id`,`happened_on`);--> statement-breakpoint
CREATE TABLE `vitals` (
	`id` text PRIMARY KEY NOT NULL,
	`patient_id` text NOT NULL,
	`kind` text NOT NULL,
	`value` integer NOT NULL,
	`value2` integer,
	`unit` text NOT NULL,
	`recorded_on` text NOT NULL,
	`recorded_at` text NOT NULL,
	`note` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `vitals_patient_kind_idx` ON `vitals` (`patient_id`,`kind`,`recorded_at`);