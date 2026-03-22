-- Replace permits_regulatory with housing_food category
DELETE FROM categories WHERE name = 'permits_regulatory';
INSERT INTO categories (name, cost_type, label, sort_order)
VALUES ('housing_food', 'project_cost', 'Housing & Food', 5);
