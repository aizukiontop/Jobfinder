export const PASSWORD_MIN_LENGTH = 10

const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password123', 'passw0rd', 'p@ssword',
  'qwerty123', 'qwertyuiop', '1234567890', '12345678910',
  'letmein123', 'welcome123', 'admin12345', 'iloveyou123',
  'abcd1234', 'abc12345', 'football123', 'monkey1234',
  'jobfinder', 'jobfinder1', 'jobfinder123',
])

export interface PasswordRule {
  label: string
  met: boolean
}

export function passwordRules(password: string): PasswordRule[] {
  const value = password ?? ''
  return [
    { label: `At least ${PASSWORD_MIN_LENGTH} characters`, met: value.length >= PASSWORD_MIN_LENGTH },
    { label: 'One lowercase letter', met: /[a-z]/.test(value) },
    { label: 'One uppercase letter', met: /[A-Z]/.test(value) },
    { label: 'One number', met: /[0-9]/.test(value) },
    { label: 'Not a commonly used password', met: value.length > 0 && !COMMON_PASSWORDS.has(value.toLowerCase()) },
  ]
}

export function isAcceptablePassword(password: string): boolean {
  return passwordRules(password).every(rule => rule.met)
}
