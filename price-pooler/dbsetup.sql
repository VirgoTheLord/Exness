-- initial dump table
-- TIMESTAMPTZ attempts to get the time from UTC and convert to client time zone
CREATE TABLE IF NOT EXISTS trades (
    time TIMESTAMPTZ NOT NULL,
    symbol TEXT NOT NULL,
    price NUMERIC,
    quantity NUMERIC,
    is_buyer_maker BOOLEAN
);

-- make it a hypertable
SELECT create_hypertable('trades', 'time', if_not_exists => TRUE);

-- all the 4 time periods materialized views
CREATE MATERIALIZED VIEW IF NOT EXISTS trades_1m
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 minute', time) AS timestamp,
    symbol,
    FIRST(price, time) AS open_price,
    LAST(price, time) AS close_price,
    MAX(price) AS high_price,
    MIN(price) AS low_price
FROM trades
GROUP BY timestamp, symbol;

CREATE MATERIALIZED VIEW IF NOT EXISTS trades_5m
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('5 minute', time) AS timestamp,
    symbol,
    FIRST(price, time) AS open_price,
    LAST(price, time) AS close_price,
    MAX(price) AS high_price,
    MIN(price) AS low_price
FROM trades
GROUP BY timestamp, symbol;

CREATE MATERIALIZED VIEW IF NOT EXISTS trades_10m
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('10 minute', time) AS timestamp,
    symbol,
    FIRST(price, time) AS open_price,
    LAST(price, time) AS close_price,
    MAX(price) AS high_price,
    MIN(price) AS low_price
FROM trades
GROUP BY timestamp, symbol;

CREATE MATERIALIZED VIEW IF NOT EXISTS trades_30m
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('30 minute', time) AS timestamp,
    symbol,
    FIRST(price, time) AS open_price,
    LAST(price, time) AS close_price,
    MAX(price) AS high_price,
    MIN(price) AS low_price
FROM trades
GROUP BY timestamp, symbol;

-- continuous aggregate policies to refresh the views
SELECT add_continuous_aggregate_policy(
    'trades_1m',
    start_offset => INTERVAL '1 day',
    end_offset   => INTERVAL '1 minute',
    schedule_interval => INTERVAL '1 minute'
);

SELECT add_continuous_aggregate_policy(
    'trades_5m',
    start_offset => INTERVAL '1 day',
    end_offset   => INTERVAL '1 minute',
    schedule_interval => INTERVAL '1 minute'
);

SELECT add_continuous_aggregate_policy(
    'trades_10m',
    start_offset => INTERVAL '1 day',
    end_offset   => INTERVAL '1 minute',
    schedule_interval => INTERVAL '1 minute'
);

SELECT add_continuous_aggregate_policy(
    'trades_30m',
    start_offset => INTERVAL '1 day',
    end_offset   => INTERVAL '1 minute',
    schedule_interval => INTERVAL '1 minute'
);
