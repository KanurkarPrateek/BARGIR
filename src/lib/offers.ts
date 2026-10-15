// Package offers: a percentage or rupee discount, optionally until a date.
// Shared by the sale form, package list, WhatsApp offers and reminders.
import { endOfDay } from "date-fns";
import { parseDate, rupees } from "./membership";

export interface OfferFields {
  name: string;
  price: number;
  discountType: string | null;
  discountValue: number;
  offerTill: string | null;
}

export interface ActiveOffer {
  amountOff: number;
  offerPrice: number;
  // "10% off" / "₹200 off"
  label: string;
  till: string | null;
}

export function activeOffer(pkg: OfferFields, today = new Date()): ActiveOffer | null {
  if (!pkg.discountType || !(pkg.discountValue > 0)) return null;
  if (pkg.offerTill && endOfDay(parseDate(pkg.offerTill)) < today) return null;
  const amountOff = pkg.discountType === "percent"
    ? Math.round((pkg.price * Math.min(pkg.discountValue, 100)) / 100)
    : Math.min(pkg.discountValue, pkg.price);
  return {
    amountOff,
    offerPrice: pkg.price - amountOff,
    label: pkg.discountType === "percent" ? `${pkg.discountValue}% off` : `${rupees(pkg.discountValue)} off`,
    till: pkg.offerTill,
  };
}

// Values for the {package}, {price}, {offer_price}, {discount} and
// {valid_till} tags in WhatsApp messages.
export function offerValues(pkg: OfferFields) {
  const offer = activeOffer(pkg);
  return {
    package: pkg.name,
    price: rupees(pkg.price),
    offer_price: rupees(offer?.offerPrice ?? pkg.price),
    discount: offer?.label ?? "",
    valid_till: offer?.till ?? "",
  };
}

// One sentence for renewal reminders: "Renew now at ₹900 (10% off till 31-10-2026)."
export function offerSentence(pkg: OfferFields): string {
  const offer = activeOffer(pkg);
  if (!offer) return "";
  return `Renew now at ${rupees(offer.offerPrice)} (${offer.label}${offer.till ? ` till ${offer.till}` : ""}).`;
}
