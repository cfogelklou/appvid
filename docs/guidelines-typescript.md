# TypeScript & Code Quality Guidelines

This document outlines the coding standards and best practices for the AppVid codebase. Examples use AppVid's `src/` layout; adapt the example module names to the nearest existing AppVid module when applying a rule.

## 1. The "No Magic Strings/Numbers" Rule

**Principle:** Do not scatter string literals or magic numbers throughout the codebase. "Random strings" (like `GAME_PHASES.SUBMISSION`, `'spy'`, `'citizen'`) make refactoring difficult and prone to typos.

**Bad Practice: Using for state or phase**
```typescript
// ❌ BAD: Magic strings
if (game.phase === 'voting') { ... }

// ❌ BAD: Magic number
if (score > 1000) { ... }

// ❌ BAD: Hardcoded color
backgroundColor: '#FF0000'
```

**Good Practice:**
```typescript
// ✅ GOOD: Centralized Enum/Constant
import { GamePhase } from 'src/types/gameState';
if (game.phase === GamePhase.VOTING) { ... }

// ✅ GOOD: Named Constant
import { POINTS_FOR_TRUTH } from 'src/constants/gameScoring';
if (score > POINTS_FOR_TRUTH) { ... }

// ✅ GOOD: Theme Color
import { themeColors } from 'src/colors';
backgroundColor: themeColors.error
```

Note: Don't mix up "strings for printing" like messages to users or developers (OK!), with strings for states or object keys (BAD!)

**Exception:** User-facing strings used in multiple places should be constants. If a label, button text, or message appears in:
- The component JSX
- Test assertions (multiple occurrences)
- Multiple components

Then extract to a constant for DRY maintenance.

```typescript
// ✅ GOOD: UI string used in multiple places → constant
export const ACTIVE_LABEL = 'Gainz++!';
// Used in: App.tsx JSX + App.test.tsx assertions

// ❌ BAD: Same string repeated 6+ times
<span>Gainz++!</span> // In App.tsx
expect(screen.getByText('Gainz++!')) // In test 1
expect(screen.getByText('Gainz++!')) // In test 2
// ...
```

### 1a. No Magic Numbers in Tests

**Principle:** Test files MUST use the same constants defined in the source code. When a constant value changes (e.g., `GRID_SIZE_MIN` changes from 5 to 8), tests using hardcoded magic numbers will NOT be automatically updated, causing false failures or passing invalid edge cases.

**Bad Practice:**
```typescript
// ❌ BAD: Magic number in test - breaks when constant changes
describe('Minesweeper grid size', () => {
  it('should clamp grid size to minimum', () => {
    const result = clampedGridSize(3);  // Hardcoded 3
    expect(result).toBe(5);  // ❌ Wrong! GRID_SIZE_MIN is 8, not 5
  });
});
```

**Good Practice:**
```typescript
// ✅ GOOD: Import and use the constant
import { GRID_SIZE_MIN, GRID_SIZE_MAX, GRID_SIZE_DEFAULT } from 'src/minesweeper';

describe('Minesweeper grid size', () => {
  it('should clamp grid size to minimum', () => {
    const result = clampedGridSize(3);
    expect(result).toBe(GRID_SIZE_MIN);  // ✅ Stays in sync with code
  });

  it('should use default when not specified', () => {
    const result = getGridSize(undefined);
    expect(result).toBe(GRID_SIZE_DEFAULT);
  });
});
```

**Why This Matters:**
- **Test Drift:** Magic numbers in tests don't update when constants change
- **False Confidence:** Tests may pass with outdated values, masking bugs
- **Maintenance Burden:** Every constant change requires hunting down test files
- **Real-World Example:** `GRID_SIZE_MIN` changed from 5 to 8, but tests still used `expect(result).toBe(5)` - tests would fail with correct implementation

**Rule:** If a number is defined as a constant in the source code, tests MUST import and use that constant instead of hardcoding the value.

### 1b. Exception: Magic Numbers in Styles

**Principle:** The "no magic numbers" rule applies primarily to **business logic, game state, and semantic constants**. For styling (StyleSheet.create), magic numbers are **acceptable** when a standardized design system constant doesn't exist.

**When to Use Design System Constants (REQUIRED):**

If a design system constant exists, you MUST use it instead of a literal value:

```typescript
import { spacing } from '@abstractions/spacing';
import { borderRadius } from '@abstractions/spacing';
import { themeColors } from 'src/colors';

const styles = StyleSheet.create({
  card: {
    // ✅ GOOD: Use existing spacing constants
    padding: spacing.xxl,           // Instead of 24
    marginBottom: spacing.lg,       // Instead of 16
    gap: spacing.sm,                // Instead of 8
    
    // ✅ GOOD: Use existing border radius constants
    borderRadius: borderRadius.large, // Instead of 12
    
    // ✅ GOOD: Use existing color constants
    backgroundColor: themeColors.backgroundMedium,
  }
});
```

**Available Design System Constants:**
- **Spacing**: `spacing.xs` (4), `spacing.sm` (8), `spacing.md` (12), `spacing.lg` (16), `spacing.xl` (20), `spacing.xxl` (24), `spacing.xxxl` (32), `spacing.xxxxl` (40)
- **Border Radius**: `borderRadius.small` (6), `borderRadius.medium` (8), `borderRadius.large` (12), `borderRadius.xlarge` (16), `borderRadius.circular*` (for circles)
- **Opacity**: `opacity.subtle` (0.8), `opacity.medium` (0.6), `opacity.light` (0.4), `opacity.veryLight` (0.2)
- **Colors**: All colors from `src/colors.ts` (see style guide)

**When Magic Numbers Are OK:**

For style properties **without** design system constants, literal values are acceptable:

```typescript
const styles = StyleSheet.create({
  storyCard: {
    // ✅ OK: Component-specific font sizes (no standard constants exist)
    fontSize: 28,
    lineHeight: 36,
    letterSpacing: 2,
    
    // ✅ OK: Shadow properties (no standard constants exist)
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,

    // ✅ OK: Animation timing values (style-related, not business logic)
    // Framer Motion, spring physics, and animation durations are style choices
    staggerChildren: 0.08,      // Stagger delay between children
    delayChildren: 0.1,         // Initial delay before first child
    duration: 0.4,              // Animation duration
    damping: 18,                // Spring damping
    stiffness: 120,             // Spring stiffness
    x: -20,                     // Starting x offset

    // ✅ OK: Component-specific border width (not in design system)
    borderWidth: 3,
    
    // ✅ OK: One-off border radius not in design system
    borderRadius: 24,  // Larger than standard options
  }
});
```

**When to Extract to Constants:**

Only extract style values to constants if:

1. **Reused multiple times in the same file**
   ```typescript
   // ✅ GOOD: Used in 3+ places in this file
   const CARD_BORDER_RADIUS = 24;
   const styles = StyleSheet.create({
     outerCard: { borderRadius: CARD_BORDER_RADIUS },
     innerCard: { borderRadius: CARD_BORDER_RADIUS },
     iconContainer: { borderRadius: CARD_BORDER_RADIUS },
   });
   ```

2. **Represents a semantic concept**
   ```typescript
   // ✅ GOOD: Semantic meaning
   const MAX_PLAYERS_PER_ROW = 4;
   const VOTING_TIMEOUT_SECONDS = 30;
   ```

**Bad Practice: Over-extraction**

Creating constants for every literal value in styles adds technical debt without benefit:

```typescript
// ❌ BAD: Creating constants for one-off values
const STORY_FONT_SIZE = 22;          // Used only once
const STORY_LINE_HEIGHT = 32;        // Used only once
const OUTCOME_LETTER_SPACING = 2;    // Used only once

const styles = StyleSheet.create({
  storyText: {
    fontSize: STORY_FONT_SIZE,       // Just use 22
    lineHeight: STORY_LINE_HEIGHT,   // Just use 32
    letterSpacing: OUTCOME_LETTER_SPACING, // Just use 2
  }
});
```

**Summary:**
- **Business logic & game state**: NO magic strings/numbers - always use constants/enums
- **Styles with design system values**: Use design system constants (`spacing.xxl`, `borderRadius.large`, etc.)
- **Styles without design system values**: Literal numbers are OK (font sizes, shadows, etc.)
- **Extract to constants**: Only if reused multiple times in same file OR has semantic meaning

## 2. Centralized Definitions (The "C++ Enum" Model)

Think of our type system like C++ headers. Define standard values **in one place** and refer to them everywhere.

### Locations for Definitions

*   **Universal Types & Enums:** Place in **`src/types/`** or **`src/constants/`**.
    *   *Path:* `src/`
    *   *Usage:* Game state, player roles, event names, API schemas.
    *   *Examples:* `GameState`, `PlayerRole`, `GamePhase`.

*   **Controller-Specific Types:** Place in **`src/components/types/`** (create if needed) or top of relevant controller files if local.
    *   *Path:* `src/`
    *   *Usage:* Form states, UI-specific navigation params (shared PWA/Mobile).

*   **Colors:** ALWAYS use **`src/colors.ts`**.
    *   If you need a new color, add it to `themeColors` first.

## Base types, derived types

