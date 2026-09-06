CREATE TABLE dbo.Users (
    id INT IDENTITY(1,1) PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE TABLE dbo.RefreshTokens (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL REFERENCES dbo.Users(id),
    token_hash VARCHAR(255) NOT NULL,
    expires_at DATETIME2 NOT NULL,
    revoked BIT NOT NULL DEFAULT 0,
    created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE TABLE dbo.Games (
    id INT IDENTITY(1,1) PRIMARY KEY,
    slug VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL
);

CREATE TABLE dbo.Matches (
    id INT IDENTITY(1,1) PRIMARY KEY,
    game_id INT NOT NULL REFERENCES dbo.Games(id),
    player_id INT NOT NULL REFERENCES dbo.Users(id),
    status VARCHAR(20) NOT NULL DEFAULT 'in_progress'
        CHECK (status IN ('in_progress', 'finished', 'abandoned')),
    result NVARCHAR(50) NULL,
    started_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    finished_at DATETIME2 NULL
);

CREATE TABLE dbo.MatchEvents (
    id INT IDENTITY(1,1) PRIMARY KEY,
    match_id INT NOT NULL REFERENCES dbo.Matches(id),
    sequence INT NOT NULL,
    player_id INT NULL REFERENCES dbo.Users(id),
    data NVARCHAR(MAX) NOT NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_MatchEvents_match_sequence UNIQUE (match_id, sequence)
);

CREATE TABLE dbo.PointsLedgers (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL REFERENCES dbo.Users(id),
    game_id INT NOT NULL REFERENCES dbo.Games(id),
    match_id INT NULL REFERENCES dbo.Matches(id),
    points INT NOT NULL DEFAULT 0,
    reason NVARCHAR(200) NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
