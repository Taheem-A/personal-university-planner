from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1] / 'preview'
css = (ROOT / 'styles.css').read_text(encoding='utf-8')
js = (ROOT / 'app.js').read_text(encoding='utf-8')
# about:blank used by set_content has no storage origin; neutralize storage for this renderer-only smoke test.
js = js.replace("localStorage.getItem('planner-theme') || 'light'", "'light'")
js = js.replace("localStorage.setItem('planner-theme',state.theme);", "")
js = js.replace("sessionStorage.getItem('focus-capture')==='1'", "false")
js = js.replace("sessionStorage.removeItem('focus-capture');", "")
js = js.replace("sessionStorage.setItem('focus-capture','1');", "")
HTML = f'''<!doctype html><html lang="en" data-theme="light"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>University Planner</title><style>{css}</style></head><body><div id="app"></div><div id="portal"></div><script>{js}</script></body></html>'''

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1600, "height": 1024})
    errors = []
    page.on('pageerror', lambda exc: errors.append(str(exc)))
    page.set_content(HTML, wait_until='load')
    page.wait_for_timeout(150)
    assert page.locator('h1').first.text_content() == 'Today'
    assert page.locator('.timeline-row').count() >= 8

    page.click('[data-route="week"]')
    page.wait_for_timeout(80)
    assert page.locator('h1').first.text_content() == 'Week'
    assert page.locator('.week-event').count() >= 20
    page.click('[data-action="scenario-saturday"]')
    page.wait_for_timeout(80)
    assert 'Take Saturday off' in (page.locator('.right-panel').text_content() or '')
    assert page.locator('.week-event.ghost').count() == 1
    page.click('[data-action="cancel-scenario"]')

    page.locator('[data-route="upcoming"]').first.click()
    page.wait_for_timeout(100)
    assert page.locator('h1').first.text_content() == 'Upcoming'
    page.locator('[data-action="open-assessment"]').first.click()
    page.wait_for_timeout(80)
    assert 'Assignment 2' in (page.locator('.right-panel').text_content() or '')
    page.click('[data-action="close-panel"]')

    page.locator('[data-route="inbox"]').first.click()
    page.wait_for_timeout(100)
    assert page.locator('h1').first.text_content() == 'Inbox'
    before = page.locator('.inbox-row').count()
    page.fill('#capture-input', 'CIV100 polish assignment Sunday')
    page.click('#capture-form button[type="submit"]')
    page.wait_for_timeout(80)
    after = page.locator('.inbox-row').count()
    assert after == before + 1

    page.keyboard.press('Control+k')
    page.wait_for_timeout(80)
    assert page.locator('.command-box').count() == 1
    page.keyboard.press('Escape')

    # Mobile architecture smoke check.
    page.set_viewport_size({"width": 390, "height": 844})
    page.locator('.mobile-nav [data-route="today"]').click()
    page.wait_for_timeout(100)
    assert page.locator('.mobile-nav').evaluate("e => getComputedStyle(e).display") == 'grid'
    page.click('.mobile-nav [data-route="week"]')
    page.wait_for_timeout(100)
    assert page.locator('.mobile-week').evaluate("e => getComputedStyle(e).display") != 'none'
    assert page.locator('.desktop-week').evaluate("e => getComputedStyle(e).display") == 'none'

    if errors:
        raise AssertionError('Browser errors: ' + ' | '.join(errors))
    print('UI smoke test passed')
    browser.close()
