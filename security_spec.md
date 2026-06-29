# Security Specification & Threat Model

This document outlines the security invariants, the "Dirty Dozen" rogue payloads, and the testing validation for the Real-time Task Manager Firestore database.

## 1. Data Invariants

- **Ownership Isolation**: A task document MUST be owned by a authenticated user, and can only be read, created, updated, or deleted by that specific authenticated user (`request.auth.uid == resource.data.userId`).
- **No Orphaned Subtasks**: Subtasks must be embedded within the parent task document to enforce atomic updates and avoid scaling limitations of external lists.
- **Strict Size Limits**: The `title` of a task cannot exceed 200 characters, and the `description` cannot exceed 2000 characters to prevent database resource exhaustion ("Denial of Wallet").
- **Strict Structure**: Tasks must contain all required fields with proper types upon creation.

---

## 2. The "Dirty Dozen" Rogue Payloads

These payloads represent attempts to bypass security policies or pollute the database. Our security rules are designed to strictly reject all of these.

### Payload 1: Unauthorized Creation (No Auth)
An anonymous/unauthenticated client attempts to create a task.
```json
{
  "title": "Unauthenticated Task",
  "priority": "high",
  "category": "Work",
  "status": "todo",
  "userId": "some-random-uid",
  "createdAt": "2026-06-26T12:00:00Z",
  "updatedAt": "2026-06-26T12:00:00Z"
}
```
*Expected Result: PERMISSION_DENIED*

### Payload 2: UID Hijacking
An authenticated user (`alice-uid`) attempts to create a task with another user's UID (`bob-uid`).
```json
{
  "title": "Bob's Task",
  "priority": "high",
  "category": "Work",
  "status": "todo",
  "userId": "bob-uid",
  "createdAt": "2026-06-26T12:00:00Z",
  "updatedAt": "2026-06-26T12:00:00Z"
}
```
*Expected Result: PERMISSION_DENIED*

### Payload 3: Missing Required Fields
Attempting to create a task without the mandatory `priority` field.
```json
{
  "title": "Incomplete Task",
  "category": "Work",
  "status": "todo",
  "userId": "alice-uid",
  "createdAt": "2026-06-26T12:00:00Z",
  "updatedAt": "2026-06-26T12:00:00Z"
}
```
*Expected Result: PERMISSION_DENIED*

### Payload 4: Invalid Enum Value for Priority
Attempting to save a task with an unsupported priority level.
```json
{
  "title": "Invalid Priority",
  "priority": "critical-high-extreme",
  "category": "Work",
  "status": "todo",
  "userId": "alice-uid",
  "createdAt": "2026-06-26T12:00:00Z",
  "updatedAt": "2026-06-26T12:00:00Z"
}
```
*Expected Result: PERMISSION_DENIED*

### Payload 5: Type Contamination
Passing an integer/number for the `title` instead of a string.
```json
{
  "title": 12345,
  "priority": "low",
  "category": "Work",
  "status": "todo",
  "userId": "alice-uid",
  "createdAt": "2026-06-26T12:00:00Z",
  "updatedAt": "2026-06-26T12:00:00Z"
}
```
*Expected Result: PERMISSION_DENIED*

### Payload 6: Shadow Field Injection
Injecting unapproved metadata fields during creation to bypass future updates or bloat database storage.
```json
{
  "title": "Injected Fields",
  "priority": "medium",
  "category": "Work",
  "status": "todo",
  "userId": "alice-uid",
  "createdAt": "2026-06-26T12:00:00Z",
  "updatedAt": "2026-06-26T12:00:00Z",
  "isSystemAdmin": true,
  "debugLog": "pollute_database_now"
}
```
*Expected Result: PERMISSION_DENIED*

### Payload 7: Cross-User Read Attempt
User `alice-uid` attempts to query or read tasks belonging to `bob-uid`.
*Expected Query / Request: `get(/databases/$(database)/documents/tasks/bob-task-1)` by `alice-uid`*
*Expected Result: PERMISSION_DENIED*

### Payload 8: Cross-User Update Attempt
User `alice-uid` attempts to update a task document belonging to `bob-uid`.
*Expected Result: PERMISSION_DENIED*

