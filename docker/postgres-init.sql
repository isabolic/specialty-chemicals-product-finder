-- Separate database for integration tests so they never touch dev data.
CREATE DATABASE product_finder_test OWNER finder;
