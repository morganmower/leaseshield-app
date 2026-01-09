# Document Download - Test Cases and Stress-Test Scenarios

## Overview
This document provides test cases and stress-test scenarios for validating the document download functionality (PDF and DOCX) in LeaseShield.

---

## 1. Unit Tests for Download Helper

### 1.1 Magic Byte Validation Tests

| Test Case | Input | Expected Result |
|-----------|-------|-----------------|
| Valid DOCX buffer | Buffer starting with `PK` (0x50, 0x4B) | Passes validation |
| Valid PDF buffer | Buffer starting with `%PDF` | Passes validation |
| HTML returned as DOCX | Buffer starting with `<!DOCTYPE` | Throws error with head snippet |
| JSON error as DOCX | Buffer starting with `{"error":` | Throws error with head snippet |
| Empty buffer | Empty Buffer | Throws error |
| Truncated buffer | Buffer with only 1 byte | Throws error |

### 1.2 sendBinaryDownload Tests

| Test Case | Expected Result |
|-----------|-----------------|
| DOCX download | Content-Type is `application/vnd.openxmlformats-officedocument.wordprocessingml.document` |
| PDF download | Content-Type is `application/pdf` |
| Content-Disposition header | Includes `attachment; filename="..."` |
| Content-Length header | Matches buffer length |
| Cache-Control header | Set to `no-store` by default |

---

## 2. Integration Tests

### 2.1 Lease Agreement Downloads

| Template Type | Format | Test Steps | Expected Result |
|---------------|--------|------------|-----------------|
| Fixed-term Lease (UT) | PDF | 1. Open template wizard<br>2. Fill all fields<br>3. Download PDF | Valid PDF opens in viewer |
| Fixed-term Lease (UT) | DOCX | 1. Open template wizard<br>2. Fill all fields<br>3. Download DOCX | Valid DOCX opens in Word |
| Month-to-Month Lease (CA) | PDF | Same as above | Valid PDF opens |
| Month-to-Month Lease (CA) | DOCX | Same as above | Valid DOCX opens |

### 2.2 Static Template Downloads (Blank)

| Template Type | Format | Test Steps | Expected Result |
|---------------|--------|------------|-----------------|
| Rental Application (TX) | PDF | Click download blank | Valid PDF opens |
| Rental Application (TX) | DOCX | Click download blank | Valid DOCX opens |
| Move-In Checklist (AZ) | PDF | Click download blank | Valid PDF opens |
| Move-Out Checklist (FL) | DOCX | Click download blank | Valid DOCX opens |

---

## 3. Stress-Test Scenarios

### 3.1 Concurrent Downloads

**Scenario:** Multiple users downloading documents simultaneously

| Metric | Test Configuration |
|--------|-------------------|
| Concurrent users | 10, 25, 50 |
| Document type | Mix of PDF and DOCX |
| Expected latency | < 5 seconds per download |
| Success rate | > 99% |

**Test Script (conceptual):**
```bash
# Run 10 concurrent downloads
for i in {1..10}; do
  curl -X POST "https://app.example.com/api/documents/generate?format=docx" \
    -H "Cookie: session=..." \
    -d '{"templateId":"...", "fieldValues":{...}}' \
    -o "test_$i.docx" &
done
wait
```

### 3.2 Large Field Values

**Scenario:** User enters maximum-length text in all fields

| Field | Maximum Length | Test Value |
|-------|---------------|------------|
| Landlord Name | 100 chars | "A" x 100 |
| Property Address | 200 chars | "123 Very Long Street Name..." |
| Tenant Name | 100 chars | "B" x 100 |
| All fields combined | ~2000 chars total | Fill all with max length |

**Expected:** Document generates successfully without truncation or overflow.

### 3.3 Special Characters

**Scenario:** User enters special characters that could break HTML/XML generation

| Character Type | Test Values |
|----------------|-------------|
| HTML entities | `<script>alert('xss')</script>` |
| Quotes | `"double" and 'single' quotes` |
| Unicode | `Jose Garcia (accent characters)` |
| Ampersands | `Smith & Jones LLC` |
| Line breaks | `Line1\nLine2\nLine3` |

**Expected:** All characters escaped properly, document opens without corruption.

### 3.4 Rapid Sequential Downloads

**Scenario:** Single user downloads many documents quickly

| Metric | Target |
|--------|--------|
| Downloads per minute | 20 |
| Memory usage | Stable (no growth) |
| Success rate | 100% |

### 3.5 Network Interruption Recovery

**Scenario:** Download partially fails due to network issues

| Test Case | Expected Behavior |
|-----------|-------------------|
| Connection dropped mid-download | Client receives incomplete file, error shown |
| Server timeout | 500 error returned, client shows retry message |
| Retry after failure | Download succeeds on retry |

---

## 4. Error Handling Tests

### 4.1 Invalid Template ID

| Request | Expected Response |
|---------|-------------------|
| `templateId: "invalid-uuid"` | 404 - Template not found |
| `templateId: null` | 400 - Template ID required |
| `templateId: ""` | 400 - Template ID required |

