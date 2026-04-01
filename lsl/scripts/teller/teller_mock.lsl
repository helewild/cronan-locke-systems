integer MENU_MAIN = 0;
integer MENU_CUSTOMER = 1;
integer MENU_AMOUNT = 2;
integer MENU_CONFIRM = 3;
integer MENU_PIN = 4;
integer MENU_FINE = 5;
integer MENU_LOAN = 6;
integer MENU_FREEZE = 7;

integer SESSION_TIMEOUT = 180;
integer DIALOG_CHANNEL_BASE = -930000;
integer TEXTBOX_CHANNEL_BASE = -940000;

string CONFIG_BANK_NAME = "Whispering Pines Bank";
string CONFIG_TENANT_ID = "demo-tenant";
string CONFIG_REGION_ID = "demo-region";
string CONFIG_BRANCH_ID = "main-branch";
string CONFIG_TERMINAL_ID = "teller-001";
string CONFIG_ACCOUNT_PREFIX = "WPB";

key gActiveStaff = NULL_KEY;
integer gMenuListen = 0;
integer gTextListen = 0;
integer gMenuChannel = 0;
integer gTextChannel = 0;
integer gCurrentMenu = MENU_MAIN;
integer gPendingAction = MENU_MAIN;
string gTargetCustomer = "";
integer gPendingAmount = 0;
string gPendingNote = "";

list gStaffWhitelist = [
    "Xander Evergarden",
    "Bank Manager",
    "Lead Teller"
];

list gRecentCustomers = [
    "Avery Stone",
    "Mira Vale",
    "Jonah Cross"
];

integer randomPrivateChannel(integer base)
{
    return base - (integer)llFrand(1000000.0);
}

string formatMoney(integer amount)
{
    return "L$" + (string)amount;
}

string displayName(key avatar)
{
    string full = llKey2Name(avatar);
    if (full == "")
    {
        return "Unknown Resident";
    }
    return full;
}

string customerAccountReference(string customerName)
{
    string tail = llGetSubString(customerName, -4, -1);
    return CONFIG_ACCOUNT_PREFIX + "-" + tail;
}

string scopeLabel()
{
    return CONFIG_TENANT_ID + "/" + CONFIG_REGION_ID + "/" + CONFIG_BRANCH_ID;
}

string headerLine()
{
    return "[" + CONFIG_BANK_NAME + " Teller]";
}

integer isWhitelistedStaff(key avatar)
{
    if (~llListFindList(gStaffWhitelist, [displayName(avatar)]))
    {
        return TRUE;
    }
    return FALSE;
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
    gPendingAction = MENU_MAIN;
    gPendingAmount = 0;
    gPendingNote = "";
    return 0;
}

integer endSession(string reason)
{
    if (gActiveStaff != NULL_KEY && reason != "")
    {
        llRegionSayTo(gActiveStaff, 0, headerLine() + " " + reason);
    }

    resetListeners();
    gActiveStaff = NULL_KEY;
    gCurrentMenu = MENU_MAIN;
    gTargetCustomer = "";
    clearPendingAction();
    llSetTimerEvent(0.0);
    return 0;
}

integer sendSessionGreeting()
{
    llRegionSayTo(
        gActiveStaff,
        0,
        headerLine() + "\nTerminal session opened for " + displayName(gActiveStaff)
        + "\nScope: " + scopeLabel()
        + "\nTerminal: " + CONFIG_TERMINAL_ID
        + "\nStatus: MOCK MODE"
    );
    return 0;
}

integer startSession(key avatar)
{
    if (!isWhitelistedStaff(avatar))
    {
        llRegionSayTo(avatar, 0, headerLine() + " Access denied. Staff authorization required.");
        return 0;
    }

    if (gActiveStaff != NULL_KEY && gActiveStaff != avatar)
    {
        llRegionSayTo(avatar, 0, headerLine() + " This terminal is currently in use.");
        return 0;
    }

    resetListeners();
    gActiveStaff = avatar;
    gMenuChannel = randomPrivateChannel(DIALOG_CHANNEL_BASE);
    gTextChannel = randomPrivateChannel(TEXTBOX_CHANNEL_BASE);
    gMenuListen = llListen(gMenuChannel, "", avatar, "");
    gTextListen = llListen(gTextChannel, "", avatar, "");
    gCurrentMenu = MENU_MAIN;
    gTargetCustomer = "";
    clearPendingAction();
    llSetTimerEvent((float)SESSION_TIMEOUT);
    sendSessionGreeting();
    return 0;
}