### Use base types & classes, and then derive classes from them

Don't put all information for all potential usages inside one type. Instead, put all common information inside the base type. If you need game-specific data, put it in the derived type.

```typescript
// ❌ BAD:

// 1. Collect player lies from playerSubmissions
if (state.playerSubmissions) {
  Object.entries(state.playerSubmissions).forEach(([playerId, lie]) => {
    // ...
  }}

```
```typescript
// ✅  Good - use specific state! Better yet if can be done without casting.
const hornswoggleState = state as HornswoggleGameState; // 

// 1. Collect player lies from playerSubmissions
if (hornswoggleState.gamePayload.playerSubmissions) {
  Object.entries(hornswoggleState.gamePayload.playerSubmissions).forEach(([playerId, lie]) => {
  }}
```


## Prefer readability


## Use map & filter

Don't:
      const resetPlayers: Record<string, Player> = Object.fromEntries(
        Object.entries(newState.players)
          .filter(([_, player]) => !player.isBot)
          .map(([playerId, player]) => [playerId, { ...player, score: null }])
      );

### Defining Constants
Prefer TypeScript `enum` or `const` objects with `as const` to create immutable, type-safe groupings.

```typescript
// src/constants/GameTypes.ts
export const PlayerRole = {
    SPY: 'spy',
    CITIZEN: 'citizen',
} as const;

export type PlayerRoleType = typeof PlayerRole[keyof typeof PlayerRole];
```

### Creating Derived Types from Constants

**Principle:** When you define constants as objects with `as const`, you can derive type-safe union types that stay synchronized automatically.

**Pattern:**
```typescript
// 1. Define constants with 'as const'
export const GameTypeNames = {
  HORNSWOGGLE: 'HORNSWOGGLE',
  SPYFALL: 'SPYFALL',
  MAFIA: 'MAFIA',
} as const;

// 2. Derive the union type
export type GameTypeName = typeof GameTypeNames[keyof typeof GameTypeNames];
// Result: 'HORNSWOGGLE' | 'SPYFALL' | 'MAFIA'
```

**Usage in Type Definitions:**
```typescript
// ✅ GOOD: Use derived type instead of manual union
interface GameConfig {
  gameType: GameTypeName;  // Auto-syncs with constants
}

// ❌ BAD: Manual union - doesn't stay in sync
interface GameConfig {
  gameType: 'HORNSWOGGLE' | 'SPYFALL' | 'MAFIA';  // Breaks if constants change
}
```
**Advantages:**
- Auto-sync constants with types
- Enforces type safety
- Avoids hardcoded strings

## 3. Path Aliases

Always use the configured path aliases. Never use deep relative paths (e.g., `../../../../common`).

*   **`src/*`**: For AppVid application code.
*   **`src/components/*`**: For reusable AppVid components.
*   **`@abstractions/*`**: For platform-specific implementations (web vs native).
*   **`@abstractions_controllers/*`**: For controller-specific abstractions (PWA + Mobile only).

**AppVid structure note:** The backend (`src/`) CAN use `src/*` path aliases for both type AND value imports. The esbuild build process correctly resolves these aliases at bundle time. Examples: `import { wantDebug } from 'src/utils/debug'`, `import { themePatterns } from 'src/utils/backgroundPatterns'`. Common misconception: esbuild DOES resolve TypeScript path aliases for value imports (not just type-only imports).

### 3a. Check Existing Aliases Before Using Relative Imports

**Principle:** Before using a relative import path (e.g., `../../../common/utils`), **ALWAYS** verify that the target file isn't already accessible via a configured path alias. If an alias exists or could enable common code reuse, prefer the alias.

**Bad Practice:**
```typescript
// ❌ BAD: Relative path to shared code
import { myUtil } from '../../../common/utils/myUtil';

// ❌ BAD: Relative path that obscures an existing AppVid module
import { GameCard } from '../../controllers/components/GameCard';

// ❌ BAD: Deep relative path
import { GameState } from '../../../../common/types/game';
```

**Good Practice:**
```typescript
// ✅ GOOD: Use the existing AppVid module
import { myUtil } from 'src/utils/myUtil';

// ✅ GOOD: Use the shared component module
import { GameCard } from 'src/components/GameCard';

// ✅ GOOD: Use @abstractions for platform-specific code
import { spacing } from '@abstractions/spacing';
import { NavigationProps } from '@abstractions/navigation';
```

**When to Ask About Creating a New Alias:**

If you find yourself writing a relative import path like `"../../shared/..."` or `"../../../common/..."`, **STOP and ask yourself**:
1. Does this code belong in `src/`, `src/components/`, `@abstractions_controllers/`, or `@abstractions/`?
2. Should I create or use an existing alias for this shared code?

**Example Decision Process:**

```typescript
// You want to import from '../../../controllers/screens/JoinGameScreen'
// Question: Is this screen shared between AppVid components?
// Answer: Yes → Use src/components/screens/JoinGameScreen
import { JoinGameScreen } from 'src/components/screens/JoinGameScreen';

// You want to import from '../../common/utils/formatDate'
// Question: Is this utility shared by all platforms?
// Answer: Yes → Use src/utils/formatDate
import { formatDate } from 'src/utils/formatDate';

// You want to import from '../platform-specific/navigation'
// Question: Is this platform-specific implementation?
// Answer: Yes → Use @abstractions/navigation
import { useNavigation } from '@abstractions/navigation';

// You want to import from '../../controllers/web/abstractions/navigation'
// Question: Is this controller-specific abstraction (PWA + Mobile only)?
// Answer: Yes → Use @abstractions_controllers/navigation
import { useNavigation } from '@abstractions_controllers/navigation';
```

**Why This Matters:**
- **Maintainability:** Refactoring becomes easier when paths are centralized
- **Readability:** `src/types/game` clearly indicates shared code, while `../../../types/game` requires tracing the directory structure
- **Platform awareness:** Aliases enforce intentional decisions about what code is shared vs. platform-specific
- **Refactoring safety:** Moving files breaks relative imports but preserves alias imports

## 4. Type Safety & Imports

*   **No Inline Imports**: Do NOT use inline `import()` statements within type definitions. They are difficult to read and maintain. Always use standard top-level `import` statements.

**Bad Practice:**
```typescript
// ❌ BAD: Inline import
playerRoleDetails?: Record<string, import('src/constants/GameTypes').RoleDetails>;
```

**Good Practice:**
```typescript
// ✅ GOOD: Standard top-level import
import { RoleDetails } from 'src/constants/GameTypes';

playerRoleDetails?: Record<string, RoleDetails>;
```

*   **No `any`**: Avoid `any` unless absolutely necessary (e.g., at platform boundaries). Use `unknown` or specific types.
*   **Strict Null Checks**: Handle `null` and `undefined` explicitly.

## 4a. Typing External Data Sources

**Principle:** External data (Firestore, APIs, databases) is untyped by default. Always apply explicit types to prevent runtime errors.

### Firestore Documents

**Bad Practice:**
```typescript
// ❌ BAD: Untyped Firestore data
const doc = await db.collection('games').doc(id).get();
const data = doc.data();  // Type: DocumentData (any)
if (data.name) { ... }    // No type checking - field might not exist!
```

**Good Practice:**
```typescript
// ✅ GOOD: Type Firestore data explicitly AND check existence
import { DomainValue } from 'src/types/gameContent';

const doc = await db.collection('games').doc(id).get();

// 1. Check existence
if (!doc.exists) {
    throw new Error(`Game ${id} not found`);
}

// 2. Cast and Access
const data = doc.data() as DomainValue;
// Note: 'data' could still be partial/malformed if DB is corrupt.
// 'as DomainValue' is a compile-time promise, not a runtime guarantee.
if (data.truth) { ... }
```

**Why this matters:**
- `doc.data()` returns `undefined` if the document doesn't exist. Calling `as DomainValue` on `undefined` prevents TS errors but causes runtime crashes (cannot read property of undefined).
- Always check `doc.exists` or guard with `if (!data) return;`.

### Database Queries

**Bad Practice:**
```typescript
// ❌ BAD: Untyped query results
const snapshot = await db.collection('locations').where('packId', '==', 'universal').get();
snapshot.docs.forEach(doc => {
  const data = doc.data();  // Untyped
  console.log(data.name);   // Field might not exist
});
```

**Good Practice:**
```typescript
// ✅ GOOD: Type all query results
import { DomainValue } from 'src/types/gameContent';

const snapshot = await db.collection('locations').where('packId', '==', 'universal').get();
snapshot.docs.forEach(doc => {
  const data = doc.data() as DomainValue;  // Typed
  console.log(data.truth);
});
```

### API Responses

**Bad Practice:**
```typescript
// ❌ BAD: Untyped fetch response
const response = await fetch('/api/game');
const data = await response.json();  // Type: any
console.log(data.sessionId);  // No validation
```

**Good Practice:**
```typescript
// ✅ GOOD: Define API response type
interface GameApiResponse {
  sessionId: string;
  players: Player[];
}

const response = await fetch('/api/game');
const data = await response.json() as GameApiResponse;
console.log(data.sessionId);  // Type-checked
```

### Key Rules

