ALTER TABLE "invoices" ALTER COLUMN "institution_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "owner_user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "session_id" uuid;--> statement-breakpoint
CREATE INDEX "invoices_session_created_at_idx" ON "invoices" USING btree ("session_id","created_at");--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_owner_context_check" CHECK ((
    "invoices"."institution_id" is not null and "invoices"."owner_user_id" is not null and "invoices"."session_id" is null
  ) or (
    "invoices"."institution_id" is null and "invoices"."owner_user_id" is null and "invoices"."session_id" is not null
  ));
--> statement-breakpoint
-- Anonymous simulator rows are isolated by an unguessable per-tab capability.
-- Institutional rows remain inaccessible until the Auth-owned RLS contract exists.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "invoices", "invoice_items" TO anon;
--> statement-breakpoint
CREATE POLICY "invoices_session_capability_access" ON "invoices"
  FOR ALL TO anon
  USING (
    "institution_id" IS NULL
    AND "owner_user_id" IS NULL
    AND "session_id" = (nullif(current_setting('request.headers', true)::jsonb ->> 'x-invoice-session', '')::uuid)
  )
  WITH CHECK (
    "institution_id" IS NULL
    AND "owner_user_id" IS NULL
    AND "session_id" = (nullif(current_setting('request.headers', true)::jsonb ->> 'x-invoice-session', '')::uuid)
  );
--> statement-breakpoint
CREATE POLICY "invoice_items_session_capability_access" ON "invoice_items"
  FOR ALL TO anon
  USING (EXISTS (
    SELECT 1 FROM "invoices" AS parent
    WHERE parent."id" = "invoice_items"."invoice_id"
      AND parent."institution_id" IS NULL
      AND parent."owner_user_id" IS NULL
      AND parent."session_id" = (nullif(current_setting('request.headers', true)::jsonb ->> 'x-invoice-session', '')::uuid)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM "invoices" AS parent
    WHERE parent."id" = "invoice_items"."invoice_id"
      AND parent."institution_id" IS NULL
      AND parent."owner_user_id" IS NULL
      AND parent."session_id" = (nullif(current_setting('request.headers', true)::jsonb ->> 'x-invoice-session', '')::uuid)
  ));
--> statement-breakpoint
CREATE FUNCTION public.save_simulated_invoice(p_invoice_id uuid, p_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_session_id uuid := nullif(current_setting('request.headers', true)::jsonb ->> 'x-invoice-session', '')::uuid;
  v_invoice_id uuid;
  v_line jsonb;
  v_position integer := 0;
BEGIN
  IF v_session_id IS NULL THEN
    RAISE EXCEPTION 'Invoice session capability is required' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p_payload -> 'lines') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Invoice lines must be an array' USING ERRCODE = '22023';
  END IF;

  IF p_invoice_id IS NULL THEN
    INSERT INTO public.invoices (
      institution_id, owner_user_id, session_id, customer_name, customer_identification,
      issued_on, payment_method, subtotal, tax, total
    ) VALUES (
      NULL, NULL, v_session_id, p_payload ->> 'customer', p_payload ->> 'identification',
      (p_payload ->> 'date')::date, p_payload ->> 'paymentMethod',
      (p_payload #>> '{totals,subtotal}')::numeric, (p_payload #>> '{totals,tax}')::numeric,
      (p_payload #>> '{totals,total}')::numeric
    ) RETURNING id INTO v_invoice_id;
  ELSE
    UPDATE public.invoices SET
      customer_name = p_payload ->> 'customer',
      customer_identification = p_payload ->> 'identification',
      issued_on = (p_payload ->> 'date')::date,
      payment_method = p_payload ->> 'paymentMethod',
      subtotal = (p_payload #>> '{totals,subtotal}')::numeric,
      tax = (p_payload #>> '{totals,tax}')::numeric,
      total = (p_payload #>> '{totals,total}')::numeric,
      updated_at = now()
    WHERE id = p_invoice_id
      AND institution_id IS NULL AND owner_user_id IS NULL AND session_id = v_session_id
    RETURNING id INTO v_invoice_id;
    IF v_invoice_id IS NULL THEN
      RAISE EXCEPTION 'Invoice not found for this session' USING ERRCODE = '42501';
    END IF;
    DELETE FROM public.invoice_items WHERE invoice_id = v_invoice_id;
  END IF;

  FOR v_line IN SELECT value FROM jsonb_array_elements(p_payload -> 'lines') AS value LOOP
    v_position := v_position + 1;
    INSERT INTO public.invoice_items (
      invoice_id, product_id, position, description, quantity, unit_price, line_total
    ) VALUES (
      v_invoice_id,
      nullif(v_line ->> 'productId', ''),
      v_position,
      v_line ->> 'description',
      (v_line ->> 'quantity')::integer,
      (v_line ->> 'unitPrice')::numeric,
      ((v_line ->> 'quantity')::numeric * (v_line ->> 'unitPrice')::numeric)
    );
  END LOOP;

  RETURN v_invoice_id;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.save_simulated_invoice(uuid, jsonb) FROM PUBLIC, authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.save_simulated_invoice(uuid, jsonb) TO anon;
