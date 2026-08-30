ALTER TABLE "pages" ADD CONSTRAINT "pages_import_position_within_expected_count" CHECK ("pages"."import_position" < "pages"."import_expected_count") NOT VALID;
