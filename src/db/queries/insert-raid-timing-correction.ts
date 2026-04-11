import type { DbTransaction } from "../sql.js";
import type { RaidTimingCorrectionRecord } from "../../domain/raids/correct-raid-published-at.js";

export interface InsertRaidTimingCorrectionParams extends RaidTimingCorrectionRecord {
  executor: DbTransaction;
}

export async function insertRaidTimingCorrection({
  executor,
  raidPostId,
  previousPublishedAt,
  newPublishedAt,
  previousTimingConfidence,
  newTimingConfidence,
  correctedBy,
  reason,
}: InsertRaidTimingCorrectionParams): Promise<void> {
  await executor`
    insert into raid_timing_corrections (
      raid_post_id,
      previous_published_at,
      new_published_at,
      previous_timing_confidence,
      new_timing_confidence,
      corrected_by,
      reason
    )
    values (
      ${raidPostId},
      ${previousPublishedAt},
      ${newPublishedAt},
      ${previousTimingConfidence},
      ${newTimingConfidence},
      ${correctedBy},
      ${reason}
    )
  `;
}