1.  **Never trust untyped external data** - Always apply an explicit type or interface.
2.  **Runtime Existence Checks** - `as Type` does not validate data at runtime. You must still check `doc.exists` or handle `undefined` optional fields.
3.  **Use type assertions** - Cast with `as TypeName` to enforce schema matching during development.

## 4b. Shared Data Contracts (Python <-> TypeScript)

**Principle:** Data generated by Python scripts (`functions/scripts/data-import/`) is consumed by TypeScript. These schemas must be kept in sync manually to avoid "Undefined variable" errors.

1.  **Python Truth:** `functions/scripts/data-import/definitions.py` defines the `TypedDict` structure.
2.  **TypeScript Truth:** `src/types/` defines the Interface.

**Rule:** If you change a `TypedDict` in Python, you **MUST** immediately update the corresponding TypeScript interface.

**Example:**
*   **Python:**
    ```python
    class DomainValue(TypedDict):
        name: str
        truth: str
        packId: str
        # If this is missing in Python, it will be undefined in TS!
    ```
*   **TypeScript:**
    ```typescript
    export interface DomainValue {
        name: string;
        truth: string;
        packId: string;
    }
    ```

**Rule:** Ensure to add documentation to the python file, and the typescript file, pointing to the other definition to update:
```typescript
// keep xxxx in sync with yyyy, If you make changes to xxxx, you must also update xxxx!
```


**Defensive Coding:**
If a field is optional in Python or could be missing in legacy data:
1.  Mark it optional in TS: `myField?: string`
2.  Check it in code: `if (data.myField) { ... }`

## 5. Default Constants for Complex Types

**Principle:** For types with many fields (especially interfaces with 5+ properties), always provide a `DEFAULT_<TYPENAME>` constant. This makes creating new instances trivial and prevents initialization errors from missing fields.

**Why this matters:**
- **Consistency:** Ensures all instances start with the same baseline values.
- **Maintainability:** When adding new fields to the type, update the default constant once instead of hunting down every initialization.
- **Type Safety:** Prevents runtime errors from undefined fields in Firebase RTDB or other strict environments.

**Pattern:**
```typescript
// Define the interface
export interface GameState {
  sessionUuid: string;
  gamePhase: GamePhase;
  players: Record<string, Player>;
  // ... many more fields
}

// Provide a default constant
export const DEFAULT_GAME_STATE: GameState = {
  sessionUuid: '',
  gamePhase: GamePhase.LOBBY,
  players: {},
  // ... all fields initialized to null or sensible defaults
};

// Usage: Easy initialization
const newGame = {
  ...DEFAULT_GAME_STATE,
  sessionUuid: generateUuid(),
  gamePhase: GamePhase.SUBMISSION,
};
```

**Bad Practice:**
```typescript
// ❌ BAD: Manual initialization prone to missing fields
const gameState: GameState = {
  sessionUuid: 'abc',
  gamePhase: GamePhase.LOBBY,
  // Forgot 10 other fields - runtime error!
};
```

**Good Practice:**
```typescript
// ✅ GOOD: Use default constant and override only what you need
const gameState = {
  ...DEFAULT_GAME_STATE,
  sessionUuid: 'abc',
  gamePhase: GamePhase.SUBMISSION,
};
```

**Rules:**
- Name the constant `DEFAULT_<TYPENAME>` (e.g., `DEFAULT_GAME_STATE`).
- Initialize all fields to `null` for optional fields or sensible defaults for required ones.
- Place the constant immediately after the type definition.
- Use this pattern for any interface with more than 5 fields.

## 6. Control Flow: Switch vs. If/Else

**Principle:** Prefer `switch` statements over complex `if/else` chains, especially for variables that represent a set of modes or types (e.g., `GameType`, `GamePhase`, `PlayerRole`).

**Why this matters:**
- **Exhaustiveness:** You can use the `default` case to handle unexpected values or ensure all possible paths are covered.
- **Maintainability:** As more types are added (e.g., adding a new game type like `SPYFALL`), a `switch` statement is easier to audit for missing logic than a series of `if/else if` blocks.
- **Clarity:** `switch` statements clearly signal that you are branching based on the value of a single variable.

**Bad Practice:**
```typescript
if (gameType === GameType.HORNSWOGGLE) {
  // logic
} else if (gameType === GameType.SPYFALL) {
  // logic
}
// ❌ If a new GameType is added, this code silently fails or does nothing.
```

**Good Practice:**
```typescript
switch (gameType) {
  case GameType.HORNSWOGGLE:
    // logic
    break;
  case GameType.SPYFALL:
    // logic
    break;
  default:
    // ✅ Always handle the default case to catch unhandled paths
    dconsole.error(`Unhandled game type: ${gameType}`);
}
```

## 7. Inheritance & Polymorphism: Avoiding Duplicate Code

**Principle:** When multiple classes or handlers implement similar logic with game-specific variations, use inheritance and polymorphism rather than duplicating code across implementations. This reduces maintenance burden and ensures consistency.

### The Pattern: Base Class + Derived Classes

**Real-World Example:** Game event handlers (`BaseHandlers`, `HornswoggleHandlers`, `SpyfallHandlers`, `MafiaHandlers`)

All games share common event handling logic (player joins, phase changes, reset game), but each game has unique logic (start game, submit lie/vote, etc.).

**Structure:**

```typescript
// ❌ BAD: Duplicate code across handler classes
export class HornswoggleHandlers {
  static handleStartGame(gameEvent, eventId, sessionUuid, currentState, computationTimestamp) {
    // Validation code (DUPLICATED across all game handlers)
    if (!validateStateExists(currentState, 'start game')) return undefined;
    const playerId = extractPlayerId(gameEvent);
    if (!validateHost(currentState, playerId, 'start game')) { /* ... */ }
    if (isEventProcessed(currentState, eventId, 'START_GAME')) return undefined;

    // Hornswoggle-specific logic
    const prompt = await fetchRandomPrompt(packId, locale);
    // ... set up submission phase
    return newState;
  }
}

export class SpyfallHandlers {
  static handleStartGame(gameEvent, eventId, sessionUuid, currentState, computationTimestamp) {
    // Same validation code (DUPLICATED!)
    if (!validateStateExists(currentState, 'start game')) return undefined;
    const playerId = extractPlayerId(gameEvent);
    if (!validateHost(currentState, playerId, 'start game')) { /* ... */ }
    if (isEventProcessed(currentState, eventId, 'START_GAME')) return undefined;

    // Spyfall-specific logic
    const location = await fetchRandomLocation(packId, locale);
    // ... assign spy/citizen roles
    return newState;
  }
}

export class MafiaHandlers {
  static handleStartGame(gameEvent, eventId, sessionUuid, currentState, computationTimestamp) {
    // Same validation code (DUPLICATED AGAIN!)
    if (!validateStateExists(currentState, 'start game')) return undefined;
    // ... rest of duplicate validation
  }
}
```

**✅ GOOD: Base class with shared logic, derived classes override game-specific behavior**

