/**
 * Firestore Security Rules Specification & Dirty Dozen Verification Suite
 * Verifies all 12 adversarial payloads against the Maison Vell Zero-Trust ruleset.
 */

export interface AdversarialCase {
  id: number;
  name: string;
  collectionPath: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  auth: { uid: string; email: string; email_verified: boolean } | null;
  payload?: Record<string, unknown>;
  expectedResult: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_TESTS: AdversarialCase[] = [
  {
    id: 1,
    name: 'Shadow Privilege Escalation on User Profile',
    collectionPath: '/users/user_1',
    operation: 'create',
    auth: { uid: 'user_1', email: 'u1@example.com', email_verified: true },
    payload: { uid: 'user_1', displayName: 'Attacker', loyaltyPoints: 50000, isAdmin: true },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Unverified Bootstrap Admin Email Spoof',
    collectionPath: '/products/prod_1',
    operation: 'delete',
    auth: { uid: 'spoof_1', email: 'razasphare@gmail.com', email_verified: false },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Cross-User PII Read on Split Private Collection',
    collectionPath: '/users/user_1/private/info',
    operation: 'get',
    auth: { uid: 'user_2', email: 'u2@example.com', email_verified: true },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Unfiltered Order List Query Scraping',
    collectionPath: '/orders',
    operation: 'list',
    auth: { uid: 'user_2', email: 'u2@example.com', email_verified: true },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'ID Poisoning with Oversized Key',
    collectionPath: `/users/user_1/cart/${'x'.repeat(200)}`,
    operation: 'create',
    auth: { uid: 'user_1', email: 'u1@example.com', email_verified: true },
    payload: { uid: 'user_1', productId: 'p1', quantity: 1, size: 'M', color: 'Ivory', savedForLater: false },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Self-Assigned Admin Role Escalation',
    collectionPath: '/admins/user_2',
    operation: 'create',
    auth: { uid: 'user_2', email: 'u2@example.com', email_verified: true },
    payload: { uid: 'user_2', email: 'u2@example.com', role: 'super_admin' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Order Grand Total Tampering During Customer Update',
    collectionPath: '/orders/order_1',
    operation: 'update',
    auth: { uid: 'user_1', email: 'u1@example.com', email_verified: true },
    payload: { status: 'Cancelled', grandTotal: 0 },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Terminal Cancelled Order Reactivation',
    collectionPath: '/orders/order_cancelled',
    operation: 'update',
    auth: { uid: 'user_1', email: 'u1@example.com', email_verified: true },
    payload: { status: 'Confirmed' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Forged Past Timestamp on Product Review',
    collectionPath: '/products/prod_1/reviews/rev_1',
    operation: 'create',
    auth: { uid: 'user_1', email: 'u1@example.com', email_verified: true },
    payload: { productId: 'prod_1', userId: 'user_1', authorName: 'U1', rating: 5, title: 'Great', comment: 'Nice', createdAt: '2020-01-01T00:00:00Z' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Orphaned Review on Non-Existent Product',
    collectionPath: '/products/ghost_prod/reviews/rev_1',
    operation: 'create',
    auth: { uid: 'user_1', email: 'u1@example.com', email_verified: true },
    payload: { productId: 'ghost_prod', userId: 'user_1', authorName: 'U1', rating: 5, title: 'Great', comment: 'Nice' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Unbounded Array Resource Exhaustion',
    collectionPath: '/products/prod_1',
    operation: 'create',
    auth: { uid: 'admin_1', email: 'razasphare@gmail.com', email_verified: true },
    payload: { sizes: new Array(50).fill('XL') },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Shadow Ghost Field Injection on Profile Update',
    collectionPath: '/users/user_1',
    operation: 'update',
    auth: { uid: 'user_1', email: 'u1@example.com', email_verified: true },
    payload: { displayName: 'Valid Name', ghostAdminFlag: true },
    expectedResult: 'PERMISSION_DENIED',
  },
];
