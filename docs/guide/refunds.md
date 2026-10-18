# Refunds and cancellation

## Refund

```ts
const v = await pesakit.verifyPayment(orderTrackingId);
await pesakit.refundPayment({
  confirmationCode: v.confirmationCode!,
  amount: 500,
  username: 'ops@yourapp.com',
  remarks: 'Customer returned item',
});
```

Rules at Pesapal:

- Only `COMPLETED` payments.
- One refund per payment.
- Cards: partial or full. Mobile money: full amount only.
- Same currency as the payment.
- A `200` means received. The merchant approves it in the Pesapal dashboard before money moves.

A rejection throws `PaymentError` with the Pesapal message in `error.details.pesapal`.

## Cancel

```ts
await pesakit.cancelOrder(orderTrackingId);
```

Only pending or failed orders, and only once. Completed orders cannot be cancelled; refund them instead.
