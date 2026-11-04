# Maison Vell — Payload-First Security Specification

## 1. Data Invariants
1. **Identity Integrity**: Every user-scoped resource (`users/{userId}`, `users/{userId}/private/info`, `addresses`, `cart`, `wishlist`, `reviews`) MUST carry `uid` or `userId` matching `request.auth.uid`, with `request.auth.token.email_verified == true`.
2. **PII Split Isolation**: Customer emails, phone numbers, and saved street addresses are isolated inside `users/{userId}/private/info` and `users/{userId}/addresses/{addressId}`, readable strictly by `isOwner(userId)` or `isAdmin()`.
3. **RBAC Admin Gate**: Admin privileges are verified strictly via database document existence (`exists(/databases/$(database)/documents/admins/$(request.auth.uid))`) or verified runtime bootstrap admin (`request.auth.token.email == 'razasphare@gmail.com' && request.auth.token.email_verified == true`). Users cannot self-assign admin roles.
4. **Master Gate Relational Sync**: Subcollections (`/products/{productId}/reviews/{reviewId}`, `/orders/{orderId}/items/{itemId}`, `/users/{userId}/cart/{itemId}`) verify parent document existence via `exists()` or `get()`.
5. **Bounded Arrays & Strict Keys**: Every write validates `keys().hasAll(...)` and `keys().hasOnly(...)` on create, and `affectedKeys().hasOnly(...)` wrapped by `isValid[Entity](incoming())` on update. All arrays enforce `.size() <= MAX`.
6. **Terminal State Locking**: Orders in terminal states (`Cancelled`) cannot be modified by non-admin customers. Customers can only cancel `Pending` orders or request returns on `Delivered` orders.
7. **Temporal Integrity**: All `createdAt` and `updatedAt` timestamps must equal `request.time`.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Shadow Privilege Escalation**: Creating `/users/u1` with `{ uid: 'u1', displayName: 'Attacker', loyaltyPoints: 999999, isAdmin: true }`. Rejected by `hasOnly` and `loyaltyPoints == 0` initial rule.
2. **Unverified Admin Email Spoof**: Accessing `/admins` with `email: 'razasphare@gmail.com'` and `email_verified: false`. Rejected by `email_verified == true` requirement.
3. **Cross-User PII Scraping**: Authenticated user `u2` attempting `get` on `/users/u1/private/info` or `/orders/ord_u1`. Rejected by strict `isOwner` / `isAdmin` check.
4. **Blanket Order List Scraping**: Authenticated user `u2` executing unfiltered `list` on `/orders`. Rejected because `allow list` enforces `resource.data.userId == request.auth.uid || isAdmin()`.
5. **ID Poisoning / Denial of Wallet**: Creating document with 500-char junk ID or 100KB description string. Rejected by `isValidId()` (`size() <= 128`) and field `.size()` limits.
6. **Self-Admin Promotion**: User `u2` writing to `/admins/u2`. Rejected because only existing `super_admin` or verified bootstrap admin can write `/admins`.
7. **Order Total Manipulation on Update**: Customer `u1` updating `/orders/o1` to change `grandTotal: 1` while cancelling. Rejected by `affectedKeys().hasOnly(['status', 'updatedAt'])`.
8. **Terminal State Reversal**: Customer `u1` attempting to update an already `Cancelled` order back to `Confirmed`. Rejected by terminal state lock (`existing().status == 'Pending'`).
9. **Spoofed Timestamp Injection**: Creating a review with `createdAt: timestamp(2020-01-01)`. Rejected by `incoming().createdAt == request.time`.
10. **Orphaned Review Write**: Creating `/products/nonexistent_prod/reviews/r1`. Rejected by Master Gate `exists(/databases/$(database)/documents/products/$(productId))`.
11. **Unbounded Array Bomb**: Admin or attacker pushing 200 items into `sizes` array on `/products/p1`. Rejected by `data.sizes.size() <= 12`.
12. **Shadow Field Update**: Updating `/users/u1` with `{ displayName: 'New', role: 'admin', updatedAt: request.time }`. Rejected by `isValidUserPublic` `hasOnly` + `affectedKeys().hasOnly`.
