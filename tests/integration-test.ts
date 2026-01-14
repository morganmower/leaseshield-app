/**
 * LeaseShield App - Integration Tests
 * Tests core business logic and data integrity directly
 */

import { storage } from '../server/storage';

interface TestResult {
  name: string;
  status: 'PASS' | 'FAIL';
  details: string;
}

const results: TestResult[] = [];

function log(name: string, status: 'PASS' | 'FAIL', details: string) {
  results.push({ name, status, details });
  const icon = status === 'PASS' ? '✅' : '❌';
  console.log(`${icon} ${name}: ${details}`);
}

async function testTemplatesData() {
  console.log('\n📋 TEMPLATES DATA TESTS\n');
  
  const states = ['UT', 'TX', 'ND', 'SD', 'NC', 'OH', 'MI', 'ID'];
  
  for (const state of states) {
    const templates = await storage.getAllTemplates({ stateId: state });
    
    // Check template count
    if (templates.length >= 7) {
      log(`${state} Template Count`, 'PASS', `${templates.length} templates`);
    } else {
      log(`${state} Template Count`, 'FAIL', `Only ${templates.length} templates (expected 7+)`);
    }
    
    // Check for move-in/move-out checklists
    const moveIn = templates.find(t => t.templateType === 'move_in_checklist');
    const moveOut = templates.find(t => t.templateType === 'move_out_checklist');
    
    if (moveIn && moveOut) {
      log(`${state} Checklists`, 'PASS', 'Move-in and move-out checklists present');
    } else {
      log(`${state} Checklists`, 'FAIL', `Missing: ${!moveIn ? 'move-in' : ''} ${!moveOut ? 'move-out' : ''}`);
    }
    
    // Check fillable form data exists
    const hasFormData = templates.every(t => t.fillableFormData && (t.fillableFormData as any).fields?.length > 0);
    if (hasFormData) {
      log(`${state} Form Data`, 'PASS', 'All templates have fillable fields');
    } else {
      log(`${state} Form Data`, 'FAIL', 'Some templates missing fillable fields');
    }
  }
}

async function testComplianceCardsData() {
  console.log('\n📊 COMPLIANCE CARDS DATA TESTS\n');
  
  const states = ['UT', 'TX', 'ND', 'SD', 'NC', 'OH', 'MI', 'ID'];
  const expectedCategories = ['deposits', 'disclosures', 'evictions', 'fair_housing'];
  
  for (const state of states) {
    const cards = await storage.getComplianceCardsByState(state);
    
    // Check card count
    if (cards.length === 4) {
      log(`${state} Card Count`, 'PASS', '4 compliance cards');
    } else {
      log(`${state} Card Count`, 'FAIL', `${cards.length} cards (expected 4)`);
    }
    
    // Check all categories present
    const categories = cards.map(c => c.category);
    const hasAllCategories = expectedCategories.every(cat => categories.includes(cat));
    
    if (hasAllCategories) {
      log(`${state} Categories`, 'PASS', 'All 4 categories present');
    } else {
      const missing = expectedCategories.filter(cat => !categories.includes(cat));
      log(`${state} Categories`, 'FAIL', `Missing: ${missing.join(', ')}`);
    }
    
    // Check content structure
    const hasValidContent = cards.every(c => {
      const content = c.content as any;
      return content?.statutes?.length > 0 && 
             content?.requirements?.length > 0 && 
             content?.actionableSteps?.length > 0;
    });
    
    if (hasValidContent) {
      log(`${state} Content Structure`, 'PASS', 'All cards have valid content');
    } else {
      log(`${state} Content Structure`, 'FAIL', 'Some cards have incomplete content');
    }
  }
}