list mainButtons()
{
    return [
        "Open Account",
        "Deposit",
        "Withdraw",
        "View Account",
        "Issue Card",
        "Reset PIN",
        "Accept Fine",
        "Process Loan",
        "Freeze Acct",
        "Exit"
    ];
}

list customerButtons()
{
    return ["Recent", "Enter Name", "Back"];
}

list amountButtons()
{
    return ["20", "50", "100", "500", "Custom", "Back"];
}

list confirmButtons()
{
    return ["Confirm", "Cancel"];
}

integer dialog(key avatar, string message, list buttons, integer menuId)
{
    gCurrentMenu = menuId;
    llDialog(avatar, message, buttons, gMenuChannel);
    return 0;
}

string tellerMenuLabel(integer actionId)
{
    if (actionId == 10)
    {
        return "Open Account";
    }
    if (actionId == 11)
    {
        return "Deposit";
    }
    if (actionId == 12)
    {
        return "Withdraw";
    }
    if (actionId == 13)
    {
        return "View Account";
    }
    if (actionId == 14)
    {
        return "Issue Card";
    }
    if (actionId == 15)
    {
        return "Reset PIN";
    }
    if (actionId == 16)
    {
        return "Accept Fine";
    }
    if (actionId == 17)
    {
        return "Process Loan";
    }
    if (actionId == 18)
    {
        return "Freeze Account";
    }
    return "Action";
}

integer showMainMenu()
{
    string customerLine = "Target Customer: None";

    if (gTargetCustomer != "")
    {
        customerLine = "Target Customer: " + gTargetCustomer;
    }

    dialog(
        gActiveStaff,
        CONFIG_BANK_NAME + "\nTeller Terminal\n\n"
        + "Staff: " + displayName(gActiveStaff) + "\n"
        + customerLine + "\n"
        + "Scope: " + scopeLabel() + "\n"
        + "Terminal: " + CONFIG_TERMINAL_ID + "\n\n"
        + "Select an action:",
        mainButtons(),
        MENU_MAIN
    );
    return 0;
}

integer showCustomerMenu()
{
    string recent = llDumpList2String(gRecentCustomers, "\n- ");

    dialog(
        gActiveStaff,
        "Select Customer\n\nRecent customers:\n- " + recent
        + "\n\nChoose how to continue.",
        customerButtons(),
        MENU_CUSTOMER
    );
    return 0;
}

integer showAmountMenu()
{
    dialog(
        gActiveStaff,
        tellerMenuLabel(gPendingAction) + "\n\n"
        + "Customer: " + gTargetCustomer + "\n"
        + "Account Ref: " + customerAccountReference(gTargetCustomer) + "\n"
        + "Choose an amount or enter a custom value.",
        amountButtons(),
        MENU_AMOUNT
    );
    return 0;
}

