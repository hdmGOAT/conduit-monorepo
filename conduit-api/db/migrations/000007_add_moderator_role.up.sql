-- Add moderator role to membership_role enum

ALTER TYPE membership_role ADD VALUE IF NOT EXISTS 'moderator';
