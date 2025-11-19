# Legal Update Notification System

## Overview

LeaseShield App now includes a comprehensive email notification system to keep landlords informed when state laws change. This system automatically sends professional, branded emails to users based on the impact level and their preferred states.

## How It Works

### 1. **Monitoring Legal Changes** (Manual Process)

To ensure templates and compliance guidance stay current, you'll need to establish a regular monitoring workflow:

#### Recommended Services:
- **LexisNexis State Net** - Premium legislative tracking
- **Fastcase Docket Alarm** - Legal change alerts
- **State Agency RSS Feeds** - Direct from regulatory bodies
- **GovPredict** - Government affairs tracking

#### Weekly Process:
1. Review alerts from your legislative tracking service
2. Log potential changes in a tracking sheet (Google Sheets/Airtable)
3. Escalate high-impact items for attorney review
4. Draft updates for approved changes

### 2. **Creating Legal Updates**

When a law changes, create a legal update entry in the database:

```bash
# Use the admin API endpoint or database interface
POST /api/admin/legal-updates
```

**Required Fields:**
- `stateId`: State code (UT, TX, ND, SD)
- `title`: Clear, concise title of the change
- `summary`: What landlords need to know
- `whyItMatters`: How this affects their properties
- `beforeText`: What the old rule was (optional)
- `afterText`: What the new rule is (optional)
- `effectiveDate`: When the law takes effect
- `impactLevel`: `high`, `medium`, or `low`

**Impact Levels:**
- **High**: Affects all landlords statewide (sent to ALL users)
- **Medium**: Significant change (sent to users in that state)
- **Low**: Minor update (bundled into monthly digest)

### 3. **Sending Notifications**

Once a legal update is created, trigger email notifications:

```bash
POST /api/admin/notify-legal-update/{updateId}
```

**What Happens:**
- ✅ Professional HTML email sent to affected users
- ✅ In-app notification created
- ✅ Users receive impact-coded alerts (color-coded by severity)
- ✅ Email includes:
  - Summary of changes
  - Effective date
  - "Why it matters" explanation
  - Link to view updated templates
  - Legal disclaimers

### 4. **Email Design**

Emails are professionally branded with:
- LeaseShield logo and colors
- Impact badges (HIGH/MEDIUM/LOW with color coding)
- State-specific information
- Responsive mobile design
- Legal disclaimers
- Direct links to compliance dashboard

**Color Coding:**
- 🔴 **Red** - High Impact
- 🟠 **Orange** - Medium Impact
- 🔵 **Blue** - Low Impact

## Best Practices

### Quarterly Review Cycle

1. **Week 1**: Monitor new legislation across all 4 states
2. **Week 2-3**: Attorney review of flagged changes
3. **Week 4**: Draft and publish updates
4. **Monthly**: Send digest of low-impact changes

### Template Versioning

- Maintain version history in templates table
- Archive old versions for traceability
- Document all changes in legal updates
- Keep changelog in replit.md

### User Communication Strategy

**High Impact** (Immediate)
- Send within 48 hours of discovery
- Include clear action items
- Provide direct support contact

**Medium Impact** (Weekly)
- Bundle into weekly update emails
- Include context and guidance
- Link to updated resources

**Low Impact** (Monthly)
- Compile into monthly digest
- Keep users informed without overwhelming
- Focus on education

## Admin Workflow Example

### Scenario: New Security Deposit Law in Utah

1. **Discovery**: State tracking service alerts about SB 142
   
2. **Review**: Attorney confirms it affects security deposit return timelines
   
3. **Create Update**:
   ```json
   {
     "stateId": "UT",
     "title": "Utah Security Deposit Return Deadline Changed",
     "summary": "Landlords now have 45 days (up from 30 days) to return security deposits after move-out.",
     "whyItMatters": "This gives you more time to process deposit returns, but failing to return within 45 days could result in penalties.",
     "beforeText": "Security deposits must be returned within 30 days of move-out.",
     "afterText": "Security deposits must be returned within 45 days of move-out.",
     "effectiveDate": "2025-07-01",
     "impactLevel": "medium"
   }
   ```

4. **Update Templates**: Revise Utah security deposit templates

5. **Send Notification**: Trigger email to all Utah landlords

6. **Track**: Monitor email opens and in-app notification views

## Technical Details

### Email Service

- **Provider**: Resend (integrated via Replit Connector)
- **From Address**: support@leaseshieldapp.com
- **Templates**: Located in `server/email-templates.ts`
- **Rate Limits**: Configured in Resend dashboard

### Database Schema

**legalUpdates Table:**
- Stores all legal changes
- Versioned and archivable
- Linked to states

**userNotifications Table:**
- Tracks in-app notifications
- Read/unread status
- Associated with legal updates

### API Endpoints

- `POST /api/admin/legal-updates` - Create update
- `GET /api/legal-updates` - List updates
- `POST /api/admin/notify-legal-update/:id` - Send emails
- `GET /api/notifications` - User's notifications

## Monitoring & Analytics

Track notification effectiveness:
- Email open rates
- Click-through to compliance dashboard
- In-app notification acknowledgments
- User feedback/support tickets

## Future Enhancements

### Planned Features:
- [ ] Automated legislative tracking API integration
- [ ] SMS alerts for urgent high-impact changes
- [ ] Template change history viewer
- [ ] Scheduled digest emails (automatic monthly)
- [ ] Attorney review workflow automation
- [ ] Multi-state impact analysis

### Integration Opportunities:
- **GovPredict API**: Automated legislative tracking
- **Twilio**: SMS notifications for urgent alerts
- **Segment/Mixpanel**: Advanced analytics tracking
- **Intercom**: In-app messaging for support

## Support

For questions about the legal update system:
- Email: support@leaseshieldapp.com
- Documentation: `/replit.md`
- Technical: Check `server/routes.ts` and `server/email-templates.ts`

---

**Remember**: This system provides educational information, not legal advice. Always emphasize the importance of users consulting with licensed attorneys for specific situations.
