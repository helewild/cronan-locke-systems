integer MENU_MAIN = 0;
integer MENU_TRANSFER = 1;
integer MENU_HISTORY = 2;
integer MENU_FINES = 3;
integer MENU_LOANS = 4;
integer MENU_CARD = 5;
integer MENU_CONFIRM = 6;
integer MENU_TEXT = 7;

integer SESSION_TIMEOUT = 180;
integer DIALOG_CHANNEL_BASE = -960000;
integer TEXTBOX_CHANNEL_BASE = -970000;

integer ACTION_NONE = 0;
integer ACTION_TRANSFER_RECENT = 1;
integer ACTION_TRANSFER_NAME = 2;
integer ACTION_PAY_FINE = 3;

string CONFIG_BANK_NAME = "Whispering Pines Bank";
string CONFIG_TENANT_ID = "demo-tenant";
string CONFIG_REGION_ID = "demo-region";
string CONFIG_BRANCH_ID = "main-branch";
string CONFIG_DEVICE_ID = "hud-001";
string CONFIG_ACCOUNT_PREFIX = "WPB";

key gUser = NULL_KEY;
integer gMenuListen = 0;
integer gTextListen = 0;
integer gMenuChannel = 0;
integer gTextChannel = 0;
integer gCurrentMenu = MENU_MAIN;
integer gPendingAction = ACTION_NONE;
string gPendingTarget = "";
integer gPendingAmount = 0;

integer gMockBalance = 2845;
integer gMockFineAmount = 75;
integer gMockLoanBalance = 225;
string gMockLoanTerms = "3 weeks at L$75 per week";
string gMockCardState = "ACTIVE";

list gMockRecentRecipients = ["Avery Stone", "Mira Vale", "Jonah Cross"];
list gMockHistory = [
    "PAYROLL +L$900",
    "TRANSFER TO Mira Vale -L$150",
    "FINE PAYMENT -L$75",
    "ATM WITHDRAWAL -L$100",
    "CASH DEPOSIT +L$500"
];

integer randomPrivateChannel(integer base)
{
    return base - (integer)llFrand(1000000.0);
}

string headerLine()
{
    return "[" + CONFIG_BANK_NAME + " Mobile]";
}

string userName()
{
    string full;

    if (gUser == NULL_KEY)
    {
        return "Customer";
    }

    full = llKey2Name(gUser);
    if (full == "")
    {
        return "Customer";
    }
    return full;
}

string accountReference()
{
    string tail;

    if (gUser == NULL_KEY)
    {
        return CONFIG_ACCOUNT_PREFIX + "-00000";
    }

    tail = llGetSubString((string)gUser, -5, -1);
    return CONFIG_ACCOUNT_PREFIX + "-" + tail;
}

string scopeLabel()
{
    return CONFIG_TENANT_ID + "/" + CONFIG_REGION_ID + "/" + CONFIG_BRANCH_ID;
}

string formatMoney(integer amount)
{
    return "L$" + (string)amount;
}

list mainButtons()
{
    return ["Balance", "Transfer", "History", "Pay Fine", "Loans", "Card", "Close"];
}

list transferButtons()
{
    return ["Recent", "Enter Name", "Back"];
}

list historyButtons()
{
    return ["Refresh", "Back"];
}

list fineButtons()
{
    return ["Pay Now", "Back"];
}

list loanButtons()
{
    return ["View Terms", "Back"];
}

list cardButtons()
{
    return ["View State", "Back"];
}

list confirmButtons()
{
    return ["Confirm", "Cancel"];
}

integer resetListeners()
{
    if (gMenuListen)
    {
        llListenRemove(gMenuListen);
        gMenuListen = 0;
    }
    if (gTextListen)
    {
        llListenRemove(gTextListen);
        gTextListen = 0;
    }
    return 0;
}

integer clearPendingAction()
{
    gPendingAction = ACTION_NONE;
    gPendingTarget = "";
    gPendingAmount = 0;
    return 0;
}

integer endSession(string reason)
{
    if (gUser != NULL_KEY && reason != "")
    {
        llRegionSayTo(gUser, 0, headerLine() + " " + reason);
    }

    resetListeners();
    gCurrentMenu = MENU_MAIN;
    clearPendingAction();
    llSetTimerEvent(0.0);
    return 0;
}

