import { deriveMonthKey, minutesBetween } from "../../lib/time.js";
import { queryReminderCandidates, type ReminderCandidate } from "../../db/queries/reminder-candidates.js";
import { hasOpsAlertPublication } from "../../db/queries/job-runs.js";

export type OpsAlertType = "low_confidence" | "low_participation";

export interface OpsAlert {
  raidPostId: string;
  clientName: string;
  platform: string;
  postUrl: string;
  ageMinutes: number;
  earlyWindowActions: number;
  timingConfidence: "high" | "low";
  alertType: OpsAlertType;
  alertWindowKey: string;
}

export interface OpsSurfacingDigest {
  text: string;
  alerts: OpsAlert[];
}

export interface BuildOpsSurfacingDigestParams {
  now?: Date;
  lookbackHours?: number;
}

export interface BuildOpsSurfacingDigestDependencies {
  queryReminderCandidates?: typeof queryReminderCandidates;
  hasOpsAlertPublication?: typeof hasOpsAlertPublication;
}

function buildAlertWindowKey(candidate: ReminderCandidate): string {
  return deriveMonthKey(candidate.publishedAt ?? candidate.slackPostedAt);
}

function toReferenceTime(candidate: ReminderCandidate): Date {
  return candidate.publishedAt ?? candidate.slackPostedAt;
}

function buildAlertText(alert: OpsAlert): string {
  const reason =
    alert.alertType === "low_confidence"
      ? "timing confidence is low"
      : `only ${alert.earlyWindowActions} early actions after ${alert.ageMinutes} minutes`;

  return `- ${alert.clientName} (${alert.platform}) ${reason}: ${alert.postUrl}`;
}

export async function buildOpsSurfacingDigest(
  params: BuildOpsSurfacingDigestParams = {},
  dependencies: BuildOpsSurfacingDigestDependencies = {},
): Promise<OpsSurfacingDigest> {
  const now = params.now ?? new Date();
  const lookbackHours = params.lookbackHours ?? 24;
  const lookbackStart = new Date(now.getTime() - lookbackHours * 60 * 60 * 1000);
  const candidates = await (dependencies.queryReminderCandidates ?? queryReminderCandidates)({
    lookbackStart,
    now,
  });
  const alerts: OpsAlert[] = [];

  for (const candidate of candidates) {
    const ageMinutes = Math.max(minutesBetween(now, toReferenceTime(candidate)), 0);
    const alertWindowKey = buildAlertWindowKey(candidate);
    const potentialAlerts: OpsAlert[] = [];

    if (candidate.timingConfidence === "low") {
      potentialAlerts.push({
        raidPostId: candidate.raidPostId,
        clientName: candidate.clientName,
        platform: candidate.platform,
        postUrl: candidate.postUrl,
        ageMinutes,
        earlyWindowActions: candidate.earlyWindowActions,
        timingConfidence: candidate.timingConfidence,
        alertType: "low_confidence",
        alertWindowKey,
      });
    }

    if (ageMinutes >= 20 && candidate.earlyWindowActions < 3) {
      potentialAlerts.push({
        raidPostId: candidate.raidPostId,
        clientName: candidate.clientName,
        platform: candidate.platform,
        postUrl: candidate.postUrl,
        ageMinutes,
        earlyWindowActions: candidate.earlyWindowActions,
        timingConfidence: candidate.timingConfidence,
        alertType: "low_participation",
        alertWindowKey,
      });
    }

    for (const alert of potentialAlerts) {
      const alreadyPublished = await (dependencies.hasOpsAlertPublication ?? hasOpsAlertPublication)(
        {
          raidPostId: alert.raidPostId,
          alertType: alert.alertType,
          alertWindowKey: alert.alertWindowKey,
        },
      );

      if (!alreadyPublished) {
        alerts.push(alert);
      }
    }
  }

  if (alerts.length === 0) {
    return {
      text: "No ops alerts for the current reminder window.",
      alerts,
    };
  }

  return {
    text: ["Ops surfacing digest:", ...alerts.map(buildAlertText)].join("\n"),
    alerts,
  };
}
