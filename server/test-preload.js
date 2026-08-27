// Force an isolated in-memory DB for tests so they never touch app.sqlite.
process.env.DB_PATH = process.env.DB_PATH || ':memory:';
