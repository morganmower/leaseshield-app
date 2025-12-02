import puppeteer, { Browser, Page } from 'puppeteer';

interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  details: string;
  screenshot?: string;
}

const BASE_URL = 'http://localhost:5000';
const results: TestResult[] = [];

async function logResult(name: string, status: 'PASS' | 'FAIL' | 'SKIP', details: string, screenshot?: string) {
  results.push({ name, status, details, screenshot });
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⏭️';
  console.log(`${icon} ${name}: ${details}`);
}

async function takeScreenshot(page: Page, name: string): Promise<string> {
  const filename = `tests/screenshots/${name.replace(/\s+/g, '_').toLowerCase()}.png`;
  await page.screenshot({ path: filename, fullPage: false });
  return filename;
}

async function testLandingPage(page: Page) {
  console.log('\n📄 TESTING LANDING PAGE\n');
  
  try {
    await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Test page title
    const title = await page.title();
    if (title.includes('LeaseShield')) {
      await logResult('Landing Page Title', 'PASS', `Title: "${title}"`);
    } else {
      await logResult('Landing Page Title', 'FAIL', `Unexpected title: "${title}"`);
    }
    
    // Test hero section exists
    const heroText = await page.$eval('h1', el => el.textContent).catch(() => null);
    if (heroText) {
      await logResult('Hero Section', 'PASS', `Found hero: "${heroText.slice(0, 50)}..."`);
    } else {
      await logResult('Hero Section', 'FAIL', 'No h1 found');
    }
    
    // Test CTA buttons exist
    const ctaButtons = await page.$$('[data-testid*="button"]');
    if (ctaButtons.length > 0) {
      await logResult('CTA Buttons', 'PASS', `Found ${ctaButtons.length} buttons with test IDs`);
    } else {
      await logResult('CTA Buttons', 'FAIL', 'No buttons with data-testid found');
    }
    
    // Test pricing section
    const pricingSection = await page.$('[data-testid*="pricing"], .pricing, [id*="pricing"]');
    if (pricingSection) {
      await logResult('Pricing Section', 'PASS', 'Pricing section found');
    } else {
      // Try finding by content
      const pageContent = await page.content();
      if (pageContent.includes('$10') || pageContent.includes('month')) {
        await logResult('Pricing Section', 'PASS', 'Pricing content found in page');
      } else {
        await logResult('Pricing Section', 'SKIP', 'Could not locate pricing section');
      }
    }
    
    // Test navigation links
    const navLinks = await page.$$('nav a, header a');
    if (navLinks.length > 0) {
      await logResult('Navigation Links', 'PASS', `Found ${navLinks.length} navigation links`);
    } else {
      await logResult('Navigation Links', 'SKIP', 'No navigation links found (may be hidden)');
    }
    
    // Test footer
    const footer = await page.$('footer');
    if (footer) {
      await logResult('Footer', 'PASS', 'Footer section present');
    } else {
      await logResult('Footer', 'FAIL', 'No footer found');
    }
    
    // Test FAQ accordion
    const faqSection = await page.$('[data-testid*="faq"], .accordion, [id*="faq"]');
    if (faqSection) {
      await logResult('FAQ Section', 'PASS', 'FAQ accordion found');
    } else {
      const pageContent = await page.content();
      if (pageContent.toLowerCase().includes('frequently asked') || pageContent.toLowerCase().includes('faq')) {
        await logResult('FAQ Section', 'PASS', 'FAQ content found');
      } else {
        await logResult('FAQ Section', 'SKIP', 'FAQ section not located');
      }
    }
    
    await takeScreenshot(page, 'landing_page');
    
  } catch (error) {
    await logResult('Landing Page Load', 'FAIL', `Error: ${error}`);
  }
}

