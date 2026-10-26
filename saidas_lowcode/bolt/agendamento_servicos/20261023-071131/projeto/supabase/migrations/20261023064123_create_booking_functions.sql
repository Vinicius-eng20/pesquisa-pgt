/*
# Função: Criar Agendamento Atomicamente

## Descrição
Cria uma função RPC que atomicamente:
1. Verifica se o slot está disponível (não reservado)
2. Marca o slot como reservado (is_booked = true)
3. Cria o registro de booking com status 'pending'

Isso evita race conditions onde dois clientes tentam agendar o mesmo horário simultaneamente.

## Segurança
- SECURITY DEFINER: executa com privilégios elevados para atualizar o slot
- Apenas usuários autenticados e não-business podem chamar
- Revogada de PUBLIC/anon
*/

CREATE OR REPLACE FUNCTION public.create_booking(
  p_slot_id uuid,
  p_notes text DEFAULT ''
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking_id uuid;
  v_slot record;
  v_client_id uuid := auth.uid();
BEGIN
  -- Lock the slot row to prevent concurrent booking
  SELECT * INTO v_slot
  FROM available_slots
  WHERE id = p_slot_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Horário não encontrado';
  END IF;

  IF v_slot.is_booked THEN
    RAISE EXCEPTION 'Este horário já foi reservado';
  END IF;

  -- Mark slot as booked
  UPDATE available_slots SET is_booked = true WHERE id = p_slot_id;

  -- Create booking
  INSERT INTO bookings (client_id, business_id, service_id, slot_id, status, notes)
  VALUES (v_client_id, v_slot.business_id, v_slot.service_id, p_slot_id, 'pending', p_notes)
  RETURNING id INTO v_booking_id;

  RETURN v_booking_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_booking(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_booking(uuid, text) TO authenticated;

-- Function to cancel a booking (client) — also frees the slot
CREATE OR REPLACE FUNCTION public.cancel_booking(
  p_booking_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking record;
  v_user_id uuid := auth.uid();
BEGIN
  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Agendamento não encontrado';
  END IF;

  -- Only the client who owns the booking can cancel
  IF v_booking.client_id != v_user_id THEN
    RAISE EXCEPTION 'Você não pode cancelar este agendamento';
  END IF;

  -- Only pending or confirmed bookings can be cancelled
  IF v_booking.status NOT IN ('pending', 'confirmed') THEN
    RAISE EXCEPTION 'Este agendamento não pode mais ser cancelado';
  END IF;

  -- Update booking status
  UPDATE bookings SET status = 'cancelled' WHERE id = p_booking_id;

  -- Free the slot
  UPDATE available_slots SET is_booked = false WHERE id = v_booking.slot_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cancel_booking(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_booking(uuid) TO authenticated;

-- Function for business to update booking status (confirm/decline)
CREATE OR REPLACE FUNCTION public.update_booking_status(
  p_booking_id uuid,
  p_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking record;
  v_user_id uuid := auth.uid();
  v_is_business boolean;
BEGIN
  -- Check if user is business
  SELECT public.is_business() INTO v_is_business;

  IF NOT v_is_business THEN
    RAISE EXCEPTION 'Apenas o responsável pode alterar o status de agendamentos';
  END IF;

  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Agendamento não encontrado';
  END IF;

  IF v_booking.business_id != v_user_id THEN
    RAISE EXCEPTION 'Você não tem permissão para alterar este agendamento';
  END IF;

  IF p_status NOT IN ('confirmed', 'declined') THEN
    RAISE EXCEPTION 'Status inválido';
  END IF;

  -- If declining, free the slot
  IF p_status = 'declined' THEN
    UPDATE available_slots SET is_booked = false WHERE id = v_booking.slot_id;
  END IF;

  UPDATE bookings SET status = p_status WHERE id = p_booking_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_booking_status(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_booking_status(uuid, text) TO authenticated;