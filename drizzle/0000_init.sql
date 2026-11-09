CREATE TABLE `email_log` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`gallery_id` text,
	`template_id` text,
	`recipient` text NOT NULL,
	`subject` text NOT NULL,
	`payload` text,
	`status` text DEFAULT 'queued' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`next_attempt_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`error` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`sent_at` integer,
	FOREIGN KEY (`gallery_id`) REFERENCES `galleries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `email_log_gallery_idx` ON `email_log` (`gallery_id`);--> statement-breakpoint
CREATE INDEX `email_log_status_idx` ON `email_log` (`status`);--> statement-breakpoint
CREATE TABLE `email_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`subject` text NOT NULL,
	`body` text NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `favorites` (
	`visitor_id` text NOT NULL,
	`photo_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`visitor_id`, `photo_id`),
	FOREIGN KEY (`visitor_id`) REFERENCES `visitors`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`photo_id`) REFERENCES `photos`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `galleries` (
	`id` text PRIMARY KEY NOT NULL,
	`folder` text NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`event_date` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`missing` integer DEFAULT false NOT NULL,
	`cover_photo_id` text,
	`cover_focal_x` real DEFAULT 0.5 NOT NULL,
	`cover_focal_y` real DEFAULT 0.5 NOT NULL,
	`password` text,
	`design` text NOT NULL,
	`download` text NOT NULL,
	`favorites_enabled` integer DEFAULT true NOT NULL,
	`language` text DEFAULT 'en' NOT NULL,
	`client_name` text,
	`client_email` text,
	`warnings` text DEFAULT '[]' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`published_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `galleries_slug_unique` ON `galleries` (`slug`);--> statement-breakpoint
CREATE INDEX `galleries_folder_idx` ON `galleries` (`folder`);--> statement-breakpoint
CREATE TABLE `photos` (
	`id` text PRIMARY KEY NOT NULL,
	`gallery_id` text NOT NULL,
	`section_id` text NOT NULL,
	`filename` text NOT NULL,
	`size` integer NOT NULL,
	`mtime_ms` integer NOT NULL,
	`width` integer DEFAULT 0 NOT NULL,
	`height` integer DEFAULT 0 NOT NULL,
	`taken_at` integer,
	`position` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`error` text,
	`version` integer DEFAULT 1 NOT NULL,
	`color` text DEFAULT '#d9d9d6' NOT NULL,
	`placeholder` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`gallery_id`) REFERENCES `galleries`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`section_id`) REFERENCES `sections`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `photos_section_filename_idx` ON `photos` (`section_id`,`filename`);--> statement-breakpoint
CREATE INDEX `photos_gallery_idx` ON `photos` (`gallery_id`);--> statement-breakpoint
CREATE INDEX `photos_status_idx` ON `photos` (`status`);--> statement-breakpoint
CREATE TABLE `sections` (
	`id` text PRIMARY KEY NOT NULL,
	`gallery_id` text NOT NULL,
	`folder` text NOT NULL,
	`slug` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`sort_mode` text DEFAULT 'filename' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`gallery_id`) REFERENCES `galleries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sections_gallery_folder_idx` ON `sections` (`gallery_id`,`folder`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `visitors` (
	`id` text PRIMARY KEY NOT NULL,
	`gallery_id` text NOT NULL,
	`email` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`gallery_id`) REFERENCES `galleries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `visitors_gallery_email_idx` ON `visitors` (`gallery_id`,`email`);