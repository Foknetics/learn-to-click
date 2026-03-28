# Learn to Click

A real-time multiplayer practice tool for the **Magtheridon's Lair** cube-clicking mechanic from World of Warcraft.

## Overview

Players join a shared room and practice coordinating the 5-cube channeling mechanic:

- **5 Cubes** arranged in a pentagon — players click to channel
- **10-second channels** with a 30-second cooldown debuff afterward
- **Boss caging** when all 5 cubes are channeled simultaneously
- **Blast Wave** timer that wipes the raid if not interrupted by caging the boss
- **Foji WeakAura** import support for raid assignments

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Client | Angular 21, RxJS, Socket.IO Client |
| Server | NestJS, Socket.IO |
| Shared | TypeScript types & events |

## Project Structure

```
├── shared/    # Shared TypeScript types and Socket.IO event definitions
├── server/    # NestJS WebSocket server (game engine, room management)
├── client/    # Angular SPA (arena UI, cube components, assignment grid)
```

## Getting Started

```bash
# Install all dependencies (monorepo workspaces)
npm install

# Build the shared library first
npm run build:shared

# Start the server (watch mode, port 3000)
npm run start:server

# Start the client (dev server, port 4200)
npm run start:client
```

## Production Build

```bash
npm run build
```
