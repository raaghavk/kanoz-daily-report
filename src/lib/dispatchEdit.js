import { sanitizeText } from './sanitize'

/** Form state for editing an existing dispatch. */
export function buildDispatchEditForm(dispatch) {
  if (!dispatch) return {}
  return {
    truck_number: dispatch.truck_number || '',
    customer_id: dispatch.customer_id || '',
    destination: dispatch.destination || '',
    driver_name: dispatch.driver_name || '',
    driver_phone: dispatch.driver_phone || '',
    transporter: dispatch.transporter || '',
    serial_no: dispatch.serial_no || '',
    invoice_no: dispatch.invoice_no || '',
    loading_date: dispatch.loading_date || '',
    loading_time: dispatch.loading_time?.slice(0, 5) || '',
    dispatch_date: dispatch.dispatch_date || '',
    dispatch_time: dispatch.dispatch_time?.slice(0, 5) || '',
    remarks: dispatch.remarks || '',
  }
}

/** When the customer changes, copy their address into Destination (same as create). */
export function applyCustomerToDispatchEdit(form, customer) {
  if (!customer) return { ...form, customer_id: '' }
  return {
    ...form,
    customer_id: customer.id,
    ...(customer.address ? { destination: customer.address } : {}),
  }
}

export function buildDispatchEditPayload(editForm, dispatch) {
  const payload = {
    truck_number: editForm.truck_number || dispatch.truck_number,
    driver_name: editForm.driver_name,
    driver_phone: editForm.driver_phone,
    transporter: editForm.transporter,
    serial_no: editForm.serial_no || null,
    invoice_no: editForm.invoice_no,
    loading_date: editForm.loading_date || null,
    loading_time: editForm.loading_time || null,
    dispatch_date: editForm.dispatch_date || null,
    dispatch_time: editForm.dispatch_time || null,
    date: editForm.dispatch_date || dispatch.date || null,
    remarks: editForm.remarks || null,
    destination: sanitizeText(editForm.destination || '', 200) || null,
  }
  if (editForm.customer_id) payload.customer_id = editForm.customer_id
  return payload
}
