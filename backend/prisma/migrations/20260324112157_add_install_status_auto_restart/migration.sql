-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Server" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "gameType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'stopped',
    "port" INTEGER NOT NULL,
    "pid" INTEGER,
    "dataPath" TEXT NOT NULL,
    "config" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "installStatus" TEXT NOT NULL DEFAULT 'not_installed',
    "autoRestart" BOOLEAN NOT NULL DEFAULT false,
    "userId" INTEGER NOT NULL,
    CONSTRAINT "Server_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Server" ("config", "createdAt", "dataPath", "gameType", "id", "name", "pid", "port", "status", "updatedAt", "userId") SELECT "config", "createdAt", "dataPath", "gameType", "id", "name", "pid", "port", "status", "updatedAt", "userId" FROM "Server";
DROP TABLE "Server";
ALTER TABLE "new_Server" RENAME TO "Server";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
