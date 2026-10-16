// The wording of every WhatsApp message the software writes by itself:
// starter workflows for new gyms, one-tap reminders, trainer notices, offer
// templates. WhatsApp shows *text* in bold and ~text~ struck through.
//
// Workflow templates use {tags} that are filled per person; the helper
// functions below build ready-to-send text.

import { rupees } from "@/lib/membership";

export const WORKFLOW_TEMPLATES = {
  welcome: `Hi {first_name} 👋

Thank you for your interest in *{gym}*! 💪

We'd love to show you around 🏋️
📍 Drop in any time to see the gym
💬 Reply here for plans, timings or trainers

See you soon! 🙌
— Team {gym}`,

  enquiryFollowup: `Hi {first_name} 😊

Just checking in from *{gym}* 🏋️
Ready to start your fitness journey? 💪

✅ Plans for every budget
✅ Trainers to guide you
✅ A friendly community

Reply here and we'll help you pick the right plan 🙌`,

  expiringSoon: `Hi {first_name} ⏰

Your *{service}* membership at *{gym}* ends on *{expiry_date}*.

Don't break your streak! 🔥 Renew now and keep going strong 💪
{offer}

Reply *RENEW* or visit the front desk 🙌`,

  expired: `Hi {first_name} 👋

We miss you at *{gym}*! 😢
Your *{service}* membership ended on *{expiry_date}*.

Come back and pick up where you left off 💪🔥
{offer}

Reply here to renew 🙌`,

  birthday: `🎉🎂 *Happy Birthday, {first_name}!* 🎂🎉

Wishing you a year full of health, strength and happiness 💪✨
Keep shining and keep lifting! 🏋️

With love,
Team {gym} ❤️`,

  invoice: `Hi {first_name} 🙏

Thank you for choosing *{gym}*! 💪🎉

🧾 *Your membership*
📦 Plan: {service}
💰 Amount: {amount}
✅ Paid: {paid}
⏳ Balance: {due}
📅 Valid till: {expiry_date}

Let's crush those goals together! 🔥`,

  receipt: `Hi {first_name} ✅

Payment received, thank you! 🙏

💰 Amount: {paid}
📦 Plan: {service}
⏳ Balance: {due}

— Team {gym} 💪`,
};

// Offers about a package (WhatsApp Management → Offers).
export const OFFER_TEMPLATES = {
  withOffer: (hasEndDate: boolean) => `🎉 *Special offer at {gym}!* 🎉

Hi {first_name} 👋

🔥 *{package}* now just *{offer_price}* ~{price}~
🏷️ {discount}${hasEndDate ? "\n⏰ Valid till {valid_till}" : ""}

Don't miss it! Reply here to grab your spot 💪`,
  noOffer: `Hi {first_name} 👋

Start your fitness journey at *{gym}* 💪
📦 *{package}* for just *{price}*

Reply here to join or to know more 🙌`,
};

export const TEST_MESSAGE = "✅ Test message from your gym software. WhatsApp is connected and ready! 💪";

// ---------- one-tap messages staff send from the app ----------

export const paymentReminder = (name: string, service: string, due: number, gym: string) => `Hi ${name} 👋

A gentle reminder from *${gym}* 🙏

💰 Balance due: *${rupees(due)}*
📦 Plan: ${service}

You can pay at the front desk or reply here. Thank you! 💪`;

// Sent as the caption of the invoice PDF.
export const invoiceShare = (name: string, service: string, gym: string) => `Hi ${name} 🙏

Thank you for choosing *${gym}*! 💪
🧾 Here is the invoice for your *${service}*.

Stay healthy, stay strong! 🔥`;

// `daysLeft`: negative once ended, 0 today, 1 tomorrow...
export function renewalReminder(name: string, service: string, endDate: string, daysLeft: number, gym: string): string {
  const when =
    daysLeft < 0 ? `ended on *${endDate}* 😢`
    : daysLeft === 0 ? `ends *today* (${endDate}) ⏰`
    : daysLeft === 1 ? `ends *tomorrow* (${endDate}) ⏰`
    : `ends in *${daysLeft} days* (${endDate}) ⏰`;
  return `Hi ${name} 👋

Your *${service}* membership at *${gym}* ${when}

${daysLeft < 0 ? "We miss you! Come back and pick up where you left off 💪🔥" : "Renew now and keep your streak going 🔥💪"}

Reply here or visit the front desk to renew 🙌`;
}

export const birthdayWish = (name: string, gym: string) => `🎉🎂 *Happy Birthday, ${name}!* 🎂🎉

Wishing you a year full of health, strength and happiness 💪✨
Keep shining and keep lifting! 🏋️

With love,
Team ${gym} ❤️`;

// Sent when someone's privacy settings do not let the gym add them to its
// group. {group_link} is filled in by the sender.
export const groupInvite = (name: string, group: string, gym: string) => `Hi ${name} 👋

Welcome to *${gym}*! 🎉
Join our WhatsApp group *${group}* for updates, timings and offers 💪

👉 {group_link}`;

// ---------- notices to trainers ----------

export const trainerNewEnquiry = (gym: string, lead: { name: string; phone: string; message?: string | null; followupDate?: string | null }) =>
  [
    `🆕 *New enquiry assigned to you*`,
    ``,
    `👤 ${lead.name}`,
    `📞 ${lead.phone}`,
    lead.message ? `📝 ${lead.message}` : null,
    lead.followupDate ? `📅 Follow up on ${lead.followupDate}` : null,
    ``,
    `Please reach out soon 🙌 — ${gym}`,
  ].filter((line) => line !== null).join("\n");

export const trainerNewClient = (gym: string, name: string, phone: string) => `🏋️ *New client for you!*

👤 ${name}
📞 ${phone}

Please connect with them today 💪
— ${gym}`;

export const trainerDailyFollowups = (gym: string, people: { name: string; phone: string }[]) =>
  [`📋 *Today's follow-ups* (${people.length})`, ``, ...people.map((p) => `• ${p.name} – ${p.phone}`), ``, `Good luck! 💪 — ${gym}`].join("\n");
