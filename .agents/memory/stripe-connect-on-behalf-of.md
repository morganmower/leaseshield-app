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
