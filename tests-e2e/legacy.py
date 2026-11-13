# Opens the previously deployed single-table build, commits on a branch, then opens the new build on the SAME origin.
import subprocess, time, sys, shutil, os
from playwright.sync_api import sync_playwright
PORT=4190; UD='/tmp/k/legacy-profile'; shutil.rmtree(UD, ignore_errors=True)
def serve(path):
    return subprocess.Popen(['python3','-m','http.server',str(PORT),'--directory',path],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
ok=[]
def check(n,c,e=''): ok.append(c); print('PASS' if c else 'FAIL', n, e, flush=True)
with sync_playwright() as p:
    s=serve('/tmp/old-docs'); time.sleep(1)
    c=p.chromium.launch_persistent_context(UD,executable_path='/usr/bin/google-chrome',args=['--no-sandbox'],viewport={'width':1440,'height':900})
    pg=c.new_page(); pg.goto(f'http://localhost:{PORT}/'); pg.wait_for_selector('.spreadsheet')
    pg.fill('#newbranch','legacy-branch'); pg.click('text=Create'); pg.wait_for_selector('.branch-item.active:has-text("legacy-branch")')
    pg.locator('input[aria-label="item-003 quantity"]').fill('77'); pg.fill('input[aria-label="Commit message"]','Legacy commit'); pg.click('text=Commit snapshot'); pg.wait_for_selector('text=All changes committed')
    c.close(); s.terminate(); time.sleep(1)
    s=serve('/home/sandbox/sheetgeist/dist'); time.sleep(1)
    c=p.chromium.launch_persistent_context(UD,executable_path='/usr/bin/google-chrome',args=['--no-sandbox'],viewport={'width':1440,'height':900})
    pg=c.new_page(); errs=[]; pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.goto(f'http://localhost:{PORT}/'); pg.wait_for_selector('.table-bar')
    check('legacy repo opens as one table named sheet', pg.locator('.table-bar .table-chip[role=tab]').all_inner_texts()[0].startswith('sheet'))
    check('legacy branch preserved', pg.locator('.branch-item.active:has-text("legacy-branch")').count()==1)
    check('legacy edit preserved', pg.locator('input[aria-label="item-003 quantity"]').input_value()=='77')
    pg.fill('input[aria-label="Commit message"]','x'); 
    pg.locator('input[aria-label="item-003 quantity"]').fill('78'); pg.fill('input[aria-label="Commit message"]','Post-upgrade commit'); pg.click('text=Commit snapshot'); pg.wait_for_selector('text=All changes committed')
    pg.locator('input[aria-label="item-003 quantity"]').click(); pg.wait_for_selector('.cell-change')
    txt=pg.locator('.cell-history').inner_text()
    check('cell history spans legacy and new commits', 'Post-upgrade commit' in txt and 'Legacy commit' in txt, txt[:200])
    pg.click('button[aria-label=History]'); pg.wait_for_selector('.commit-card')
    pg.locator('.commit-card:has-text("Legacy commit")').click(); pg.wait_for_selector('.diff-row')
    check('legacy commit diff readable', pg.locator('.diff-row').count()>=1)
    pg.click('.branch-item:has-text("main")') if False else None
    check('no page errors', not errs, str(errs))
    c.close(); s.terminate()
print('ALL OK' if all(ok) else 'FAILURES'); sys.exit(0 if all(ok) else 1)