integer showConfirmMenu()
{
    string message = tellerMenuLabel(gPendingAction) + "\n\n"
        + "Staff: " + displayName(gActiveStaff) + "\n"
        + "Customer: " + gTargetCustomer + "\n"
        + "Account Ref: " + customerAccountReference(gTargetCustomer) + "\n";

    if (gPendingAmount > 0)
    {
        message = message + "Amount: " + formatMoney(gPendingAmount) + "\n";
    }

    if (gPendingNote != "")
    {
        message = message + "Note: " + gPendingNote + "\n";
    }

    message = message + "\nConfirm this teller action?";

    dialog(gActiveStaff, message, confirmButtons(), MENU_CONFIRM);
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

integer requireCustomerSelection()
{
    if (gTargetCustomer == "")
    {
        llRegionSayTo(gActiveStaff, 0, headerLine() + " Select a customer first.");
        showCustomerMenu();
        return FALSE;
    }
    return TRUE;
}

integer promptForCustomerName()
{
    gCurrentMenu = MENU_CUSTOMER;
    llRegionSayTo(gActiveStaff, 0, headerLine() + " Customer name entry opened.");
    llTextBox(
        gActiveStaff,
        "Enter the customer's full avatar name.\nExample: Avery Stone",
        gTextChannel
    );
    return 0;
}

integer promptForAmount()
{
    llRegionSayTo(gActiveStaff, 0, headerLine() + " Amount entry opened.");
    llTextBox(
        gActiveStaff,
        "Enter a whole Linden amount.\nExamples: 25, 150, 1200",
        gTextChannel
    );
    return 0;
}

integer promptForPIN()
{
    gCurrentMenu = MENU_PIN;
    llRegionSayTo(gActiveStaff, 0, headerLine() + " New PIN entry opened.");
    llTextBox(
        gActiveStaff,
        "Enter a new 4 digit PIN for " + gTargetCustomer,
        gTextChannel
    );
    return 0;
}

integer promptForFineReason()
{
    gCurrentMenu = MENU_FINE;
    llRegionSayTo(gActiveStaff, 0, headerLine() + " Fine note entry opened.");
    llTextBox(
        gActiveStaff,
        "Enter a fine note or citation reference for " + gTargetCustomer,
        gTextChannel
    );
    return 0;
}

integer promptForLoanNote()
{
    gCurrentMenu = MENU_LOAN;
    llRegionSayTo(gActiveStaff, 0, headerLine() + " Loan note entry opened.");
    llTextBox(
        gActiveStaff,
        "Enter loan terms or memo for " + gTargetCustomer,
        gTextChannel
    );
    return 0;
}

integer promptForFreezeReason()
{
    gCurrentMenu = MENU_FREEZE;
    llRegionSayTo(gActiveStaff, 0, headerLine() + " Freeze reason entry opened.");
    llTextBox(
        gActiveStaff,
        "Enter the reason for freezing " + gTargetCustomer,
        gTextChannel
    );
    return 0;
}

integer sendAuditReceipt()
{
    string details = headerLine() + "\n"
        + "Action: " + tellerMenuLabel(gPendingAction) + "\n"
        + "Status: APPROVED\n"
        + "Staff: " + displayName(gActiveStaff) + "\n"
        + "Customer: " + gTargetCustomer + "\n"
        + "Account Ref: " + customerAccountReference(gTargetCustomer) + "\n";

    if (gPendingAmount > 0)
    {
        details = details + "Amount: " + formatMoney(gPendingAmount) + "\n";
    }

    if (gPendingNote != "")
    {
        details = details + "Memo: " + gPendingNote + "\n";
    }

    details = details
        + "Scope: " + scopeLabel() + "\n"
        + "Terminal: " + CONFIG_TERMINAL_ID + "\n"
        + "Audit: MOCK ONLY";

    llRegionSayTo(gActiveStaff, 0, details);
    clearPendingAction();
    showMainMenu();
    return 0;
}

integer showMockAccountView()
{
    llRegionSayTo(
        gActiveStaff,
        0,
        headerLine() + "\nAccount Review\n"
        + "Customer: " + gTargetCustomer + "\n"
        + "Account Ref: " + customerAccountReference(gTargetCustomer) + "\n"
        + "Status: ACTIVE\n"
        + "Balance: L$2845\n"
        + "Card State: ACTIVE\n"
        + "Flags: NONE\n"
        + "Mode: MOCK DATA"
    );
    clearPendingAction();
    showMainMenu();
    return 0;
}

integer beginCustomerAction(integer actionId)
{
    gPendingAction = actionId;

    if (!requireCustomerSelection())
    {
        return 0;
    }

    if (actionId == 11 || actionId == 12 || actionId == 16 || actionId == 17)
    {
        showAmountMenu();
    }
    else if (actionId == 13)
    {
        showMockAccountView();
    }
    else if (actionId == 14)
    {
        showConfirmMenu();
    }
    else if (actionId == 15)
    {
        promptForPIN();
    }
    else if (actionId == 18)
    {
        promptForFreezeReason();
    }

    return 0;
}

integer handleMainChoice(string message)
{
    if (message == "Open Account")
    {
        gPendingAction = 10;
        showCustomerMenu();
    }
    else if (message == "Deposit")
    {
        beginCustomerAction(11);
    }
    else if (message == "Withdraw")
    {
        beginCustomerAction(12);
    }
    else if (message == "View Account")
    {
        beginCustomerAction(13);
    }
    else if (message == "Issue Card")
    {
        beginCustomerAction(14);
    }
    else if (message == "Reset PIN")
    {
        beginCustomerAction(15);
    }
    else if (message == "Accept Fine")
    {
        beginCustomerAction(16);
    }
    else if (message == "Process Loan")
    {
        beginCustomerAction(17);
    }
    else if (message == "Freeze Acct")
    {
        beginCustomerAction(18);
    }
    else if (message == "Exit")
    {
        endSession("Session closed.");
    }
    return 0;
}

integer handleCustomerChoice(string message)
{
    if (message == "Back")
    {
        clearPendingAction();
        showMainMenu();
    }
    else if (message == "Recent")
    {
        gTargetCustomer = llList2String(gRecentCustomers, 0);
        llRegionSayTo(gActiveStaff, 0, headerLine() + " Selected customer: " + gTargetCustomer);

        if (gPendingAction == 10)
        {
            showConfirmMenu();
        }
        else
        {
            beginCustomerAction(gPendingAction);
        }
    }
    else if (message == "Enter Name")
    {
        promptForCustomerName();
    }
    return 0;
}

integer handleAmountChoice(string message)
{
    integer amount;

    if (message == "Back")
    {
        showMainMenu();
        return 0;
    }

    if (message == "Custom")
    {
        gCurrentMenu = MENU_AMOUNT;
        promptForAmount();
        return 0;
    }

    amount = parseAmount(message);
    if (amount < 0)
    {
        llRegionSayTo(gActiveStaff, 0, headerLine() + " Invalid amount selection.");
        showMainMenu();
        return 0;
    }

    gPendingAmount = amount;

    if (gPendingAction == 16)
    {
        promptForFineReason();
    }
    else if (gPendingAction == 17)
    {
        promptForLoanNote();
    }
    else
    {
        showConfirmMenu();
    }
    return 0;
}

integer handleConfirmChoice(string message)
{
    if (message == "Confirm")
    {
        sendAuditReceipt();
    }
    else if (message == "Cancel")
    {
        llRegionSayTo(gActiveStaff, 0, headerLine() + " Action canceled.");
        clearPendingAction();
        showMainMenu();
    }
    return 0;
}

integer handleTextInput(string message)
{
    integer amount;
    string text = llStringTrim(message, STRING_TRIM);

    if (text == "")
    {
        llRegionSayTo(gActiveStaff, 0, headerLine() + " Input cannot be blank.");
        showMainMenu();
        return 0;
    }

    if (gCurrentMenu == MENU_CUSTOMER)
    {
        gTargetCustomer = text;
        llRegionSayTo(gActiveStaff, 0, headerLine() + " Selected customer: " + gTargetCustomer);

        if (gPendingAction == 10)
        {
            showConfirmMenu();
        }
        else
        {
            beginCustomerAction(gPendingAction);
        }
    }
    else if (gCurrentMenu == MENU_AMOUNT)
    {
        amount = parseAmount(text);
        if (amount < 0)
        {
            llRegionSayTo(gActiveStaff, 0, headerLine() + " Invalid amount.");
            promptForAmount();
            return 0;
        }

        gPendingAmount = amount;

        if (gPendingAction == 16)
        {
            promptForFineReason();
        }
        else if (gPendingAction == 17)
        {
            promptForLoanNote();
        }
        else
        {
            showConfirmMenu();
        }
    }
    else if (gCurrentMenu == MENU_PIN)
    {
        gPendingNote = "PIN reset to " + text;
        showConfirmMenu();
    }
    else if (gCurrentMenu == MENU_FINE)
    {
        gPendingNote = text;
        showConfirmMenu();
    }
    else if (gCurrentMenu == MENU_LOAN)
    {
        gPendingNote = text;
        showConfirmMenu();
    }
    else if (gCurrentMenu == MENU_FREEZE)
    {
        gPendingNote = text;
        showConfirmMenu();
    }
    return 0;
}

default
{
    state_entry()
    {
        llSetObjectName(CONFIG_BANK_NAME + " Teller");
        llOwnerSay("Teller mock script ready. Touch to begin a staff session.");
    }

    touch_start(integer count)
    {
        key avatar = llDetectedKey(0);
        startSession(avatar);
        if (gActiveStaff == avatar)
        {
            showMainMenu();
        }
    }

    listen(integer channel, string name, key id, string message)
    {
        if (id != gActiveStaff)
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
            else if (gCurrentMenu == MENU_CUSTOMER)
            {
                handleCustomerChoice(message);
            }
            else if (gCurrentMenu == MENU_AMOUNT)
            {
                handleAmountChoice(message);
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
