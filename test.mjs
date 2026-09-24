import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:5173/');

  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const login = btns.find(b => b.textContent.includes('Log In') || b.textContent.includes('Sign In') || b.textContent.includes('Get Started'));
    if (login) login.click();
  });
  await new Promise(r => setTimeout(r, 1000));

  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const signup = btns.find(b => b.textContent.includes('Sign Up'));
    if (signup) signup.click();
  });
  await new Promise(r => setTimeout(r, 1000));

  const selectTrigger = await page.$('#signup-institute');
  if (selectTrigger) {
    await selectTrigger.click();
    await new Promise(r => setTimeout(r, 1000));
  }

  const content = await page.$('[role="listbox"]');
  if (content) {
    const info = await content.evaluate(el => {
      const style = window.getComputedStyle(el);
      return { 
        visible: style.display !== 'none' && style.visibility !== 'hidden', 
        zIndex: style.zIndex,
        pointerEvents: style.pointerEvents,
      };
    });
    console.log('SelectContent:', info);
    
    const rect = await content.evaluate(el => {
       const r = el.getBoundingClientRect();
       return {x: r.x + r.width/2, y: r.y + r.height/2};
    });
    const topEl = await page.evaluate((x, y) => {
       const el = document.elementFromPoint(x, y);
       return el ? el.className + ' ' + el.tagName : 'null';
    }, rect.x, rect.y);
    console.log('Top element at center of listbox:', topEl);
  } else {
    console.log('SelectContent not found');
  }

  await browser.close();
})();
