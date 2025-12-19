import { storage } from "./storage";
import { XMLParser } from "fast-xml-parser";

// DigitalDelve SSO API URL (Western Verify's screening platform)
const DIGITAL_DELVE_SSO_URL = "https://secure.westernverify.com/listeners/sso.cfm";

// Default InvitationId for full integration AppScreen requests
const DEFAULT_INVITATION_ID = "C6BC580D-5E1A-4F51-A93B-927F5CFD5F9E";

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  parseTagValue: true,
  trimValues: true,
  processEntities: false,
});

function getBaseUrl(): string {
  return DIGITAL_DELVE_SSO_URL;
}

function getCredentials() {
  const username = process.env.DIGITAL_DELVE_USERNAME;
  const password = process.env.DIGITAL_DELVE_PASSWORD;
  
  if (!username || !password) {
    throw new Error("DigitalDelve credentials not configured");
  }
  
  return { username, password };
}

function escapeXml(str: string | undefined | null): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function getXmlValue(obj: any, ...keys: string[]): string | undefined {
  for (const key of keys) {
    if (obj && typeof obj[key] !== 'undefined') {
      return String(obj[key]);
    }
  }
  return undefined;
}

export interface ScreeningCredentials {
  username: string;
  password: string;
  invitationId?: string;
}

interface AppScreenRequest {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  ssn?: string;
  dob?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  referenceNumber: string;
  invitationId?: string;
  statusPostUrl: string;
  resultPostUrl: string;
  credentials?: ScreeningCredentials;
}

interface DigitalDelveResponse {
  success: boolean;
  message?: string;
  error?: string;
  reportId?: string;
  rawXml?: string;
}

async function sendXmlRequest(xml: string): Promise<{ body: string; statusCode: number }> {
  const url = getBaseUrl();
  console.log("[DigitalDelve] Sending request to:", url);
  console.log("[DigitalDelve] Request XML:", xml.substring(0, 500));
  
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/xml",
    },
    body: xml,
  });

  const body = await response.text();
  console.log("[DigitalDelve] Response status:", response.status);
  console.log("[DigitalDelve] Response body:", body.substring(0, 500));
  return { body, statusCode: response.status };
}

function parseXmlResponse(xml: string): DigitalDelveResponse {
  try {
    const parsed = xmlParser.parse(xml);
    // DigitalDelve SSO API uses <SSO> wrapper for responses
    const root = parsed.SSO || parsed.OrderXML || parsed.ResponseXML || parsed.Response || parsed;
    
    const status = getXmlValue(root, 'Status', 'status');
    const statusMessage = getXmlValue(root, 'StatusMessage', 'statusMessage');
    const message = getXmlValue(root, 'Message', 'message');
    const reportId = getXmlValue(root, 'ReportId', 'ReportID', 'reportId');
    const reportUrl = getXmlValue(root, 'ReportURL', 'reportUrl');
    
    // Handle Errors element which can contain multiple Error elements
    let errorMessage: string | undefined;
    if (root.Errors) {
      const errors = root.Errors.Error;
      if (Array.isArray(errors)) {
        errorMessage = errors.join('; ');
      } else if (errors) {
        errorMessage = String(errors);
      }
    }
    errorMessage = errorMessage || getXmlValue(root, 'ErrorMessage', 'errorMessage', 'Error', 'error');

    console.log("[DigitalDelve] Parsed response - Status:", status, "StatusMessage:", statusMessage, "Message:", message);

    if (status?.toLowerCase() === 'success') {
      return {
        success: true,
        message: statusMessage || message || "Success",
        reportId,
        rawXml: xml,
      };
    }

    // Include the actual error message from the API
    const errorMsg = errorMessage || statusMessage || message || "Unknown error from screening service";
    return {
      success: false,
      error: errorMsg,
      rawXml: xml,
    };
  } catch (parseError) {
    console.error("Failed to parse XML response:", parseError);
    console.error("Raw XML snippet:", xml.substring(0, 500));
    return { 
      success: false, 
      error: "Failed to parse response from screening service", 
      rawXml: xml 
    };
  }
}

export async function verifyCredentials(): Promise<DigitalDelveResponse> {
  const { username, password } = getCredentials();
  return verifyCredentialsWithParams(username, password);
}

