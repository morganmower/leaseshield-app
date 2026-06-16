---
name: Stripe Connect on_behalf_of needs card_payments
description: Why ACH rent charges using on_behalf_of fail for landlord connected accounts, and the gate/fallback to use.
---

# on_behalf_of requires the card_payments capability

Setting `on_behalf_of` = a connected account on a charge (used to make the
landlord the merchant of record on the ACH/NACHA mandate) makes Stripe **reject
the charge** unless that connected account has the `card_payments` capability
**active** — even for `us_bank_account` (ACH) payments. Error seen in prod:
"You cannot create a charge with the `on_behalf_of` parameter set to a connected
account with `transfers` but without the `card_payments` capability enabled."

Landlord Express accounts are onboarded ACH-first (transfers +
us_bank_account_ach_payments), so card_payments is usually inactive.

**Rule:** before creating the Checkout Session / PaymentIntent, retrieve the
connected account and only set `on_behalf_of` (+ `statement_descriptor_suffix`)
when `acct.capabilities?.card_payments === 'active'`. Otherwise create a plain
destination charge (`transfer_data.destination` + `application_fee_amount`) —
funds and platform fees still route correctly; only the merchant-of-record
display falls back to the platform.

**Why:** keeps tenant ACH checkout working for every landlord while preserving
landlord-as-merchant display where Stripe allows it.

**How to apply:** onboarding requests `card_payments` too, so accounts that
complete the extra verification become eligible over time; the per-charge gate
makes the upgrade automatic with no code change. Requesting card_payments adds
onboarding requirements but never blocks ACH because of the fallback.

**Idempotency gotcha:** when you rebuild a Checkout Session to drop a now-broken
param, the `idempotencyKey` MUST change or Stripe (24h cache) returns the
ORIGINAL response — i.e. the old broken session — so the fix appears not to work.
Encode the merchant-of-record / config state into the key (e.g. `...-mor0/-mor1`).
Also: a tenant sitting on the old hosted checkout.stripe.com page won't pick up
the fix; they must restart from the app's `/pay-rent/:token` link to get a fresh
session.
