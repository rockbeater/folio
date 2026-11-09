CREATE TABLE `activity` (
	`id` text PRIMARY KEY NOT NULL,
	`gallery_id` text NOT NULL,
	`kind` text NOT NULL,
	`email` text,
	`detail` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`gallery_id`) REFERENCES `galleries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `activity_gallery_kind_idx` ON `activity` (`gallery_id`,`kind`);--> statement-breakpoint
CREATE TABLE `presets` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`settings` text NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `watermarks` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`file` text NOT NULL,
	`text` text,
	`position` text DEFAULT 'center' NOT NULL,
	`scale` real DEFAULT 0.3 NOT NULL,
	`opacity` real DEFAULT 0.5 NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
ALTER TABLE `email_log` ADD `scheduled_for` integer;--> statement-breakpoint
ALTER TABLE `email_templates` ADD `kind` text DEFAULT 'delivery' NOT NULL;--> statement-breakpoint
ALTER TABLE `email_templates` ADD `language` text DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE `galleries` ADD `options` text;--> statement-breakpoint
ALTER TABLE `galleries` ADD `tags` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `galleries` ADD `watermark_id` text;--> statement-breakpoint
ALTER TABLE `galleries` ADD `expires_on` text;--> statement-breakpoint
ALTER TABLE `galleries` ADD `reminder_days` integer;--> statement-breakpoint
ALTER TABLE `galleries` ADD `reminder_to` text DEFAULT 'client' NOT NULL;--> statement-breakpoint
ALTER TABLE `galleries` ADD `reminder_sent_at` integer;--> statement-breakpoint
ALTER TABLE `photos` ADD `hidden` integer DEFAULT false NOT NULL;