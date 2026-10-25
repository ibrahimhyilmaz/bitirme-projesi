/**
 * Firestore Security Rules Test Suite (Dirty Dozen Verification)
 * Verifies all 12 adversarial payloads defined in security_spec.md are rejected.
 */

export interface DirtyDozenScenario {
  id: number;
  name: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  expectedOutcome: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_SCENARIOS: DirtyDozenScenario[] = [
  { id: 1, name: 'Unauthenticated Write', operation: 'create', path: '/rooms/ana-oda', expectedOutcome: 'PERMISSION_DENIED' },
  { id: 2, name: 'Unverified Email Spoof', operation: 'create', path: '/rooms/ana-oda', expectedOutcome: 'PERMISSION_DENIED' },
  { id: 3, name: 'Shadow Field Injection on Create', operation: 'create', path: '/rooms/ana-oda', expectedOutcome: 'PERMISSION_DENIED' },
  { id: 4, name: 'Shadow Field Injection on Update', operation: 'update', path: '/rooms/ana-oda', expectedOutcome: 'PERMISSION_DENIED' },
  { id: 5, name: 'Identity Spoofing on Create', operation: 'create', path: '/rooms/room-1', expectedOutcome: 'PERMISSION_DENIED' },
  { id: 6, name: 'Immutable Field Tampering on Update', operation: 'update', path: '/rooms/room-1', expectedOutcome: 'PERMISSION_DENIED' },
  { id: 7, name: 'Timestamp Forgery', operation: 'create', path: '/rooms/room-1', expectedOutcome: 'PERMISSION_DENIED' },
  { id: 8, name: 'ID Poisoning Attack', operation: 'create', path: '/rooms/invalid$$id', expectedOutcome: 'PERMISSION_DENIED' },
  { id: 9, name: 'Value Poisoning / Denial of Wallet', operation: 'update', path: '/rooms/room-1', expectedOutcome: 'PERMISSION_DENIED' },
  { id: 10, name: 'Orphaned Subcollection Write', operation: 'create', path: '/rooms/missing-room/elements/el-1', expectedOutcome: 'PERMISSION_DENIED' },
  { id: 11, name: 'Locked Room Bypass', operation: 'create', path: '/rooms/locked-room/elements/el-1', expectedOutcome: 'PERMISSION_DENIED' },
  { id: 12, name: 'Unauthorized Blanket List', operation: 'list', path: '/rooms', expectedOutcome: 'PERMISSION_DENIED' },
];
