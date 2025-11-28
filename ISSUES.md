# 🚨 Critical Issues Report

Generated at: 11/21/2025, 2:25:55 PM
Total Issues Found: 1

## 1. Game not found for action

- **Count**: 5
- **First Seen**: 2025-11-21T12:15:50.753Z
- **Last Seen**: 2025-11-21T12:19:26.267Z

### 🤖 Cursor Auto-Fix Prompt
Copy the block below into Cursor Chat (Cmd+L) to fix this issue:

- **Status**: Fixed
- **Analysis**: The "Game not found for action" error was caused by `RoomManager` deleting games immediately when the last player disconnected (e.g. during a page refresh). This race condition caused the client to try to perform actions on a game that the server had just deleted.
- **Fix**: 
  - Modified `Game.ts` to distinguish between `disconnectPlayer` (network issue, preserve game state) and `removePlayer` (explicit leave, delete if empty).
  - Updated `RoomManager.ts` to handle socket disconnects by marking players as disconnected instead of removing them.
  - Added `cleanupStaleGames` in `RoomManager` to garbage collect empty or abandoned games after a timeout.
---
