# Security Specification (`security_spec.md`)

## 1. Data Invariants
1. **Global Default Deny**: Any path not explicitly matched is unconditionally denied (`allow read, write: if false;`).
2. **Verified Identity**: All mutations require an authenticated user with a verified email (`request.auth != null && request.auth.token.email_verified == true`).
3. **Path Variable Hardening**: Every document ID (`{adminId}`, `{roomId}`, `{elementId}`) must satisfy `isValidId(id)` (`id is string && id.size() >= 1 && id.size() <= 128 && id.matches('^[a-zA-Z0-9_\\-]+$')`).
4. **Master Gate & Relational Integrity**: Every `CanvasItem` under `/rooms/{roomId}/elements/{elementId}` requires the parent `/rooms/{roomId}` document to exist (`exists(...)`), not be locked (`get(...).data.isLocked == false`), and match `incoming().roomId == roomId`.
5. **Anti-Update-Gap & Strict Keys**: Every `create` and `update` must pass `isValidRoom(incoming())` or `isValidCanvasItem(incoming())` enforcing `hasAll` and `hasOnly` key checks, strict type/length bounds, and `request.time` temporal integrity.
6. **Query Enforcer**: `allow list` on `/rooms` and `/rooms/{roomId}/elements` explicitly evaluates `resource.data` (`resource.data.isPublic == true || resource.data.ownerId == request.auth.uid`) and never uses blanket `isSignedIn()`.

## 2. The "Dirty Dozen" Payloads
1. **Unauthenticated Write**: `auth = null`, creating `/rooms/ana-oda` -> `PERMISSION_DENIED`.
2. **Unverified Email Spoof**: `auth = { uid: 'u1', token: { email: 'RepSouler42@gmail.com', email_verified: false } }` -> `PERMISSION_DENIED`.
3. **Shadow Field Injection on Create**: Creating `/rooms/ana-oda` with an undeclared field `isSuperAdmin: true` -> Rejected by `data.keys().hasOnly(...)`.
4. **Shadow Field Injection on Update**: Updating `/rooms/ana-oda` with `hacked: 1` -> Rejected by `affectedKeys().hasOnly(...)` and `isValidRoom(incoming())`.
5. **Identity Spoofing on Create**: User `u1` creates `/rooms/room-1` with `ownerId: 'u2'` -> Rejected by `incoming().ownerId == request.auth.uid`.
6. **Immutable Field Tampering on Update**: Updating `ownerId` or `createdAt` on `/rooms/room-1` -> Rejected by `incoming().ownerId == existing().ownerId && incoming().createdAt == existing().createdAt`.
7. **Timestamp Forgery**: Sending a past or future `createdAt` or `updatedAt` timestamp -> Rejected by `incoming().createdAt == request.time` / `incoming().updatedAt == request.time`.
8. **ID Poisoning Attack**: Creating a room with a 500-char ID or special characters `room/../../hack` -> Rejected by `isValidId(roomId)`.
9. **Value Poisoning / Denial of Wallet**: Sending a 200,000-char `codeContent` string -> Rejected by `data.codeContent.size() <= 50000`.
10. **Orphaned Subcollection Write**: Creating `/rooms/non-existent/elements/el-1` when `/rooms/non-existent` does not exist -> Rejected by Master Gate `exists(/databases/$(database)/documents/rooms/$(roomId))`.
11. **Locked Room Bypass**: Creating or updating an element in `/rooms/{roomId}/elements/{elementId}` when parent room has `isLocked == true` and user is not the room owner/admin -> Rejected by Master Gate check.
12. **Unauthorized Blanket List**: Listing `/rooms` where `isPublic == false` and `ownerId != request.auth.uid` -> Rejected by Query Enforcer `resource.data.isPublic == true || resource.data.ownerId == request.auth.uid`.