integer sendSessionGreeting()
{
    llRegionSayTo(
        gUser,
        0,
        headerLine() + "\nDevice session opened for " + userName()
        + "\nAccount Ref: " + accountReference()
        + "\nScope: " + scopeLabel()
        + "\nStatus: MOCK MODE"
    );
    return 0;
}

integer startSession(key avatar)
{
    resetListeners();
    gUser = avatar;
    gMenuChannel = randomPrivateChannel(DIALOG_CHANNEL_BASE);
    gTextChannel = randomPrivateChannel(TEXTBOX_CHANNEL_BASE);
    gMenuListen = llListen(gMenuChannel, "", avatar, "");
    gTextListen = llListen(gTextChannel, "", avatar, "");
    gCurrentMenu = MENU_MAIN;
    clearPendingAction();
    llSetTimerEvent((float)SESSION_TIMEOUT);
    sendSessionGreeting();
    return 0;
}

integer dialog(key avatar, string message, list buttons, integer menuId)
{
    gCurrentMenu = menuId;
    llDialog(avatar, message, buttons, gMenuChannel);
    return 0;
}

integer showMainMenu()
{
    dialog(
        gUser,
        CONFIG_BANK_NAME + "\nMobile Banking\n\n"
        + "User: " + userName() + "\n"
        + "Account Ref: " + accountReference() + "\n"
        + "Balance: " + formatMoney(gMockBalance) + "\n"
        + "Card State: " + gMockCardState + "\n"
        + "Scope: " + scopeLabel() + "\n\n"
        + "Select an option:",
        mainButtons(),
        MENU_MAIN
    );
    return 0;
}

integer showTransferMenu()
{
    string recent = llDumpList2String(gMockRecentRecipients, "\n- ");

    dialog(
        gUser,
        "Transfer Funds\n\nRecent recipients:\n- " + recent
        + "\n\nChoose how to continue.",
        transferButtons(),
        MENU_TRANSFER
    );
    return 0;
}

integer showHistoryMenu()
{
    string body = llDumpList2String(gMockHistory, "\n");

    dialog(
        gUser,
        "Transaction History\n\n" + body + "\n\nRefresh or go back.",
        historyButtons(),
        MENU_HISTORY
    );
    return 0;
}

integer showFineMenu()
{
    dialog(
        gUser,
        "Outstanding Fine\n\n"
        + "Amount Due: " + formatMoney(gMockFineAmount) + "\n"
        + "Reference: SPEEDING-204\n"
        + "Status: DUE\n\n"
        + "Select an option:",
        fineButtons(),
        MENU_FINES
    );
    return 0;
}

integer showLoanMenu()
{
    dialog(
        gUser,
        "Loan Summary\n\n"
        + "Outstanding Balance: " + formatMoney(gMockLoanBalance) + "\n"
        + "Terms: " + gMockLoanTerms + "\n"
        + "Status: ACTIVE\n\n"
        + "Select an option:",
        loanButtons(),
        MENU_LOANS
    );
    return 0;
}

integer showCardMenu()
{
    dialog(
        gUser,
        "Card Summary\n\n"
        + "Card State: " + gMockCardState + "\n"
        + "ATM Access: "
        + ((gMockCardState == "ACTIVE") ? "AVAILABLE" : "RESTRICTED")
        + "\n\nSelect an option:",
        cardButtons(),
        MENU_CARD
    );
    return 0;
}

integer showBalanceView()
{
    llRegionSayTo(
        gUser,
        0,
        headerLine() + "\nBalance Summary\n"
        + "User: " + userName() + "\n"
        + "Account Ref: " + accountReference() + "\n"
        + "Available Balance: " + formatMoney(gMockBalance) + "\n"
        + "Outstanding Fine: " + formatMoney(gMockFineAmount) + "\n"
        + "Loan Balance: " + formatMoney(gMockLoanBalance) + "\n"
        + "Mode: MOCK DATA"
    );
    showMainMenu();
    return 0;
}

