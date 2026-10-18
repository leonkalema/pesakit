# Subscriptions

Pesapal bills recurring payments on cards only (Visa and Mastercard). Add `subscription` to a normal order:

```ts
await pesakit.createPayment({
  amount: 999,
  currency: 'KES',
  description: 'Monthly plan',
  reference: 'SUB-77',
  email: 'jane@example.com',
  callbackUrl: 'https://yourapp.com/pesapal/callback',
  subscription: {
    accountNumber: 'CUSTOMER-77',
    startDate: '01-11-2026',   // DD-MM-YYYY
    endDate: '01-11-2027',
    frequency: 'MONTHLY',      // DAILY | WEEKLY | MONTHLY | YEARLY
  },
});
```

The customer confirms the subscription on the checkout page and cannot edit the details there.

Each later charge arrives as an IPN with `orderNotificationType: 'RECURRING'`. Your `onNotification` receives the verification with `subscriptionTransactionInfo`:

```ts
onNotification: async (v, ipn) => {
  if (ipn.orderNotificationType === 'RECURRING') {
    const info = v.subscriptionTransactionInfo; // { account_reference, amount, first_name, last_name, correlation_id }
  }
}
```