### 4.2 Missing Field Values

| Request | Expected Response |
|---------|-------------------|
| `fieldValues: null` | 400 - Field values required |
| `fieldValues: {}` | Document generated with blank placeholders |

### 4.3 Generation Failures

| Failure Type | Expected Behavior |
|--------------|-------------------|
| Puppeteer crash (PDF) | 500 error, user sees "try again" message |
| html-to-docx failure | 500 error, user sees "try again" message |
| Magic byte validation fail | 500 error, server logs show head snippet |

---

## 5. Browser Compatibility Tests

### 5.1 PDF Downloads

| Browser | Version | Expected Result |
|---------|---------|-----------------|
| Chrome | Latest | PDF downloads, opens in viewer |
| Firefox | Latest | PDF downloads, opens in viewer |
| Safari | Latest | PDF downloads, opens in Preview |
| Edge | Latest | PDF downloads, opens in viewer |
| Mobile Safari | iOS 17+ | PDF downloads to Files app |
| Mobile Chrome | Android 13+ | PDF downloads to Downloads |

### 5.2 DOCX Downloads

| Browser | Version | Expected Result |
|---------|---------|-----------------|
| Chrome | Latest | DOCX downloads, opens in Word/Docs |
| Firefox | Latest | DOCX downloads, prompts for app |
| Safari | Latest | DOCX downloads, opens in Pages/Word |
| Edge | Latest | DOCX downloads, opens in Word Online |

---

## 6. Performance Benchmarks

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| PDF generation time | < 3 seconds | Server-side timing logs |
| DOCX generation time | < 2 seconds | Server-side timing logs |
| Download response time | < 5 seconds total | Client-side timing |
| Memory per request | < 50MB | Server process monitoring |
| CPU spike per request | < 50% | Server process monitoring |

---

## 7. Regression Test Checklist

After any changes to document generation:

- [ ] Download PDF for Fixed-term Lease Agreement (all 15 states)
- [ ] Download DOCX for Fixed-term Lease Agreement (all 15 states)
- [ ] Download PDF for Month-to-Month Lease Agreement (all 15 states)
- [ ] Download DOCX for Month-to-Month Lease Agreement (all 15 states)
- [ ] Download blank Rental Application (PDF and DOCX)
- [ ] Download Move-In Checklist (PDF and DOCX)
- [ ] Download Move-Out Checklist (PDF and DOCX)
- [ ] Verify all state-specific legal provisions are present
- [ ] Verify signature lines are present and properly formatted
- [ ] Verify no HTML/raw code visible in downloaded documents
- [ ] Test with special characters in field values
- [ ] Test with empty field values
- [ ] Verify server logs show magic byte validation passing

---

## 8. Automated Test Implementation

### Example Test (Node.js/Jest)

```typescript
import { assertLooksLikeDocx, assertLooksLikePdf } from './utils/download';

describe('Magic Byte Validation', () => {
  it('validates DOCX files correctly', () => {
    const validDocx = Buffer.from([0x50, 0x4B, 0x03, 0x04]);
    expect(() => assertLooksLikeDocx(validDocx)).not.toThrow();
  });

  it('rejects HTML as DOCX', () => {
    const html = Buffer.from('<!DOCTYPE html>');
    expect(() => assertLooksLikeDocx(html)).toThrow(/missing PK/);
  });

  it('validates PDF files correctly', () => {
    const validPdf = Buffer.from('%PDF-1.4');
    expect(() => assertLooksLikePdf(validPdf)).not.toThrow();
  });

  it('rejects JSON as PDF', () => {
    const json = Buffer.from('{"error": "not found"}');
    expect(() => assertLooksLikePdf(json)).toThrow(/missing %PDF/);
  });
});
```

---

## 9. Monitoring and Alerting

### Key Metrics to Monitor

| Metric | Alert Threshold |
|--------|-----------------|
| Download failure rate | > 1% |
| Generation time (P95) | > 10 seconds |
| Magic byte validation failures | Any occurrence |
| 500 errors on /api/documents/generate | > 5 per hour |

### Log Patterns to Watch

```
[DOCX Download] bytes=0        # Empty buffer - critical
[PDF Download] head="<!doctype # HTML returned - critical
[DOCX Download] head="{"error  # JSON error - critical
```

---

## 10. Manual QA Checklist

Before each release:

1. **Fresh Login Test**
   - [ ] Log in as new user
   - [ ] Download first template (PDF)
   - [ ] Download first template (DOCX)

2. **All States Coverage**
   - [ ] Spot-check 3-4 states for lease agreements
   - [ ] Verify state-specific provisions appear

3. **Field Value Edge Cases**
   - [ ] Enter company name with `&` symbol
   - [ ] Enter address with special characters
   - [ ] Leave optional fields empty

4. **Document Quality**
   - [ ] Check formatting in Word (Windows)
   - [ ] Check formatting in Word (Mac)
   - [ ] Check formatting in Google Docs
   - [ ] Verify PDF prints correctly