```typescript
// Base class: Shared logic for all games
export class BaseHandlers {
  // ✅ Common validation shared by all games
  protected static _validateStartGameCommon(
    gameEvent: GameEvent,
    eventId: string,
    sessionUuid: string,
    currentState: GameState | null,
    computationTimestamp: number,
    gameName: string
  ): GameState | undefined | null {
    if (!validateStateExists(currentState, `start ${gameName} game`)) {
      return undefined;
    }

    const playerId = extractPlayerId(gameEvent);
    if (!validateHost(currentState, playerId, `start ${gameName} game`)) {
      const newState = cloneGameState(currentState);
      addPlayerError(newState, playerId, ERROR_CODES.NOT_HOST, /* ... */);
      markEventProcessed(newState, eventId, computationTimestamp);
      return newState;
    }

    if (isEventProcessed(currentState, eventId, 'START_GAME')) {
      return undefined;
    }

    return null; // Validation passed
  }

  // ✅ Common bot filling logic
  protected static _addBotsIfNeeded(
    currentState: GameState,
    computationTimestamp: number
  ): GameState {
    const currentPlayers = Object.values(currentState.players || {});
    const humanPlayerCount = currentPlayers.filter(p => !p.isBot).length;
    const gameType = currentState.gameType || GameTypeNames.HORNSWOGGLE;
    const botThreshold = getBotFillThreshold(gameType);

    if (wantDebug && humanPlayerCount < botThreshold && botThreshold > 0) {
      const botsNeeded = botThreshold - humanPlayerCount;
      return this.addBotPlayers(currentState, botsNeeded, computationTimestamp);
    }
    return currentState;
  }

  // ✅ Polymorphic hook: Each game implements its own bot logic
  static addBotPlayers(state: GameState, count: number, timestamp: number): GameState {
    throw new Error('addBotPlayers must be implemented by derived class');
  }

  // ✅ Polymorphic hook: Each game implements its own start logic
  static async handleStartGame(
    gameEvent: GameEvent,
    eventId: string,
    sessionUuid: string,
    currentState: GameState | null,
    computationTimestamp: number
  ): Promise<GameState | undefined> {
    throw new Error('handleStartGame must be implemented by derived class');
  }
}

// Derived class: Hornswoggle-specific implementation
export class HornswoggleHandlers extends BaseHandlers {
  static async handleStartGame(
    gameEvent: GameEvent,
    eventId: string,
    sessionUuid: string,
    _currentState: GameState | null,
    computationTimestamp: number
  ): Promise<GameState | undefined> {
    const currentState = _currentState;

    // ✅ Use shared validation from base class
    const validationResult = this._validateStartGameCommon(
      gameEvent,
      eventId,
      sessionUuid,
      currentState,
      computationTimestamp,
      'Hornswoggle'
    );
    if (validationResult !== null) return validationResult;

    // ✅ Use shared bot logic from base class
    const stateWithBots = this._addBotsIfNeeded(currentState, computationTimestamp);

    // ✅ Hornswoggle-specific logic ONLY
    const prompt = await fetchRandomPrompt(packId, locale);
    const newState = cloneGameState(stateWithBots) as HornswoggleGameState;
    newState.gamePhase = GamePhase.SUBMISSION;
    newState.gamePayload.currentPrompt = { /* ... */ };
    // ... rest of Hornswoggle setup

    return newState;
  }

  static addBotPlayers(state: GameState, count: number, timestamp: number): GameState {
    // ✅ Hornswoggle-specific bot creation
    const newState = cloneGameState(state);
    for (let i = 0; i < count; i++) {
      const botId = `${BOT_PLAYER_PREFIX}${botIndex}`;
      const botPlayer = {
        playerId: botId,
        displayName: getBotName(botIndex),
        // ... Hornswoggle bot properties
      };
      newState.players[botId] = botPlayer;
    }
    return newState;
  }
}

// Derived class: Spyfall-specific implementation
export class SpyfallHandlers extends BaseHandlers {
  static async handleStartGame(
    gameEvent: GameEvent,
    eventId: string,
    sessionUuid: string,
    _currentState: GameState | null,
    computationTimestamp: number
  ): Promise<GameState | undefined> {
    const currentState = _currentState;
    // ✅ Same validation as Hornswoggle - from base class
    const validationResult = this._validateStartGameCommon(
      gameEvent,
      eventId,
      sessionUuid,
      currentState,
      computationTimestamp,
      'Spyfall'
    );
    if (validationResult !== null) return validationResult;

    // ✅ Spyfall-specific logic ONLY
    const location = await fetchRandomLocation(packId, locale);
    const newState = cloneGameState(currentState) as SpyfallGameState;
    newState.gamePhase = GamePhase.ACCUSATION;
    newState.gamePayload.currentLocation = location;
    // ... assign spy/citizen roles
    return newState;
  }

  static addBotPlayers(state: GameState, count: number, timestamp: number): GameState {
    // ✅ Spyfall-specific bot creation (different properties)
    // ... Spyfall bot setup
  }
}
```

### Key Principles

1. **Extract Common Logic to Base Class**: Validation, error handling, state cloning, event processing - these belong in `BaseHandlers`.

2. **Use Protected Helpers for Reusable Patterns**: Methods like `_validateStartGameCommon()` and `_addBotsIfNeeded()` encapsulate validation patterns that multiple derived classes need.

3. **Override Only Game-Specific Behavior**: Derived classes implement `handleStartGame()`, `addBotPlayers()`, etc. to handle their unique game logic.

4. **Polymorphic Method Calls**: Use `this.methodName()` in base class to call derived class implementations. The base class doesn't know which game it's handling - it just delegates to the right handler.

5. **Use `async` for Heavy Operations**: Game start often requires Firestore fetches. Mark these as `async`/`await` and handle in derived classes.

6. **Type Safety**: Even though handlers are polymorphic, cast to game-specific types (`HornswoggleGameState`) when accessing game-specific payload:
   ```typescript
   const hornswoggleState = currentState as HornswoggleGameState;
   if (hornswoggleState.gamePayload.playerSubmissions) { /* ... */ }
   ```

### Common Anti-Patterns to Avoid

**❌ Copy-pasting validation logic across handlers:**
```typescript
// In HornswoggleHandlers, SpyfallHandlers, MafiaHandlers
if (!currentState) return undefined;
const playerId = extractPlayerId(gameEvent);
if (!currentState.players[playerId]?.isHost) { /* error */ }
// ... validation repeated 3 times with minor differences
```

**✅ Extract to protected base method and reuse:**
```typescript
// In BaseHandlers
protected static _validateStartGameCommon(gameEvent, eventId, sessionUuid, currentState, computationTimestamp, gameName) {
  if (!validateStateExists(currentState, `start ${gameName} game`)) return undefined;
  // ... all validation logic
  return null; // Success
}

// In all derived handlers
const validationResult = this._validateStartGameCommon(gameEvent, eventId, sessionUuid, currentState, computationTimestamp, gameName);
if (validationResult !== null) return validationResult; // null = success
```

---

## 8. Null/Undefined Checks: Using `const` to Satisfy Linters

**Principle:** When a linter warns that a variable might be `null` or `undefined` even after a guard clause, extract it to a `const` to reset the type narrowing context. This is cleaner than using non-null assertions (`!`).

### The Problem

TypeScript's type narrowing sometimes "forgets" that you've checked a variable. This happens especially across function boundaries or in complex control flow.

**Bad Practice: Using non-null assertions (`!`)**
```typescript
// ❌ BAD: Non-null assertions hide potential bugs
if (!validateStateExists(currentState, 'submit lie')) return undefined;

const playerId = extractPlayerId(gameEvent);
if (!validateHost(currentState, playerId, 'submit lie')) {
  const newState = cloneGameState(currentState!); // ❌ Using ! assertion
  addPlayerError(newState, playerId, /* ... */);
  return newState;
}
```

**Problem**: The `!` operator tells TS to "trust me, it's not null" - but if validation truly failed, this causes runtime crashes. It also silences legitimate warnings.

### The Solution: Extract to `const`

When you've validated a variable exists, extract it to a `const`. This resets TypeScript's type narrowing and satisfies linters without forcing assertions.

**✅ GOOD: Extract to const, THEN check for null**
```typescript
// Step 1: Extract to const (still typed as GameState | null)
const validState = currentState;

// Step 2: Check for null - NOW TypeScript narrows the type
if (!validState) {
  return undefined; // Exit early
}

// Step 3: Use the extracted const - TypeScript knows it's GameState (not null)
const playerId = extractPlayerId(gameEvent);
if (!validateHost(validState, playerId, 'submit lie')) {
  const newState = cloneGameState(validState); // ✅ No ! assertion needed - TS knows it's not null
  addPlayerError(newState, playerId, ERROR_CODES.NOT_HOST, /* ... */);
  return newState;
}

// Continue using validState - type narrowing is maintained
const hornswoggleState = validState as HornswoggleGameState;
if (!hornswoggleState.gamePayload.playerSubmissions) {
  hornswoggleState.gamePayload.playerSubmissions = {};
}
```

### Real-World Example from Codebase

**Before (with assertions):**
```typescript
static handleSubmitLie(
  gameEvent: GameEvent,
  eventId: string,
  sessionUuid: string,
  currentState: GameState | null,
  computationTimestamp: number
): GameState | undefined {
  if (!validateStateExists(currentState, 'submit lie')) return undefined;

  const newState = cloneGameState(currentState!); // ❌ Linter still complains - validateStateExists doesn't narrow type
  HornswoggleHandlers.applyEventToState(newState, gameEvent, computationTimestamp);
  return newState;
}
```

**After (with correct const extraction):**
```typescript
static handleSubmitLie(
  gameEvent: GameEvent,
  eventId: string,
  sessionUuid: string,
  currentState: GameState | null,
  computationTimestamp: number
): GameState | undefined {
  // ✅ CORRECT: Extract to const FIRST
  const validState = currentState; // Still typed as GameState | null
  
  // ✅ Then check it - THIS check narrows the type
  if (!validState) return undefined; // Now validState is GameState (not null)

  // ✅ No ! assertions needed - type narrowing works
  if (!validateStateExists(validState, 'submit lie')) return undefined;

  // Check if already processed
  if (isEventProcessed(validState, eventId, 'HW_SUBMIT_LIE')) return undefined;

  const playerId = extractPlayerId(gameEvent);

  // Validate phase
  if (!validatePhase(validState, GamePhase.SUBMISSION, 'submit lie')) {
    const newState = cloneGameState(validState); // ✅ No ! assertion - TS knows it's safe
    addPlayerError(newState, playerId, ERROR_CODES.WRONG_PHASE, /* ... */);
    markEventProcessed(newState, eventId, computationTimestamp);
    return newState;
  }

  // Apply event
  const newState = cloneGameState(validState); // ✅ Clean and type-safe
  HornswoggleHandlers.applyEventToState(newState, gameEvent, computationTimestamp);
  markEventProcessed(newState, eventId, computationTimestamp);

  return newState;
}
```

### When to Use This Pattern

