process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??= "postgresql://ess:ess@localhost:5432/ess";
process.env.JWT_SECRET ??= "test-secret-test-secret-test-secret-1234";
