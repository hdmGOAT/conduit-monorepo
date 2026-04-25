ALTER TABLE payments
    RENAME COLUMN amount TO total_amount;

ALTER TABLE payments
    ADD COLUMN base_amount BIGINT,
    ADD COLUMN fee_amount BIGINT NOT NULL DEFAULT 0;

UPDATE payments
SET base_amount = total_amount,
    fee_amount = 0
WHERE base_amount IS NULL;

ALTER TABLE payments
    ALTER COLUMN base_amount SET NOT NULL;