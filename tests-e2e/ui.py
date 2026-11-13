import sys, os, json, time, subprocess
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv)>1 else 'http://localhost:4173/'
OUT = sys.argv[2] if len(sys.argv)>2 else 'shots'
os.makedirs(OUT, exist_ok=True)
results=[]
def check(name, cond, extra=''):
    results.append((name, bool(cond))); print(('PASS' if cond else 'FAIL'), name, extra, flush=True)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width':1440,'height':900}, accept_downloads=True)
    pg = ctx.new_page(); errs=[]; reqs=[]
    pg.on('console', lambda m: errs.append(m.text) if m.type=='error' else None)
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('request', lambda r: reqs.append(r.url))
    pg.goto(BASE); pg.wait_for_selector('.table-bar')
    chips = pg.locator('.table-bar .table-chip[role=tab]').all_inner_texts()
    check('three table chips', len(chips)==3, str(chips))
    check('computed column rendered', pg.locator('td[data-computed=total_value_usd]').count()==20)
    first = pg.locator('td[data-computed=total_value_usd]').first.get_attribute('data-value')
    check('computed value numeric', first and float(first)>0, first)
    check('totals row for quantity', pg.locator('tr[data-summary=quantity]').count()==1)
    pg.screenshot(path=f'{OUT}/01-sheet.png')
    # edit quantity of item-001 -> computed updates
    q = pg.locator('input[aria-label="item-001 quantity"]'); old=q.input_value(); q.fill('100'); pg.wait_for_timeout(700)
    uv = float(pg.locator('input[aria-label="item-001 unit_value_usd"]').input_value())
    cv = float(pg.locator('tr:has(input[aria-label="item-001 quantity"]) td[data-computed=total_value_usd]').get_attribute('data-value'))
    check('computed recalculates on edit', abs(cv-100*uv)<0.01, f'{cv} vs {100*uv}')
    check('uncommitted status', 'Uncommitted' in pg.locator('.work-status').inner_text())
    pg.fill('input[aria-label="Commit message"]','Raise lantern stock'); pg.click('text=Commit snapshot'); pg.wait_for_selector('text=All changes committed')
    q.click(); pg.wait_for_selector('.cell-change')
    check('cell history shows commit', 'Raise lantern stock' in pg.locator('.cell-history').inner_text())
    pg.screenshot(path=f'{OUT}/02-cell-history.png')
    # query join
    pg.click('button[aria-label=Query]'); pg.click('text=Execute Query'); pg.wait_for_selector('.result-table')
    check('join query returns rows', pg.locator('.result-table tbody tr').count()>=3, str(pg.locator('.result-table tbody tr').count()))
    pg.fill('#sql-query',"SELECT name, total_value_usd FROM items ORDER BY total_value_usd DESC LIMIT 3"); pg.click('text=Execute Query'); pg.wait_for_timeout(500)
    check('computed column queryable', pg.locator('.result-table tbody tr').count()==3)
    pg.fill('#sql-query',"DELETE FROM items"); pg.click('text=Execute Query'); pg.wait_for_selector('.error-box')
    check('write rejected', True)
    pg.fill('#sql-query',"SELECT * FROM items WHERE id IN (SELECT item_id FROM loans) LIMIT 5"); pg.click('text=Execute Query'); pg.wait_for_timeout(500)
    check('loans table joinable', pg.locator('.result-table tbody tr').count()>=1)
    pg.screenshot(path=f'{OUT}/03-query.png')
    # branch, edit two tables, conflicting edit on main
    pg.click('button[aria-label=Sheet]')
    pg.fill('#newbranch','plan'); pg.click('text=Create'); pg.wait_for_selector('.branch-item.active:has-text("plan")')
    pg.locator('input[aria-label="item-002 location"]').fill('Hall C')
    pg.click('.table-chip:has-text("loans")'); pg.locator('input[aria-label="loan-001 borrower"]').fill('Plan Museum')
    pg.fill('input[aria-label="Commit message"]','Plan edits'); pg.click('text=Commit snapshot'); pg.wait_for_selector('text=All changes committed')
    pg.click('.branch-item:has-text("main")'); pg.wait_for_selector('.branch-item.active:has-text("main")')
    pg.click('.table-chip:has-text("loans")'); pg.locator('input[aria-label="loan-001 borrower"]').fill('Main Museum')
    pg.click('.table-chip:has-text("items")'); pg.locator('input[aria-label="item-005 quantity"]').fill('9')
    pg.fill('input[aria-label="Commit message"]','Main edits'); pg.click('text=Commit snapshot'); pg.wait_for_selector('text=All changes committed')
    pg.select_option('#mergebranch','plan'); pg.click('text=Preview merge'); pg.wait_for_selector('.conflict-card')
    check('conflict names its table', 'loans' in pg.locator('.conflict-card').first.inner_text())
    check('merge blocked until choice', pg.locator('.modal-footer .btn-primary').is_disabled())
    pg.screenshot(path=f'{OUT}/04-merge.png')
    pg.locator('.conflict-option').nth(1).click(); pg.click('text=Create merge commit'); pg.wait_for_selector('text=Merged as a real two-parent')
    pg.click('.table-chip:has-text("items")')
    check('independent edit from plan kept (items)', pg.locator('input[aria-label="item-002 location"]').input_value()=='Hall C')
    check('independent edit from main kept (items)', pg.locator('input[aria-label="item-005 quantity"]').input_value()=='9')
    pg.click('.table-chip:has-text("loans")')
    check('conflict choice applied', pg.locator('input[aria-label="loan-001 borrower"]').input_value()=='Plan Museum')
    # history per table
    pg.click('button[aria-label=History]'); pg.locator('.commit-card').first.click(); pg.wait_for_selector('.table-chips')
    check('merge commit flagged', pg.locator('.merge-label').count()>=1)
    pg.screenshot(path=f'{OUT}/05-history.png')
    # xlsx export and re-import
    with pg.expect_download() as d: pg.click('text=Export workbook (.xlsx)')
    path=f'{OUT}/export.xlsx'; d.value.save_as(path)
    check('xlsx downloaded', os.path.getsize(path)>3000, str(os.path.getsize(path)))
    # add a table + computed column
    pg.click('button[aria-label=Sheet]'); pg.click('button[aria-label="Add table"]')
    pg.fill('input[aria-label="New table name"]','notes'); pg.fill('input[aria-label="New table columns"]','title, body'); pg.click('text=Create table')
    check('new table created', pg.locator('.table-bar .table-chip[role=tab]').count()==4)
    pg.click('.table-chip:has-text("items")')
    pg.fill('input[aria-label="Computed column name"]','half_qty'); pg.fill('input[aria-label="Computed column expression"]','quantity / 2.0'); pg.click('text=Add computed column'); pg.wait_for_timeout(600)
    check('second computed column', pg.locator('td[data-computed=half_qty]').count()==20)
    pg.fill('input[aria-label="Computed column name"]','bad'); pg.fill('input[aria-label="Computed column expression"]','(SELECT 1)'); pg.click('text=Add computed column')
    check('subquery expression rejected', pg.locator('.table-panel .error-box').count()==1)
    # import exported xlsx (replaces workbook) 
    pg.on('dialog', lambda dlg: dlg.accept())
    pg.set_input_files('input[type=file]', path); pg.wait_for_selector('.import-report')
    rep = pg.locator('.import-report').inner_text()
    check('import report shown and Provenance skipped', 'Import report' in rep and 'Provenance' in rep and '3 sheet' in rep, rep[:200])
    pg.screenshot(path=f'{OUT}/06-import.png')
    # off-origin requests
    origin = BASE.split('/')[2]
    off=[r for r in reqs if r.startswith('http') and origin not in r]
    check('no off-origin requests', not off, str(off[:3]))
    check('no console errors', not [e for e in errs if '404' not in e], str(errs[:3]))
    # mobile
    m = b.new_context(viewport={'width':390,'height':844}, is_mobile=True); mp=m.new_page(); mp.goto(BASE); mp.wait_for_selector('.table-bar')
    mp.locator('.mobile-records details').first.click(); mp.screenshot(path=f'{OUT}/07-mobile.png')
    sw = mp.evaluate('document.documentElement.scrollWidth'); check('mobile no horizontal overflow', sw<=392, str(sw))
    b.close()
bad=[n for n,c in results if not c]
print(f'{len(results)-len(bad)}/{len(results)} passed'); sys.exit(1 if bad else 0)