integer promptForTransferName()
{
    gCurrentMenu = MENU_TEXT;
    llRegionSayTo(gUser, 0, headerLine() + " Recipient name entry opened.");
    llTextBox(
        gUser,
        "Enter the recipient's full avatar name.\nExample: Avery Stone",
        gTextChannel
    );
    return 0;
}

integer promptForTransferAmount()
{
    gCurrentMenu = MENU_TEXT;
    llRegionSayTo(gUser, 0, headerLine() + " Transfer amount entry opened.");
    llTextBox(
        gUser,
        "Enter a whole Linden amount to send.\nExample: 25 or 150",
        gTextChannel
    );
    return 0;
}

integer parseAmount(string text)
{
    string trimmed = llStringTrim(text, STRING_TRIM);
    integer amount;

    if (trimmed == "")
    {
        return -1;
    }

    amount = (integer)trimmed;
    if (amount <= 0)
    {
        return -1;
    }

    return amount;
}

integer showConfirmMenu()
{
    string details = "Confirm Action\n\n";

    if (gPendingAction == ACTION_TRANSFER_RECENT || gPendingAction == ACTION_TRANSFER_NAME)
    {
        details = details
            + "Type: Transfer\n"
            + "To: " + gPendingTarget + "\n"
            + "Amount: " + formatMoney(gPendingAmount) + "\n";
    }
    else if (gPendingAction == ACTION_PAY_FINE)
    {
        details = details
            + "Type: Fine Payment\n"
            + "Amount: " + formatMoney(gMockFineAmount) + "\n"
            + "Reference: SPEEDING-204\n";
    }

    details = details + "\nConfirm this action?";

    dialog(gUser, details, confirmButtons(), MENU_CONFIRM);
    return 0;
}

integer completePendingAction()
{
    if (gPendingAction == ACTION_TRANSFER_RECENT || gPendingAction == ACTION_TRANSFER_NAME)
    {
        llRegionSayTo(
            gUser,
            0,
            headerLine() + "\nTransfer Receipt\n"
            + "From: " + userName() + "\n"
            + "To: " + gPendingTarget + "\n"
            + "Amount: " + formatMoney(gPendingAmount) + "\n"
            + "Account Ref: " + accountReference() + "\n"
            + "Status: APPROVED\n"
            + "Mode: MOCK ONLY"
        );
    }
    else if (gPendingAction == ACTION_PAY_FINE)
    {
        llRegionSayTo(
            gUser,
            0,
            headerLine() + "\nFine Payment Receipt\n"
            + "User: " + userName() + "\n"
            + "Amount: " + formatMoney(gMockFineAmount) + "\n"
            + "Reference: SPEEDING-204\n"
            + "Status: APPROVED\n"
            + "Mode: MOCK ONLY"
        );
    }

    clearPendingAction();
    showMainMenu();
    return 0;
}

integer handleMainChoice(string message)
{
    if (message == "Balance")
    {
        showBalanceView();
    }
    else if (message == "Transfer")
    {
        showTransferMenu();
    }
    else if (message == "History")
    {
        showHistoryMenu();
    }
    else if (message == "Pay Fine")
    {
        showFineMenu();
    }
    else if (message == "Loans")
    {
        showLoanMenu();
    }
    else if (message == "Card")
    {
        showCardMenu();
    }
    else if (message == "Close")
    {
        endSession("Session closed.");
    }
    return 0;
}

integer handleTransferChoice(string message)
{
    if (message == "Recent")
    {
        gPendingAction = ACTION_TRANSFER_RECENT;
        gPendingTarget = llList2String(gMockRecentRecipients, 0);
        llRegionSayTo(gUser, 0, headerLine() + " Selected recipient: " + gPendingTarget);
        promptForTransferAmount();
    }
    else if (message == "Enter Name")
    {
        gPendingAction = ACTION_TRANSFER_NAME;
        promptForTransferName();
    }
    else if (message == "Back")
    {
        clearPendingAction();
        showMainMenu();
    }
    return 0;
}

integer handleHistoryChoice(string message)
{
    if (message == "Refresh")
    {
        showHistoryMenu();
    }
    else if (message == "Back")
    {
        showMainMenu();
    }
    return 0;
}