- **Guard clauses**: Extract to `const` FIRST, then immediately check for `null`/`undefined`. The check itself narrows the type.
- **Parameter validation**: Extract parameter to `const`, then check it. This is the only way to reset type narrowing across function boundaries.
- **Before long code blocks**: If you have multiple statements using the same variable, extract once at the top and check immediately.
- **Avoid calling validation helpers and expecting type narrowing**: Helper functions like `validateHost()` return `boolean` — they don't narrow types. Always extract to `const` first, then do explicit null checks.

### When NOT to Use This Pattern

- **Inside short if blocks**: No need to extract if the variable is only used once or twice in the immediate block
- **At function boundaries**: Don't over-extract - use them in the function where they're validated

```typescript
// ❌ Unnecessary extraction for single-use
function helper(state: GameState | null) {
  if (!state) return;
  const validState = state;
  return validState.gamePhase; // Used once - don't bother extracting
}

// ✅ Good extraction when used multiple times
function helper(state: GameState | null) {
  if (!state) return;
  const validState = state;
  
  calculateScores(validState);
  updatePhase(validState);
  saveState(validState); // Used multiple times - extraction justified
}
```

---

## 9. Type Narrowing with Guards and Derived Variables

**Principle:** When a variable can have multiple types (union types), use type guards to check the actual type, then create a new variable with that specific type for all further operations. This is safer than repeatedly casting or using non-null assertions.

### The Pattern

1. **Check the type** using a type guard function or runtime check
2. **Create a new variable** with the narrowed type (type assertion)
3. **Use the new variable** for all subsequent operations

### Why This Matters

- **Type Safety:** TypeScript knows the exact type and can provide proper autocomplete and error checking
- **No Repeated Casts:** Instead of `as MafiaGameState` everywhere, cast once and use consistently
- **Self-Documenting Code:** Variable names like `mafiaGame` or `hornswoggleState` clearly indicate the expected type
- **Easier Refactoring:** If the type changes, you only update the assertion in one place

### Real-World Example

**Context:** `MafiaDayVotingPhase.tsx` - We need to access `gamePayload` which only exists on `MafiaGameState`, not the base `GameState`.

**Bad Practice: Repeated type assertions**
```typescript
// ❌ BAD: Using `as` repeatedly throughout the component
const payload = (currentGame as MafiaGameState).gamePayload;

const myRole = (currentGame as MafiaGameState).gamePayload?.playerRoleDetails?.[currentPlayerId]?.role;

// ... later in the code ...
const winnerFaction = getMafiaWinner(currentGame as MafiaGameState);

// ... and again ...
const eliminatedPlayers = (currentGame as MafiaGameState).gamePayload?.eliminatedPlayers || [];
```

**Problems:**
- Hard to read - each line needs `as MafiaGameState`
- Error-prone - easy to miss one cast
- Violates DRY principle - same cast repeated multiple times
- TypeScript can't help if you forget a cast

**Good Practice: Type guard + derived variable**
```typescript
// ✅ GOOD: Check once, create derived variable, use everywhere
const { currentGame, currentPlayerId } = useGame();

// 1. Type guard check
const isMafiaGameState = currentGame && isMafiaGame(currentGame);

// 2. Early return for non-Mafia games
if (!currentGame || !isMafiaGameState || !currentPlayerId) {
  logger.warn('MafiaDayVotingPhase rendered for non-Mafia game or without player ID');
  return null;
}

// 3. Create derived variable with known type
const mafiaGame = currentGame as MafiaGameState;
const payload = mafiaGame.gamePayload;

// 4. Use the typed variables throughout - NO MORE CASTS NEEDED
const myRole = payload.playerRoleDetails?.[currentPlayerId]?.role;
const eliminatedPlayers = payload.eliminatedPlayers || [];
const winnerFaction = getMafiaWinner(mafiaGame);
```

### Key Points

1. **Guard First**: Always check the type before creating the derived variable
2. **Early Return**: After the guard, return early if the type doesn't match
3. **Type Assertion Only Once**: Cast at the point of assignment to the derived variable
4. **Use Derived Variable**: All subsequent code uses the typed variable (`mafiaGame`, `payload`)
5. **Optional Chaining Still Safe**: Even with typed variables, use optional chaining (`?.`) for runtime safety in case of corrupted data

### When to Use This Pattern

- **Component props** that accept multiple game state types
- **API responses** that can be different shapes based on a `type` field
- **Database documents** with discriminator fields (e.g., `gameType: 'MAFIA' | 'HORNSWOGGLE'`)
- **Polymorphic event handlers** that handle multiple game types

### Type Guard Functions

Always prefer using helper functions for type guards:

```typescript
// Type guard function - returns true if the game is a Mafia game
export function isMafiaGame(game: GameState | null): game is MafiaGameState {
  return game?.gameType === GameTypeNames.MAFIA;
}

// Usage - TypeScript now knows `game` is `MafiaGameState` inside the if
if (isMafiaGame(currentGame)) {
  // currentGame is automatically narrowed to MafiaGameState here
  const payload = currentGame.gamePayload; // No cast needed!
}
```

### Don't Overuse Type Assertions

Only use `as` when:
- You've already validated the type with a guard
- The validation happens just before the assertion
- You're assigning to a new variable with a descriptive name

**Bad Pattern:**
```typescript
// ❌ BAD: Blind assertion without validation
const mafiaGame = currentGame as MafiaGameState; // Runtime crash if not actually Mafia!
```

**Good Pattern:**
```typescript
// ✅ GOOD: Validate first, then assert
if (!currentGame || currentGame.gameType !== GameTypeNames.MAFIA) {
  return null; // Early return for non-Mafia games
}
const mafiaGame = currentGame as MafiaGameState; // Safe - we validated it's Mafia
```

---

## 10. React Hooks: Wrapper Component Pattern for Conditional Rendering

**Principle:** React Hooks must be called in the exact same order on every render. You cannot call hooks after an early return or inside conditional blocks. When a component needs to validate props/context before rendering, use the **wrapper component pattern** to satisfy the Rules of Hooks.

### The Problem

**React Hooks Error:**
```typescript
// ❌ BAD: React Hook "useMemo" is called conditionally
export function MafiaDayRevealPhase() {
  const { currentGame, currentPlayerId, eventClient } = useGame();
  const [helpModalVisible, setHelpModalVisible] = useState(false);
  
  // Early return BEFORE useMemo - violates Rules of Hooks
  if (!currentGame || !isMafiaGame(currentGame) || !currentPlayerId) {
    return null;
  }
  
  // Hook called conditionally - will fail lint
  const teammates = useMemo(() => {
    // ... teammate calculation
  }, [currentGame, currentPlayerId]);
  
  return <View>...</View>;
}
```

**Problem:** The early return means `useMemo` isn't called on every render. React requires hooks to be called in the same order every time, even if the component returns `null`.

### The Solution: Wrapper + Inner Component

Split into two components:
1. **Wrapper component** (exported): Validates data and decides whether to render
2. **Inner component** (not exported): Contains all hooks and assumes data is valid

**✅ GOOD: Wrapper validates, inner component uses hooks**

```typescript
// Step 1: Define props interface for validated data
interface MafiaDayRevealPhaseProps {
  currentGame: MafiaGame;  // Strongly typed - not nullable
  currentGameId: string | null;
  currentPlayerId: string;  // Guaranteed to exist
  eventClient: ReturnType<typeof useGame>['eventClient'];
}

// Step 2: Inner component receives validated props - uses hooks freely
function MafiaDayRevealPhaseIntern({
  currentGame,
  currentGameId,
  currentPlayerId,
  eventClient,
}: MafiaDayRevealPhaseProps) {
  const { t } = useTranslation();
  const [helpModalVisible, setHelpModalVisible] = useState(false);
  
  // ✅ No early returns before hooks - component only renders when valid
  
  // ✅ All hooks called unconditionally
  const teammates = useMemo(() => {
    if (!myRole || myRole === MafiaRole.CITIZEN) return [];
    const players = Object.values(currentGame.players || {});
    return players.filter(p => {
      const r = payload.playerRoleDetails?.[p.playerId]?.role;
      return r === myRole && p.playerId !== currentPlayerId;
    });
  }, [myRole, currentGame.players, payload.playerRoleDetails, currentPlayerId]);
  
  const payload = currentGame.gamePayload;
  // ... rest of component logic
  
  return (
    <ScreenTemplate>
      {/* ... component JSX */}
    </ScreenTemplate>
  );
}

// Step 3: Wrapper component - validates and passes props to inner
export function MafiaDayRevealPhase() {
  const { currentGame, currentGameId, currentPlayerId, eventClient } = useGame();
  
  // ✅ Validate BEFORE rendering inner component
  if (!currentGame || !isMafiaGame(currentGame) || !currentPlayerId) {
    return null;
  }
  
  // ✅ Inner component only renders with valid data
  return (
    <MafiaDayRevealPhaseIntern
      currentGame={currentGame}
      currentGameId={currentGameId}
      currentPlayerId={currentPlayerId}
      eventClient={eventClient}
    />
  );
}
```

### Why This Works

1. **Wrapper calls `useGame()` once** - Only one hook, called unconditionally
2. **Validation happens in wrapper** - Before inner component renders
3. **Inner component receives validated props** - Can assume data exists
4. **All hooks in inner component are unconditional** - Component only renders when data is valid
5. **Type safety preserved** - Props interface ensures correct types

