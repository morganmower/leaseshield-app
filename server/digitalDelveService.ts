import { storage } from "./storage";
import { XMLParser } from "fast-xml-parser";

// Western Verify / DigitalDelve API URL
const WESTERN_VERIFY_API_URL = "https://secure.westernverify.com/webservice/default.cfm";

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  parseTagValue: true,
  trimValues: true,
  processEntities: false,
});

function getBaseUrl(): string {
  return WESTERN_VERIFY_API_URL;
}

function getCredentials() {
  const username = process.env.DIGITAL_DELVE_USERNAME;
  const password = process.env.DIGITAL_DELVE_PASSWORD;
  
  if (!username || !password) {
    throw new Error("DigitalDelve credentials not configured");
  }
  
  return { username, password };
}

function escapeXml(str: string): string {
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
    // Western Verify uses OrderXML for responses
    const root = parsed.OrderXML || parsed.ResponseXML || parsed.Response || parsed;
    
    const status = getXmlValue(root, 'Status', 'status');
    const message = getXmlValue(root, 'Message', 'message');
    const errorMessage = getXmlValue(root, 'ErrorMessage', 'errorMessage', 'Error', 'error');
    const reportId = getXmlValue(root, 'ReportID', 'reportId', 'ReportId');

    console.log("[DigitalDelve] Parsed response - Status:", status, "Message:", message);

    if (status?.toLowerCase() === 'success') {
      return {
        success: true,
        message: message || "Success",
        reportId,
        rawXml: xml,
      };
    }

    // Include the actual error message from the API
    const errorMsg = errorMessage || message || "Unknown error from screening service";
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

  const xml = `<?xml version="1.0"?>
<RequestXML>
  <Authentication>
    <Username>${escapeXml(username)}</Username>
    <Password>${escapeXml(password)}</Password>
  </Authentication>
  <Function>AuthOnly</Function>
</RequestXML>`;

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

export async function retrieveInvitations(): Promise<{ success: boolean; invitations?: any[]; error?: string }> {
  const { username, password } = getCredentials();

  const xml = `<?xml version="1.0"?>
<RequestXML>
  <Authentication>
    <Username>${escapeXml(username)}</Username>
    <Password>${escapeXml(password)}</Password>
  </Authentication>
  <Function>RetrieveInvitations</Function>
</RequestXML>`;

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
      const idMatch = invXml.match(/<ID>([^<]*)<\/ID>/i);
      const nameMatch = invXml.match(/<Name>([^<]*)<\/Name>/i);
      const descMatch = invXml.match(/<Description>([^<]*)<\/Description>/i);
      
      invitations.push({
        id: idMatch?.[1] || "",
        name: nameMatch?.[1] || "",
        description: descMatch?.[1] || "",
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
  const { username, password } = getCredentials();

  const xml = `<?xml version="1.0"?>
<RequestXML>
  <Authentication>
    <Username>${escapeXml(username)}</Username>
    <Password>${escapeXml(password)}</Password>
  </Authentication>
  <Function>AppScreen</Function>
  <AppScreen>
    ${data.invitationId ? `<InvitationID>${escapeXml(data.invitationId)}</InvitationID>` : ''}
    <ClientRef>${escapeXml(data.referenceNumber)}</ClientRef>
    <StatusPostUrl>${escapeXml(data.statusPostUrl)}</StatusPostUrl>
    <ResultPostUrl>${escapeXml(data.resultPostUrl)}</ResultPostUrl>
    <Candidate>
      <FirstName>${escapeXml(data.firstName)}</FirstName>
      <LastName>${escapeXml(data.lastName)}</LastName>
      <Email>${escapeXml(data.email)}</Email>
      ${data.phone ? `<Phone>${escapeXml(data.phone)}</Phone>` : ''}
      ${data.ssn ? `<SSN>${escapeXml(data.ssn)}</SSN>` : ''}
      ${data.dob ? `<DOB>${escapeXml(data.dob)}</DOB>` : ''}
      ${data.address ? `<Address>${escapeXml(data.address)}</Address>` : ''}
      ${data.city ? `<City>${escapeXml(data.city)}</City>` : ''}
      ${data.state ? `<State>${escapeXml(data.state)}</State>` : ''}
      ${data.zip ? `<Zip>${escapeXml(data.zip)}</Zip>` : ''}
    </Candidate>
  </AppScreen>
</RequestXML>`;

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

  const xml = `<?xml version="1.0"?>
<RequestXML>
  <Authentication>
    <Username>${escapeXml(username)}</Username>
    <Password>${escapeXml(password)}</Password>
  </Authentication>
  <Function>ViewReport</Function>
  <ReportID>${escapeXml(reportId)}</ReportID>
</RequestXML>`;

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

export async function getViewReportByRefSsoUrl(referenceNumber: string): Promise<{ success: boolean; url?: string; error?: string }> {
  const { username, password } = getCredentials();

  const xml = `<?xml version="1.0"?>
<RequestXML>
  <Authentication>
    <Username>${escapeXml(username)}</Username>
    <Password>${escapeXml(password)}</Password>
  </Authentication>
  <Function>ViewReportByClientRef</Function>
  <ReportID>${escapeXml(referenceNumber)}</ReportID>
</RequestXML>`;

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
    // Western Verify uses OrderXML with Method field to indicate webhook type
    const root = findInParsedXml(parsed, 'OrderXML', 'StatusUpdate', 'Response', 'Webhook', 'ResponseXML');
    
    console.log("[DigitalDelve] Status webhook parsed root keys:", root ? Object.keys(root) : 'null');
    
    // Get reference from Order.BillingReferenceCode or direct ClientRef
    let referenceNumber = getXmlValue(root, 'ClientRef', 'clientRef', 'ReferenceNumber', 'referenceNumber');
    if (!referenceNumber && root?.Order) {
      referenceNumber = getXmlValue(root.Order, 'BillingReferenceCode', 'ClientRef');
    }
    
    const status = getXmlValue(root, 'Status', 'status');
    const reportId = getXmlValue(root, 'ReportID', 'reportId', 'ReportId');
    
    // Get report URL from Order.ReportLink or direct field
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
      status: status.toLowerCase(),
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
    // Western Verify uses OrderXML with Method "PUSH RESULTS" for results
    const root = findInParsedXml(parsed, 'OrderXML', 'ResultUpdate', 'Response', 'Webhook', 'ResponseXML');
    
    console.log("[DigitalDelve] Result webhook parsed root keys:", root ? Object.keys(root) : 'null');
    const method = getXmlValue(root, 'Method');
    console.log("[DigitalDelve] Webhook method:", method);
    
    // Get reference from Order.BillingReferenceCode or direct ClientRef
    let referenceNumber = getXmlValue(root, 'ClientRef', 'clientRef', 'ReferenceNumber', 'referenceNumber');
    if (!referenceNumber && root?.Order) {
      referenceNumber = getXmlValue(root.Order, 'BillingReferenceCode', 'ClientRef');
    }
    
    const status = getXmlValue(root, 'Status', 'status') || 'complete';
    const reportId = getXmlValue(root, 'ReportID', 'reportId', 'ReportId');
    
    // Get report URL from Order.ReportLink or direct field
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
  invitationId?: string
): Promise<{ success: boolean; order?: any; error?: string }> {
  const referenceNumber = `LS-${submissionId.slice(0, 8)}-${Date.now()}`;
  
  const webhookSecret = process.env.DIGITAL_DELVE_WEBHOOK_SECRET || "";
  const tokenParam = webhookSecret ? `?token=${encodeURIComponent(webhookSecret)}` : "";
  
  const statusPostUrl = `${baseUrl}/api/webhooks/digitaldelve/status${tokenParam}`;
  const resultPostUrl = `${baseUrl}/api/webhooks/digitaldelve/result${tokenParam}`;

  const order = await storage.createRentalScreeningOrder({
    submissionId,
    referenceNumber,
    invitationId: invitationId || null,
    status: "not_sent",
    reportId: null,
    reportUrl: null,
    rawStatusXml: null,
    rawResultXml: null,
    errorMessage: null,
  });

  const result = await sendAppScreenRequest({
    ...applicantData,
    referenceNumber,
    invitationId,
    statusPostUrl,
    resultPostUrl,
  });

  if (result.success) {
    await storage.updateRentalScreeningOrder(order.id, {
      status: "sent",
    });
    
    return { success: true, order };
  } else {
    await storage.updateRentalScreeningOrder(order.id, {
      status: "error",
      errorMessage: result.error,
    });
    
    return { success: false, error: result.error };
  }
}

export async function handleStatusWebhook(xml: string): Promise<boolean> {
  const data = parseStatusWebhook(xml);
  if (!data) {
    console.error("Failed to parse status webhook:", xml);
    return false;
  }

  try {
    const order = await storage.getRentalScreeningOrderByReference(data.referenceNumber);

    if (!order) {
      console.error("Screening order not found for reference:", data.referenceNumber);
      return false;
    }
    
    await storage.updateRentalScreeningOrder(order.id, {
      status: data.status === "in progress" ? "in_progress" : data.status as any,
      reportId: data.reportId || order.reportId,
      reportUrl: data.reportUrl || order.reportUrl,
      rawStatusXml: data.rawXml,
    });

    return true;
  } catch (error) {
    console.error("Error processing status webhook:", error);
    return false;
  }
}

export async function handleResultWebhook(xml: string): Promise<boolean> {
  const data = parseResultWebhook(xml);
  if (!data) {
    console.error("Failed to parse result webhook:", xml);
    return false;
  }

  try {
    const order = await storage.getRentalScreeningOrderByReference(data.referenceNumber);

    if (!order) {
      console.error("Screening order not found for reference:", data.referenceNumber);
      return false;
    }
    
    await storage.updateRentalScreeningOrder(order.id, {
      status: "complete",
      reportId: data.reportId || order.reportId,
      reportUrl: data.reportUrl || order.reportUrl,
      rawResultXml: data.rawXml,
    });

    return true;
  } catch (error) {
    console.error("Error processing result webhook:", error);
    return false;
  }
}