integer handleFineChoice(string message)
{
    if (message == "Pay Now")
    {
        gPendingAction = ACTION_PAY_FINE;
        showConfirmMenu();
    }
    else if (message == "Back")
    {
        clearPendingAction();
        showMainMenu();
    }
    return 0;
}

integer handleLoanChoice(string message)
{
    if (message == "View Terms")
    {
        llRegionSayTo(
            gUser,
            0,
            headerLine() + "\nLoan Terms\n"
            + "Outstanding Balance: " + formatMoney(gMockLoanBalance) + "\n"
            + "Terms: " + gMockLoanTerms + "\n"
            + "Mode: MOCK DATA"
        );
        showLoanMenu();
    }
    else if (message == "Back")
    {
        showMainMenu();
    }
    return 0;
}

integer handleCardChoice(string message)
{
    if (message == "View State")
    {
        llRegionSayTo(
            gUser,
            0,
            headerLine() + "\nCard Link Status\n"
            + "Card State: " + gMockCardState + "\n"
            + "ATM Hook: READY LATER\n"
            + "HUD Hook: ACTIVE MENU ONLY\n"
            + "Mode: MOCK DATA"
        );
        showCardMenu();
    }
    else if (message == "Back")
    {
        showMainMenu();
    }
    return 0;
}

integer handleConfirmChoice(string message)
{
    if (message == "Confirm")
    {
        completePendingAction();
    }
    else if (message == "Cancel")
    {
        llRegionSayTo(gUser, 0, headerLine() + " Action canceled.");
        clearPendingAction();
        showMainMenu();
    }
    return 0;
}

integer handleTextInput(string message)
{
    string text = llStringTrim(message, STRING_TRIM);
    integer amount;

    if (text == "")
    {
        llRegionSayTo(gUser, 0, headerLine() + " Input cannot be blank.");
        showMainMenu();
        return 0;
    }

    if (gPendingAction == ACTION_TRANSFER_NAME && gPendingTarget == "")
    {
        gPendingTarget = text;
        llRegionSayTo(gUser, 0, headerLine() + " Selected recipient: " + gPendingTarget);
        promptForTransferAmount();
    }
    else if (gPendingAction == ACTION_TRANSFER_RECENT || gPendingAction == ACTION_TRANSFER_NAME)
    {
        amount = parseAmount(text);
        if (amount < 0)
        {
            llRegionSayTo(gUser, 0, headerLine() + " Invalid amount.");
            promptForTransferAmount();
            return 0;
        }

        gPendingAmount = amount;
        showConfirmMenu();
    }
    return 0;
}

default
{
    state_entry()
    {
        llSetObjectName(CONFIG_BANK_NAME + " Mobile");
        llOwnerSay("HUD mock script ready. Touch to open mobile banking.");
    }

    touch_start(integer count)
    {
        key avatar = llDetectedKey(0);
        startSession(avatar);
        showMainMenu();
    }

    listen(integer channel, string name, key id, string message)
    {
        if (id != gUser)
        {
            return;
        }

        llSetTimerEvent((float)SESSION_TIMEOUT);

        if (channel == gMenuChannel)
        {
            if (gCurrentMenu == MENU_MAIN)
            {
                handleMainChoice(message);
            }
            else if (gCurrentMenu == MENU_TRANSFER)
            {
                handleTransferChoice(message);
            }
            else if (gCurrentMenu == MENU_HISTORY)
            {
                handleHistoryChoice(message);
            }
            else if (gCurrentMenu == MENU_FINES)
            {
                handleFineChoice(message);
            }
            else if (gCurrentMenu == MENU_LOANS)
            {
                handleLoanChoice(message);
            }
            else if (gCurrentMenu == MENU_CARD)
            {
                handleCardChoice(message);
            }
            else if (gCurrentMenu == MENU_CONFIRM)
            {
                handleConfirmChoice(message);
            }
        }
        else if (channel == gTextChannel)
        {
            handleTextInput(message);
        }
    }

    timer()
    {
        endSession("Session timed out.");
    }

    changed(integer change)
    {
        if (change & (CHANGED_OWNER | CHANGED_INVENTORY))
        {
            llResetScript();
        }
    }
}
