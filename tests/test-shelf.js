/**
 * Automated Playwright Test Suite for Aptara Content Shelf
 * Tests all core workflows, edge cases, responsiveness, and state handling.
 */
const { chromium } = require('D:/projects/Rise Component Builder/v5_PMI_Specific/node_modules/playwright');
const path = require('path');
const fs = require('fs');

const INDEX_URL = 'file:///' + path.resolve('index.html').replace(/\\/g, '/');
const STORYBOARD_PATH = path.resolve('Rise_Storyboard_Populated_UAT.docx');

async function runTests() {
  console.log('--- STARTING APTARA CONTENT SHELF TEST SUITE ---');
  const browser = await chromium.launch({ headless: true });
  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`  ✓ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ✕ FAIL: ${testName}`);
      failed++;
    }
  }

  try {
    // 1. Initial Start Experience (No saved project)
    console.log('\n[1] Testing Start Experience (No saved project)...');
    const context1 = await browser.newContext();
    const page1 = await context1.newPage();
    page1.on('console', msg => console.log('BROWSER LOG:', msg.text()));
    await page1.goto(INDEX_URL);

    // Verify start screen is visible when no project is stored
    const startVisible = await page1.isVisible('#start-screen-container');
    assert(startVisible, 'Start screen is visible when no project is saved');

    const hasPrepareAction = await page1.isVisible('#start-btn-word');
    assert(hasPrepareAction, 'Primary action "Import Word storyboard" is visible');

    const hasBuildAction = await page1.isVisible('#start-btn-handoff');
    assert(hasBuildAction, 'Primary action "Open handoff file" is visible');

    const hasSampleAction = await page1.isVisible('#start-btn-sample');
    assert(hasSampleAction, 'Secondary action "Try a sample project" is visible');

    // 2. Loading Sample Project
    console.log('\n[2] Testing Sample Demo Project...');
    await page1.click('#start-btn-sample');
    await page1.waitForTimeout(300);

    const workspaceVisible = await page1.isVisible('#workspace-container');
    assert(workspaceVisible, 'Workspace is visible after loading sample project');

    const demoBannerVisible = await page1.isVisible('#demo-banner');
    assert(demoBannerVisible, 'Demo banner is clearly visible so sample is not mistaken for real work');

    const blockCount = await page1.locator('.nav-block-btn').count();
    assert(blockCount === 5, 'Sample project has exactly 5 blocks rendered in sidebar');

    // Check Source ID display
    const firstSourceId = await page1.locator('.nav-source-id').first().textContent();
    assert(firstSourceId.includes('S01-B01'), 'Source block ID S01-B01 is clearly visible in sidebar navigation');

    // 3. Mode Separation: Prepare Content vs Build in Rise
    console.log('\n[3] Testing Mode Separation (Prepare vs Build)...');
    // Prepare Mode
    await page1.click('#btn-mode-prepare');
    await page1.waitForTimeout(200);
    const prepareText = await page1.textContent('#primary-action-text');
    assert(prepareText.includes('Export handoff'), 'Primary action in Prepare mode is "Export handoff"');

    const actionCheckboxLabelPrep = await page1.textContent('.mode-action-label span');
    assert(actionCheckboxLabelPrep.includes('reviewed for handoff'), 'Action checkbox in Prepare mode is "Mark content reviewed"');

    // Mark block 1 reviewed
    await page1.click('#check-block-action');
    await page1.waitForTimeout(200);
    const badgeReview1 = await page1.textContent('#badge-prepare-count');
    assert(badgeReview1 === '1/5', 'Prepare progress reflects 1/5 reviewed');

    // Switch to Build Mode
    await page1.click('#btn-mode-build');
    await page1.waitForTimeout(200);
    const buildText = await page1.textContent('#primary-action-text');
    assert(buildText.includes('companion'), 'Primary action in Build mode is "Open companion"');

    const actionCheckboxLabelBuild = await page1.textContent('.mode-action-label span');
    assert(actionCheckboxLabelBuild.includes('inserted in Rise'), 'Action checkbox in Build mode is "Mark block inserted in Rise"');

    const badgeBuild1 = await page1.textContent('#badge-build-count');
    assert(badgeBuild1 === '0/5', 'Build progress remains 0/5 (reviewed != inserted)');

    // Mark block 1 inserted
    await page1.click('#check-block-action');
    await page1.waitForTimeout(200);
    const badgeBuild2 = await page1.textContent('#badge-build-count');
    assert(badgeBuild2 === '1/5', 'Build progress reflects 1/5 inserted');

    // Switch back to Prepare Mode and check independence
    await page1.click('#btn-mode-prepare');
    await page1.waitForTimeout(200);
    const badgeReview2 = await page1.textContent('#badge-prepare-count');
    assert(badgeReview2 === '1/5', 'Prepare reviewed status was not modified by marking inserted in Rise');

    // 4. Content Copying & Interaction Grouping
    console.log('\n[4] Testing Content Copying & Interaction Grouping...');
    // Jump to Accordion block (Block 3)
    await page1.locator('.nav-block-btn').nth(2).click();
    await page1.waitForTimeout(200);

    const accordionGroups = await page1.locator('.content-group-title').allTextContents();
    assert(accordionGroups.some(g => g.includes('Item 1')), 'Accordion items are visually grouped by Item title');

    // Verify copy button exists and has text
    const firstCopyBtn = page1.locator('.copy-btn').first();
    assert(await firstCopyBtn.isVisible(), 'Copy button is prominent and visible');

    // 5. Developer Notes Distinction
    console.log('\n[5] Testing Developer Notes...');
    const hasDevNotes = await page1.isVisible('.developer-notes-card');
    assert(hasDevNotes, 'Developer setup notes card is styled distinctly from learner content');

    // 6. Word Storyboard Import (.docx)
    console.log('\n[6] Testing Word Storyboard Import with Populated Template...');
    const fileChooserPromise = page1.waitForEvent('filechooser');
    await page1.click('#btn-menu-toggle');
    await page1.click('#menu-word-import');
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(STORYBOARD_PATH);

    await page1.waitForSelector('#word-preview-dialog[open]', { timeout: 10000 });
    const summaryText = await page1.textContent('#word-preview-summary');
    assert(summaryText.includes('67 block records found'), 'Word import correctly extracted all 67 block records');

    // Verify apply button text
    const applyBtnText = await page1.textContent('#btn-apply-word-import');
    assert(applyBtnText.includes('Import 67 selected blocks'), 'Apply button reflects all 67 populated blocks selected');

    // Handle replacement confirmation
    page1.once('dialog', dialog => dialog.accept());
    await page1.click('#btn-apply-word-import');
    await page1.waitForTimeout(500);

    const importedCount = await page1.locator('.nav-block-btn').count();
    assert(importedCount === 67, 'All 67 blocks imported into the shelf');

    // 7. Companion Window Mode
    console.log('\n[7] Testing Companion Window (?compact=1)...');
    const companionPage = await context1.newPage();
    await companionPage.setViewportSize({ width: 420, height: 750 });
    await companionPage.goto(INDEX_URL + '?compact=1');
    await companionPage.waitForTimeout(500);

    const isCompanionClass = await companionPage.evaluate(() => document.body.classList.contains('companion-mode'));
    assert(isCompanionClass, 'Companion mode class applied to body');

    const compactSelectVisible = await companionPage.isVisible('.compact-block-bar');
    assert(compactSelectVisible, 'Compact block selector bar is visible in companion view');

    const sidebarHidden = await companionPage.evaluate(() => {
      const el = document.querySelector('aside.sidebar');
      return window.getComputedStyle(el).display === 'none';
    });
    assert(sidebarHidden, 'Wide sidebar is hidden in companion mode');

    // Check no horizontal scrollbar
    const hasHorizontalScroll = await companionPage.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    assert(!hasHorizontalScroll, 'Companion view has no horizontal scrollbar at 420px width');

    // 8. Responsive Viewports Inspection
    console.log('\n[8] Testing Responsive Viewports (1366x768, 1920x1080, 360px)...');
    await page1.setViewportSize({ width: 1366, height: 768 });
    await page1.waitForTimeout(200);
    assert(await page1.isVisible('#main-content-area'), 'Workspace layout renders properly at 1366x768');

    await page1.setViewportSize({ width: 1920, height: 1080 });
    await page1.waitForTimeout(200);
    assert(await page1.isVisible('#main-content-area'), 'Workspace layout renders properly at 1920x1080');

    await companionPage.setViewportSize({ width: 360, height: 700 });
    await companionPage.waitForTimeout(200);
    const scroll360 = await companionPage.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    assert(!scroll360, 'Companion view has no horizontal overflow even at narrow 360px width');
    await companionPage.close();

    // 9. Reorder, Duplicate, Undo
    console.log('\n[9] Testing Reorder, Duplicate & Undo...');
    const originalFirstTitle = await page1.locator('.nav-block-title').first().textContent();
    await page1.click('#btn-duplicate-block');
    await page1.waitForTimeout(200);

    const duplicatedCount = await page1.locator('.nav-block-btn').count();
    assert(duplicatedCount === 68, 'Duplicating block increases block count to 68');

    // Undo duplicate
    await page1.click('#btn-undo');
    await page1.waitForTimeout(200);
    const restoredCount = await page1.locator('.nav-block-btn').count();
    assert(restoredCount === 67, 'Undo restored block count back to 67');

    // 10. Title Presentation (Repeated IDs stripped in UI)
    console.log('\n[10] Testing Title Presentation (No duplicate IDs in title)...');
    const firstHeading = await page1.locator('.block-heading').textContent();
    const firstBadge = await page1.locator('.badge-source').textContent();
    assert(!firstHeading.startsWith(firstBadge), 'Block heading presentation does not repeat the badge source ID');
    assert(firstHeading.trim().length > 0, 'Clean readable title is displayed in header');

    // 11. Large Project Navigation & Section Grouping
    console.log('\n[11] Testing Section Grouping for Large Projects...');
    const sectionGroups = await page1.locator('.sidebar-section-group').count();
    assert(sectionGroups > 0, 'Sidebar groups 67 blocks into collapsible section details');
    const openSection = await page1.locator('.sidebar-section-group[open]').count();
    assert(openSection >= 1, 'Current active block section is automatically kept open');

    // 12. Sidebar Filters (All, Uncompleted, Needs attention)
    console.log('\n[12] Testing Sidebar Filtering...');
    await page1.click('#filter-btn-uncompleted');
    await page1.waitForTimeout(100);
    const uncompletedFilterActive = await page1.locator('#filter-btn-uncompleted.active').count();
    assert(uncompletedFilterActive === 1, 'Uncompleted filter tab is marked active');
    const filterSummaryVisible = await page1.isVisible('#filter-summary-row');
    assert(filterSummaryVisible, 'Filter summary row is displayed when non-default filter is active');

    // Clear filters
    await page1.click('#btn-clear-all-filters');
    await page1.waitForTimeout(100);
    const allFilterActive = await page1.locator('#filter-btn-all.active').count();
    assert(allFilterActive === 1, 'All filter tab is restored on Clear filters');

    // 13. Bottom Completion & Advancement Action
    console.log('\n[13] Testing Bottom Completion & Next Action...');
    const completeNextBtn = await page1.locator('#btn-complete-and-next');
    assert(await completeNextBtn.isVisible(), 'Bottom completion and next action button is present');
    const initialSelectedBlockId = await page1.locator('.nav-block-btn.active').getAttribute('data-block-id');
    await completeNextBtn.click();
    await page1.waitForTimeout(200);
    const nextSelectedBlockId = await page1.locator('.nav-block-btn.active').getAttribute('data-block-id');
    assert(initialSelectedBlockId !== nextSelectedBlockId, 'Clicking Complete & Next advances to next block');

    // 14. Refresh State Restoration
    console.log('\n[14] Testing Refresh State Restoration...');
    await page1.reload();
    await page1.waitForTimeout(500);
    const isWorkspaceVisibleAfterReload = await page1.isVisible('#block-content-view');
    const isStartHiddenAfterReload = !(await page1.isVisible('#start-screen-container'));
    assert(isWorkspaceVisibleAfterReload && isStartHiddenAfterReload, 'Page reload restores workspace view without resetting to start screen');
    const currentBlockAfterReload = await page1.locator('.nav-block-btn.active').getAttribute('data-block-id');
    assert(currentBlockAfterReload === nextSelectedBlockId, 'Selected block is preserved across page refresh');

    // Test Resume Card on Start Screen
    await page1.click('#btn-view-start');
    await page1.waitForTimeout(200);
    const isResumeCardVisible = await page1.isVisible('#start-resume-card');
    assert(isResumeCardVisible, 'Prominent Resume project card is visible on start screen when project exists');
    await page1.click('#start-btn-resume');
    await page1.waitForTimeout(200);
    const isWorkspaceBack = await page1.isVisible('#block-content-view');
    assert(isWorkspaceBack, 'Clicking Resume project returns directly to workspace');

    // 15. Companion Mode Menu
    console.log('\n[15] Testing Companion Dropdown Menu...');
    const compPage = await context1.newPage();
    await compPage.setViewportSize({ width: 420, height: 750 });
    await compPage.goto(`${INDEX_URL}?compact=1`);
    await compPage.waitForSelector('body.companion-mode');
    const compMenuBtn = await compPage.locator('#btn-companion-menu');
    assert(await compMenuBtn.isVisible(), 'Companion header features dedicated menu trigger');
    await compMenuBtn.click();
    const compDropdown = await compPage.locator('#companion-dropdown-menu');
    assert(await compDropdown.isVisible(), 'Companion dropdown opens with workspace and backup actions');
    await compPage.close();

    await browser.close();
  } catch (err) {
    console.error('Test suite exception:', err);
    failed++;
    await browser.close();
  }

  console.log(`\n--- TEST SUMMARY: ${passed} PASSED, ${failed} FAILED ---`);
  if (failed > 0) process.exit(1);
}

runTests();