### Payload 9: Invalid Document ID Poisoning
Attempting to create or update a task with a document ID containing invalid characters or massive size to crash queries.
*Expected Document ID: `tasks/INVALID_ID_$$$_###_LONG_CHARACTER_STRING_...`*
*Expected Result: PERMISSION_DENIED*

### Payload 10: Array Size Exhaustion (Subtasks Bloating)
Attempting to save a list of subtasks exceeding 10 items to trigger denial of service or extreme client-side lag.
```json
{
  "title": "Bloated Subtasks",
  "priority": "low",
  "category": "Work",
  "status": "todo",
  "userId": "alice-uid",
  "createdAt": "2026-06-26T12:00:00Z",
  "updatedAt": "2026-06-26T12:00:00Z",
  "subtasks": [
    {"id": "1", "title": "Sub 1", "completed": false},
    {"id": "2", "title": "Sub 2", "completed": false},
    {"id": "3", "title": "Sub 3", "completed": false},
    {"id": "4", "title": "Sub 4", "completed": false},
    {"id": "5", "title": "Sub 5", "completed": false},
    {"id": "6", "title": "Sub 6", "completed": false},
    {"id": "7", "title": "Sub 7", "completed": false},
    {"id": "8", "title": "Sub 8", "completed": false},
    {"id": "9", "title": "Sub 9", "completed": false},
    {"id": "10", "title": "Sub 10", "completed": false},
    {"id": "11", "title": "Sub 11", "completed": false}
  ]
}
```
*Expected Result: PERMISSION_DENIED*

### Payload 11: Attempting to Hijack Creation Date
Updating the `createdAt` timestamp of an existing task to change history records.
*Expected Operation: `update` where `incoming().diff(existing()).affectedKeys().hasAny(['createdAt'])` is true.*
*Expected Result: PERMISSION_DENIED*

### Payload 12: Super-sized Fields
A title string exceeding 200 characters to consume storage.
```json
{
  "title": "A super long title text exceeding two hundred characters... repeating to reach the threshold... repeating repeating repeating repeating repeating repeating repeating repeating repeating repeating repeating repeating repeating repeating repeating repeating repeating repeating",
  "priority": "low",
  "category": "Work",
  "status": "todo",
  "userId": "alice-uid",
  "createdAt": "2026-06-26T12:00:00Z",
  "updatedAt": "2026-06-26T12:00:00Z"
}
```
*Expected Result: PERMISSION_DENIED*

---

## 3. Test Runner Design

A test configuration file structure (for standard Firebase rules test framework) would look as follows:

```typescript
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";

describe("Task Manager Security Rules", () => {
  let testEnv;

  before(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: "ace-striker-q07pf",
      firestore: {
        host: "localhost",
        port: 8080,
      },
    });
  });

  after(async () => {
    await testEnv.cleanup();
  });

  it("should fail to create a task when unauthenticated", async () => {
    const unauthedDb = testEnv.unauthenticatedContext().firestore();
    const taskDoc = unauthedDb.collection("tasks").doc("some-task");
    await assertFails(taskDoc.set({ title: "No Auth", priority: "low" }));
  });

  it("should fail to hijack bob's UID when authenticated as alice", async () => {
    const aliceDb = testEnv.authenticatedContext("alice-uid").firestore();
    const taskDoc = aliceDb.collection("tasks").doc("alice-task");
    await assertFails(taskDoc.set({
      title: "Bob's Task",
      priority: "high",
      category: "Work",
      status: "todo",
      userId: "bob-uid",
      createdAt: "2026-06-26T12:00:00Z",
      updatedAt: "2026-06-26T12:00:00Z"
    }));
  });

  it("should succeed to create task under own UID", async () => {
    const aliceDb = testEnv.authenticatedContext("alice-uid").firestore();
    const taskDoc = aliceDb.collection("tasks").doc("alice-task");
    await assertSucceeds(taskDoc.set({
      title: "My Actual Task",
      priority: "medium",
      category: "Work",
      status: "todo",
      userId: "alice-uid",
      createdAt: "2026-06-26T12:00:00Z",
      updatedAt: "2026-06-26T12:00:00Z"
    }));
  });
});
```
