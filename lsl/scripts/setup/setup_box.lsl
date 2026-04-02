string CONFIG_PLATFORM_NAME = "Cronan & Locke Systems";
string CONFIG_BANK_NAME = "";
string CONFIG_API_URL = "http://15.204.56.251/api/v1/portal";
string CONFIG_SETUP_SECRET = "REPLACE_ME_SETUP_SECRET";
string CONFIG_DEFAULT_REGION_NAME = "";
integer CONFIG_PAYROLL_DEFAULT = 250;

key gPendingRequest = NULL_KEY;
key gRequestUser = NULL_KEY;

string headerLine()
{
    return "[" + CONFIG_PLATFORM_NAME + " Setup Box]";
}

string avatarName(key avatar)
{
    string name = llKey2Name(avatar);
    if (name == "")
    {
        return "Unknown Buyer";
    }
    return name;
}

string jsonPayload(key avatar)
{
    string buyer = avatarName(avatar);
    string bankName = CONFIG_BANK_NAME;
    string regionName = CONFIG_DEFAULT_REGION_NAME;

    if (bankName == "")
    {
        bankName = buyer + " Bank";
    }

    if (regionName == "")
    {
        regionName = buyer + " Region";
    }

    return llList2Json(JSON_OBJECT, [
        "action", "register_tenant_box",
        "setup_secret", CONFIG_SETUP_SECRET,
        "tenant_name", buyer,
        "bank_name", bankName,
        "primary_region_name", regionName,
        "payroll_default_amount", CONFIG_PAYROLL_DEFAULT,
        "buyer_avatar_name", buyer,
        "buyer_avatar_key", (string)avatar,
        "marketplace_order_id", ""
    ]);
}

integer beginRegistration(key avatar)
{
    if (gPendingRequest != NULL_KEY)
    {
        llRegionSayTo(avatar, 0, headerLine() + " Setup request already in progress.");
        return 0;
    }

    gRequestUser = avatar;
    gPendingRequest = llHTTPRequest(
        CONFIG_API_URL,
        [
            HTTP_METHOD, "POST",
            HTTP_MIMETYPE, "application/json"
        ],
        jsonPayload(avatar)
    );

    llRegionSayTo(
        avatar,
        0,
        headerLine() + " Registering your tenant with " + CONFIG_PLATFORM_NAME + "..."
    );
    return 0;
}

integer clearRequest()
{
    gPendingRequest = NULL_KEY;
    gRequestUser = NULL_KEY;
    return 0;
}

default
{
    state_entry()
    {
        llSetObjectName(CONFIG_PLATFORM_NAME + " Setup Box");
        llOwnerSay("Setup box ready. Touch to register a new tenant.");
    }

    touch_start(integer count)
    {
        key avatar = llDetectedKey(0);

        if (avatar != llGetOwner())
        {
            llRegionSayTo(avatar, 0, headerLine() + " Only the object owner can run setup.");
            return;
        }

        beginRegistration(avatar);
    }

    http_response(key request_id, integer status, list metadata, string body)
    {
        string okValue;
        string message;
        string tenantId;
        string activationCode;
        string licenseId;
        string adminUrl;

        if (request_id != gPendingRequest)
        {
            return;
        }

        if (status != 200)
        {
            llRegionSayTo(
                gRequestUser,
                0,
                headerLine() + " Setup failed. HTTP status: " + (string)status
            );
            clearRequest();
            return;
        }

        okValue = llJsonGetValue(body, ["ok"]);
        if (okValue != "true")
        {
            message = llJsonGetValue(body, ["error"]);
            if (message == JSON_INVALID || message == "")
            {
                message = "Unknown registration error.";
            }

            llRegionSayTo(gRequestUser, 0, headerLine() + " Setup failed: " + message);
            clearRequest();
            return;
        }

        tenantId = llJsonGetValue(body, ["tenant_id"]);
        activationCode = llJsonGetValue(body, ["activation_code"]);
        licenseId = llJsonGetValue(body, ["license_id"]);
        adminUrl = llJsonGetValue(body, ["admin_url"]);
        message = llJsonGetValue(body, ["message"]);

        llRegionSayTo(
            gRequestUser,
            0,
            headerLine() + "\n"
            + "Tenant registration complete.\n"
            + "Tenant ID: " + tenantId + "\n"
            + "Activation Code: " + activationCode + "\n"
            + "License ID: " + licenseId + "\n"
            + "Admin URL: " + adminUrl + "\n"
            + "Next Step: Open the admin site and use First-Time Setup."
        );

        if (message != JSON_INVALID && message != "")
        {
            llOwnerSay(message);
        }

        clearRequest();
    }
}
