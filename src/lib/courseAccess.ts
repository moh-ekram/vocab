import { Course } from '../types';

/**
 * Helper to check if a user is enrolled in a course (case-insensitive & trimmed)
 */
export function isCourseEnrolled(courseId: string | null | undefined, enrolledIds: string[]): boolean {
  if (!courseId || !enrolledIds || !Array.isArray(enrolledIds)) return false;
  const normId = courseId.trim().toLowerCase();
  return enrolledIds.some(id => typeof id === 'string' && id.trim().toLowerCase() === normId);
}

/**
 * Helper to strictly enforce course access logic across the app.
 * A user HAS ACCESS if:
 * 1. The user is enrolled in the course (`enrolledCourseIds` contains courseId).
 * 2. The course is public (`!course.isRestricted`).
 * 3. The user is an Admin (`mohammad.001ekram@gmail.com`).
 * 4. The user is the Creator of the course.
 * 5. The user's email is listed in `course.allowedUsers` (and not expired).
 */
export function isCourseAccessible(
  course: Course | null | undefined,
  enrolledIds: string[],
  userEmail?: string | null
): boolean {
  if (!course || !course.id) return false;

  const normCourseId = course.id.trim().toLowerCase();
  const cleanUserEmail = userEmail?.trim().toLowerCase() || '';

  // 1. Enrolled courses are always accessible immediately
  if (isCourseEnrolled(normCourseId, enrolledIds)) {
    return true;
  }

  // 2. Admin user email bypasses all restrictions
  if (cleanUserEmail === 'mohammad.001ekram@gmail.com') {
    return true;
  }

  // 3. Course creator bypasses restrictions
  if (course.createdBy && course.createdBy.trim().toLowerCase() === cleanUserEmail) {
    return true;
  }

  // 4. Allowed users check for restricted courses
  if (course.isRestricted) {
    if (!cleanUserEmail) return false;

    if (course.allowedUsers && Array.isArray(course.allowedUsers)) {
      const isAllowed = course.allowedUsers.some(
        allowed => typeof allowed === 'string' && allowed.trim().toLowerCase() === cleanUserEmail
      );

      if (isAllowed) {
        // Check expiry date if specified
        if (course.allowedUsersExpiry && typeof course.allowedUsersExpiry === 'object') {
          const matchingKey = Object.keys(course.allowedUsersExpiry).find(
            k => k.trim().toLowerCase() === cleanUserEmail
          );
          if (matchingKey) {
            const expiryStr = course.allowedUsersExpiry[matchingKey];
            if (expiryStr) {
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const expiryDate = new Date(expiryStr);
              expiryDate.setHours(23, 59, 59, 999);
              if (today > expiryDate) {
                return false; // Access expired
              }
            }
          }
        }
        return true;
      }
    }
    return false;
  }

  // 5. Public courses (isRestricted is false or undefined) are accessible to anyone
  return true;
}
