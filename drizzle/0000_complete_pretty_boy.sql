CREATE TABLE `assessment_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`site_id` text NOT NULL,
	`snapshot` text NOT NULL,
	`created_at` text NOT NULL,
	`created_by` text NOT NULL,
	FOREIGN KEY (`site_id`) REFERENCES `heritage_sites`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `runs_site_idx` ON `assessment_runs` (`site_id`);--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`action` text NOT NULL,
	`site_id` text,
	`actor` text NOT NULL,
	`details` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `current_reviews` (
	`score_id` text PRIMARY KEY NOT NULL,
	`review_id` text NOT NULL,
	`revision` integer NOT NULL,
	FOREIGN KEY (`score_id`) REFERENCES `scores`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`review_id`) REFERENCES `reviews`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `dimension_scores` (
	`id` text PRIMARY KEY NOT NULL,
	`site_id` text NOT NULL,
	`dimension` text NOT NULL,
	`score` real,
	`confidence` text,
	`evidence` text,
	`reasoning` text,
	`missing` text,
	`source_id` text NOT NULL,
	`row_number` integer NOT NULL,
	`raw` text NOT NULL,
	FOREIGN KEY (`site_id`) REFERENCES `heritage_sites`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `site_dimension_unique` ON `dimension_scores` (`site_id`,`dimension`);--> statement-breakpoint
CREATE TABLE `import_chunks` (
	`id` text PRIMARY KEY NOT NULL,
	`digest` text NOT NULL,
	`rows` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `indicators` (
	`id` text PRIMARY KEY NOT NULL,
	`dimension` text NOT NULL,
	`category` text NOT NULL,
	`name` text NOT NULL,
	`position` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `data_issues` (
	`id` text PRIMARY KEY NOT NULL,
	`site_id` text,
	`source_id` text,
	`row_number` integer,
	`kind` text NOT NULL,
	`description` text NOT NULL,
	`raw` text
);
--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`score_id` text NOT NULL,
	`score` real NOT NULL,
	`note` text NOT NULL,
	`reviewer` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`score_id`) REFERENCES `scores`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `review_score_idx` ON `reviews` (`score_id`);--> statement-breakpoint
CREATE TABLE `scores` (
	`id` text PRIMARY KEY NOT NULL,
	`site_id` text NOT NULL,
	`indicator_id` text NOT NULL,
	`score` real,
	`confidence` text,
	`evidence` text,
	`reasoning` text,
	`missing` text,
	`source_id` text NOT NULL,
	`sheet` text NOT NULL,
	`row_number` integer NOT NULL,
	`raw` text NOT NULL,
	FOREIGN KEY (`site_id`) REFERENCES `heritage_sites`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`indicator_id`) REFERENCES `indicators`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `site_indicator_unique` ON `scores` (`site_id`,`indicator_id`);--> statement-breakpoint
CREATE INDEX `score_site_idx` ON `scores` (`site_id`);--> statement-breakpoint
CREATE TABLE `heritage_sites` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`district` text NOT NULL,
	`address` text,
	`level` text,
	`type` text,
	`age` text,
	`material` text,
	`structure` text,
	`condition` text,
	`opening` text,
	`tourism` text,
	`core_area` text,
	`longitude` real,
	`latitude` real,
	`raw` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `site_district_idx` ON `heritage_sites` (`district`);--> statement-breakpoint
CREATE INDEX `site_name_idx` ON `heritage_sites` (`name`);--> statement-breakpoint
CREATE TABLE `sources` (
	`id` text PRIMARY KEY NOT NULL,
	`filename` text NOT NULL,
	`sha256` text NOT NULL,
	`rows` integer NOT NULL,
	`imported_rows` integer NOT NULL,
	`kind` text NOT NULL,
	`size` integer NOT NULL,
	`object_key` text,
	`imported_at` text NOT NULL
);
