CREATE TABLE `carts` (
	`id` text PRIMARY KEY NOT NULL,
	`gallery_id` text NOT NULL,
	`items` text DEFAULT '[]' NOT NULL,
	`coupon_code` text,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`gallery_id`) REFERENCES `galleries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `coupons` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`code` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`starts_on` text NOT NULL,
	`ends_on` text,
	`percent` integer,
	`amount_off` integer,
	`free_shipping` integer DEFAULT false NOT NULL,
	`free_product_id` text,
	`min_amount` integer,
	`max_uses` integer,
	`once_per_gallery` integer DEFAULT false NOT NULL,
	`gallery_ids` text,
	`product_ids` text,
	`banner` integer DEFAULT false NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`uses` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `coupons_code_unique` ON `coupons` (`code`);--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`product_id` text,
	`product_name` text NOT NULL,
	`variant_label` text DEFAULT '' NOT NULL,
	`kind` text NOT NULL,
	`digital` text,
	`photo_id` text,
	`filename` text,
	`section_id` text,
	`crop` text,
	`quantity` integer NOT NULL,
	`unit_price` integer NOT NULL,
	`discount` integer DEFAULT 0 NOT NULL,
	`tax_rate` integer DEFAULT 0 NOT NULL,
	`tax` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `order_items_order_idx` ON `order_items` (`order_id`);--> statement-breakpoint
CREATE INDEX `order_items_photo_idx` ON `order_items` (`photo_id`);--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`number` integer NOT NULL,
	`token` text NOT NULL,
	`gallery_id` text,
	`gallery_name` text DEFAULT '' NOT NULL,
	`buyer_role` text DEFAULT 'guest' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`payment_status` text DEFAULT 'unpaid' NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`country` text DEFAULT '' NOT NULL,
	`address` text,
	`shipping_name` text,
	`currency` text NOT NULL,
	`language` text DEFAULT 'en' NOT NULL,
	`kind` text NOT NULL,
	`subtotal` integer NOT NULL,
	`discount` integer DEFAULT 0 NOT NULL,
	`shipping` integer DEFAULT 0 NOT NULL,
	`tax` integer DEFAULT 0 NOT NULL,
	`total` integer NOT NULL,
	`refunded` integer DEFAULT 0 NOT NULL,
	`coupon_code` text,
	`stripe_session_id` text,
	`stripe_payment_intent` text,
	`stripe_mode` text,
	`tracking` text,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`paid_at` integer,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`gallery_id`) REFERENCES `galleries`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_number_unique` ON `orders` (`number`);--> statement-breakpoint
CREATE UNIQUE INDEX `orders_token_unique` ON `orders` (`token`);--> statement-breakpoint
CREATE INDEX `orders_gallery_idx` ON `orders` (`gallery_id`);--> statement-breakpoint
CREATE INDEX `orders_email_idx` ON `orders` (`email`);--> statement-breakpoint
CREATE TABLE `price_lists` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`min_order` integer DEFAULT 0 NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`price_list_id` text NOT NULL,
	`category` text DEFAULT '' NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`images` text DEFAULT '[]' NOT NULL,
	`kind` text DEFAULT 'physical' NOT NULL,
	`digital` text,
	`options` text DEFAULT '[]' NOT NULL,
	`variants` text DEFAULT '[]' NOT NULL,
	`price` integer DEFAULT 0 NOT NULL,
	`extra_shipping` integer DEFAULT 0 NOT NULL,
	`no_photo` integer DEFAULT false NOT NULL,
	`tax_exempt` integer DEFAULT false NOT NULL,
	`max_one` integer DEFAULT false NOT NULL,
	`multi_photo` integer DEFAULT false NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`price_list_id`) REFERENCES `price_lists`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `products_price_list_idx` ON `products` (`price_list_id`);--> statement-breakpoint
CREATE TABLE `shipping_methods` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`country` text NOT NULL,
	`fee` integer DEFAULT 0 NOT NULL,
	`delivery_time` text DEFAULT '' NOT NULL,
	`pickup` integer DEFAULT false NOT NULL,
	`position` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tax_rates` (
	`id` text PRIMARY KEY NOT NULL,
	`country` text NOT NULL,
	`rate` integer NOT NULL,
	`shipping` integer DEFAULT true NOT NULL,
	`digital` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tax_rates_country_unique` ON `tax_rates` (`country`);--> statement-breakpoint
ALTER TABLE `galleries` ADD `store_enabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `galleries` ADD `price_list_id` text;