export async function verifyCredentialsWithParams(username: string, password: string): Promise<DigitalDelveResponse> {
  // SSO format per API documentation - AuthOnly function
  const xml = `<?xml version="1.0"?>
<SSO>
  <Authentication>
    <UserName>${escapeXml(username)}</UserName>
    <Password>${escapeXml(password)}</Password>
  </Authentication>
  <Function>AuthOnly</Function>
</SSO>`;

  try {
    const { body } = await sendXmlRequest(xml);
    return parseXmlResponse(body);
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Failed to verify credentials",
    };
  }
}

export async function retrieveInvitations(credentials?: { username: string; password: string }): Promise<{ success: boolean; invitations?: any[]; error?: string }> {
  let username: string;
  let password: string;
  
  if (credentials) {
    username = credentials.username;
    password = credentials.password;
  } else {
    const systemCreds = getCredentials();
    username = systemCreds.username;
    password = systemCreds.password;
  }

  // Use SSO format per DigitalDelve API documentation
  const xml = `<?xml version="1.0"?>
<SSO>
  <Authentication>
    <UserName>${escapeXml(username)}</UserName>
    <Password>${escapeXml(password)}</Password>
  </Authentication>
  <Function>RetrieveInvitations</Function>
</SSO>`;

  try {
    const { body } = await sendXmlRequest(xml);
    const result = parseXmlResponse(body);
    
    if (!result.success) {
      return { success: false, error: result.error };
    }

    const invitations: any[] = [];
    const invitationRegex = /<Invitation>([\s\S]*?)<\/Invitation>/gi;
    let invMatch;
    
    while ((invMatch = invitationRegex.exec(body)) !== null) {
      const invXml = invMatch[1];
      // Match element names per API docs: InvitationId, InvitationName, IncludedPackage
      const idMatch = invXml.match(/<InvitationId>([^<]*)<\/InvitationId>/i) || invXml.match(/<ID>([^<]*)<\/ID>/i);
      const nameMatch = invXml.match(/<InvitationName>([^<]*)<\/InvitationName>/i) || invXml.match(/<Name>([^<]*)<\/Name>/i);
      const packageMatch = invXml.match(/<IncludedPackage>([^<]*)<\/IncludedPackage>/i) || invXml.match(/<Description>([^<]*)<\/Description>/i);
      
      invitations.push({
        id: idMatch?.[1] || "",
        name: nameMatch?.[1] || "",
        description: packageMatch?.[1] || "",
      });
    }

    return { success: true, invitations };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Failed to retrieve invitations",
    };
  }
}

export async function sendAppScreenRequest(data: AppScreenRequest): Promise<DigitalDelveResponse> {
  // Use per-landlord credentials if provided, otherwise fall back to system credentials
  let username: string;
  let password: string;
  
  if (data.credentials) {
    username = data.credentials.username;
    password = data.credentials.password;
  } else {
    const systemCreds = getCredentials();
    username = systemCreds.username;
    password = systemCreds.password;
  }

  // Use the provided invitationId, per-landlord default, or system default
  const invitationId = data.invitationId || data.credentials?.invitationId || DEFAULT_INVITATION_ID;

  // Full Integration AppScreen request per SSO API documentation
  // Sends an invitation email to the applicant who completes their info on Western Verify's portal
  const xml = `<?xml version="1.0"?>
<SSO>
  <Authentication>
    <UserName>${escapeXml(username)}</UserName>
    <Password>${escapeXml(password)}</Password>
  </Authentication>
  <Function>AppScreen</Function>
  <ResultPostURL>${escapeXml(data.resultPostUrl)}</ResultPostURL>
  <StatusPostURL>${escapeXml(data.statusPostUrl)}</StatusPostURL>
  <InvitationId>${escapeXml(invitationId)}</InvitationId>
  <Applicant>
    <ReferenceNumber>${escapeXml(data.referenceNumber)}</ReferenceNumber>
    <FirstName>${escapeXml(data.firstName)}</FirstName>
    <LastName>${escapeXml(data.lastName)}</LastName>
    <EmailAddress>${escapeXml(data.email)}</EmailAddress>
  </Applicant>
</SSO>`;

  try {
    const { body } = await sendXmlRequest(xml);
    return parseXmlResponse(body);
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Failed to send screening request",
    };
  }
}

