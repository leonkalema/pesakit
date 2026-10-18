# Payouts

Pesapal API 3.0 moves money in one direction: from the customer to your Pesapal wallet. Pesapal settles your wallet to your bank on its schedule. The only API that returns money is `RefundRequest`, and it pays the original payer.

There is no public Pesapal endpoint to send money to a phone number or bank account, so pesakit does not have one.

For payouts look at the telco APIs directly (Safaricom Daraja B2C, MTN MoMo Disbursements, Airtel Money Disbursement) or an aggregator that covers several corridors. If Pesapal offers you a private disbursement product through your account manager, open an issue and it can be added behind a flag.
