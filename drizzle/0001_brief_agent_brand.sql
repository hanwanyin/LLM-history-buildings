CREATE TABLE `spatial_matches` (
	`site_id` text PRIMARY KEY NOT NULL,
	`building_id` text,
	`status` text NOT NULL,
	`original_lon` real NOT NULL,
	`original_lat` real NOT NULL,
	`longitude` real NOT NULL,
	`latitude` real NOT NULL,
	`distance_m` real,
	`height` real,
	`geometry` text,
	`candidates` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`site_id`) REFERENCES `heritage_sites`(`id`) ON UPDATE no action ON DELETE no action
);
