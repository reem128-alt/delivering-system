import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PaymentProvider,
  PaymentIntentResult,
  PaymentConfirmationResult,
  PaymentCaptureResult,
  PaymentRefundResult,
  PaymentDetails,
} from './payment-provider.interface';

import Stripe from 'stripe';

// Extended interface to include missing Stripe properties
interface ExtendedPaymentIntent extends Stripe.PaymentIntent {
  captured_at?: number;
}

@Injectable()
export class StripeProvider implements PaymentProvider {
  private readonly logger = new Logger(StripeProvider.name);
  private readonly stripe: Stripe;

  constructor(private configService: ConfigService) {
    // Uncomment when Stripe package is installed and add STRIPE_SECRET_KEY to environment
    this.stripe = new Stripe(
      this.configService.get<string>('STRIPE_SECRET_KEY') as string,
      {
        apiVersion: '2025-12-15.clover',
      },
    );
  }

  async createPaymentIntent(
    amount: number,
    currency: string,
    orderId: number,
  ): Promise<PaymentIntentResult> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Stripe uses cents
        currency: currency.toLowerCase(),
        metadata: {
          orderId: orderId.toString(),
        },
        payment_method_types: ['card'], // Only accept card payments
        capture_method: 'manual', // Authorize only, don't capture automatically
      });

      this.logger.log(
        `Created payment intent ${paymentIntent.id} for order ${orderId}`,
      );

      return {
        id: paymentIntent.id,
        clientSecret: paymentIntent.client_secret!,
        status: paymentIntent.status,
        amount: paymentIntent.amount / 100, // Convert back to dollars
        currency: paymentIntent.currency.toUpperCase(),
        metadata: paymentIntent.metadata,
      };
    } catch (error) {
      this.logger.error(
        `Failed to create payment intent: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  async confirmPaymentIntent(
    paymentIntentId: string,
    paymentMethodId: string,
  ): Promise<PaymentConfirmationResult> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.confirm(
        paymentIntentId,
        {
          payment_method: paymentMethodId,
          capture_method: 'manual', // Authorize only, don't capture yet
        },
      );

      this.logger.log(
        `Confirmed payment intent ${paymentIntentId} with payment method ${paymentMethodId}`,
      );

      return {
        id: paymentIntent.id,
        status: paymentIntent.status,
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency.toUpperCase(),
        paymentMethodId: paymentIntent.payment_method as string,
        authorizationId: paymentIntent.latest_charge as string,
      };
    } catch (error) {
      this.logger.error(
        `Failed to confirm payment intent: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  async capturePayment(
    paymentIntentId: string,
    amount?: number,
  ): Promise<PaymentCaptureResult> {
    try {
      const captureParams = amount
        ? { amount_to_capture: Math.round(amount * 100) }
        : {};
      const paymentIntent = (await this.stripe.paymentIntents.capture(
        paymentIntentId,
        captureParams,
      )) as ExtendedPaymentIntent;

      this.logger.log(
        `Captured payment ${paymentIntentId} for amount ${amount || 'full'}`,
      );

      return {
        id: paymentIntent.id,
        status: paymentIntent.status,
        amountCaptured:
          (paymentIntent.amount_received || paymentIntent.amount) / 100,
        currency: paymentIntent.currency.toUpperCase(),
        capturedAt: paymentIntent.captured_at
          ? new Date(paymentIntent.captured_at * 1000)
          : new Date(),
      };
    } catch (error) {
      this.logger.error(
        `Failed to capture payment: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  async refundPayment(
    paymentIntentId: string,
    amount: number,
    reason?: string,
  ): Promise<PaymentRefundResult> {
    try {
      const refund = await this.stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount: Math.round(amount * 100),
        reason:
          reason &&
          ['duplicate', 'fraudulent', 'requested_by_customer'].includes(reason)
            ? (reason as Stripe.RefundCreateParams.Reason)
            : undefined,
      });

      this.logger.log(
        `Refunded ${amount} for payment ${paymentIntentId}. Reason: ${reason}`,
      );

      return {
        id: refund.id,
        status: refund.status as string,
        amountRefunded: refund.amount / 100,
        currency: refund.currency.toUpperCase(),
        refundId: refund.id,
        reason: refund.reason || undefined,
        refundedAt: new Date(refund.created * 1000),
      };
    } catch (error) {
      this.logger.error(
        `Failed to refund payment: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  async retrievePayment(paymentIntentId: string): Promise<PaymentDetails> {
    try {
      const paymentIntent = (await this.stripe.paymentIntents.retrieve(
        paymentIntentId,
      )) as ExtendedPaymentIntent;

      this.logger.log(`Retrieved payment details for ${paymentIntentId}`);

      return {
        id: paymentIntent.id,
        status: paymentIntent.status,
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency.toUpperCase(),
        paymentMethodId: paymentIntent.payment_method as string,
        createdAt: new Date(paymentIntent.created * 1000),
        capturedAt: paymentIntent.captured_at
          ? new Date(paymentIntent.captured_at * 1000)
          : undefined,
        metadata: paymentIntent.metadata,
      };
    } catch (error) {
      this.logger.error(
        `Failed to retrieve payment: ${(error as Error).message}`,
      );
      throw error;
    }
  }
}
