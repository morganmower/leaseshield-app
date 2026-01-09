# Utah Residential Lease - Test Cases & Stress Test Scenarios

## Test Suite Overview
These test cases cover the Utah Residential Lease template features including:
- Term Period selector (1 Year, 2 Years, Custom)
- Auto-calculate end date functionality
- Mold disclosure addendum
- Required disclosures checkboxes
- Form validation and edge cases

---

## 1. Term Period Selector Tests

### TC-1.1: Default Term Selection
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to Templates page | Templates list displays |
| 2 | Filter by Utah state | Utah templates shown |
| 3 | Click "Fill & Download" on Utah Residential Lease | Document wizard opens |
| 4 | Navigate to "Lease Terms" section | Form fields visible |
| 5 | Check "Lease Term Period" dropdown | Default value is "1 Year" |

### TC-1.2: Select 1 Year Term
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Select "1 Year" from Term Period dropdown | Selection confirmed |
| 2 | Enter Lease Start Date: 2026-02-01 | Date accepted |
| 3 | Check Lease End Date field | Auto-populated with 2027-01-31 |
| 4 | Verify End Date field is disabled | Field shows disabled state |
| 5 | Verify helper text appears | "Auto-calculated based on 1 Year term" shown |

### TC-1.3: Select 2 Years Term
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Select "2 Years" from Term Period dropdown | Selection confirmed |
| 2 | Enter Lease Start Date: 2026-03-15 | Date accepted |
| 3 | Check Lease End Date field | Auto-populated with 2028-03-14 |
| 4 | Verify End Date field is disabled | Field shows disabled state |

### TC-1.4: Select Custom Term
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Select "Custom" from Term Period dropdown | Selection confirmed |
| 2 | Enter Lease Start Date: 2026-01-01 | Date accepted |
| 3 | Check Lease End Date field | Field is ENABLED (editable) |
| 4 | Enter custom End Date: 2026-06-30 | Date accepted |
| 5 | Verify no helper text | No auto-calculate message shown |

### TC-1.5: Change Term After Start Date Set
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Enter Lease Start Date: 2026-05-01 | Date accepted |
| 2 | Select "1 Year" term | End date calculates to 2027-04-30 |
| 3 | Change to "2 Years" term | End date recalculates to 2028-04-30 |
| 4 | Change to "Custom" term | End date field becomes editable |
| 5 | Manually enter: 2026-12-31 | Custom date accepted |

---

## 2. Auto-Calculate End Date Edge Cases

### TC-2.1: Leap Year Calculation
| Test Data | Start Date | Term | Expected End Date |
|-----------|------------|------|-------------------|
| Standard year | 2026-03-01 | 1 Year | 2027-02-28 |
| Start on leap day | 2028-02-29 | 1 Year | 2029-02-28 |
| Spanning leap year | 2027-03-01 | 1 Year | 2028-02-29 |
| Two years from leap | 2028-02-29 | 2 Years | 2030-02-28 |

### TC-2.2: Month-End Boundary Cases
| Test Data | Start Date | Term | Expected End Date |
|-----------|------------|------|-------------------|
| January 31st | 2026-01-31 | 1 Year | 2027-01-30 |
| Month with 30 days | 2026-04-30 | 1 Year | 2027-04-29 |
| December 31st | 2026-12-31 | 1 Year | 2027-12-30 |
| February 28th | 2026-02-28 | 1 Year | 2027-02-27 |

### TC-2.3: Year Transition
| Test Data | Start Date | Term | Expected End Date |
|-----------|------------|------|-------------------|
| Year-end start | 2026-12-15 | 1 Year | 2027-12-14 |
| New Year start | 2027-01-01 | 1 Year | 2027-12-31 |
| 2 Year span | 2026-06-15 | 2 Years | 2028-06-14 |

---

## 3. Mold Disclosure Addendum Tests

### TC-3.1: Mold Disclosure Checkbox Required
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to "Utah Required Disclosures" section | Section visible |
| 2 | Leave mold disclosure unchecked | Checkbox empty |
| 3 | Attempt to submit form | Validation error shown |
| 4 | Check mold disclosure checkbox | Checkbox selected |
| 5 | Submit form | Proceeds successfully |

### TC-3.2: Mold Addendum Content in Generated PDF
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Complete all form fields | Form valid |
| 2 | Check mold disclosure checkbox | Checkbox selected |
| 3 | Generate PDF document | PDF downloads |
| 4 | Open PDF and find Mold Addendum section | Section present |
| 5 | Verify legal reference | Contains "Utah Code § 57-22-4" |
| 6 | Verify landlord responsibilities | Lists moisture prevention duties |
| 7 | Verify tenant responsibilities | Lists reporting requirements |
| 8 | Verify 10-day response requirement | Present per Utah Code |

### TC-3.3: Utah Fit Premises Act Reference
| Verification Item | Expected Content |
|-------------------|------------------|
| Legal Authority | Utah Fit Premises Act |
| Statute Citation | § 57-22-4 |
| Landlord Duty | Address moisture within 10 days |
| Tenant Duty | Report leaks, ventilate properly |
| Disclosure Type | Voluntary (best practice) |

---

## 4. Required Disclosures Tests

### TC-4.1: Lead Paint Disclosure (Pre-1978)
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to disclosures section | Section visible |
| 2 | Find lead paint checkbox | Optional checkbox present |
| 3 | Leave unchecked | Form still valid |
| 4 | Check the box | Selection saved |
| 5 | Generate PDF | Lead paint section included |