### Naming Convention

- **Wrapper**: Use the public component name (e.g., `MafiaDayRevealPhase`)
- **Inner**: Suffix with `Intern` (e.g., `MafiaDayRevealPhaseIntern`)
  - Alternative: Prefix with `_` (e.g., `_MafiaDayRevealPhase`) if not exported

### When to Use This Pattern

Use the wrapper pattern when:

- Component needs early returns based on hook values (context, props)
- Component uses `useMemo`, `useEffect`, `useCallback` that depend on validated data
- Linter shows "Hook called conditionally" errors
- Component accepts nullable props but needs non-null types internally

**Don't use this pattern when:**
- Component has no early returns
- All hooks are unconditional
- Component is purely presentational with no validation logic

### Key Rules

1. **Export only the wrapper** - Inner component is an implementation detail
2. **Pass ALL necessary hook values** - Don't call the same hook twice
3. **Define props interface** - Use strong types (not nullable) for validated data
4. **Keep wrapper minimal** - Only validation and rendering decision
5. **Put all hooks in inner component** - Including `useState`, `useMemo`, `useEffect`, etc.

### Real-World Example

From `MafiaDayRevealPhase.tsx`:

```typescript
// Props with validated types
interface MafiaDayRevealPhaseProps {
  currentGame: MafiaGame;  // Not GameState | null - validated as MafiaGame
  currentGameId: string | null;
  currentPlayerId: string;  // Not string | null - validated to exist
  eventClient: ReturnType<typeof useGame>['eventClient'];
}

// Inner component - all hooks, no validation
function MafiaDayRevealPhaseIntern(props: MafiaDayRevealPhaseProps) {
  const { currentGame, currentPlayerId } = props;
  
  // ✅ useMemo always called - no conditional returns before it
  const teammates = useMemo(() => {
    // ... calculation
  }, [currentGame, currentPlayerId]);
  
  // Component logic and JSX
}

// Wrapper - validate and render
export function MafiaDayRevealPhase() {
  const gameContext = useGame();
  
  if (!gameContext.currentGame || !isMafiaGame(gameContext.currentGame) || !gameContext.currentPlayerId) {
    return null;
  }
  
  return <MafiaDayRevealPhaseIntern {...gameContext} />;
}
```

---

## 11. Naming Conventions

*   **Types/Interfaces/Enums**: `PascalCase` (e.g., `GameState`, `UserProfile`).
*   **Components**: `PascalCase` (e.g., `GamePlayScreen`).
*   **Variables/Functions**: `camelCase` (e.g., `calculateScore`, `isValid`).
*   **Constants**: `UPPER_CASE` (e.g., `MAX_PLAYERS`, `DEFAULT_TIMEOUT`).

## 12. DRY: Shared Component Code

