CREATE TABLE `appointments` (
	`id` text PRIMARY KEY NOT NULL,
	`patient_id` text NOT NULL,
	`provider` text NOT NULL,
	`specialty` text,
	`location` text,
	`phone` text,
	`on_date` text NOT NULL,
	`at_time` text,
	`driver` text,
	`bring` text,
	`purpose` text,
	`post_visit_notes` text,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`archived_at` text,
	FOREIGN KEY (`patient_id`) REFERENCES `patients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `appointments_patient_idx` ON `appointments` (`patient_id`,`on_date`);--> statement-breakpoint
CREATE TABLE `wf_execution_inputs` (
	`id` text PRIMARY KEY NOT NULL,
	`execution_id` text NOT NULL,
	`node_property_id` text NOT NULL,
	`values` text NOT NULL,
	FOREIGN KEY (`execution_id`) REFERENCES `wf_executions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `wf_exec_inputs_idx` ON `wf_execution_inputs` (`execution_id`);--> statement-breakpoint
CREATE TABLE `wf_execution_outputs` (
	`id` text PRIMARY KEY NOT NULL,
	`execution_id` text NOT NULL,
	`node_id` text NOT NULL,
	`output` text NOT NULL,
	`at` text NOT NULL,
	FOREIGN KEY (`execution_id`) REFERENCES `wf_executions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `wf_exec_outputs_idx` ON `wf_execution_outputs` (`execution_id`,`node_id`);--> statement-breakpoint
CREATE TABLE `wf_executions` (
	`id` text PRIMARY KEY NOT NULL,
	`workflow_id` text NOT NULL,
	`workflow_version` integer NOT NULL,
	`patient_id` text,
	`status` text NOT NULL,
	`awaiting_node_id` text,
	`error` text,
	`started_at` text NOT NULL,
	`finished_at` text,
	FOREIGN KEY (`workflow_id`) REFERENCES `wf_workflows`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `wf_exec_workflow_idx` ON `wf_executions` (`workflow_id`,`started_at`);--> statement-breakpoint
CREATE TABLE `wf_node_properties` (
	`id` text PRIMARY KEY NOT NULL,
	`node_id` text NOT NULL,
	`name` text NOT NULL,
	`label` text,
	`input_node_id` text,
	`hidden` integer DEFAULT false NOT NULL,
	`values` text DEFAULT '[]' NOT NULL,
	FOREIGN KEY (`node_id`) REFERENCES `wf_nodes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `wf_props_node_idx` ON `wf_node_properties` (`node_id`);--> statement-breakpoint
CREATE TABLE `wf_nodes` (
	`id` text PRIMARY KEY NOT NULL,
	`workflow_id` text NOT NULL,
	`type` text NOT NULL,
	`description` text NOT NULL,
	`position_x` integer NOT NULL,
	`position_y` integer NOT NULL,
	FOREIGN KEY (`workflow_id`) REFERENCES `wf_workflows`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `wf_nodes_workflow_idx` ON `wf_nodes` (`workflow_id`);--> statement-breakpoint
CREATE TABLE `wf_workflows` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`category` text NOT NULL,
	`est_minutes` integer NOT NULL,
	`replaces_hours` text NOT NULL,
	`version` integer NOT NULL,
	`created_at` text NOT NULL
);
