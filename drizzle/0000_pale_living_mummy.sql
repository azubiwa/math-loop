CREATE TABLE `progress` (
	`profile_id` text NOT NULL,
	`problem_id` text NOT NULL,
	`status` text NOT NULL,
	`best_score` integer DEFAULT 0 NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`last_answer` text DEFAULT '' NOT NULL,
	`duration_seconds` integer DEFAULT 0 NOT NULL,
	`solved_at` text,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`profile_id`, `problem_id`)
);
