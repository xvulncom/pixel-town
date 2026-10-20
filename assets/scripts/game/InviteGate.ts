// 网页版第一次打开时输邀请码的那一层。只在网页版用，直接用 DOM 盖在 Cocos 画布上面，输完就拆掉。
// 邀请码由我生成后发给朋友（~/SERVER/像素小镇/invite.sh），同一个码换手机再输一次就接着玩。

import { serverLogin, Session } from '../core/sync';

const STYLE = `
.pt-gate{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;
  background:#2b2118;font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;padding:16px;box-sizing:border-box}
.pt-card{width:100%;max-width:340px;background:#f3e3c3;border:4px solid #6b4a2b;box-shadow:0 6px 0 #1a130d;
  padding:22px 20px;box-sizing:border-box;color:#3b2a1a;text-align:center;image-rendering:pixelated}
.pt-card h1{margin:0 0 6px;font-size:24px;letter-spacing:4px}
.pt-card p{margin:0 0 16px;font-size:14px;line-height:1.6;color:#6b4a2b}
.pt-card input{width:100%;box-sizing:border-box;font-size:20px;letter-spacing:2px;text-align:center;padding:10px 8px;
  border:3px solid #6b4a2b;background:#fffaf0;color:#3b2a1a;outline:none;text-transform:uppercase;border-radius:0}
.pt-card button{margin-top:14px;width:100%;font-size:18px;padding:10px;border:3px solid #3f5a24;background:#7aa649;
  color:#fff;box-shadow:0 4px 0 #3f5a24;cursor:pointer;border-radius:0;letter-spacing:4px}
.pt-card button:disabled{opacity:.6}
.pt-err{min-height:20px;margin-top:10px;font-size:13px;color:#b0412e}
`;

function mount(html: string): HTMLDivElement {
    if (!document.getElementById('pt-gate-style')) {
        const s = document.createElement('style');
        s.id = 'pt-gate-style';
        s.textContent = STYLE;
        document.head.appendChild(s);
    }
    const el = document.createElement('div');
    el.className = 'pt-gate';
    el.innerHTML = `<div class="pt-card">${html}</div>`;
    document.body.appendChild(el);
    return el;
}

/** 让玩家输邀请码，换到会话才返回。 */
export function askInvite(base: string, hint = ''): Promise<Session> {
    return new Promise((resolve) => {
        const el = mount(`<h1>像素小镇</h1><p>输入朋友给你的邀请码<br>换手机时再输一次就能接着玩</p>
            <form><input name="code" autocomplete="off" autocapitalize="characters" spellcheck="false"
              placeholder="XXXX-XXXX-XXXX" maxlength="20"><button type="submit">进镇</button></form>
            <div class="pt-err"></div>`);
        const form = el.querySelector('form')!;
        const input = el.querySelector('input')!;
        const btn = el.querySelector('button')!;
        const err = el.querySelector('.pt-err')!;
        err.textContent = hint;
        input.focus();
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const code = input.value.trim();
            if (!code) return;
            btn.disabled = true;
            err.textContent = '';
            const r = await serverLogin(base, code, fetch.bind(globalThis));
            btn.disabled = false;
            if ('error' in r) {
                err.textContent = r.error;
                return;
            }
            el.remove();
            resolve(r);
        });
    });
}

/** 连不上服务器又没有本机缓存时，等玩家点重试。 */
export function waitRetry(message: string): Promise<void> {
    return new Promise((resolve) => {
        const el = mount(`<h1>像素小镇</h1><p></p><button type="button">重试</button>`);
        el.querySelector('p')!.textContent = message;
        el.querySelector('button')!.addEventListener('click', () => {
            el.remove();
            resolve();
        });
    });
}