export async function getViewReportSsoUrl(reportId: string): Promise<{ success: boolean; url?: string; error?: string }> {
  const { username, password } = getCredentials();

  // SSO format per API documentation
  const xml = `<?xml version="1.0"?>
<SSO>
  <Authentication>
    <UserName>${escapeXml(username)}</UserName>
    <Password>${escapeXml(password)}</Password>
  </Authentication>
  <Function>ViewReport</Function>
  <ReportId>${escapeXml(reportId)}</ReportId>
</SSO>`;

  try {
    const { body, statusCode } = await sendXmlRequest(xml);
    
    if (statusCode === 302 || statusCode === 200) {
      const locationMatch = body.match(/<RedirectURL>([^<]*)<\/RedirectURL>/i);
      if (locationMatch) {
        return { success: true, url: locationMatch[1] };
      }
    }
    
    return { success: true, url: getBaseUrl() + "?action=ViewReport&reportId=" + reportId };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Failed to get report URL",
    };
  }
}

export async function getViewReportByRefSsoUrl(
  referenceNumber: string,
  credentials?: ScreeningCredentials
): Promise<{ success: boolean; url?: string; error?: string }> {
  let username: string;
  let password: string;
  
  if (credentials && credentials.username && credentials.password) {
    username = credentials.username;
    password = credentials.password;
  } else {
    const systemCreds = getCredentials();
    username = systemCreds.username;
    password = systemCreds.password;
  }

  // SSO format per API documentation - use ReportId element for reference number lookup
  const xml = `<?xml version="1.0"?>
<SSO>
  <Authentication>
    <UserName>${escapeXml(username)}</UserName>
    <Password>${escapeXml(password)}</Password>
  </Authentication>
  <Function>ViewReportByClientRef</Function>
  <ReportId>${escapeXml(referenceNumber)}</ReportId>
</SSO>`;

  try {
    const { body, statusCode } = await sendXmlRequest(xml);
    
    if (statusCode === 302 || statusCode === 200) {
      const locationMatch = body.match(/<RedirectURL>([^<]*)<\/RedirectURL>/i);
      if (locationMatch) {
        return { success: true, url: locationMatch[1] };
      }
    }
    
    return { success: true, url: getBaseUrl() + "?action=ViewReportByClientRef&ref=" + referenceNumber };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Failed to get report URL",
    };
  }
}

export interface OrderStatusResult {
  success: boolean;
  status?: 'complete' | 'in_progress' | 'invited' | 'not_found' | 'error';
  reportId?: string;
  reportUrl?: string;
  rawXml?: string;
  error?: string;
}

export async function checkOrderStatus(
  referenceNumber: string, 
  credentials?: ScreeningCredentials
): Promise<OrderStatusResult> {
  let username: string;
  let password: string;
  
  if (credentials && credentials.username && credentials.password) {
    username = credentials.username;
    password = credentials.password;
  } else {
    const systemCreds = getCredentials();
    username = systemCreds.username;
    password = systemCreds.password;
  }
  
  if (!username || !password) {
    return {
      success: false,
      error: "Screening credentials not configured",
    };
  }

  const xml = `<?xml version="1.0"?>
<SSO>
  <Authentication>
    <UserName>${escapeXml(username)}</UserName>
    <Password>${escapeXml(password)}</Password>
  </Authentication>
  <Function>RetrieveOrderStatus</Function>
  <Applicant>
    <ReferenceNumber>${escapeXml(referenceNumber)}</ReferenceNumber>
  </Applicant>
</SSO>`;

  try {
    const { body } = await sendXmlRequest(xml);
    console.log("[DigitalDelve] CheckOrderStatus response:", body.substring(0, 500));
    
    const parsed = xmlParser.parse(body);
    const root = parsed?.SSO || parsed?.Response || parsed;
    
    const errorMatch = body.match(/<Error>([^<]*)<\/Error>/i);
    if (errorMatch) {
      const errorMsg = errorMatch[1].toLowerCase();
      if (errorMsg.includes('not found') || errorMsg.includes('no order')) {
        return { success: true, status: 'not_found', rawXml: body };
      }
      return { success: false, error: errorMatch[1], rawXml: body };
    }
    
    let statusStr = getXmlValue(root, 'Status', 'status', 'OrderStatus');
    if (!statusStr && root?.Applicant) {
      statusStr = getXmlValue(root.Applicant, 'Status', 'status');
    }
    
    const reportId = getXmlValue(root, 'ReportId', 'ReportID', 'reportId');
    let reportUrl = getXmlValue(root, 'ReportURL', 'reportUrl', 'ReportUrl', 'ReportLink');
    
    let normalizedStatus: OrderStatusResult['status'] = 'in_progress';
    if (statusStr) {
      const lower = statusStr.toLowerCase().replace(/\s+/g, '_');
      if (lower.includes('complete') || lower.includes('finished') || lower.includes('ready')) {
        normalizedStatus = 'complete';
      } else if (lower.includes('in_progress') || lower.includes('pending') || lower.includes('processing')) {
        normalizedStatus = 'in_progress';
      } else if (lower.includes('invited') || lower.includes('sent')) {
        normalizedStatus = 'invited';
      }
    }
    
    if (reportId || reportUrl) {
      normalizedStatus = 'complete';
    }
    
    return {
      success: true,
      status: normalizedStatus,
      reportId,
      reportUrl,
      rawXml: body,
    };
  } catch (error: any) {
    console.error("[DigitalDelve] CheckOrderStatus error:", error);
    return {
      success: false,
      error: error.message || "Failed to check order status",
    };
  }
}

