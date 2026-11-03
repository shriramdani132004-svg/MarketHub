-- Add a distinct event type for customer-initiated cancellation before payment.
ALTER TYPE "PaymentEventType" ADD VALUE IF NOT EXISTS 'PAYMENT_CANCELLED';
