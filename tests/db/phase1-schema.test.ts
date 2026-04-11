import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260410213000_phase1_core.sql",
);

function loadMigrationSql() {
  return readFileSync(migrationPath, "utf8");
}

describe("Phase 1 schema migration", () => {
  it("defines the required tables", () => {
    const sql = loadMigrationSql();

    expect(sql).toMatch(/create table\s+raid_posts/i);
    expect(sql).toMatch(/create table\s+engagement_logs/i);
    expect(sql).toMatch(/create table\s+raid_timing_corrections/i);
  });

  it("stores the canonical raid post timing fields", () => {
    const sql = loadMigrationSql();

    expect(sql).toContain("published_at");
    expect(sql).toContain("slack_posted_at");
    expect(sql).toContain("slack_message_ts");
    expect(sql).toContain("slack_channel_id");
    expect(sql).toContain("timing_confidence");
    expect(sql).toContain("month_key");
  });

  it("stores engagement scoring facts and uniqueness guarantees", () => {
    const sql = loadMigrationSql();

    expect(sql).toContain("reacted_at");
    expect(sql).toContain("minutes_from_publish");
    expect(sql).toContain("scoring_window");
    expect(sql).toContain("points_awarded");
    expect(sql).toContain("removed_at");
    expect(sql).toContain("engagement_logs_one_action_per_user_post");
  });

  it("stores timing correction audit history", () => {
    const sql = loadMigrationSql();

    expect(sql).toContain("previous_published_at");
    expect(sql).toContain("new_published_at");
    expect(sql).toContain("previous_timing_confidence");
    expect(sql).toContain("new_timing_confidence");
  });
});
