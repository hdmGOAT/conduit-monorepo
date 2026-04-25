ALTER TABLE payments
    RENAME COLUMN total_amount TO amount;

ALTER TABLE payments
    DROP COLUMN base_amount,
    DROP COLUMN fee_amount;