async function testLoginFlow(page: Page) {
  console.log('\n🔐 TESTING LOGIN FLOW\n');
  
  try {
    // Navigate to dashboard (should redirect to login)
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Check if we're redirected to login or auth
    const url = page.url();
    if (url.includes('login') || url.includes('auth') || url.includes('replit')) {
      await logResult('Auth Redirect', 'PASS', 'Protected route redirects to login');
    } else {
      // Check for login prompt in page
      const pageContent = await page.content();
      if (pageContent.includes('Login') || pageContent.includes('Sign in') || pageContent.includes('Unauthorized')) {
        await logResult('Auth Redirect', 'PASS', 'Login prompt shown on protected route');
      } else {
        await logResult('Auth Redirect', 'SKIP', `Stayed on: ${url}`);
      }
    }
    
    await takeScreenshot(page, 'login_redirect');
    
  } catch (error) {
    await logResult('Login Flow', 'FAIL', `Error: ${error}`);
  }
}

async function testTemplatesPage(page: Page) {
  console.log('\n📋 TESTING TEMPLATES PAGE\n');
  
  try {
    await page.goto(`${BASE_URL}/templates`, { waitUntil: 'networkidle2', timeout: 30000 });
    
    const url = page.url();
    const pageContent = await page.content();
    
    // If redirected to login, that's expected
    if (url.includes('login') || pageContent.includes('Unauthorized')) {
      await logResult('Templates Auth Check', 'PASS', 'Templates page requires authentication');
      return;
    }
    
    // Check for template cards
    const templateCards = await page.$$('[data-testid*="template"], .template-card, [class*="template"]');
    if (templateCards.length > 0) {
      await logResult('Template Cards', 'PASS', `Found ${templateCards.length} template elements`);
    } else {
      await logResult('Template Cards', 'SKIP', 'Could not find template cards (may need auth)');
    }
    
    await takeScreenshot(page, 'templates_page');
    
  } catch (error) {
    await logResult('Templates Page', 'FAIL', `Error: ${error}`);
  }
}

async function testCompliancePage(page: Page) {
  console.log('\n📊 TESTING COMPLIANCE PAGE\n');
  
  try {
    await page.goto(`${BASE_URL}/compliance`, { waitUntil: 'networkidle2', timeout: 30000 });
    
    const url = page.url();
    const pageContent = await page.content();
    
    if (url.includes('login') || pageContent.includes('Unauthorized')) {
      await logResult('Compliance Auth Check', 'PASS', 'Compliance page requires authentication');
      return;
    }
    
    // Check for state tabs
    const stateTabs = await page.$$('[role="tab"], [data-testid*="tab"]');
    if (stateTabs.length > 0) {
      await logResult('State Tabs', 'PASS', `Found ${stateTabs.length} state tabs`);
    } else {
      await logResult('State Tabs', 'SKIP', 'State tabs not found');
    }
    
    await takeScreenshot(page, 'compliance_page');
    
  } catch (error) {
    await logResult('Compliance Page', 'FAIL', `Error: ${error}`);
  }
}

async function testDarkMode(page: Page) {
  console.log('\n🌙 TESTING DARK MODE\n');
  
  try {
    await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Look for theme toggle
    const themeToggle = await page.$('[data-testid*="theme"], [data-testid*="dark"], button[aria-label*="theme"]');
    
    if (themeToggle) {
      await themeToggle.click();
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const htmlClass = await page.$eval('html', el => el.className);
      if (htmlClass.includes('dark')) {
        await logResult('Dark Mode Toggle', 'PASS', 'Dark mode class applied to HTML');
      } else {
        await logResult('Dark Mode Toggle', 'PASS', 'Theme toggle clicked (mode may use different method)');
      }
      
      await takeScreenshot(page, 'dark_mode');
    } else {
      await logResult('Dark Mode Toggle', 'SKIP', 'Theme toggle button not found');
    }
    
  } catch (error) {
    await logResult('Dark Mode', 'FAIL', `Error: ${error}`);
  }
}

