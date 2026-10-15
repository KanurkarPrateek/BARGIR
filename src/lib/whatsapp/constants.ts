// Shared between server code and the admin UI (no server-only imports here).

export type WorkflowTrigger =
  | "enquiry_created"
  | "enquiry_followup"
  | "membership_expiry"
  | "birthday"
  | "sale_created"
  | "payment_received";

export type CampaignAudience =
  | "all_members"
  | "active_members"
  | "expired_members"
  | "enquiries"
  | "everyone"
  | "renewal_due"
  | "dormant";

export const TRIGGERS: {
  value: WorkflowTrigger;
  label: string;
  description: string;
  // Date based triggers can be shifted by a number of days.
  hasOffset: boolean;
  placeholders: string[];
}[] = [
  {
    value: "enquiry_created",
    label: "New enquiry added",
    description: "Sent right away when an enquiry is created.",
    hasOffset: false,
    placeholders: ["name", "first_name", "gym", "followup_date"],
  },
  {
    value: "enquiry_followup",
    label: "Enquiry follow-up date",
    description: "Sent around the enquiry's follow-up date.",
    hasOffset: true,
    placeholders: ["name", "first_name", "gym", "followup_date"],
  },
  {
    value: "membership_expiry",
    label: "Membership expiry",
    description:
      "Sent around the day a membership ends. Skipped if the member has already renewed.",
    hasOffset: true,
    placeholders: ["name", "first_name", "gym", "service", "expiry_date", "offer"],
  },
  {
    value: "birthday",
    label: "Member birthday",
    description: "Sent around the member's birthday.",
    hasOffset: true,
    placeholders: ["name", "first_name", "gym"],
  },
  {
    value: "sale_created",
    label: "Plan sold (invoice)",
    description: "Sent right away when a plan is sold, with a link to the invoice.",
    hasOffset: false,
    placeholders: ["name", "first_name", "gym", "service", "amount", "paid", "due", "expiry_date", "invoice_link"],
  },
  {
    value: "payment_received",
    label: "Payment received (receipt)",
    description: "Sent right away when a balance payment is collected.",
    hasOffset: false,
    placeholders: ["name", "first_name", "gym", "service", "paid", "due", "invoice_link"],
  },
];

export const AUDIENCES: { value: CampaignAudience; label: string }[] = [
  { value: "active_members", label: "Active members" },
  { value: "renewal_due", label: "Pending renewal (ending soon or ended in the last 30 days)" },
  { value: "dormant", label: "Dormant members (paying but not coming for 7+ days)" },
  { value: "expired_members", label: "Members without an active membership" },
  { value: "all_members", label: "All members" },
  { value: "enquiries", label: "Enquiries (not yet members)" },
  { value: "everyone", label: "Everyone (members + enquiries)" },
];

export const CAMPAIGN_PLACEHOLDERS = ["name", "first_name", "gym"];
// Extra tags when an offer is about a particular package.
export const PACKAGE_PLACEHOLDERS = ["package", "price", "offer_price", "discount", "valid_till"];

export function describeOffset(offsetDays: number): string {
  if (offsetDays === 0) return "on the day";
  const n = Math.abs(offsetDays);
  return `${n} day${n === 1 ? "" : "s"} ${offsetDays < 0 ? "before" : "after"}`;
}

export function renderTemplate(
  template: string,
  values: Record<string, string | undefined | null>
): string {
  return template
    .replace(/\{(\w+)\}/g, (match, key) => (key in values ? values[key] ?? "" : match))
    // An empty tag such as {offer} must not leave a double space behind.
    .replace(/[ \t]{2,}/g, " ")
    // ...nor a run of empty lines.
    .replace(/\n[ \t]+\n/g, "\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
