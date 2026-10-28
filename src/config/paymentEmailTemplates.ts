import { emailTemplateFromSpec, type EmailDetailRow } from './emailTemplateDesign';

export const PAYMENT_EMAIL_VARIABLES = [
  ['name', 'Customer Name', 'Rahul Kumar'],
  ['plan', 'Payment sheet heading', 'API Subscription'],
  ['payment_id', 'Payment ID', 'pay_SAMPLE123456'],
  ['order_id', 'Order ID', 'order_SAMPLE123456'],
  ['amount', 'Amount', '₹99.00'],
  ['transaction_id', 'Transaction ID', '628012345678'],
  ['customer_id', 'Customer ID', 'cust_SAMPLE123456'],
  ['event_id', 'Event ID', 'TkSAMPLE123456'],
  ['subscription_id', 'Subscription ID', 'sub_SAMPLE123456'],
  ['invoice_id', 'Invoice ID', 'inv_SAMPLE123456'],
  ['currency', 'Currency', 'INR'],
  ['description', 'Description', 'QRv2 Payment'],
  ['method', 'Method', 'UPI'],
  ['vpa', 'Payer UPI ID', 'rahul@upi'],
  ['card_details', 'Card Details', 'Visa •• 1234'],
  ['bank', 'Bank', 'HDFC Bank'],
  ['provider', 'Provider', 'Payment Provider'],
  ['status', 'Status', 'Successful'],
  ['received', 'Received', '05 October 2026 at 10:43:00 PM IST'],
  ['rrn', 'RRN', '628012345678'],
  ['mobile', 'Mobile Number', '+91 98765 43210'],
  ['email', 'Email ID', 'rahul@example.com'],
  ['refund_id', 'Refund ID', 'rfnd_SAMPLE123456'],
  ['refund_speed', 'Refund Speed', 'Normal'],
  ['refund_status', 'Refund Status', 'Refund can take up to 7 business days.'],
  ['refund_amount', 'Refunded Amount', '₹99.00'],
  ['refund_currency', 'Refund Currency', 'INR'],
  ['refund_comment', 'Refund Comment', 'Cancel'],
  ['refund_description', 'Refund Description', 'Refund'],
  ['refund_customer_id', 'Refund Customer ID', 'cust_SAMPLE123456'],
  ['refund_upi_transaction_id', 'UPI Transaction ID', '628012345679'],
  ['refund_received', 'Refund processed', '05 October 2026 at 10:45:00 PM IST'],
  ['error_description', 'Error Details', 'Payment failed. No additional details were provided.'],
  ['error_code', 'Error Code', 'BAD_REQUEST_ERROR'],
  ['pdf_url', 'Payment PDF link', 'https://worklyindia.devs.surf/payment-history'],
  ['invoice_url', 'Official invoice link', 'https://worklyindia.devs.surf/payment-history'],
].map(([key, label, sample]) => ({ key, label, sample }));

const detail = (key: string): EmailDetailRow => ({
  label: PAYMENT_EMAIL_VARIABLES.find((v) => v.key === key)?.label || key,
  value: `{{${key}}}`,
});

