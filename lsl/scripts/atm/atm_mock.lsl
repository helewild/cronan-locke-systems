integer MENU_MAIN = 0;
integer MENU_WITHDRAW = 1;
integer MENU_DEPOSIT = 2;
integer MENU_TRANSFER = 3;
integer MENU_STATEMENT = 4;
integer MENU_TRANSFER_NAME = 5;
integer MENU_CUSTOM_AMOUNT = 6;

integer SESSION_TIMEOUT = 120;
integer DIALOG_CHANNEL_BASE = -910000;
integer TEXTBOX_CHANNEL_BASE = -920000;

string CONFIG_BANK_NAME = "Whispering Pines Bank";
string CONFIG_TENANT_ID = "demo-tenant";
string CONFIG_REGION_ID = "demo-region";
string CONFIG_BRANCH_ID = "main-branch";
string CONFIG_ATM_ID = "atm-001";
string CONFIG_ACCOUNT_PREFIX = "WPB";

key gActiveUser = NULL_KEY;
integer gMenuListen = 0;
integer gTextListen = 0;
integer gMenuChannel = 0;
integer gTextChannel = 0;
integer gCurrentMenu = MENU_MAIN;
integer gPendingAmountMenu = MENU_MAIN;
integer gPendingStatementCount = 5;
string gLastRecipient = "";
integer gMockBalance = 2845;

list gMockRecentRecipients = ["Avery Stone", "Mira Vale", "Jonah Cross"];
list gMockStatement = [
    "PAYROLL +L$900",
    "TRANSFER TO Mira Vale -L$150",
    "DEPOSIT +L$500",
    "FINE PAYMENT -L$75",
    "WITHDRAWAL -L$100",
    "TRANSFER FROM Avery Stone +L$40",
    "LOAN PAYMENT -L$60",
    "CASH DEPOSIT +L$250",
    "TRANSFER TO Jonah Cross -L$20",
    "ATM WITHDRAWAL -L$50"
];

integer randomPrivateChannel(integer base)
{
    return base - (integer)llFrand(1000000.0);
}

string formatMoney(integer amount)
{
    return "L$" + (string)amount;
}

string customerName(key avatar)
{
    string full = llKey2Name(avatar);
    if (full == "")
    {
        return "Customer";
    }
    return full;
}

string accountReference(key avatar)
{
    string tail = llGetSubString((string)avatar, -5, -1);
    return CONFIG_ACCOUNT_PREFIX + "-" + tail;
}

string scopeLabel()
{
    return CONFIG_TENANT_ID + "/" + CONFIG_REGION_ID + "/" + CONFIG_BRANCH_ID;
}

string headerLine()
{
    return "[" + CONFIG_BANK_NAME + " ATM]";
}