export interface WebhookStatusData {
  referenceNumber: string;
  status: string;
  reportId?: string;
  reportUrl?: string;
  rawXml: string;
}

function findInParsedXml(obj: any, ...possibleRoots: string[]): any {
  for (const root of possibleRoots) {
    if (obj && obj[root]) return obj[root];
  }
  return obj;
}

export function parseStatusWebhook(xml: string): WebhookStatusData | null {
  try {
    const parsed = xmlParser.parse(xml);
    // SSO API uses <SSO> wrapper for status updates per documentation
    const root = findInParsedXml(parsed, 'SSO', 'OrderXML', 'StatusUpdate', 'Response', 'Webhook', 'ResponseXML');
    
    console.log("[DigitalDelve] Status webhook parsed root keys:", root ? Object.keys(root) : 'null');
    
    // Per SSO docs, reference is in Applicant.ReferenceNumber
    let referenceNumber = getXmlValue(root, 'ReferenceNumber', 'referenceNumber', 'ClientRef', 'clientRef');
    if (!referenceNumber && root?.Applicant) {
      referenceNumber = getXmlValue(root.Applicant, 'ReferenceNumber', 'referenceNumber');
    }
    if (!referenceNumber && root?.Order) {
      referenceNumber = getXmlValue(root.Order, 'BillingReferenceCode', 'ClientRef');
    }
    
    // Status is directly in root per SSO docs (e.g., "In Progress")
    const status = getXmlValue(root, 'Status', 'status');
    const reportId = getXmlValue(root, 'ReportId', 'ReportID', 'reportId');
    
    // Get report URL from ReportURL element
    let reportUrl = getXmlValue(root, 'ReportURL', 'reportUrl', 'ReportUrl', 'ReportLink');
    if (!reportUrl && root?.Order) {
      reportUrl = getXmlValue(root.Order, 'ReportLink');
    }

    if (!referenceNumber || !status) {
      console.error("Missing required fields in status webhook. Reference:", referenceNumber, "Status:", status);
      console.error("Raw XML snippet:", xml.substring(0, 500));
      return null;
    }

    return {
      referenceNumber,
      status: status.toLowerCase().replace(/\s+/g, '_'), // "In Progress" -> "in_progress"
      reportId,
      reportUrl,
      rawXml: xml,
    };
  } catch (error) {
    console.error("Error parsing status webhook:", error);
    console.error("Raw XML snippet:", xml.substring(0, 500));
    return null;
  }
}

export function parseResultWebhook(xml: string): WebhookStatusData | null {
  try {
    const parsed = xmlParser.parse(xml);
    // SSO API uses <SSO> wrapper for result updates per documentation
    const root = findInParsedXml(parsed, 'SSO', 'OrderXML', 'ResultUpdate', 'Response', 'Webhook', 'ResponseXML');
    
    console.log("[DigitalDelve] Result webhook parsed root keys:", root ? Object.keys(root) : 'null');
    
    // Per SSO docs, reference is in Applicant.ReferenceNumber
    let referenceNumber = getXmlValue(root, 'ReferenceNumber', 'referenceNumber', 'ClientRef', 'clientRef');
    if (!referenceNumber && root?.Applicant) {
      referenceNumber = getXmlValue(root.Applicant, 'ReferenceNumber', 'referenceNumber');
    }
    if (!referenceNumber && root?.Order) {
      referenceNumber = getXmlValue(root.Order, 'BillingReferenceCode', 'ClientRef');
    }
    
    // Status is "Complete" per SSO docs, also get Recommendation if available
    const status = getXmlValue(root, 'Status', 'status') || 'complete';
    const reportId = getXmlValue(root, 'ReportId', 'ReportID', 'reportId');
    
    // Per SSO docs, ReportURL contains the full report URL
    let reportUrl = getXmlValue(root, 'ReportURL', 'reportUrl', 'ReportUrl', 'ReportLink');
    if (!reportUrl && root?.Order) {
      reportUrl = getXmlValue(root.Order, 'ReportLink');
    }

    if (!referenceNumber) {
      console.error("Missing reference number in result webhook");
      console.error("Raw XML snippet:", xml.substring(0, 500));
      return null;
    }

    return {
      referenceNumber,
      status: status.toLowerCase(),
      reportId,
      reportUrl,
      rawXml: xml,
    };
  } catch (error) {
    console.error("Error parsing result webhook:", error);
    console.error("Raw XML snippet:", xml.substring(0, 500));
    return null;
  }
}

