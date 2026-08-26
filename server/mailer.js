export function createMailer(config = {}) {
  const { provider = 'none', apiKey = '', from = '' } = config ?? {}

  if (provider !== 'resend' || !apiKey) {
    return {
      enabled: false,
      async send() {
        throw new Error('Email delivery is not configured')
      },
    }
  }

  return {
    enabled: true,
    async send({ to, subject, text, html }) {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from, to: [to], subject, text, html }),
        signal: AbortSignal.timeout(10_000),
      })

      if (!response.ok) {
        const detail = await response.text().catch(() => '')
        throw new Error(`Email provider rejected the message (${response.status}): ${detail.slice(0, 200)}`)
      }
    },
  }
}

export function passwordResetEmail(resetUrl, expiryMinutes, accountLabel = '') {
  const forAccount = accountLabel ? ` for your ${accountLabel} account` : ''
  const text = [
    `We received a request to reset your JobFinder password${forAccount}.`,
    '',
    `Open this link to choose a new password: ${resetUrl}`,
    '',
    `The link expires in ${expiryMinutes} minutes and can only be used once.`,
    'If you did not request this, you can ignore this email. Your password will not change.',
  ].join('\n')

  const html = `
    <div style="font-family:Inter,Arial,sans-serif;color:#111827;line-height:1.5">
      <h2 style="margin:0 0 16px">Reset your JobFinder password</h2>
      <p>We received a request to reset your JobFinder password${forAccount}.</p>
      <p style="margin:24px 0">
        <a href="${resetUrl}"
           style="background:#16a34a;color:#fff;border-radius:6px;padding:12px 20px;
                  text-decoration:none;font-weight:600;display:inline-block">
          Choose a new password
        </a>
      </p>
      <p style="color:#6b7280;font-size:14px">
        The link expires in ${expiryMinutes} minutes and can only be used once.
      </p>
      <p style="color:#6b7280;font-size:14px">
        If you did not request this, you can ignore this email. Your password will not change.
      </p>
    </div>
  `.trim()

  const subject = accountLabel
    ? `Reset your JobFinder password (${accountLabel} account)`
    : 'Reset your JobFinder password'

  return { subject, text, html }
}
