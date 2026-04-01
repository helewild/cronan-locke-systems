integer MENU_MAIN = 0;
integer MENU_CONFIRM = 1;

integer SESSION_TIMEOUT = 120;
integer DIALOG_CHANNEL_BASE = -950000;

integer CARD_STATE_ACTIVE = 0;
integer CARD_STATE_LOCKED = 1;
integer CARD_STATE_STOLEN = 2;

integer ACTION_NONE = 0;
integer ACTION_LOCK = 1;
integer ACTION_UNLOCK = 2;
integer ACTION_REPORT_STOLEN = 3;

string CONFIG_BANK_NAME = "Whispering Pines Bank";
string CONFIG_TENANT_ID = "demo-tenant";
string CONFIG_REGION_ID = "demo-region";
string CONFIG_BRANCH_ID = "main-branch";
string CONFIG_CARD_ID = "card-001";
string CONFIG_CARD_PREFIX = "5326";

key gCardOwner = NULL_KEY;
integer gCardBound = FALSE;
integer gCardState = CARD_STATE_ACTIVE;
integer gMenuListen = 0;
integer gMenuChannel = 0;
integer gCurrentMenu = MENU_MAIN;
integer gPendingAction = ACTION_NONE;

integer randomPrivateChannel(integer base)
{
    return base - (integer)llFrand(1000000.0);
}

string headerLine()
{
    return "[" + CONFIG_BANK_NAME + " Card]";
}

string scopeLabel()
{
    return CONFIG_TENANT_ID + "/" + CONFIG_REGION_ID + "/" + CONFIG_BRANCH_ID;
}

string ownerName()
{
    string full;

    if (gCardOwner == NULL_KEY)
    {
        return "Unassigned";
    }

    full = llKey2Name(gCardOwner);
    if (full == "")
    {
        return "Unknown Resident";
    }
    return full;
}

string cardStateLabel()
{
    if (gCardState == CARD_STATE_ACTIVE)
    {
        return "ACTIVE";
    }
    if (gCardState == CARD_STATE_LOCKED)
    {
        return "LOCKED";
    }
    if (gCardState == CARD_STATE_STOLEN)
    {
        return "STOLEN";
    }
    return "UNKNOWN";
}

string cardNumber()
{
    string tail;

    if (gCardOwner == NULL_KEY)
    {
        return CONFIG_CARD_PREFIX + "-0000-0000-0000";
    }

    tail = llGetSubString((string)gCardOwner, -11, -1);
    return CONFIG_CARD_PREFIX + "-" + llGetSubString(tail, 0, 3) + "-" + llGetSubString(tail, 4, 7) + "-" + llGetSubString(tail, 8, 10);
}

list mainButtons()
{
    return ["View Card", "Lock Card", "Unlock Card", "Report Stolen", "Status"];
}

list confirmButtons()
{
    return ["Confirm", "Cancel"];
}

integer resetListener()
{
    if (gMenuListen)
    {
        llListenRemove(gMenuListen);
        gMenuListen = 0;
    }
    return 0;
}

integer bindCardToOwner()
{
    gCardOwner = llGetOwner();
    gCardBound = TRUE;
    return 0;
}

integer ensureCardBinding()
{
    if (!gCardBound || gCardOwner != llGetOwner())
    {
        bindCardToOwner();
    }
    return 0;
}

integer endSession(string reason)
{
    if (gCardOwner != NULL_KEY && reason != "")
    {
        llRegionSayTo(gCardOwner, 0, headerLine() + " " + reason);
    }

    resetListener();
    gCurrentMenu = MENU_MAIN;
    gPendingAction = ACTION_NONE;
    llSetTimerEvent(0.0);
    return 0;
}

integer sendBindingNotice()
{
    llRegionSayTo(
        gCardOwner,
        0,
        headerLine() + "\nCard linked to " + ownerName()
        + "\nCard Number: " + cardNumber()
        + "\nState: " + cardStateLabel()
        + "\nScope: " + scopeLabel()
        + "\nStatus: MOCK MODE"
    );
    return 0;
}

integer startSession(key avatar)
{
    ensureCardBinding();

    if (avatar != gCardOwner)
    {
        llRegionSayTo(avatar, 0, headerLine() + " Access denied. This card belongs to " + ownerName() + ".");
        return 0;
    }

    resetListener();
    gMenuChannel = randomPrivateChannel(DIALOG_CHANNEL_BASE);
    gMenuListen = llListen(gMenuChannel, "", avatar, "");
    gCurrentMenu = MENU_MAIN;
    gPendingAction = ACTION_NONE;
    llSetTimerEvent((float)SESSION_TIMEOUT);
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
        gCardOwner,
        CONFIG_BANK_NAME + "\nBank Card\n\n"
        + "Owner: " + ownerName() + "\n"
        + "Card: " + cardNumber() + "\n"
        + "State: " + cardStateLabel() + "\n"
        + "Scope: " + scopeLabel() + "\n\n"
        + "Select an option:",
        mainButtons(),
        MENU_MAIN
    );
    return 0;
}

