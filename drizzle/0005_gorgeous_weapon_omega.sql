ALTER TABLE `galleries` ADD `sort_mode` text DEFAULT 'filename' NOT NULL;--> statement-breakpoint
UPDATE `galleries` SET `sort_mode` = 'date' WHERE (SELECT count(*) FROM `sections` WHERE `sections`.`gallery_id` = `galleries`.`id` AND `sections`.`sort_mode` = 'date') > (SELECT count(*) FROM `sections` WHERE `sections`.`gallery_id` = `galleries`.`id` AND `sections`.`sort_mode` = 'filename');
