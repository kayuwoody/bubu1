-- product_categories: controls per-category visibility and labels
-- Run this in the Supabase SQL editor

CREATE TABLE IF NOT EXISTS product_categories (
  id         TEXT    PRIMARY KEY,  -- matches products.category value
  label      TEXT    NOT NULL,
  is_private BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- Seed with existing category values (matches CAT_ORDER in menu API)
INSERT INTO product_categories (id, label, is_private, sort_order) VALUES
  ('coffee',       'Coffee',         FALSE, 1),
  ('non-coffee',   'Non-Coffee',     FALSE, 2),
  ('cold',         'Iced & Frappe',  FALSE, 3),
  ('food',         'Bakes',          FALSE, 4),
  ('combo',        'Combos',         FALSE, 5)
ON CONFLICT (id) DO NOTHING;

-- in_stock: set FALSE to grey out an item without hiding it entirely
-- (available_online = FALSE hides the item completely)
ALTER TABLE products ADD COLUMN IF NOT EXISTS in_stock BOOLEAN NOT NULL DEFAULT TRUE;
