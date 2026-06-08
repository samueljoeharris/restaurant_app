CREATE UNIQUE INDEX IF NOT EXISTS restaurants_google_place_id_uidx
    ON restaurants (google_place_id)
    WHERE google_place_id IS NOT NULL;