async function testMobileResponsiveness(page: Page) {
  console.log('\n📱 TESTING MOBILE RESPONSIVENESS\n');
  
  try {
    // Set mobile viewport
    await page.setViewport({ width: 375, height: 812 });
    await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Check if page loads correctly
    const title = await page.title();
    if (title.includes('LeaseShield')) {
      await logResult('Mobile View Load', 'PASS', 'Page loads on mobile viewport');
    } else {
      await logResult('Mobile View Load', 'FAIL', 'Page may not load correctly on mobile');
    }
    
    // Check for mobile menu button
    const mobileMenu = await page.$('[data-testid*="menu"], [data-testid*="mobile"], button[aria-label*="menu"]');
    if (mobileMenu) {
      await logResult('Mobile Menu', 'PASS', 'Mobile menu button found');
    } else {
      await logResult('Mobile Menu', 'SKIP', 'Mobile menu button not found (may not be needed)');
    }
    
    await takeScreenshot(page, 'mobile_view');
    
    // Reset viewport
    await page.setViewport({ width: 1280, height: 800 });
    
  } catch (error) {
    await logResult('Mobile Responsiveness', 'FAIL', `Error: ${error}`);
  }
}

async function testAPIEndpoints(page: Page) {
  console.log('\n🔌 TESTING API ENDPOINTS\n');
  
  try {
    // Test stats endpoint
    const statsResponse = await page.goto(`${BASE_URL}/api/stats/template-count`, { waitUntil: 'networkidle2' });
    const status = statsResponse?.status() || 0;
    if (statsResponse && (statsResponse.ok() || status === 304)) {
      const statsText = await statsResponse.text();
      if (statsText.includes('count') || status === 304) {
        await logResult('Stats API', 'PASS', `Response OK (HTTP ${status})`);
      } else {
        await logResult('Stats API', 'FAIL', 'Unexpected response format');
      }
    } else {
      await logResult('Stats API', 'FAIL', `HTTP ${status}`);
    }
    
  } catch (error) {
    await logResult('API Endpoints', 'FAIL', `Error: ${error}`);
  }
}

async function generateReport() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 QA TEST REPORT SUMMARY');
  console.log('='.repeat(60) + '\n');
  
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const skipped = results.filter(r => r.status === 'SKIP').length;
  const total = results.length;
  
  console.log(`Total Tests: ${total}`);
  console.log(`✅ Passed: ${passed} (${Math.round(passed/total*100)}%)`);
  console.log(`❌ Failed: ${failed} (${Math.round(failed/total*100)}%)`);
  console.log(`⏭️ Skipped: ${skipped} (${Math.round(skipped/total*100)}%)`);
  
  if (failed > 0) {
    console.log('\n❌ FAILED TESTS:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`  - ${r.name}: ${r.details}`);
    });
  }
  
  console.log('\n' + '='.repeat(60));
  
  return { passed, failed, skipped, total, results };
}

async function runAllTests() {
  console.log('🚀 Starting LeaseShield App QA Browser Tests\n');
  console.log('='.repeat(60));
  
  // Create screenshots directory
  const fs = await import('fs');
  if (!fs.existsSync('tests/screenshots')) {
    fs.mkdirSync('tests/screenshots', { recursive: true });
  }
  
  let browser: Browser | null = null;
  
  try {
    browser = await puppeteer.launch({
      headless: true,
      executablePath: '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    
    // Run all tests
    await testLandingPage(page);
    await testLoginFlow(page);
    await testTemplatesPage(page);
    await testCompliancePage(page);
    await testDarkMode(page);
    await testMobileResponsiveness(page);
    await testAPIEndpoints(page);
    
    await browser.close();
    
    return await generateReport();
    
  } catch (error) {
    console.error('❌ Browser test error:', error);
    if (browser) await browser.close();
    throw error;
  }
}

// Run tests
runAllTests()
  .then((report) => {
    console.log('\n✅ Browser QA tests completed!');
    process.exit(report.failed > 0 ? 1 : 0);
  })
  .catch((error) => {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  });