async function testLegalUpdatesData() {
  console.log('\n📰 LEGAL UPDATES DATA TESTS\n');
  
  const states = ['UT', 'TX', 'ND', 'SD', 'NC', 'OH', 'MI', 'ID'];
  
  for (const state of states) {
    const updates = await storage.getLegalUpdatesByState(state);
    
    if (updates.length >= 2) {
      log(`${state} Updates Count`, 'PASS', `${updates.length} legal updates`);
    } else {
      log(`${state} Updates Count`, 'FAIL', `Only ${updates.length} updates (expected 2+)`);
    }
    
    // Check update structure
    const hasValidStructure = updates.every(u => 
      u.title && u.summary && u.whyItMatters && u.beforeText && u.afterText
    );
    
    if (hasValidStructure) {
      log(`${state} Update Structure`, 'PASS', 'All updates have complete fields');
    } else {
      log(`${state} Update Structure`, 'FAIL', 'Some updates missing required fields');
    }
  }
}

async function testUserOperations() {
  console.log('\n👤 USER OPERATIONS TESTS\n');
  
  const testUserId = 'integration-test-user-' + Date.now();
  
  try {
    // Test user creation
    await storage.upsertUser({
      id: testUserId,
      email: `${testUserId}@test.com`,
      firstName: 'Test',
      lastName: 'User',
      subscriptionStatus: 'trialing',
      trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    log('Create User', 'PASS', 'User created successfully');
    
    // Test user retrieval
    const user = await storage.getUser(testUserId);
    if (user && user.email === `${testUserId}@test.com`) {
      log('Get User', 'PASS', 'User retrieved correctly');
    } else {
      log('Get User', 'FAIL', 'User not found or data mismatch');
    }
    
    // Test user update
    await storage.upsertUser({
      id: testUserId,
      preferredState: 'TX',
    });
    const updatedUser = await storage.getUser(testUserId);
    if (updatedUser?.preferredState === 'TX') {
      log('Update User', 'PASS', 'User preference updated');
    } else {
      log('Update User', 'FAIL', 'User preference not updated');
    }
    
  } catch (error) {
    log('User Operations', 'FAIL', `Error: ${error}`);
  }
}

async function testPropertyOperations() {
  console.log('\n🏠 PROPERTY OPERATIONS TESTS\n');
  
  const testUserId = 'qa-test-user-2025'; // Use our test user
  
  try {
    // Test property creation
    const property = await storage.createProperty({
      userId: testUserId,
      name: 'Integration Test Property',
      address: '456 Test Ave',
      city: 'Austin',
      state: 'TX',
      zipCode: '78701',
    });
    
    if (property && property.id) {
      log('Create Property', 'PASS', `Property ID: ${property.id}`);
      
      // Test property retrieval
      const properties = await storage.getPropertiesByUserId(testUserId);
      const found = properties.find(p => p.id === property.id);
      if (found) {
        log('Get Properties', 'PASS', `Found ${properties.length} properties`);
      } else {
        log('Get Properties', 'FAIL', 'Created property not in list');
      }
      
      // Test property update
      const updated = await storage.updateProperty(property.id, testUserId, {
        name: 'Updated Test Property',
      });
      if (updated && updated.name === 'Updated Test Property') {
        log('Update Property', 'PASS', 'Property updated successfully');
      } else {
        log('Update Property', 'FAIL', 'Property not updated');
      }
      
      // Test property deletion
      const deleted = await storage.deleteProperty(property.id, testUserId);
      if (deleted) {
        log('Delete Property', 'PASS', 'Property deleted successfully');
      } else {
        log('Delete Property', 'FAIL', 'Property not deleted');
      }
    } else {
      log('Create Property', 'FAIL', 'No property ID returned');
    }
    
  } catch (error) {
    log('Property Operations', 'FAIL', `Error: ${error}`);
  }
}

async function testNotificationOperations() {
  console.log('\n🔔 NOTIFICATION OPERATIONS TESTS\n');
  
  const testUserId = 'qa-test-user-2025';
  
  try {
    // Test notification creation
    const notification = await storage.createUserNotification({
      userId: testUserId,
      title: 'Test Notification',
      message: 'This is a test notification for QA',
      type: 'template_update',
    });
    
    if (notification && notification.id) {
      log('Create Notification', 'PASS', `Notification ID: ${notification.id}`);
      
      // Test getting notifications
      const notifications = await storage.getUserNotifications(testUserId);
      if (notifications.length > 0) {
        log('Get Notifications', 'PASS', `Found ${notifications.length} notifications`);
      } else {
        log('Get Notifications', 'FAIL', 'No notifications found');
      }
      
      // Test unread count
      const unreadCount = await storage.getUnreadNotificationCount(testUserId);
      if (typeof unreadCount === 'number') {
        log('Unread Count', 'PASS', `${unreadCount} unread notifications`);
      } else {
        log('Unread Count', 'FAIL', 'Invalid unread count');
      }
      
      // Test mark as read
      try {
        await storage.markNotificationAsRead(notification.id);
        log('Mark As Read', 'PASS', 'Notification marked as read');
      } catch (e) {
        log('Mark As Read', 'FAIL', 'Failed to mark notification');
      }
    } else {
      log('Create Notification', 'FAIL', 'No notification created');
    }
    
  } catch (error) {
    log('Notification Operations', 'FAIL', `Error: ${error}`);
  }
}

async function testSavedDocumentOperations() {
  console.log('\n📄 SAVED DOCUMENT OPERATIONS TESTS\n');
  
  const testUserId = 'qa-test-user-2025';
  
  try {
    // Get a template to use
    const templates = await storage.getAllTemplates({ stateId: 'UT' });
    if (templates.length === 0) {
      log('Saved Documents', 'FAIL', 'No templates available for testing');
      return;
    }
    
    const template = templates[0];
    
    // Test document save
    const savedDoc = await storage.createSavedDocument({
      userId: testUserId,
      templateId: template.id,
      templateName: template.title,
      documentName: 'Test Saved Document',
      formData: { testField: 'test value' },
    });
    
    if (savedDoc && savedDoc.id) {
      log('Save Document', 'PASS', `Document ID: ${savedDoc.id}`);
      
      // Test getting saved documents
      const docs = await storage.getSavedDocumentsByUserId(testUserId);
      if (docs.find(d => d.id === savedDoc.id)) {
        log('Get Saved Documents', 'PASS', `Found ${docs.length} documents`);
      } else {
        log('Get Saved Documents', 'FAIL', 'Saved document not in list');
      }
      
      // Test getting single document
      const singleDoc = await storage.getSavedDocumentById(savedDoc.id);
      if (singleDoc) {
        log('Get Single Document', 'PASS', 'Document retrieved');
      } else {
        log('Get Single Document', 'FAIL', 'Document not found');
      }
      
      // Test document deletion
      try {
        await storage.deleteSavedDocument(savedDoc.id);
        log('Delete Document', 'PASS', 'Document deleted');
      } catch (e) {
        log('Delete Document', 'FAIL', 'Document not deleted');
      }
    } else {
      log('Save Document', 'FAIL', 'No document ID returned');
    }
    
  } catch (error) {
    log('Saved Document Operations', 'FAIL', `Error: ${error}`);
  }
}

async function generateReport() {
  console.log('\n' + '='.repeat(60));
  console.log('📊 INTEGRATION TEST SUMMARY');
  console.log('='.repeat(60) + '\n');
  
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const total = results.length;
  
  console.log(`Total Tests: ${total}`);
  console.log(`✅ Passed: ${passed} (${Math.round(passed/total*100)}%)`);
  console.log(`❌ Failed: ${failed} (${Math.round(failed/total*100)}%)`);
  
  if (failed > 0) {
    console.log('\n❌ FAILED TESTS:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`  - ${r.name}: ${r.details}`);
    });
  }
  
  console.log('\n' + '='.repeat(60));
  
  return { passed, failed, total };
}

async function runAllTests() {
  console.log('🚀 Starting LeaseShield Integration Tests\n');
  console.log('='.repeat(60));
  
  try {
    await testTemplatesData();
    await testComplianceCardsData();
    await testLegalUpdatesData();
    await testUserOperations();
    await testPropertyOperations();
    await testNotificationOperations();
    await testSavedDocumentOperations();
    
    const report = await generateReport();
    process.exit(report.failed > 0 ? 1 : 0);
    
  } catch (error) {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  }
}

runAllTests();
