CREATE TABLE `favorite_lists` (
	`id` text PRIMARY KEY NOT NULL,
	`gallery_id` text NOT NULL,
	`visitor_id` text NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`preset_id` text,
	`submitted_at` integer,
	`share_token` text,
	`share_private` integer DEFAULT true NOT NULL,
	`share_views` integer DEFAULT 0 NOT NULL,
	`share_downloads` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`gallery_id`) REFERENCES `galleries`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`visitor_id`) REFERENCES `visitors`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `favorite_lists_share_token_unique` ON `favorite_lists` (`share_token`);--> statement-breakpoint
CREATE INDEX `favorite_lists_visitor_idx` ON `favorite_lists` (`visitor_id`);--> statement-breakpoint
CREATE TABLE `share_links` (
	`id` text PRIMARY KEY NOT NULL,
	`token` text NOT NULL,
	`gallery_id` text NOT NULL,
	`name` text NOT NULL,
	`photo_ids` text NOT NULL,
	`download` text NOT NULL,
	`expires_on` text,
	`password` text,
	`active` integer DEFAULT true NOT NULL,
	`views` integer DEFAULT 0 NOT NULL,
	`downloads` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`gallery_id`) REFERENCES `galleries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `share_links_token_unique` ON `share_links` (`token`);--> statement-breakpoint
CREATE INDEX `share_links_gallery_idx` ON `share_links` (`gallery_id`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_favorites` (
	`list_id` text NOT NULL,
	`visitor_id` text NOT NULL,
	`photo_id` text NOT NULL,
	`note` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`list_id`, `photo_id`),
	FOREIGN KEY (`list_id`) REFERENCES `favorite_lists`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`visitor_id`) REFERENCES `visitors`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`photo_id`) REFERENCES `photos`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `favorite_lists`("id", "gallery_id", "visitor_id", "name", "created_at") SELECT lower(hex(randomblob(16))), "gallery_id", "id", '', "created_at" FROM `visitors` WHERE "id" IN (SELECT DISTINCT "visitor_id" FROM `favorites`);--> statement-breakpoint
INSERT INTO `__new_favorites`("list_id", "visitor_id", "photo_id", "note", "created_at") SELECT l."id", f."visitor_id", f."photo_id", NULL, f."created_at" FROM `favorites` f INNER JOIN `favorite_lists` l ON l."visitor_id" = f."visitor_id";--> statement-breakpoint
DROP TABLE `favorites`;--> statement-breakpoint
ALTER TABLE `__new_favorites` RENAME TO `favorites`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `favorites_visitor_idx` ON `favorites` (`visitor_id`);--> statement-breakpoint
ALTER TABLE `galleries` ADD `access` text;--> statement-breakpoint
ALTER TABLE `photos` ADD `private` integer DEFAULT false NOT NULL;