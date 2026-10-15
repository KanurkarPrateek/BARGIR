// Shown on forms opened from BackDate Management: the record is old and is
// being entered now, so nothing is sent to the member.
export function BackdateBanner({ what }: { what: string }) {
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
      <strong>BackDate entry.</strong> Use this for {what} that happened before you started using this software.
      Pick the real past dates. No WhatsApp message, invoice or email is sent.
    </div>
  )
}