**Principle:** Practice DRY (Don't Repeat Yourself) by establishing shared component code. Aim for code that can be shared across web, React Native, and controller platforms. When impossible, at minimum share within the controller. Platform-specific implementations should be moved to `@abstractions` or `@abstractions_controllers`.

### Component Placement Strategy

| Code Location | When to Use |
|---------------|-------------|
| `src/components/` | Reusable UI shared across AppVid screens |
| `src/utils/` | Shared media, timeline, and domain helpers |
| `@abstractions/*` | Platform-specific implementations (web vs native) |
| `@abstractions_controllers/*` | Controller-specific platform implementations (PWA + Mobile only) |

### Example Pattern: ReusableComponent

The ReusableComponent component demonstrates this pattern:

**1. Shared Component** (`src/components/ReusableComponent.tsx`):
```tsx
import { ReusableComponentBorder } from '@abstractions_controllers/ReusableComponent';

// Contains shared logic: state management, accessibility, character counting, font resizing
// Works identically on both web and mobile
export function ReusableComponent({ value, onChangeText, maxLength = 200, ...props }) {
  const [fontSize, setFontSize] = useState(DEFAULT_FONT_SIZE);
  const [isFocused, setIsFocused] = useState(false);
  // ... shared logic here

  return (
    <View style={styles.wrapper}>
      <ReusableComponentBorder focused={isFocused} motionAllowed={motionAllowed} />
      <TextInput {...props} value={value} onChangeText={onChangeText} />
    </View>
  );
}
```

**2. Platform Abstractions**:

Web (`src/web/abstractions/ReusableComponent.tsx`):
```tsx
// Uses plain SVG for web rendering
export function ReusableComponentBorder({ focused, motionAllowed }) {
  return (
    <View pointerEvents="none">
      <svg width="100%" height="100%" viewBox={WAVY_TEXT_INPUT_VIEWBOX}>
        <path d={WAVY_TEXT_INPUT_PATH} stroke={focused ? ... : ...} />
      </svg>
    </View>
  );
}
```

Mobile (`src/mobile/abstractions/ReusableComponent.tsx`):
```tsx
import Svg, { Path } from 'react-native-svg';

// Uses react-native-svg for native rendering
export function ReusableComponentBorder({ focused, motionAllowed }) {
  return (
    <View pointerEvents="none">
      <Svg width="100%" height="100%" viewBox={WAVY_TEXT_INPUT_VIEWBOX}>
        <Path d={WAVY_TEXT_INPUT_PATH} stroke={focused ? ... : ...} />
      </Svg>
    </View>
  );
}
```

### Benefits

1. **Single Source of Truth**: Business logic lives in one place
2. **Platform Optimization**: Rendering can be optimized per platform
3. **Easier Maintenance**: Bug fixes and features apply to all platforms
4. **Type Safety**: Shared props and interfaces ensure consistency

### When to Create Abstractions

Create platform abstractions when:
- Different rendering approaches are needed (SVG vs react-native-svg, HTML vs native components)
- Platform-specific APIs are required (haptics, biometrics, native permissions)
- Performance optimizations differ between platforms

DO NOT duplicate entire components—only abstract the platform-specific parts.

## 13. Receiver Screen Guidelines

**Principle:** All receiver screens MUST use `ReceiverScreenContainer` as their root element. This ensures consistent sizing and overflow protection across all screens.

### Required Pattern

```tsx
import { ReceiverScreenContainer } from '../common/components/ReceiverScreenContainer';

export function MyScreen() {
  return (
    <ReceiverScreenContainer style={styles.container}>
      {/* screen content */}
    </ReceiverScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    // Layout props only (justifyContent, alignItems, padding)
    // Do NOT set flex: 1, backgroundColor: 'transparent', or overflow
    // These are handled by ReceiverScreenContainer
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.xl,
  },
});
```

### Rules

1. **Always use `ReceiverScreenContainer`** as the root element. Never use a bare `<View>`.
2. **Scale fixed widths** by `RECEIVER_SCALE` instead of hardcoding pixel values (e.g., vote chart columns).

2. **Do NOT set overflow** - ReceiverScreenContainer handles overflow protection.

## 14. Translation Key Conventions

**Principle:** Translation keys must follow consistent case conventions to prevent i18next warnings and missing key errors.

### Game Type Keys (UPPERCASE)

Use uppercase for game type identifiers.

- **Examples:** `HORNSWOGGLE`, `SPYFALL`, `MAFIA`
- **Used in:** `gameDescriptions.GAMETYPE`, `help.GAMETYPE.*`

### Phase Keys (lowercase, match GAME_PHASES constants)

**CRITICAL:** Phase keys in translations must match the actual phase values from `GAME_PHASES` constants. 

**DO NOT** convert phase values to uppercase when constructing translation keys.

- **Examples:** `lobby`, `submission`, `voting`, `discussion`, `night`, `day_reveal`, `day_voting`
- **Incorrect:** `help.MAFIA.NIGHT.MAFIA.title` (uppercase phase)
- **Correct:** `help.MAFIA.night.MAFIA.title` (lowercase phase)

### Help Modal Keys (Hierarchical Pattern)

Help modal keys follow a hierarchical pattern with fallback chain:

1. **Role-specific:** `help.GAMETYPE.PHASE.ROLE.title`
   - Example: `help.MAFIA.night.MAFIA.title`
2. **Phase-specific:** `help.GAMETYPE.PHASE.title`
   - Example: `help.MAFIA.night.title`
3. **Game-specific:** `help.GAMETYPE.default.title`
   - Example: `help.MAFIA.default.title`
4. **Generic:** `help.default.title`

### Role Keys (lowercase)

Use lowercase for role identifiers.

- **Examples:** `mafia`, `police`, `doctor`, `citizen`
- **Used in:** `mafia.night.ROLE.instruction`

### Common Mistakes

1. **Uppercasing phase values:** `const phaseKey = phase.toUpperCase()` breaks translation lookups
2. **Wrong case for phase keys in locale files:** Writing `LOBBY` instead of `lobby` silently misses the lookup and falls through to the generic `help.default` content
3. **Using `.detail` when `.instruction` exists:** Prefer `.instruction` for role descriptions
4. **Missing fallback keys:** Always provide `help.GAMETYPE.default` for game-specific fallback
5. **Missing game type lobby entry:** Every game type must have a `lobby` key or it falls through to `help.default`

### Example: Correct Lobby Phase Keys in Locale Files

`GAME_PHASES.LOBBY = 'lobby'` (lowercase). All locale file keys must match:

```ts
// ❌ WRONG - key is LOBBY (uppercase), GAME_PHASES.LOBBY is 'lobby' (lowercase)
// HelpModal looks up help.SPYFALL.lobby - this key doesn't exist, falls to help.default
SPYFALL: {
  LOBBY: { title: '...', description: '...', rules: [] },
}

// ✅ CORRECT - key matches the actual phase value
SPYFALL: {
  lobby: { title: '...', description: '...', rules: [] },
}
```

Every game type must define a `lobby` entry (lowercase). Missing entries silently fall through to `help.default`, which may show generic content irrelevant to the current screen.

### Example Help Modal Implementation

```tsx
// ❌ WRONG - converts phase to uppercase
const phaseKey = effectivePhase.toUpperCase(); // "night" → "NIGHT"
const roleKey = `help.${gameType}.${phaseKey}.${normalizedRole}`; // help.MAFIA.NIGHT.MAFIA.title

// ✅ CORRECT - uses phase value directly
const roleKey = `help.${gameType}.${effectivePhase}.${normalizedRole}`; // help.MAFIA.night.MAFIA.title
```

---

## 15. Error Handling: Catch Clause Type Restrictions

**Principle:** TypeScript catch clause variables can only be typed as `any` or `unknown`. More specific types like `Error | { message?: string }` will cause compile errors.

### The Restriction

```typescript
// ❌ BAD: TypeScript doesn't allow specific types in catch clauses
} catch (err: Error | { message?: string }) {
  // TS Error: Catch clause variable type annotation must be 'any' or 'unknown' if specified.
}

// ✅ GOOD: Use `unknown` and narrow with type guards
} catch (err: unknown) {
  const errorMsg = err instanceof Error ? err.message : (err as { message?: string })?.message ?? 'Unknown error';
  setError(errorMsg);
}
```

### Pattern for Safe Error Extraction

```typescript
try {
  // ... code that might throw
} catch (err: unknown) {
  // Type guard: check if it's an Error instance
  if (err instanceof Error) {
    logger.error('Operation failed', err);
    setError(err.message);
  } else {
    // Handle non-Error objects
    const message = (err as { message?: string })?.message ?? 'Unknown error';
    logger.error('Operation failed', { error: message });
    setError(message);
  }
}
```

### Why This Matters

- **Type Safety:** `unknown` forces you to check the type before accessing properties
- **Runtime Safety:** Handles both `Error` instances and plain objects thrown as errors
- **Debugging:** Preserves stack traces when `err instanceof Error`

---

## 16. React Native Web Platform Compatibility

**Principle:** React Native Web doesn't support all React Native props. Use `Platform.OS` checks to exclude native-only props when running on web.

### Common Native-Only Props

These props work on iOS/Android but cause warnings or errors on web:
- `submitBehavior` - TextInput submit behavior control
- `blurOnSubmit` - Whether to blur on submit
- `returnKeyType` - Keyboard return key label
- `selectionColor` - Cursor color
- `textAlignVertical` - Vertical text alignment

### The Pattern

```typescript
import { Platform } from 'react-native';

// ❌ BAD: Native-only props applied on all platforms
<TextInput
  {...(hideKeyboardOnReturn && {
    submitBehavior: 'blurAndSubmit',
    blurOnSubmit: true,
    returnKeyType: 'done',
  })}
/>

// ✅ GOOD: Exclude native-only props on web
<TextInput
  {...(hideKeyboardOnReturn && Platform.OS !== 'web' && {
    submitBehavior: 'blurAndSubmit',
    blurOnSubmit: true,
    returnKeyType: 'done',
  })}
/>
```

### Helper for Platform Checks

For frequently used patterns, create a helper:

```typescript
// ✅ GOOD: Reusable helper
const nativeOnlyProps = <T extends object>(props: T): T | {} =>
  Platform.OS === 'web' ? {} : props;

// Usage:
<TextInput
  {...nativeOnlyProps({
    submitBehavior: 'blurOnSubmit',
    returnKeyType: 'done',
  })}
/>
```

---

## 17. Input Sanitization Patterns

**Principle:** User input must be sanitized at the backend handler level to prevent XSS, injection attacks, and database bloat. Validators validate structure; handlers sanitize content.

### Architecture: Handler vs Validator

| Layer | Responsibility | Example |
|-------|---------------|---------|
| **Validator** | Validate structure, required fields | `questionText` is non-empty string |
| **Handler** | Sanitize content, transform data | Strip HTML, enforce length limits |

### Sanitization Utility Pattern

```typescript
// ✅ GOOD: Centralized sanitization utility
// functions/src/shared/utils/sanitize.ts

const HTML_TAG_REGEX = /<[^>]*>/g;

export function sanitizeInput(input: string, maxLength: number, fieldName: string): string {
  // 1. Strip HTML tags
  const sanitized = input.replace(HTML_TAG_REGEX, '');

  // 2. Trim whitespace
  const trimmed = sanitized.trim();

  // 3. Validate length
  if (trimmed.length > maxLength) {
    throw new Error(`${fieldName} exceeds maximum length of ${maxLength} characters`);
  }

  return trimmed;
}

export const SANITIZE_CONSTRAINTS = {
  MAX_QUESTION_LENGTH: 500,
  MAX_ANSWER_LENGTH: 100,
} as const;

// Convenience wrappers
export function sanitizeQuestion(questionText: string): string {
  return sanitizeInput(questionText, SANITIZE_CONSTRAINTS.MAX_QUESTION_LENGTH, 'Question');
}

export function sanitizeAnswer(answer: string): string {
  return sanitizeInput(answer, SANITIZE_CONSTRAINTS.MAX_ANSWER_LENGTH, 'Answer');
}
```

### Handler Integration

```typescript
// ✅ GOOD: Apply sanitization in handler after validation
import { sanitizeQuestion, sanitizeAnswer } from '../shared/utils/sanitize';

// In handleQuestionSubmit:
try {
  // Validate first (structure)
  if (!data.questionText || !data.correctAnswer) {
    throw new Error('Missing required fields');
  }

  // Sanitize second (content)
  const sanitizedQuestion = sanitizeQuestion(data.questionText);
  const sanitizedCorrectAnswer = sanitizeAnswer(data.correctAnswer);
  const sanitizedWrongAnswers = data.wrongAnswers.map(ans => sanitizeAnswer(ans));

  // Create object with sanitized values
  const question: PartyQuizQuestion = {
    questionText: sanitizedQuestion,
    correctAnswer: sanitizedCorrectAnswer,
    wrongAnswers: sanitizedWrongAnswers,
    // ...
  };
} catch (error) {
  logger.warn('Sanitization failed', { error, playerId });
  // Add player error with user-friendly message
  return state;
}
```

### Key Rules

1. **Sanitize at the handler layer** - Never trust client-side validation
2. **Strip HTML before length validation** - Prevent encoded payloads from bypassing limits
3. **Throw descriptive errors** - Include field name and limit in error messages
4. **Log sanitization failures** - Helps detect potential attacks or bugs
5. **Use convenience wrappers** - `sanitizeQuestion()`, `sanitizeAnswer()` improve readability

---

## 18. Timestamp Comparisons: Client vs Server Time

**Principle:** Clock skew between clients and servers can cause timing bugs if you mix server timestamps (from Firebase RTDB) with client time (Date.now()). Always use the appropriate time source for each use case.

### The Infrastructure

The codebase provides `getServerTime()` from GameContext via clockSynchronizer to approximate server time on the client:

```typescript
// GameContext provides server time approximation
const { getServerTime } = useGame();

// Returns server timestamp in milliseconds
const serverNow = getServerTime();
```

### Two Use Cases, Two Patterns

#### Use Case 1: Button Enable/Disable (Client-Driven)

**Pattern:** Use `useRef(Date.now())` for purely client-side timing decisions.

When a user action triggers a timer (e.g., "wait 2 seconds before enabling button"), the timer should be based on when the action occurred on the client. Never reference server timestamps for this.

**✅ GOOD: Client-driven button enable**
```typescript
import { useRef, useEffect, useState } from 'react';

export function MyComponent() {
  const [buttonEnabled, setButtonEnabled] = useState(false);
  const phaseStartedAt = useRef(Date.now());

  useEffect(() => {
    const timer = setTimeout(() => {
      setButtonEnabled(true);
    }, 2000); // 2 seconds from NOW (client time)

    return () => clearTimeout(timer);
  }, []);

  return (
    <StyledButton disabled={!buttonEnabled} onPress={handlePress}>
      Continue
    </StyledButton>
  );
}
```

**❌ BAD: Mixing server timestamp with client Date.now()**
```typescript
// This breaks if client clock is skewed from server
const [buttonEnabled, setButtonEnabled] = useState(false);

useEffect(() => {
  const serverNow = getServerTime(); // Server time
  const timeUntil = currentGame.currentPhaseStartedAt + 2000 - serverNow;

  const timer = setTimeout(() => {
    setButtonEnabled(true);
  }, timeUntil); // ❌ Wrong! Client setTimeout expects client time
}, []);
```

**Why the bad pattern fails:**
- `currentGame.currentPhaseStartedAt` is set by the server (server time)
- `getServerTime()` returns server time
- But `setTimeout` runs on client clock (client time)
- If client clock is 5 seconds behind server, button enables 5 seconds too early

#### Use Case 2: Display/Mechanic Timing (Server-Aware)

**Pattern:** Use `getServerTime()` when calculating time remaining for server-driven phases.

When displaying "Time remaining: 45s" or checking if a phase should auto-advance, use server time to match the backend's perspective.

**✅ GOOD: Server-aware time remaining calculation**
```typescript
const { getServerTime, currentGame } = useGame();

const calculateTimeRemaining = () => {
  const serverNow = getServerTime();
  const phaseStartedAt = currentGame.currentPhaseStartedAt; // Server timestamp
  const phaseDurationMs = 60000; // 60 seconds

  const elapsed = serverNow - phaseStartedAt;
  const remaining = Math.max(0, phaseDurationMs - elapsed);

  return remaining;
};

const timeRemaining = useMemo(calculateTimeRemaining, [currentGame, getServerTime]);
```

**✅ GOOD: Phase transition check with server time**
```typescript
const { getServerTime, currentGame } = useGame();

useEffect(() => {
  const checkPhaseTransition = () => {
    const serverNow = getServerTime();
    const phaseStartedAt = currentGame.currentPhaseStartedAt;
    const phaseDurationMs = 30000; // 30 seconds

    if (serverNow - phaseStartedAt >= phaseDurationMs) {
      // Phase should transition
      logger.info('Phase duration elapsed, ready for next phase');
    }
  };

  const interval = setInterval(checkPhaseTransition, 1000);
  return () => clearInterval(interval);
}, [currentGame, getServerTime]);
```

### Common Mistakes

**❌ BAD: Comparing server timestamp with client Date.now() directly**
```typescript
// Clock skew causes this to fail
const now = Date.now(); // Client time
const timeLeft = currentGame.phaseEndsAt - now; // Server - Client = WRONG
```

**❌ BAD: Using server timestamp for setTimeout delay**
```typescript
const serverNow = getServerTime();
const delay = phaseEndsAt - serverNow;
setTimeout(() => doSomething(), delay); // ❌ Client setTimeout, server delay
```

**✅ GOOD: Matching time source to use case**
```typescript
// Button timing: Client source
const actionTime = useRef(Date.now());
useEffect(() => {
  const timer = setTimeout(() => setReady(true), 2000);
  return () => clearTimeout(timer);
}, []);

// Display timing: Server source
const timeRemaining = Math.max(0, phaseEndsAt - getServerTime());
```

### Key Rules

1. **Never mix sources:** Don't subtract server timestamps from client Date.now() or vice versa
2. **Client UI timers:** Use `useRef(Date.now())` for button enable/disable triggered by user actions
3. **Server phase timing:** Use `getServerTime()` for time remaining, phase transitions, and display countdowns
4. **setTimeout/setInterval:** These use client clock - only use with client-based delays
5. **Backend scoring:** Backend already uses server time - no client-side verification needed

### Real-World Examples from Codebase

**RevealPhase.tsx (Button timing):**
```typescript
const phaseStartedAt = useRef(Date.now());

useEffect(() => {
  const timer = setTimeout(() => {
    setContinueButtonEnabled(true);
  }, 2000);

  return () => clearTimeout(timer);
}, []);
```

**MinesweeperGamePhase.tsx (Game mechanic timing):**
```typescript
const { getServerTime, currentGame } = useGame();
const serverNow = getServerTime();
const elapsed = serverNow - gameState.gameCreatedAt;
const timeRemaining = Math.max(0, GAME_DURATION_MS - elapsed);
```

**DiscussionTimer.tsx (Phase display timing):**
```typescript
const { getServerTime, currentGame } = useGame();
const serverNow = getServerTime();
const discussionTimeRemaining = Math.max(
  0,
  currentGame.currentPhaseStartedAt + DISCUSSION_DURATION_MS - serverNow
);
```

### Testing Considerations

When testing timing logic:
- **E2E tests:** Use `shortenDelays` flag to reduce all timing constants
- **Clock skew tests:** Test with simulated clock offsets (future enhancement)
- **Manual testing:** Verify behavior on devices with incorrect system clocks

---

## 19. Lenient Validation for Backward Compatibility

**Principle:** When adding new fields to game state or events, use lenient validation with defaults instead of rejecting older clients. This allows older app versions to continue working.

### Strict vs Lenient Validation

**Strict (rejects missing fields):**
```typescript
// ❌ BAD: Breaks older app versions
function validateSubmitAnswer(data: Record<string, unknown>): boolean {
  if (!data.selectedAnswerIndex) return false;  // Older clients might not send this
  if (!data.guessedAuthorId) return false;      // Optional field - should allow missing
  return true;
}
```

**Lenient (provides defaults):**
```typescript
// ✅ GOOD: Provides defaults for optional fields
function validateSubmitAnswer(state: GameState, playerId: string, data: Record<string, unknown>): boolean {
  let answerIndex = data.selectedAnswerIndex as number | undefined;

  // Lenient: Default to first answer if not provided
  if (answerIndex === undefined) {
    logger.warn('[Validator] Missing selectedAnswerIndex, defaulting to 0', { playerId });
    answerIndex = 0;
  }

  // Lenient: Clamp out-of-range values
  if (answerIndex < 0) {
    logger.warn('[Validator] Negative answerIndex, defaulting to 0', { playerId, answerIndex });
    answerIndex = 0;
  }

  // Lenient: Optional field - log warning but don't reject
  const guessedAuthorId = data.guessedAuthorId as string | undefined;
  if (guessedAuthorId && !state.players?.[guessedAuthorId]) {
    logger.warn('[Validator] Invalid guessedAuthorId, ignoring', { playerId, guessedAuthorId });
    // Continue without the author guess
  }

  // Strict: Required fields still validated
  if (!data.questionId) return false;

  return true;
}
```

### Pattern Checklist

| Field Type | Pattern | Example |
|------------|---------|---------|
| **Required** | Reject if missing | `questionId` must exist |
| **Optional** | Log warning, continue | `guessedAuthorId` can be missing |
| **New Required** | Provide default for old clients | `selectedAnswerIndex ?? 0` |
| **Out of Range** | Clamp to valid range | `Math.max(0, Math.min(value, max))` |
| **Invalid Type** | Log warning, use default | Non-boolean → `false` |

### Migration Strategy

When adding a new required field:

1. **Phase 1 (Current Release):** Make field optional, provide default
2. **Phase 2 (Next Release):** Log deprecation warning for missing field
3. **Phase 3 (Future):** Make field required after clients update

```typescript
// Phase 1: New optional field with default
const newField = data.newField ?? DEFAULT_VALUE;

// Phase 2: Add deprecation warning
if (data.newField === undefined) {
  logger.warn('[Deprecation] newField will be required in v2.0');
}

// Phase 3: Make required
if (!data.newField) return false;
```

---

## 20. Accessibility Labels for Interactive Elements

**Principle:** All interactive elements (TouchableOpacity, Pressable, Button) must have `accessibilityLabel` for screen readers. This ensures the app is usable by visually impaired players.

### Required Props

| Element | Required Props |
|---------|---------------|
| `TouchableOpacity` | `accessibilityLabel`, `accessibilityRole="button"` |
| `Pressable` | `accessibilityLabel`, `accessibilityRole` |
| `TextInput` | `accessibilityLabel` (describes input purpose) |
| `Button` | `accessibilityLabel` (if text isn't descriptive enough) |

### Pattern

```typescript
// ❌ BAD: No accessibility labels
<TouchableOpacity onPress={handlePress}>
  <MaterialIcons name="close" />
</TouchableOpacity>

// ✅ GOOD: Clear labels for screen readers
<TouchableOpacity
  onPress={handlePress}
  accessibilityLabel="Close image"
  accessibilityRole="button"
>
  <MaterialIcons name="close" size={ICON_SIZES.small} />
</TouchableOpacity>
```

### Dynamic Labels

```typescript
// ✅ GOOD: Context-aware labels
<TouchableOpacity
  onPress={handleImagePress}
  accessibilityLabel={currentImageUrl ? "Change image" : "Add image"}
  accessibilityRole="button"
>
  {currentImageUrl ? <ImagePreview /> : <AddIcon />}
</TouchableOpacity>
```

### Icon Buttons

For icon-only buttons, labels are especially important:

```typescript
// ✅ GOOD: Describe the action, not the icon
<IconButton
  icon="delete"
  accessibilityLabel="Delete question"  // What it DOES, not icon name
  accessibilityRole="button"
/>

// ❌ BAD: Uses icon name
<IconButton
  icon="delete"
  accessibilityLabel="delete icon"  // Not helpful!
/>
```

### Testing

Test accessibility with:
1. iOS: VoiceOver (Settings → Accessibility → VoiceOver)
2. Android: TalkBack (Settings → Accessibility → TalkBack)
3. React Native: `accessibilityLabel` appears in component inspector
