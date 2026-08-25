export const PASSWORD_MIN_LENGTH = 10
export const PASSWORD_MAX_LENGTH = 128

const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password123', 'passw0rd', 'p@ssword',
  'qwerty123', 'qwertyuiop', '1234567890', '12345678910',
  'letmein123', 'welcome123', 'admin12345', 'iloveyou123',
  'abcd1234', 'abc12345', 'football123', 'monkey1234',
  'jobfinder', 'jobfinder1', 'jobfinder123',
])

export function passwordProblems(password) {
  const value = String(password ?? '')
  const problems = []

  if (value.length < PASSWORD_MIN_LENGTH) {
    problems.push(`At least ${PASSWORD_MIN_LENGTH} characters`)
  }
  if (value.length > PASSWORD_MAX_LENGTH) {
    problems.push(`At most ${PASSWORD_MAX_LENGTH} characters`)
  }
  if (!/[a-z]/.test(value)) problems.push('One lowercase letter')
  if (!/[A-Z]/.test(value)) problems.push('One uppercase letter')
  if (!/[0-9]/.test(value)) problems.push('One number')
  if (COMMON_PASSWORDS.has(value.toLowerCase())) {
    problems.push('Not a commonly used password')
  }

  return problems
}

export function isAcceptablePassword(password) {
  return passwordProblems(password).length === 0
}
