// Email content templates — mirrors templates.ts (WhatsApp SIDs)
// Each message type maps to a subject + body builder using the same variables

type Vars = Record<string, string>;

interface EmailContent {
  subject: string;
  body: string; // Plain text body (inserted into HTML shell)
}

// ─── Content Builders ────────────────────────────────────────────────────

const CONTENT: Record<string, (v: Vars) => EmailContent> = {
  // ─── Contractor Messages ───
  contractor_dispatch: (v) => ({
    subject: `New Job Request — ${v["1"] || "Maintenance"}`,
    body: `Hi ${v["2"] || "there"},\n\nYou have a new maintenance job request.\n\nProperty: ${v["3"] || "N/A"}\nIssue: ${v["1"] || "N/A"}\nCategory: ${v["4"] || "N/A"}\n\nPlease use the link below to view the job details and submit your quote:\n${v["5"] || ""}\n\nIf you have any questions, reply to this email.`,
  }),
  contractor_job_schedule: (v) => ({
    subject: `Job Scheduled — ${v["2"] || "Property"}`,
    body: `Hi ${v["1"] || "there"},\n\nYour job has been approved and scheduled.\n\nProperty: ${v["2"] || "N/A"}\nIssue: ${v["3"] || "N/A"}\nDate: ${v["4"] || "N/A"}\nTime: ${v["5"] || "N/A"}\nTenant: ${v["6"] || "N/A"}\n\nPlease arrive within the scheduled time window. If you need to reschedule, use the portal link from your original job request.`,
  }),
  contractor_job_confirmed: (v) => ({
    subject: `Booking Confirmed — ${v["2"] || "Property"}`,
    body: `Hi ${v["1"] || "there"},\n\nYour booking has been confirmed.\n\nProperty: ${v["2"] || "N/A"}\nIssue: ${v["3"] || "N/A"}\nDate: ${v["4"] || "N/A"}\nTime: ${v["5"] || "N/A"}\n\nPlease arrive within the scheduled time window.`,
  }),
  contractor_job_reminder: (v) => ({
    subject: `Reminder: Job Tomorrow — ${v["2"] || "Property"}`,
    body: `Hi ${v["1"] || "there"},\n\nThis is a reminder that you have a job scheduled for tomorrow.\n\nProperty: ${v["2"] || "N/A"}\nIssue: ${v["3"] || "N/A"}\nTime: ${v["4"] || "N/A"}\n\nPlease confirm your attendance by using the portal link from your original job request.`,
  }),
  contractor_reminder: (v) => ({
    subject: `Action Required — Pending Job Request`,
    body: `Hi ${v["1"] || "there"},\n\nYou have a pending job request that needs your attention.\n\nProperty: ${v["2"] || "N/A"}\nIssue: ${v["3"] || "N/A"}\n\nPlease use the portal link from your original job request to respond.\n\nIf you are unable to take this job, please let us know so we can arrange an alternative.`,
  }),
  contractor_completion_reminder: (v) => ({
    subject: `Completion Update Needed — ${v["2"] || "Property"}`,
    body: `Hi ${v["1"] || "there"},\n\nWe are following up on a recently completed job.\n\nProperty: ${v["2"] || "N/A"}\nIssue: ${v["3"] || "N/A"}\n\nPlease confirm the job has been completed using the portal link from your original job request.`,
  }),
  contractor_reschedule_request: (v) => ({
    subject: `Reschedule Requested — ${v["2"] || "Property"}`,
    body: `Hi ${v["1"] || "there"},\n\nThe tenant has requested to reschedule your upcoming job.\n\nProperty: ${v["2"] || "N/A"}\nIssue: ${v["3"] || "N/A"}\n\nPlease use the portal link to review and respond to this request.`,
  }),

  // ─── Landlord Messages ───
  ll_ticket_created: (v) => ({
    subject: `New Maintenance Ticket — ${v["2"] || "Property"}`,
    body: `Hi ${v["1"] || "there"},\n\nA new maintenance ticket has been raised for one of your properties.\n\nProperty: ${v["2"] || "N/A"}\nIssue: ${v["3"] || "N/A"}\nCategory: ${v["4"] || "N/A"}\nPriority: ${v["5"] || "N/A"}\n\nYour property manager is handling this. No action is needed from you at this stage.`,
  }),
  landlord_quote: (v) => ({
    subject: `Quote for Approval — ${v["2"] || "Property"}`,
    body: `Hi ${v["1"] || "there"},\n\nA contractor has submitted a quote for your property.\n\nProperty: ${v["2"] || "N/A"}\nIssue: ${v["3"] || "N/A"}\nContractor: ${v["4"] || "N/A"}\nQuote: ${v["5"] || "N/A"}\n\nPlease respond to approve or decline this quote. Your property manager is copied on all updates.`,
  }),
  landlord_allocate: (v) => ({
    subject: `Contractor Quote — Approval Required`,
    body: `Hi ${v["1"] || "there"},\n\nA contractor has quoted for maintenance work at your property.\n\nProperty: ${v["2"] || "N/A"}\nIssue: ${v["3"] || "N/A"}\nContractor: ${v["4"] || "N/A"}\nQuote: ${v["5"] || "N/A"}\nPortal: ${v["6"] || ""}\n\nPlease approve or decline the quote by replying to this email or using the tenant portal link above.`,
  }),
  no_more_contractors: (v) => ({
    subject: `No Contractors Available — ${v["1"] || "Property"}`,
    body: `Hi there,\n\nWe were unable to find an available contractor for the maintenance issue at your property.\n\nProperty: ${v["1"] || "N/A"}\nIssue: ${v["2"] || "N/A"}\n\nYour property manager has been notified and will follow up with alternative arrangements.`,
  }),
  ll_job_booked: (v) => ({
    subject: `Job Booked — ${v["1"] || "Property"}`,
    body: `Hi there,\n\nA maintenance job has been booked at your property.\n\nProperty: ${v["1"] || "N/A"}\nIssue: ${v["2"] || "N/A"}\nContractor: ${v["3"] || "N/A"}\nDate: ${v["4"] || "N/A"}\nTime: ${v["5"] || "N/A"}\n\nThe contractor will attend during the scheduled time window. No action is needed from you.`,
  }),
  ll_job_completed: (v) => ({
    subject: `Job Completed — ${v["1"] || "Property"}`,
    body: `Hi there,\n\nThe maintenance job at your property has been completed.\n\nProperty: ${v["1"] || "N/A"}\nIssue: ${v["2"] || "N/A"}\nContractor: ${v["3"] || "N/A"}\n\nIf there are any concerns, please contact your property manager.`,
  }),
  landlord_followup: (v) => ({
    subject: `Action Required — Pending Approval`,
    body: `Hi ${v["1"] || "there"},\n\nA maintenance request is awaiting your response.\n\nProperty: ${v["2"] || "N/A"}\nIssue: ${v["3"] || "N/A"}\n\nPlease respond at your earliest convenience so we can proceed with the works.`,
  }),
};

// ─── HTML Shell ──────────────────────────────────────────────────────────

function htmlShell(body: string): string {
  // Convert newlines to <br> for HTML
  const htmlBody = body
    .split("\n")
    .map((line) => (line.trim() === "" ? "<br>" : `<p style="margin:0 0 8px 0;color:#374151;font-size:15px;line-height:1.6;">${escapeHtml(line)}</p>`))
    .join("");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <!-- Header -->
        <tr><td style="background-color:#1e40af;padding:24px 32px;">
          <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.02em;">Yarro</h1>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:32px;">
          ${htmlBody}
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:16px 32px;border-top:1px solid #e5e7eb;">
          <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.5;">Powered by Yarro &mdash; Maintenance made simple</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── Public API ──────────────────────────────────────────────────────────

export interface EmailTemplate {
  subject: string;
  html: string;
}

/**
 * Build email content for a given message type.
 * Returns null if no email template exists for this message type (WhatsApp-only messages).
 */
export function buildEmail(
  messageType: string,
  variables: Record<string, string>,
): EmailTemplate | null {
  const builder = CONTENT[messageType];
  if (!builder) return null;

  const content = builder(variables);
  return {
    subject: content.subject,
    html: htmlShell(content.body),
  };
}
