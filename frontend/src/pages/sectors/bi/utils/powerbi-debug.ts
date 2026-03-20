/**
 * Power BI URL Validation and Debugging Utilities
 */

export interface EmbedUrlValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  metadata: {
    hasReportId: boolean;
    hasGroupId: boolean;
    hasConfig: boolean;
    hasW: boolean;
    protocol: string | null;
    hostname: string | null;
  };
}

export function validateEmbedUrl(url: string): EmbedUrlValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const metadata = {
    hasReportId: false,
    hasGroupId: false,
    hasConfig: false,
    hasW: false,
    protocol: null as string | null,
    hostname: null as string | null,
  };

  // Check if URL is a string
  if (typeof url !== "string") {
    errors.push("embedUrl is not a string");
    return { isValid: false, errors, warnings, metadata };
  }

  // Check if URL is empty
  if (!url || url.trim().length === 0) {
    errors.push("embedUrl is empty");
    return { isValid: false, errors, warnings, metadata };
  }

  // Check protocol
  if (!url.startsWith("https://") && !url.startsWith("http://")) {
    errors.push(
      `Invalid protocol. URL must start with https:// (got: ${url.substring(0, 20)})`,
    );
  } else {
    const match = url.match(/^(https?):\/\/([^/]+)/);
    if (match) {
      metadata.protocol = match[1];
      metadata.hostname = match[2];
    }
  }

  // Check hostname
  if (!url.includes("app.powerbi.com")) {
    errors.push("embedUrl hostname must be app.powerbi.com");
  }

  // Check for required parameters
  if (url.includes("reportId=")) {
    metadata.hasReportId = true;
  } else {
    errors.push("embedUrl missing reportId parameter");
  }

  if (url.includes("groupId=")) {
    metadata.hasGroupId = true;
  } else {
    warnings.push("embedUrl missing groupId parameter (may be required)");
  }

  if (url.includes("config=")) {
    metadata.hasConfig = true;
  } else {
    warnings.push("embedUrl missing config parameter");
  }

  if (url.includes("w=")) {
    metadata.hasW = true;
  } else {
    warnings.push("embedUrl missing w parameter");
  }

  const isValid = errors.length === 0;

  return {
    isValid,
    errors,
    warnings,
    metadata,
  };
}

export function logEmbedUrlDiagnostics(
  url: string,
  prefix: string = "[PowerBI Debug]",
): void {
  const validation = validateEmbedUrl(url);

  console.group(`${prefix} Embed URL Validation`);
  console.log("URL:", url.substring(0, 150) + (url.length > 150 ? "..." : ""));
  console.log("Valid:", validation.isValid);
  console.log("Metadata:", validation.metadata);

  if (validation.errors.length > 0) {
    console.error("Errors:", validation.errors);
  }
  if (validation.warnings.length > 0) {
    console.warn("Warnings:", validation.warnings);
  }

  console.groupEnd();
}

export function extractReportIdFromUrl(url: string): string | null {
  const match = url.match(/reportId=([a-f0-9-]+)/i);
  return match ? match[1] : null;
}

export function extractGroupIdFromUrl(url: string): string | null {
  const match = url.match(/groupId=([a-f0-9-]+)/i);
  return match ? match[1] : null;
}