### TC-4.2: Radon Disclosure (Optional)
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Find radon disclosure checkbox | Optional checkbox present |
| 2 | Leave unchecked | Form still valid |
| 3 | Check the box | Selection saved |

### TC-4.3: Deposit Return Notice (Required)
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Find 30-day deposit return checkbox | Required checkbox present |
| 2 | Leave unchecked | Validation error on submit |
| 3 | Check the box | Form proceeds |
| 4 | Verify in PDF | 30-day return requirement mentioned |

---

## 5. Form Validation Stress Tests

### TC-5.1: Required Field Validation
| Field | Test Action | Expected Result |
|-------|-------------|-----------------|
| Landlord Name | Leave empty | "Required" error |
| Landlord Address | Leave empty | "Required" error |
| Landlord Phone | Leave empty | "Required" error |
| Tenant Name | Leave empty | "Required" error |
| Property Address | Leave empty | "Required" error |
| Monthly Rent | Leave empty | "Required" error |
| Security Deposit | Leave empty | "Required" error |
| Lease Start Date | Leave empty | "Required" error |
| Lease End Date | Leave empty (Custom term) | "Required" error |

### TC-5.2: Field Format Validation
| Field | Invalid Input | Expected Behavior |
|-------|---------------|-------------------|
| Landlord Phone | "abc" | Format error or correction |
| Landlord Email | "notanemail" | Email format error |
| Tenant Phone | "123" | Format warning |
| Monthly Rent | "-100" | Negative value error |
| Security Deposit | "abc" | Number required error |
| Lease Start Date | "invalid" | Date format error |

### TC-5.3: Special Characters in Text Fields
| Field | Test Input | Expected Result |
|-------|------------|-----------------|
| Landlord Name | `O'Brien & Sons, LLC` | Properly escaped in PDF |
| Property Address | `123 Main St, Apt #5` | Properly escaped |
| Tenant Name | `José García-López` | Unicode handled |
| Landlord Name | `<script>alert('xss')</script>` | Sanitized, no script execution |

---

## 6. Stress Test Scenarios

### SC-6.1: Rapid Term Changes
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Set start date: 2026-01-15 | Date set |
| 2 | Rapidly toggle: 1 Year → 2 Years → Custom → 1 Year | No errors, final state correct |
| 3 | Verify end date matches final selection | 2027-01-14 (1 Year) |

### SC-6.2: Date Field Manipulation
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Set term to "1 Year" | Selected |
| 2 | Set start date | End date calculates |
| 3 | Clear start date | End date clears or handles gracefully |
| 4 | Re-enter start date | End date recalculates |

### SC-6.3: Form Persistence (Session Recovery)
| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Fill form partially | Data entered |
| 2 | Navigate away from page | Leave page |
| 3 | Return to document wizard | Form state (expected: reset) |

### SC-6.4: Maximum Length Inputs
| Field | Test | Expected Result |
|-------|------|-----------------|
| Landlord Name | 200 characters | Handled or truncated |
| Property Address | 500 characters | Handled or truncated |
| All text fields | Max reasonable length | No overflow in PDF |

### SC-6.5: PDF Generation Under Load
| Test | Action | Expected Result |
|------|--------|-----------------|
| Single generation | Generate PDF | Completes < 10 seconds |
| Rapid regeneration | Generate 3x quickly | Each completes, no overlap issues |
| Large form data | All fields at max length | PDF generates correctly |

---

## 7. Browser Compatibility Tests

### TC-7.1: Desktop Browsers
| Browser | Term Selector | Auto-Calculate | PDF Download |
|---------|---------------|----------------|--------------|
| Chrome (latest) | Works | Works | Works |
| Firefox (latest) | Works | Works | Works |
| Safari (latest) | Works | Works | Works |
| Edge (latest) | Works | Works | Works |

### TC-7.2: Mobile Browsers
| Browser | Term Selector | Date Picker | Form Submission |
|---------|---------------|-------------|-----------------|
| iOS Safari | Works | Native picker | Works |
| Chrome Android | Works | Native picker | Works |
| Samsung Internet | Works* | Native picker | Works |

*Note: Samsung Internet may require experimental flag for certain CSS features

---

## 8. Accessibility Tests

### TC-8.1: Keyboard Navigation
| Test | Expected Result |
|------|-----------------|
| Tab through form | All fields accessible |
| Select dropdown via keyboard | Arrow keys work |
| Submit via Enter | Form submits |
| Checkbox toggle via Space | Toggles correctly |

### TC-8.2: Screen Reader Compatibility
| Element | Expected Announcement |
|---------|----------------------|
| Term Period dropdown | "Lease Term Period, combobox" |
| Required fields | "Required" indicator read |
| Error messages | Errors announced |
| Success messages | Confirmation announced |

---

## Test Execution Checklist

- [ ] All TC-1.x (Term Period) tests passed
- [ ] All TC-2.x (Edge Cases) tests passed
- [ ] All TC-3.x (Mold Disclosure) tests passed
- [ ] All TC-4.x (Required Disclosures) tests passed
- [ ] All TC-5.x (Validation) tests passed
- [ ] All SC-6.x (Stress Tests) passed
- [ ] All TC-7.x (Browser) tests passed
- [ ] All TC-8.x (Accessibility) tests passed

---

## Known Limitations

1. Form state does not persist on page navigation (expected behavior)
2. PDF generation requires server-side Puppeteer (may timeout on very slow connections)
3. Samsung Internet dark mode CSS requires experimental flag
