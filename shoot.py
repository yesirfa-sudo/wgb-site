import sys
from playwright.sync_api import sync_playwright
U=sys.argv[1]; out=sys.argv[2]; tag=sys.argv[3] if len(sys.argv)>3 else "local"
with sync_playwright() as p:
    b=p.chromium.launch(executable_path="/usr/bin/google-chrome",args=["--no-sandbox"])
    for name,vp in [("desktop",(1280,900)),("tablet",(820,1100)),("phone",(390,844))]:
        ctx=b.new_context(viewport={"width":vp[0],"height":vp[1]},device_scale_factor=2 if name=="phone" else 1,has_touch=name!="desktop"); pg=ctx.new_page()
        errs=[]; pg.on("pageerror",lambda e:errs.append(str(e))); pg.on("console",lambda m:m.type=="error" and errs.append(m.text))
        pg.goto(U,wait_until="networkidle"); pg.wait_for_timeout(500)
        pg.screenshot(path=f"{out}/{tag}-{name}.png")
        if name!="tablet":
            pg.click(".store-product:nth-child(2) .product-buy"); pg.wait_for_timeout(300)
            pg.screenshot(path=f"{out}/{tag}-{name}-product.png")
            btns=pg.locator(".wgb-modal--product .wgb-modal__foot button"); btns.nth(0).click(); pg.wait_for_timeout(200)
            btns.nth(1).click(); pg.wait_for_timeout(300)
            print(name,"cart:",pg.inner_text(".wgb-cart__total"), pg.locator(".wgb-modal--cart a.btn-primary").get_attribute("href"))
            pg.screenshot(path=f"{out}/{tag}-{name}-cart.png")
        print(name,"errors:",errs)
        ctx.close()
    b.close()