export async function processScreeningRequest(
  submissionId: string,
  applicantData: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    ssn?: string;
    dob?: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
  },
  baseUrl: string,
  invitationId?: string,
  credentials?: ScreeningCredentials,
  personId?: string
): Promise<{ success: boolean; order?: any; error?: string }> {
  const referenceNumber = `LS-${submissionId.slice(0, 8)}-${Date.now()}`;
  
  const webhookSecret = process.env.DIGITAL_DELVE_WEBHOOK_SECRET || "";
  const tokenParam = webhookSecret ? `?token=${encodeURIComponent(webhookSecret)}` : "";
  
  const statusPostUrl = `${baseUrl}/api/webhooks/digitaldelve/status${tokenParam}`;
  const resultPostUrl = `${baseUrl}/api/webhooks/digitaldelve/result${tokenParam}`;

  // Initialize polling fields - poll for 48 hours, first check in 2 minutes
  const now = new Date();
  const nextStatusCheckAt = new Date(now.getTime() + 2 * 60 * 1000); // 2 minutes
  const pollUntil = new Date(now.getTime() + 48 * 60 * 60 * 1000); // 48 hours
  
  const order = await storage.createRentalScreeningOrder({
    submissionId,
    personId: personId || null,
    referenceNumber,
    invitationId: invitationId || credentials?.invitationId || null,
    status: "not_sent",
    reportId: null,
    reportUrl: null,
    rawStatusXml: null,
    rawResultXml: null,
    errorMessage: null,
    lastStatusCheckAt: null,
    nextStatusCheckAt,
    pollUntil,
    consecutiveFailures: 0,
  });

  const result = await sendAppScreenRequest({
    ...applicantData,
    referenceNumber,
    invitationId: invitationId || credentials?.invitationId,
    statusPostUrl,
    resultPostUrl,
    credentials,
  });

  if (result.success) {
    const updatedOrder = await storage.updateRentalScreeningOrder(order.id, {
      status: "sent",
    });
    
    return { success: true, order: updatedOrder || order };
  } else {
    await storage.updateRentalScreeningOrder(order.id, {
      status: "error",
      errorMessage: result.error,
    });
    
    return { success: false, error: result.error };
  }
}

export async function handleStatusWebhook(xml: string): Promise<{ success: boolean; submissionId?: string }> {
  const data = parseStatusWebhook(xml);
  if (!data) {
    console.error("Failed to parse status webhook:", xml);
    return { success: false };
  }

  try {
    const order = await storage.getRentalScreeningOrderByReference(data.referenceNumber);

    if (!order) {
      console.error("Screening order not found for reference:", data.referenceNumber);
      return { success: false };
    }
    
    await storage.updateRentalScreeningOrder(order.id, {
      status: data.status === "in progress" ? "in_progress" : data.status as any,
      reportId: data.reportId || order.reportId,
      reportUrl: data.reportUrl || order.reportUrl,
      rawStatusXml: data.rawXml,
    });

    return { success: true, submissionId: order.submissionId };
  } catch (error) {
    console.error("Error processing status webhook:", error);
    return { success: false };
  }
}

export async function handleResultWebhook(xml: string): Promise<{ success: boolean; submissionId?: string }> {
  const data = parseResultWebhook(xml);
  if (!data) {
    console.error("Failed to parse result webhook:", xml);
    return { success: false };
  }

  try {
    const order = await storage.getRentalScreeningOrderByReference(data.referenceNumber);

    if (!order) {
      console.error("Screening order not found for reference:", data.referenceNumber);
      return { success: false };
    }
    
    await storage.updateRentalScreeningOrder(order.id, {
      status: "complete",
      reportId: data.reportId || order.reportId,
      reportUrl: data.reportUrl || order.reportUrl,
      rawResultXml: data.rawXml,
    });

    return { success: true, submissionId: order.submissionId };
  } catch (error) {
    console.error("Error processing result webhook:", error);
    return { success: false };
  }
}
