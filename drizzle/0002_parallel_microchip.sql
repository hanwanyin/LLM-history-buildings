CREATE TABLE `knowledge_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`site_id` text,
	`title` text NOT NULL,
	`kind` text NOT NULL,
	`filename` text,
	`mime` text,
	`size` integer,
	`sha256` text,
	`object_key` text,
	`source_url` text,
	`publisher` text,
	`published_at` text,
	`locator` text NOT NULL,
	`content` text NOT NULL,
	`extraction_note` text NOT NULL,
	`fingerprint` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`reviewed_by` text,
	`reviewed_at` text,
	`review_note` text,
	`revision` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`site_id`) REFERENCES `heritage_sites`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `knowledge_fingerprint_unique` ON `knowledge_documents` (`fingerprint`);--> statement-breakpoint
CREATE INDEX `knowledge_site_status_idx` ON `knowledge_documents` (`site_id`,`status`);--> statement-breakpoint
CREATE TABLE `research_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`site_id` text,
	`query` text NOT NULL,
	`providers` text NOT NULL,
	`status` text NOT NULL,
	`steps` text NOT NULL,
	`result_ids` text NOT NULL,
	`actor` text NOT NULL,
	`created_at` text NOT NULL,
	`finished_at` text,
	FOREIGN KEY (`site_id`) REFERENCES `heritage_sites`(`id`) ON UPDATE no action ON DELETE no action
);