export const PAYMENT_EMAIL_DEFAULTS = Object.fromEntries(
  (['success', 'failed', 'refund'] as const).map((kind) => {
    const status = kind === 'success' ? 'Successful' : kind === 'failed' ? 'Failed' : 'Refunded';
    const extra = kind === 'failed' ? ['error_description', 'error_code'] : kind === 'refund'
      ? ['refund_id', 'refund_speed', 'refund_status', 'refund_amount', 'refund_currency', 'refund_comment', 'refund_description', 'refund_customer_id', 'refund_upi_transaction_id', 'refund_received'] : [];
    const template = emailTemplateFromSpec({
      subject: `${kind === 'success' ? 'Payment Successful' : kind === 'failed' ? 'Payment Failed' : 'Payment Refund'} — {{plan}} ({{amount}})`,
      tone: kind === 'failed' ? 'danger' : kind === 'refund' ? 'info' : 'success',
      heading: kind === 'success' ? 'Payment Success' : kind === 'failed' ? 'Payment Failed' : 'Payment Refund',
      intro: kind === 'success' ? 'Your payment for {{plan}} has been received successfully. Complete details are below.' : kind === 'failed' ? 'Your payment for {{plan}} could not be completed. Any deducted amount will be returned by your bank.' : 'A refund has been issued for your {{plan}} payment. Complete details are below.',
      detailsTitle: 'Payment Details',
      details: [detail('payment_id'), ...['transaction_id', 'customer_id', 'event_id', 'subscription_id', 'invoice_id'].map(detail), detail('method'), detail('vpa'), detail('card_details'), detail('bank'), detail('provider'), { label: 'Status', value: status },
        ...['amount', 'currency', 'description', 'received', 'rrn', 'order_id', 'mobile', 'email', ...extra].map(detail)],
    });
    return [`payment_${kind}`, template];
  }),
);
// PayPal (verified webhook) — same complete-detail layout as the Razorpay payment templates.
export const PAYPAL_EMAIL_VARIABLES = [
  ['name', 'Customer Name', 'Rahul Kumar'],
  ['plan', 'Payment sheet heading', 'API Subscription'],
  ['paypal_order_id', 'PayPal Order ID', '5O190127TN364715T'],
  ['capture_id', 'Capture ID', '3C679366HH908993F'],
  ['order_id', 'Order ID', 'order_SAMPLE123456'],
  ['status', 'Status', 'Successful'],
  ['amount', 'Amount', '$1.19'],
  ['amount_inr', 'Amount (INR)', '₹99.00'],
  ['currency', 'Currency', 'USD'],
  ['received', 'Received', '05 October 2026 at 10:43:00 PM IST'],
  ['payer_name', 'Payer Name', 'Rahul Kumar'],
  ['payer_email', 'Payer Email', 'rahul@example.com'],
  ['payer_id', 'Payer ID', 'QYR5Z8XDVJNXQ'],
  ['error_description', 'Error Details', 'Payment declined by PayPal'],
  ['refund_id', 'Refund ID', '1JU08902781691411'],
  ['refund_amount', 'Refunded Amount', '$1.19'],
  ['total_refunded', 'Total Refunded', '$1.19'],
  ['refund_note', 'Refund Note', 'Cancel'],
  ['refund_received', 'Refund processed', '05 October 2026 at 10:45:00 PM IST'],
].map(([key, label, sample]) => ({ key, label, sample }));

const ppDetail = (key: string): EmailDetailRow => ({
  label: PAYPAL_EMAIL_VARIABLES.find((v) => v.key === key)?.label || key,
  value: `{{${key}}}`,
});

export const PAYPAL_EMAIL_DEFAULTS = Object.fromEntries(
  (['success', 'failed', 'refund'] as const).map((kind) => {
    const extra = kind === 'failed' ? ['error_description']
      : kind === 'refund' ? ['refund_id', 'refund_amount', 'total_refunded', 'refund_note', 'refund_received'] : [];
    const template = emailTemplateFromSpec({
      subject: `${kind === 'success' ? 'Payment Successful' : kind === 'failed' ? 'Payment Failed' : 'Payment Refund'} — {{plan}} ({{amount}})`,
      tone: kind === 'failed' ? 'danger' : kind === 'refund' ? 'info' : 'success',
      heading: kind === 'success' ? 'Payment Success' : kind === 'failed' ? 'Payment Failed' : 'Payment Refund',
      intro: kind === 'success' ? 'Your PayPal payment for {{plan}} has been received successfully. Complete details are below.'
        : kind === 'failed' ? 'Your PayPal payment for {{plan}} could not be completed. No money was taken.'
        : 'A refund has been issued for your PayPal payment for {{plan}}. Complete details are below.',
      detailsTitle: 'Payment Details',
      details: ['paypal_order_id', 'capture_id', 'order_id', 'status', 'amount', 'amount_inr', 'currency', 'received', 'payer_name', 'payer_email', 'payer_id', ...extra].map(ppDetail),
    });
    return [`paypal_payment_${kind}`, template];
  }),
);
