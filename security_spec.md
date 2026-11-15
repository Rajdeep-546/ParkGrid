# Security Specification & Red-Team Payloads — ParkGrid

## 1. Data Invariants
1. **Identity & Privilege Isolation**: No user may register as `admin` or escalate `role`, `idVerified`, or `status` on their own `users/{userId}` document. Only an authenticated verified super-admin (`rajdeep80010@gmail.com` or `/admins/{uid}`) may list all users or suspend/verify accounts.
2. **PII Protection**: `users/{userId}` contains `email`, `phone`, `licensePlate`, and `payoutId`. Read/get is restricted strictly to the document owner (`uid == request.auth.uid`) or `isAdmin()`. Blanket reads on `users` are forbidden.
3. **Vendor Ownership & Approval Gate**: Only verified vendors (`vendorId == request.auth.uid`) may create `parking_slots`. Newly created vendor slots MUST start with `approvalStatus == 'pending'` (unless created by an admin). Vendors cannot self-approve (`approvalStatus` can only transition to `'approved'` or `'rejected'` by `isAdmin()`).
4. **Booking Integrity & Relational Existence**: A booking MUST reference an existing, approved, open `parking_slots/{slotId}` document (`exists(...)` and `get(...).data.approvalStatus == 'approved'`). `driverId` MUST equal `request.auth.uid`. `vendorId` MUST match the slot's `vendorId`.
5. **Terminal State Locking**: Once a booking reaches `'completed'` or `'cancelled'`, non-admin clients cannot mutate it back to `'active'` or alter `totalAmount`.
6. **Temporal Integrity**: `createdAt` and `updatedAt` MUST equal `request.time` (serverTimestamp) on create, and `createdAt` is immutable on update while `updatedAt == request.time`.
7. **Size & ID Poisoning Guards**: All document IDs match `^[a-zA-Z0-9_\-]+$` with length <= 128. Every string has strict maxLength bounds.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Self-Assigned Admin Role on Signup**: `POST /users/{uid}` with `{ role: "admin" }` -> `PERMISSION_DENIED`.
2. **PII Read Leak**: Non-owner authenticated user calls `GET /users/{otherUid}` -> `PERMISSION_DENIED`.
3. **Blanket User List Scraping**: Non-admin calls `LIST /users` -> `PERMISSION_DENIED`.
4. **Shadow Ghost Field Injection**: `POST /parking_slots/{id}` with extra field `isFeaturedOverride: true` -> `PERMISSION_DENIED`.
5. **Vendor Self-Approval Bypass**: Vendor creates slot with `approvalStatus: "approved"` -> `PERMISSION_DENIED`.
6. **Vendor Approval Escalation on Update**: Vendor updates own pending slot to `approvalStatus: "approved"` -> `PERMISSION_DENIED`.
7. **Cross-Vendor Slot Hijack**: Vendor A updates Vendor B's slot `hourlyRate` -> `PERMISSION_DENIED`.
8. **Orphaned / Unapproved Booking Creation**: Driver creates booking for non-existent or `pending` `slotId` -> `PERMISSION_DENIED`.
9. **Spoofed Driver Identity on Booking**: Driver A creates booking with `driverId: "driverB"` -> `PERMISSION_DENIED`.
10. **Terminal Booking Resurrection**: Driver updates a `completed` booking back to `status: "active"` -> `PERMISSION_DENIED`.
11. **Client-Forged Timestamp**: Client passes `createdAt: "2020-01-01T00:00:00Z"` instead of `request.time` -> `PERMISSION_DENIED`.
12. **1MB String / ID Poisoning**: Client writes `title` > 140 chars or document ID containing `../../admin` -> `PERMISSION_DENIED`.
