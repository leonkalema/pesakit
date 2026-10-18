# Payments

`createPayment()` calls Pesapal `SubmitOrderRequest`.

```ts
const order = await pesakit.createPayment({
  amount: 1500,
  currency: 'KES',
  description: 'Order 1042',
  reference: 'ORDER-1042',
  email: 'jane@example.com',
  phoneNumber: '254712345678',
  callbackUrl: 'https://yourapp.com/pesapal/callback',
  cancellationUrl: 'https://yourapp.com/cart',
  redirectMode: 'PARENT_WINDOW',
  branch: 'Nairobi CBD',
  firstName: 'Jane',
  lastName: 'Doe',
  billingAddress: { countryCode: 'KE', city: 'Nairobi' },
});
```

## Fields

| Field | Required | Notes |
| --- | --- | --- |
| `amount` | yes | Positive number |
| `currency` | | ISO 4217. Default `KES` |
| `description` | yes | Max 100 chars |
| `reference` | yes | Your order id. Unique per merchant. Max 50 chars. Letters, digits, `- _ . :` |
| `callbackUrl` | yes | Where the customer lands after checkout |
| `email` or `phoneNumber` | one | |
| `notificationId` | | `ipnId` from `registerIpnUrl()`. Falls back to `ipnUrl`, then `config.ipnUrl` |
| `ipnUrl` | | Per payment override |
| `cancellationUrl` | | Adds a cancel link on the checkout page |
| `redirectMode` | | `TOP_WINDOW` (default at Pesapal) or `PARENT_WINDOW` for iframes |
| `branch` | | Label in your Pesapal dashboard |
| `firstName`, `middleName`, `lastName` | | |
| `billingAddress` | | `line1 line2 city state postalCode zipCode countryCode`. `state` max 3 chars |
| `subscription` | | See [Subscriptions](./subscriptions) |

## Result

```ts
{
  orderTrackingId: 'b945e4af-...',   // store this
  merchantReference: 'ORDER-1042',
  redirectUrl: 'https://cybqa.pesapal.com/pesapaliframe/...',
  raw: { /* Pesapal response */ }
}
```

Store `orderTrackingId` with your order. You need it for status checks, IPN matching and cancellation.

## IPN registration

Pesapal requires a registered IPN URL on every order. pesakit handles it:

- Pass `ipnUrl` in config. On the first payment pesakit looks it up with `GetIpnList`, registers it if missing, and caches the id.
- Or register once yourself with `registerIpnUrl()` and pass `notificationId` on each order.

## Common Pesapal errors

| `error.pesapalCode` | Cause |
| --- | --- |
| `duplicate_reference` | `reference` was used before. Make it unique |
| `invalid_notification_id` | The IPN id is not registered for this merchant |
| `invalid_consumer_key_or_secret_provided` | Wrong keys, or sandbox keys against production |
