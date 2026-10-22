const SPECIAL_CHARACTER_PATTERN = /[!@#$%^&*()_+\-=\[\]{}|;:,.<>?~`]/;

export function getPasswordRequirements(password, { minLength, username = '', email = '', confirmation } = {}) {
  const normalizedPassword = password.toLowerCase();
  const normalizedUsername = username.toLowerCase().trim();
  const emailIdentifier = email.toLowerCase().trim().split('@')[0];
  const checks = [
    { label: `At least ${minLength} characters`, passed: password.length >= minLength },
    { label: 'No more than 128 characters', passed: password.length <= 128 },
    { label: 'One uppercase letter (A-Z)', passed: /[A-Z]/.test(password) },
    { label: 'One lowercase letter (a-z)', passed: /[a-z]/.test(password) },
    { label: 'One numerical digit (0-9)', passed: /[0-9]/.test(password) },
    { label: 'One allowed special symbol (!@#$%^&*)', passed: SPECIAL_CHARACTER_PATTERN.test(password) },
    {
      label: 'Does not contain your username',
      passed: normalizedUsername.length < 3 || !normalizedPassword.includes(normalizedUsername),
    },
    {
      label: 'Does not contain your email identifier',
      passed: emailIdentifier.length < 3 || !normalizedPassword.includes(emailIdentifier),
    },
  ];

  if (confirmation !== undefined) {
    checks.push({
      label: 'Passwords match',
      passed: password.length > 0 && password === confirmation,
    });
  }

  return checks;
}
