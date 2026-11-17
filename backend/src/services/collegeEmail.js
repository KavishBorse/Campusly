export function internalStudentEmailMatchesEnrollment(email, enrollmentId) {
  const configuredDomain = process.env.INTERNAL_STUDENT_EMAIL_DOMAIN?.trim().toLowerCase();
  const requiredDomain = (configuredDomain || 'students.mituniversity.edu.in').replace(/^@/, '');
  const [localPart, domain, ...extra] = email.trim().toLowerCase().split('@');
  return extra.length === 0 && Boolean(localPart && domain && enrollmentId) &&
    domain === requiredDomain && localPart === enrollmentId.trim().toLowerCase();
}