integer showConfirmMenu()
{
    string actionName = "Action";

    if (gPendingAction == ACTION_LOCK)
    {
        actionName = "Lock Card";
    }
    else if (gPendingAction == ACTION_UNLOCK)
    {
        actionName = "Unlock Card";
    }
    else if (gPendingAction == ACTION_REPORT_STOLEN)
    {
        actionName = "Report Stolen";
    }

    dialog(
        gCardOwner,
        actionName + "\n\n"
        + "Owner: " + ownerName() + "\n"
        + "Card: " + cardNumber() + "\n"
        + "Current State: " + cardStateLabel() + "\n\n"
        + "Confirm this card action?",
        confirmButtons(),
        MENU_CONFIRM
    );
    return 0;
}

integer showCardDetails()
{
    llRegionSayTo(
        gCardOwner,
        0,
        headerLine() + "\nCard Profile\n"
        + "Owner: " + ownerName() + "\n"
        + "Card Number: " + cardNumber() + "\n"
        + "Card ID: " + CONFIG_CARD_ID + "\n"
        + "State: " + cardStateLabel() + "\n"
        + "Scope: " + scopeLabel() + "\n"
        + "Hook Status: ATM/HUD ready later"
    );
    showMainMenu();
    return 0;
}

integer showCardStatus()
{
    string message = headerLine() + "\nCard Status\n"
        + "Owner: " + ownerName() + "\n"
        + "State: " + cardStateLabel() + "\n"
        + "ATM Access: ";

    if (gCardState == CARD_STATE_ACTIVE)
    {
        message = message + "AVAILABLE\n";
    }
    else if (gCardState == CARD_STATE_LOCKED)
    {
        message = message + "BLOCKED\n";
    }
    else
    {
        message = message + "DENIED\n";
    }

    message = message
        + "HUD Hooks: PENDING\n"
        + "Backend Mode: MOCK";

    llRegionSayTo(gCardOwner, 0, message);
    showMainMenu();
    return 0;
}

integer applyPendingAction()
{
    if (gPendingAction == ACTION_LOCK)
    {
        gCardState = CARD_STATE_LOCKED;
    }
    else if (gPendingAction == ACTION_UNLOCK)
    {
        gCardState = CARD_STATE_ACTIVE;
    }
    else if (gPendingAction == ACTION_REPORT_STOLEN)
    {
        gCardState = CARD_STATE_STOLEN;
    }

    llRegionSayTo(
        gCardOwner,
        0,
        headerLine() + "\nAction Complete\n"
        + "Owner: " + ownerName() + "\n"
        + "Card: " + cardNumber() + "\n"
        + "New State: " + cardStateLabel() + "\n"
        + "Audit: MOCK ONLY"
    );

    gPendingAction = ACTION_NONE;
    showMainMenu();
    return 0;
}

integer handleMainChoice(string message)
{
    if (message == "View Card")
    {
        showCardDetails();
    }
    else if (message == "Lock Card")
    {
        gPendingAction = ACTION_LOCK;
        showConfirmMenu();
    }
    else if (message == "Unlock Card")
    {
        gPendingAction = ACTION_UNLOCK;
        showConfirmMenu();
    }
    else if (message == "Report Stolen")
    {
        gPendingAction = ACTION_REPORT_STOLEN;
        showConfirmMenu();
    }
    else if (message == "Status")
    {
        showCardStatus();
    }
    return 0;
}

integer handleConfirmChoice(string message)
{
    if (message == "Confirm")
    {
        applyPendingAction();
    }
    else if (message == "Cancel")
    {
        llRegionSayTo(gCardOwner, 0, headerLine() + " Action canceled.");
        gPendingAction = ACTION_NONE;
        showMainMenu();
    }
    return 0;
}

default
{
    state_entry()
    {
        ensureCardBinding();
        llSetObjectName(CONFIG_BANK_NAME + " Card");
        llOwnerSay("Card mock script ready. Touch to open the card menu.");
        sendBindingNotice();
    }

    touch_start(integer count)
    {
        key avatar = llDetectedKey(0);
        startSession(avatar);
        if (avatar == gCardOwner)
        {
            showMainMenu();
        }
    }

    listen(integer channel, string name, key id, string message)
    {
        if (id != gCardOwner)
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
            else if (gCurrentMenu == MENU_CONFIRM)
            {
                handleConfirmChoice(message);
            }
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
