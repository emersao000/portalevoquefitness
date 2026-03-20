import { PublicClientApplication, LogLevel } from "@azure/msal-browser";

const clientId = import.meta.env.VITE_MSAL_CLIENT_ID;
const tenantId = import.meta.env.VITE_MSAL_TENANT_ID;
const redirectUri = import.meta.env.VITE_MSAL_REDIRECT_URI;

if (!clientId || !tenantId || !redirectUri) {
  console.error(
    "MSAL configuration is missing. Check your environment variables:",
  );
  console.error("VITE_MSAL_CLIENT_ID:", clientId ? "✓" : "✗ MISSING");
  console.error("VITE_MSAL_TENANT_ID:", tenantId ? "✓" : "✗ MISSING");
  console.error("VITE_MSAL_REDIRECT_URI:", redirectUri ? "✓" : "✗ MISSING");
}

const msalConfig = {
  auth: {
    clientId: clientId || "",
    authority: `https://login.microsoftonline.com/${tenantId || ""}`,
    redirectUri: redirectUri || window.location.origin,
  },
  cache: {
    cacheLocation: "sessionStorage",
    storeAuthStateInCookie: true,
  },
  system: {
    loggerOptions: {
      loggerCallback: (level: LogLevel, message: string) => {
        if (level === LogLevel.Error) {
          console.error(message);
        }
      },
    },
  },
};

export const msalInstance = new PublicClientApplication(msalConfig);

export const scopes = ["openid", "profile", "email"];
