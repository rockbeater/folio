ALTER TABLE `users` ADD `totp_secret` text;--> statement-breakpoint
ALTER TABLE `users` ADD `recovery_codes` text DEFAULT '[]' NOT NULL;