string sessionLabel()
{
    return "Tenant: " + CONFIG_TENANT_ID
        + "\nRegion: " + CONFIG_REGION_ID
        + "\nBranch: " + CONFIG_BRANCH_ID
        + "\nATM: " + CONFIG_ATM_ID;
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

integer endSession(string reason)
{
    if (gActiveUser != NULL_KEY && reason != "")
    {
        llRegionSayTo(gActiveUser, 0, headerLine() + " " + reason);
    }

    resetListeners();
    gActiveUser = NULL_KEY;
    gCurrentMenu = MENU_MAIN;
    gPendingAmountMenu = MENU_MAIN;
    gPendingStatementCount = 5;
    gLastRecipient = "";
    llSetTimerEvent(0.0);
    return 0;
}

integer sendSessionGreeting()
{
    llRegionSayTo(
        gActiveUser,
        0,
        headerLine() + "\nSession opened for " + customerName(gActiveUser)
        + "\nAccount Ref: " + accountReference(gActiveUser)
        + "\nScope: " + scopeLabel()
        + "\nStatus: MOCK MODE"
    );
    return 0;
}

integer startSession(key avatar)
{
    if (gActiveUser != NULL_KEY && gActiveUser != avatar)
    {
        llRegionSayTo(avatar, 0, headerLine() + " This ATM is currently in use. Please try again in a moment.");
        return 0;
    }

    resetListeners();
    gActiveUser = avatar;
    gMenuChannel = randomPrivateChannel(DIALOG_CHANNEL_BASE);
    gTextChannel = randomPrivateChannel(TEXTBOX_CHANNEL_BASE);
    gMenuListen = llListen(gMenuChannel, "", avatar, "");
    gTextListen = llListen(gTextChannel, "", avatar, "");
    gCurrentMenu = MENU_MAIN;
    gPendingAmountMenu = MENU_MAIN;
    gPendingStatementCount = 5;
    gLastRecipient = "";
    llSetTimerEvent((float)SESSION_TIMEOUT);
    sendSessionGreeting();
    return 0;
}

list mainButtons()
{
    return ["Balance", "Withdraw", "Deposit", "Transfer", "Statement", "Exit"];
}

list amountButtons()
{
    return ["20", "50", "100", "500", "Custom", "Back"];
}

list transferButtons()
{
    return ["Recent", "Enter Name", "Back"];
}

list statementButtons()
{
    return ["Last 5", "Last 10", "Back"];
}

integer dialog(key avatar, string message, list buttons, integer menuId)
{
    gCurrentMenu = menuId;
    llDialog(avatar, message, buttons, gMenuChannel);
    return 0;
}

integer showMainMenu()
{
    string message = CONFIG_BANK_NAME + "\nATM Services\n\n"
        + sessionLabel()
        + "\n\nSelect a service:";
    dialog(gActiveUser, message, mainButtons(), MENU_MAIN);
    return 0;
}

integer showAmountMenu(integer menuId, string title)
{
    string message = title + "\n\n"
        + "Account Ref: " + accountReference(gActiveUser)
        + "\nAvailable Mock Balance: " + formatMoney(gMockBalance)
        + "\nChoose an amount or enter a custom value.";
    dialog(gActiveUser, message, amountButtons(), menuId);
    return 0;
}

integer showTransferMenu()
{
    string recipients = llDumpList2String(gMockRecentRecipients, "\n- ");
    string message = "Transfer Funds\n\nRecent recipients:\n- " + recipients
        + "\n\nChoose how to continue.";
    dialog(gActiveUser, message, transferButtons(), MENU_TRANSFER);
    return 0;
}

integer showStatementMenu()
{
    string message = "Statement Request\n\nChoose how many recent transactions to view.";
    dialog(gActiveUser, message, statementButtons(), MENU_STATEMENT);
    return 0;
}

integer showBalance()
{
    llRegionSayTo(
        gActiveUser,
        0,
        headerLine() + "\nBalance Inquiry\n"
        + "Customer: " + customerName(gActiveUser) + "\n"
        + "Account Ref: " + accountReference(gActiveUser) + "\n"
        + "Available Balance: " + formatMoney(gMockBalance) + "\n"
        + "Status: MOCK DATA\n"
        + "Note: Live balances will be delivered by API later."
    );
    showMainMenu();
    return 0;
}

integer sendStatement(integer count)
{
    integer available = llGetListLength(gMockStatement);
    integer i = 0;
    string body = "";

    if (count > available)
    {
        count = available;
    }

    while (i < count)
    {
        body = body + (string)(i + 1) + ". " + llList2String(gMockStatement, i) + "\n";
        ++i;
    }

    llRegionSayTo(
        gActiveUser,
        0,
        headerLine() + "\nStatement: Last " + (string)count + "\n"
        + "Account Ref: " + accountReference(gActiveUser) + "\n"
        + body
    );
    showMainMenu();
    return 0;
}

integer sendMockReceipt(string action, integer amount, string targetName, integer success)
{
    string status = "APPROVED";
    string note = "Mock response only. No live ledger updated.";
    string details;

    if (success == FALSE)
    {
        status = "DECLINED";
        note = "Mock error generated for UI testing.";
    }

    details = headerLine() + "\n"
        + "Receipt: " + action + "\n"
        + "Status: " + status + "\n"
        + "Customer: " + customerName(gActiveUser) + "\n"
        + "Account Ref: " + accountReference(gActiveUser) + "\n"
        + "Amount: " + formatMoney(amount) + "\n";

    if (targetName != "")
    {
        details = details + "Target: " + targetName + "\n";
    }

    details = details
        + "Scope: " + scopeLabel() + "\n"
        + note;

    llRegionSayTo(gActiveUser, 0, details);
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

integer shouldMockFail(integer amount)
{
    if (amount > 1000)
    {
        return TRUE;
    }
    return FALSE;
}

integer handleAmount(integer amount)
{
    integer fail = shouldMockFail(amount);

    if (gPendingAmountMenu == MENU_WITHDRAW)
    {
        sendMockReceipt("Withdrawal", amount, "", !fail);
    }
    else if (gPendingAmountMenu == MENU_DEPOSIT)
    {
        sendMockReceipt("Deposit", amount, "", TRUE);
    }
    else if (gPendingAmountMenu == MENU_TRANSFER_NAME)
    {
        if (gLastRecipient == "")
        {
            llRegionSayTo(gActiveUser, 0, headerLine() + " No recipient selected. Returning to transfer menu.");
            showTransferMenu();
            return 0;
        }
        sendMockReceipt("Transfer", amount, gLastRecipient, !fail);
    }

    gPendingAmountMenu = MENU_MAIN;
    showMainMenu();
    return 0;
}

integer promptForCustomAmount(integer returnMenu)
{
    gPendingAmountMenu = returnMenu;
    gCurrentMenu = MENU_CUSTOM_AMOUNT;
    llRegionSayTo(gActiveUser, 0, headerLine() + " Custom amount entry opened.");
    llTextBox(
        gActiveUser,
        "Enter a whole Linden amount.\nExamples: 25, 150, 1200",
        gTextChannel
    );
    return 0;
}

integer promptForRecipient()
{
    gCurrentMenu = MENU_TRANSFER_NAME;
    llRegionSayTo(gActiveUser, 0, headerLine() + " Recipient name entry opened.");
    llTextBox(
        gActiveUser,
        "Enter the recipient's full avatar name.\nExample: Avery Stone",
        gTextChannel
    );
    return 0;
}

integer handleMainChoice(string message)
{
    if (message == "Balance")
    {
        showBalance();
    }
    else if (message == "Withdraw")
    {
        showAmountMenu(MENU_WITHDRAW, "Withdraw Funds");
    }
    else if (message == "Deposit")
    {
        showAmountMenu(MENU_DEPOSIT, "Deposit Funds");
    }
    else if (message == "Transfer")
    {
        showTransferMenu();
    }
    else if (message == "Statement")
    {
        showStatementMenu();
    }
    else if (message == "Exit")
    {
        endSession("Session closed.");
    }
    return 0;
}

integer handleAmountChoice(string message, integer menuId)
{
    integer amount;

    if (message == "Back")
    {
        if (menuId == MENU_TRANSFER_NAME)
        {
            showTransferMenu();
        }
        else
        {
            showMainMenu();
        }
        return 0;
    }

    if (message == "Custom")
    {
        promptForCustomAmount(menuId);
        return 0;
    }

    amount = parseAmount(message);
    if (amount < 0)
    {
        llRegionSayTo(gActiveUser, 0, headerLine() + " Invalid amount selection.");
        showMainMenu();
        return 0;
    }

    gPendingAmountMenu = menuId;
    handleAmount(amount);
    return 0;
}

integer handleTransferChoice(string message)
{
    if (message == "Back")
    {
        showMainMenu();
    }
    else if (message == "Recent")
    {
        gLastRecipient = llList2String(gMockRecentRecipients, 0);
        gPendingAmountMenu = MENU_TRANSFER_NAME;
        llRegionSayTo(gActiveUser, 0, headerLine() + " Selected recent recipient: " + gLastRecipient);
        showAmountMenu(MENU_TRANSFER_NAME, "Transfer to " + gLastRecipient);
    }
    else if (message == "Enter Name")
    {
        promptForRecipient();
    }
    return 0;
}

integer handleStatementChoice(string message)
{
    if (message == "Back")
    {
        showMainMenu();
    }
    else if (message == "Last 5")
    {
        gPendingStatementCount = 5;
        sendStatement(gPendingStatementCount);
    }
    else if (message == "Last 10")
    {
        gPendingStatementCount = 10;
        sendStatement(gPendingStatementCount);
    }
    return 0;
}

integer handleTextInput(string message)
{
    integer amount;
    string recipient;

    if (gCurrentMenu == MENU_CUSTOM_AMOUNT)
    {
        amount = parseAmount(message);
        if (amount < 0)
        {
            llRegionSayTo(gActiveUser, 0, headerLine() + " Invalid amount. Please enter a whole number greater than zero.");
            promptForCustomAmount(gPendingAmountMenu);
            return 0;
        }
        handleAmount(amount);
    }
    else if (gCurrentMenu == MENU_TRANSFER_NAME)
    {
        recipient = llStringTrim(message, STRING_TRIM);
        if (recipient == "")
        {
            llRegionSayTo(gActiveUser, 0, headerLine() + " Recipient name cannot be blank.");
            promptForRecipient();
            return 0;
        }

        gLastRecipient = recipient;
        showAmountMenu(MENU_TRANSFER_NAME, "Transfer to " + gLastRecipient);
    }
    return 0;
}

default
{
    state_entry()
    {
        llSetObjectName(CONFIG_BANK_NAME + " ATM");
        llOwnerSay("ATM mock script ready. Touch to begin a private test session.");
    }

    touch_start(integer count)
    {
        key avatar = llDetectedKey(0);
        startSession(avatar);
        if (gActiveUser == avatar)
        {
            showMainMenu();
        }
    }

    listen(integer channel, string name, key id, string message)
    {
        if (id != gActiveUser)
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
            else if (gCurrentMenu == MENU_WITHDRAW)
            {
                handleAmountChoice(message, MENU_WITHDRAW);
            }
            else if (gCurrentMenu == MENU_DEPOSIT)
            {
                handleAmountChoice(message, MENU_DEPOSIT);
            }
            else if (gCurrentMenu == MENU_TRANSFER)
            {
                handleTransferChoice(message);
            }
            else if (gCurrentMenu == MENU_STATEMENT)
            {
                handleStatementChoice(message);
            }
            else if (gCurrentMenu == MENU_TRANSFER_NAME)
            {
                handleAmountChoice(message, MENU_TRANSFER_NAME);
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
