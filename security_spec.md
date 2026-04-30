# KUFF GLOBAL: Security Specification & Red Team Test Plan

## 1. Data Invariants
- A `listing` must have a `sellerId` matching the creator's UID.
- An `order` can only be created by an authenticated user (buyer) who is not the seller.
- Escrow funds (`order.escrowStatus`) can only transition from `HELD_IN_ESCROW` to `RELEASED` by the buyer or an admin.
- `UserPrivate` data is strictly accessible only by the owner.
- Chat messages can only be sent to rooms where the user is a participant (buyer or seller in an associated order/listing).

## 2. The "Dirty Dozen" Payloads (Red Team Attack Vectors)

1. **Identity Spoofing**: Attempt to create a listing with someone else's `sellerId`.
2. **State Shortcutting**: Attempt to create an order with `escrowStatus: "RELEASED"` directly.
3. **Escrow Theft**: Attempt to change an order's `escrowStatus` to `RELEASED` as a seller.
4. **PII Scraping**: Attempt to read `/users/target_uid/private/data` as a random user.
5. **ID Poisoning**: Attempt to use a 1MB string as a `listingId`.
6. **Shadow Fields**: Attempt to add `isVerified: true` to a user profile during update.
7. **Timestamp Fraud**: Attempt to set a past date for `createdAt` instead of `request.time`.
8. **Negative Pricing**: Attempt to list a phone with `price: -50000`.
9. **Orphaned Message**: Attempt to post a message to a chat room the user isn't part of.
10. **Admin Escalation**: Attempt to write to `/admins/$(request.auth.uid)` to grant self-admin rites.
11. **Price Manipulation**: Attempt to update a listing's price while it is in "Sold" status.
12. **Blanket Query**: Attempt a collection group query on `orders` to see all platform transactions.

## 3. The Test Runner (`firestore.rules.test.ts` Outline)
The tests will use the Firebase Rules Unit Testing library to verify that all the above payloads are correctly rejected with `PERMISSION_DENIED`.
