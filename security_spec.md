# Security Specification: Vocabulary Memorizer Firestore Rules

## 1. Data Invariants
1. **User Identity Isolation**: A user can only read and write their own profile document `/users/{userId}` where `userId` matches `request.auth.uid`. No user can view or alter another user's custom progress, folders, or settings directly.
2. **Global Leaderboard Exception**: Signed-in users can query/list the `/users` collection to calculate leaderboards, but direct access (`get`) to any individual's private profile document (which contains PII like emails and notes) is strictly forbidden for anyone other than the owner or the system administrator (`mohammad.001ekram@gmail.com`).
3. **Course Data Integrity**: Course resources in `/courses/{courseId}` are read-only to all visitors and signed-in students. They can only be modified (create, update, delete) by the system administrator.
4. **Immutability of History**: Fields like `createdAt` are immutable and cannot be changed or dropped once created.
5. **Type and Size Safety**: All incoming fields must be checked for appropriate types (strings, maps, lists, integers) and bounded sizes to prevent denial-of-wallet and storage-bloat attacks.

---

## 2. The "Dirty Dozen" Malicious Payloads

### Payload 1: Identity Spoofing (Write to Another User's UID)
- **Path**: `/users/attacker_uid` (Authenticated as `victim_uid`)
- **Operation**: `create`
- **Payload**: `{ "email": "victim@example.com", "progress": {} }`
- **Expected Outcome**: `PERMISSION_DENIED`

### Payload 2: Privilege Escalation (Student Modifying Course Catalog)
- **Path**: `/courses/gre_vocab_1` (Authenticated as a regular student)
- **Operation**: `create`
- **Payload**: `{ "title": "Hacked Course", "totalGroups": 1, "words": [] }`
- **Expected Outcome**: `PERMISSION_DENIED`

### Payload 3: Schema Violation (Missing Required Email Field)
- **Path**: `/users/user_uid` (Authenticated as `user_uid`)
- **Operation**: `create`
- **Payload**: `{ "progress": {}, "folders": [] }`
- **Expected Outcome**: `PERMISSION_DENIED`

### Payload 4: Resource Poisoning (Extremely Long ID String)
- **Path**: `/users/very_long_garbage_id_over_128_characters_leading_to_wallet_exhaustion` (Authenticated as matching uid)
- **Operation**: `create`
- **Payload**: `{ "email": "user@example.com" }`
- **Expected Outcome**: `PERMISSION_DENIED`

### Payload 5: Immutability Violation (Modifying `createdAt`)
- **Path**: `/users/user_uid` (Authenticated as `user_uid`)
- **Operation**: `update`
- **Payload**: `{ "email": "user@example.com", "createdAt": "2026-01-01T00:00:00.000Z", "updatedAt": "2026-07-17T00:00:00.000Z" }`
- **Action**: Change `createdAt` from original value.
- **Expected Outcome**: `PERMISSION_DENIED`

### Payload 6: Ghost Field / Shadow Update Attack
- **Path**: `/users/user_uid` (Authenticated as `user_uid`)
- **Operation**: `update`
- **Payload**: `{ "email": "user@example.com", "isAdmin": true, "updatedAt": "2026-07-17T00:00:00.000Z" }`
- **Expected Outcome**: `PERMISSION_DENIED` (Using strict affectedKeys)

### Payload 7: Type Poisoning (Invalid Type for Integer Field)
- **Path**: `/users/user_uid` (Authenticated as `user_uid`)
- **Operation**: `update`
- **Payload**: `{ "email": "user@example.com", "quizScore": "not_an_integer", "updatedAt": "2026-07-17T00:00:00.000Z" }`
- **Expected Outcome**: `PERMISSION_DENIED`

### Payload 8: Direct PII Leak (Reading Another User's Profile via `get`)
- **Path**: `/users/victim_uid` (Authenticated as `attacker_uid`)
- **Operation**: `get`
- **Expected Outcome**: `PERMISSION_DENIED`

### Payload 9: Unauthorized Write by Unauthenticated User
- **Path**: `/users/any_uid` (Unauthenticated / Anonymous)
- **Operation**: `create`
- **Payload**: `{ "email": "anonymous@example.com" }`
- **Expected Outcome**: `PERMISSION_DENIED`

### Payload 10: Unauthorized Course Catalog Manipulation by Anonymous User
- **Path**: `/courses/new_course` (Unauthenticated)
- **Operation**: `create`
- **Payload**: `{ "title": "Anonymous Course" }`
- **Expected Outcome**: `PERMISSION_DENIED`

### Payload 11: Attempting to Inject Excessively Large Fields
- **Path**: `/users/user_uid` (Authenticated as `user_uid`)
- **Operation**: `update`
- **Payload**: `{ "email": "user@example.com", "activeCourseId": "a".repeat(200), "updatedAt": "2026-07-17T00:00:00.000Z" }`
- **Expected Outcome**: `PERMISSION_DENIED`

### Payload 12: Course Deletion by Regular User
- **Path**: `/courses/gre_vocab_1` (Authenticated as a regular student)
- **Operation**: `delete`
- **Expected Outcome**: `PERMISSION_DENIED`
