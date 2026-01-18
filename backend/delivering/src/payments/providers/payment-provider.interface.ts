export interface PaymentProvider {
  /**
   * Create a payment intent for authorization
   */
  createPaymentIntent(
    amount: number,
    currency: string,
    orderId: number,
  ): Promise<PaymentIntentResult>;

  /**
   * Confirm/authorize a payment intent
   */
  confirmPaymentIntent(
    paymentIntentId: string,
    paymentMethodId: string,
  ): Promise<PaymentConfirmationResult>;

  /**
   * Capture funds from an authorized payment
   */
  capturePayment(
    paymentIntentId: string,
    amount?: number,
  ): Promise<PaymentCaptureResult>;

  /**
   * Refund a payment
   */
  refundPayment(
    paymentIntentId: string,
    amount: number,
    reason?: string,
  ): Promise<PaymentRefundResult>;

  /**
   * Retrieve payment details
   */
  retrievePayment(paymentIntentId: string): Promise<PaymentDetails>;
}

export interface PaymentIntentResult {
  id: string;
  clientSecret?: string;
  status: string;
  amount: number;
  currency: string;
  metadata?: Record<string, string>;
}

export interface PaymentConfirmationResult {
  id: string;
  status: string;
  amount: number;
  currency: string;
  paymentMethodId: string;
  authorizationId?: string;
}

export interface PaymentCaptureResult {
  id: string;
  status: string;
  amountCaptured: number;
  currency: string;
  capturedAt: Date;
}

export interface PaymentRefundResult {
  id: string;
  status: string;
  amountRefunded: number;
  currency: string;
  refundId: string;
  reason?: string;
  refundedAt: Date;
}

export interface PaymentDetails {
  id: string;
  status: string;
  amount: number;
  currency: string;
  paymentMethodId?: string;
  createdAt: Date;
  capturedAt?: Date;
  refundedAt?: Date;
  metadata?: Record<string, string>;
}
