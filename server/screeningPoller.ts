// DEPRECATED: Polling has been disabled.
// 
// Western Verify does NOT have a RetrieveOrderStatus API function.
// The available functions per their SSO documentation are:
// - AppScreen (send screening invitation)
// - AuthOnly (verify credentials)
// - RetrieveInvitations (get invitation types)
// - ViewReport, ViewReportByClientRef (SSO redirect to view reports)
// - Dashboard, PendingReports, CompletedReports, etc. (SSO redirects)
//
// Status updates are PUSHED to us via webhooks:
// - StatusPostURL receives "In Progress" updates
// - ResultPostURL receives "Complete" notifications with ReportId and ReportURL
//
// See: /api/webhooks/digitaldelve/status and /api/webhooks/digitaldelve/result

export function startScreeningPoller(): void {
  // Polling disabled - Western Verify pushes status via webhooks
  console.log("[Poller] Screening polling disabled - using webhook-based status updates");
}

export function stopScreeningPoller(): void {
  // No-op since polling is disabled
}
