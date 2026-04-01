# ATM Mock Test Checklist

Use this after dropping `scripts/atm/atm_mock.lsl` into an in-world ATM prim.

## Compile

- Script saves without syntax errors.
- Object owner sees the startup owner-say message.
- Object name changes to `Whispering Pines ATM`.

## Session Privacy

- Touching the ATM opens the menu only for the toucher.
- A second avatar touching during an active session gets the busy message.
- Waiting for timeout closes the session cleanly.

## Main Menu

- `Balance` shows a mock balance and returns to the main menu.
- `Withdraw` opens the amount menu.
- `Deposit` opens the amount menu.
- `Transfer` opens the transfer menu.
- `Statement` opens the statement menu.
- `Exit` closes the session.

## Withdraw and Deposit

- `20`, `50`, `100`, and `500` produce mock receipts.
- `Custom` opens a text box.
- Invalid custom amount returns an error and re-prompts.
- `Back` returns to the main menu.

## Transfer

- `Recent` selects a mock recipient and opens the amount menu.
- `Enter Name` opens a text box.
- Blank recipient input returns an error and re-prompts.
- Entering a name then choosing an amount produces a transfer receipt.
- `Back` returns to the main menu.

## Statement

- `Last 5` prints five mock lines.
- `Last 10` prints ten mock lines.
- `Back` returns to the main menu.

## Mock Failure Paths

- Withdraw above `L$1000` returns a decline message.
- Transfer above `L$1000` returns a decline message.
- Deposit remains approved in mock mode.

## Notes To Report Back

When testing, capture:

- compiler errors
- chat output text
- any menu that fails to reopen
- any text box path that gets stuck
- any behavior that feels awkward for RP use
