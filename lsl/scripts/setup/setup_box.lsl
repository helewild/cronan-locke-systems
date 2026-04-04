string CONFIG_PLATFORM_NAME = "Cronan & Locke Systems";
string CONFIG_BANK_NAME = "";
string CONFIG_API_URL = "http://15.204.56.251/api/v1/portal";
string CONFIG_BOOTSTRAP_SECRET = "QbN2GpbUD2mO4M-bIZKAX_rE3cng549x";
string CONFIG_DEFAULT_REGION_NAME = "";
integer CONFIG_PAYROLL_DEFAULT = 250;

key gPendingRequest = NULL_KEY;
key gRequestUser = NULL_KEY;
string gRegisteredTenantId = "";
string gRegisteredActivationCode = "";
string gRegisteredLicenseId = "";
string gRegisteredAdminUrl = "";
string gRegisteredTenantObjectSecret = "";

integer loadCachedRegistration()
{
    string desc = llGetObjectDesc();

    if (llSubStringIndex(desc, "CLSSETUP|") != 0)
    {
        return FALSE;
    }

    list parts = llParseStringKeepNulls(desc, ["|"], []);
    if (llGetListLength(parts) < 6)
    {
        return FALSE;
    }

    gRegisteredTenantId = llList2String(parts, 1);
    gRegisteredActivationCode = llList2String(parts, 2);
    gRegisteredLicenseId = llList2String(parts, 3);
    gRegisteredAdminUrl = llList2String(parts, 4);
    gRegisteredTenantObjectSecret = llList2String(parts, 5);
    return (gRegisteredTenantId != "");
}

integer saveCachedRegistration()
{
    llSetObjectDesc(
        "CLSSETUP|"
        + gRegisteredTenantId + "|"
        + gRegisteredActivationCode + "|"
        + gRegisteredLicenseId + "|"
        + gRegisteredAdminUrl + "|"
        + gRegisteredTenantObjectSecret
    );
    return 0;
}

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
        "setup_secret", CONFIG_BOOTSTRAP_SECRET,
        "tenant_name", buyer,
        "bank_name", bankName,
        "primary_region_name", regionName,
        "payroll_default_amount", CONFIG_PAYROLL_DEFAULT,
        "buyer_avatar_name", buyer,
        "buyer_avatar_key", (string)avatar,
        "setup_box_key", (string)llGetKey(),
        "marketplace_order_id", ""
    ]);
}

integer beginRegistration(key avatar)
{
    if (gRegisteredTenantId != "")
    {
        llRegionSayTo(
            avatar,
            0,
            headerLine() + "\n"
            + "This setup box is already registered.\n"
            + "Tenant ID: " + gRegisteredTenantId + "\n"
            + "Activation Code: " + gRegisteredActivationCode + "\n"
            + "License ID: " + gRegisteredLicenseId + "\n"
            + "Admin URL: " + gRegisteredAdminUrl
        );
        return 0;
    }

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
        loadCachedRegistration();
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
        if (okValue != JSON_TRUE && okValue != "true")
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
        gRegisteredTenantObjectSecret = llJsonGetValue(body, ["tenant_object_secret"]);
        message = llJsonGetValue(body, ["message"]);
        gRegisteredTenantId = tenantId;
        gRegisteredActivationCode = activationCode;
        gRegisteredLicenseId = licenseId;
        gRegisteredAdminUrl = adminUrl;
        saveCachedRegistration();

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
