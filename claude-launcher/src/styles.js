// CSS của app, nằm trong JS và được nạp một lần ở main.jsx
export default `
:root{color-scheme:dark;--bg:#12141c;--panel:#1a1d28;--panel2:#222637;--line:#2a2e3f;--text:#e8eaf2;--mute:#8a90a6;--acc:#9aa5ff;--on-acc:#12141c;--ok:#6fd6b0;--warn:#f1c27a;--danger:#ff8a8a;--shadow:0 12px 32px #0008;--ease:cubic-bezier(.2,.8,.2,1)}
:root[data-theme=light]{color-scheme:light;--bg:#f4f5fb;--panel:#fff;--panel2:#eceefa;--line:#e0e3f0;--text:#171a26;--mute:#667089;--acc:#4f59e0;--on-acc:#fff;--ok:#16906a;--warn:#a96a12;--danger:#d03e55;--shadow:0 12px 32px #1c235222}

*{box-sizing:border-box;margin:0}
html,body,#root{height:100%}
body{background:var(--bg);color:var(--text);font:14px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;-webkit-font-smoothing:antialiased;overflow:hidden;user-select:none;-webkit-user-select:none}
input{user-select:text;-webkit-user-select:text}
button,input{font:inherit;color:inherit}
button{cursor:pointer;background:none;border:0;padding:0}
button:disabled{opacity:.45;cursor:default}
:focus-visible{outline:2px solid var(--acc);outline-offset:2px}
html.theme-anim *{transition:background-color .3s,color .3s,border-color .3s!important}

main{height:100%;display:flex;flex-direction:column;max-width:780px;margin:0 auto;padding:26px 32px 0}
header{display:flex;align-items:flex-start;gap:14px;position:relative}
.brand{display:flex;gap:14px;align-items:center;flex:1;min-width:0}
.brand svg{flex:none;filter:drop-shadow(0 6px 14px color-mix(in srgb,var(--acc) 38%,transparent))}
h1{font-size:24px;line-height:1.15;font-weight:650;letter-spacing:-.02em}
.sub{color:var(--mute);margin-top:3px}
.credit{margin-top:6px;font-size:12.5px;color:var(--mute)}
mark{background:color-mix(in srgb,var(--acc) 16%,transparent);color:var(--acc);padding:1px 7px;border-radius:6px;font-weight:650}
mark.ai{padding:0;background:linear-gradient(90deg,var(--acc),var(--ok));-webkit-background-clip:text;background-clip:text;color:transparent;font-weight:700}

.gear{width:38px;height:38px;border-radius:10px;display:grid;place-items:center;color:var(--mute);transition:color .15s,background-color .15s}
.gear:hover{color:var(--text);background:var(--panel)}
.gear[aria-expanded=true]{color:var(--acc);background:var(--panel)}
.gear svg{transition:transform .35s var(--ease)}
.gear[aria-expanded=true] svg{transform:rotate(90deg)}

.dest{display:flex;align-items:center;gap:12px;margin-top:22px;padding:6px 8px 6px 16px;border:1px solid var(--line);border-radius:12px;background:var(--panel);transition:border-color .15s,box-shadow .2s}
.dest:focus-within{border-color:var(--acc);box-shadow:0 0 0 3px color-mix(in srgb,var(--acc) 18%,transparent)}
.dest.bad{border-color:var(--danger)}
.dest span{color:var(--mute);white-space:nowrap}
.dest input{flex:1;min-width:0;background:none;border:0;outline:0;font-weight:500;font-size:15px;padding:8px 0}
.hint{color:var(--danger);font-size:12.5px;margin-top:6px;animation:fade .2s}

.bar{display:flex;gap:8px;margin:16px 0 6px}
.search{flex:1;min-width:0;background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:8px 14px;outline:0;transition:border-color .15s,box-shadow .2s}
.search:focus{border-color:var(--acc);box-shadow:0 0 0 3px color-mix(in srgb,var(--acc) 18%,transparent)}
.search::placeholder{color:var(--mute)}

.ghost{border:1px solid var(--line);border-radius:10px;padding:7px 14px;color:var(--mute);transition:color .15s,border-color .15s,background-color .15s,transform .12s}
.ghost:hover:not(:disabled){color:var(--text);border-color:var(--mute)}
.ghost.danger{color:var(--danger);border-color:color-mix(in srgb,var(--danger) 40%,transparent)}
.ghost.danger:hover:not(:disabled){color:var(--danger);background:color-mix(in srgb,var(--danger) 12%,transparent);border-color:var(--danger)}
.primary{background:var(--acc);color:var(--on-acc);border-radius:10px;padding:9px 18px;font-weight:650;transition:filter .15s,transform .12s}
.primary:hover:not(:disabled){filter:brightness(1.1)}
.ghost:active:not(:disabled),.primary:active:not(:disabled),.shut:active,.gear:active,.opt:active,.seg button:active{transform:scale(.97)}

ul{list-style:none;padding:0 12px 120px;margin:0 -12px;flex:1;overflow:auto;overscroll-behavior:contain}
ul::-webkit-scrollbar{width:8px}
ul::-webkit-scrollbar-thumb{background:var(--line);border-radius:8px}
li{display:flex;align-items:center;gap:6px;border-bottom:1px solid var(--line);animation:rise .38s var(--ease) both;animation-delay:calc(var(--i)*32ms)}
li:last-child{border-bottom:0}
li.sel .row{background:color-mix(in srgb,var(--acc) 9%,transparent)}
.row{flex:1;min-width:0;display:flex;align-items:center;gap:14px;padding:12px 10px;border-radius:10px;text-align:left;transition:background-color .15s}
.row:hover:not(:disabled){background:var(--panel)}
li.sel .row:hover:not(:disabled){background:color-mix(in srgb,var(--acc) 14%,transparent)}
.avw{position:relative;flex:none}
.av{position:relative;overflow:hidden;width:42px;height:42px;border-radius:50%;display:grid;place-items:center;font-weight:650;font-size:17px;color:#fff}
.av img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;animation:fade .3s}
.meta{flex:1;min-width:0;display:flex;flex-direction:column}
.meta b{font-weight:600;font-size:15px}
.meta small{color:var(--mute);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.go{color:var(--acc);font-weight:650;opacity:0;transform:translateX(-4px);transition:opacity .15s,transform .2s var(--ease)}
.row:hover .go,.row:focus-visible .go{opacity:1;transform:none}

.dot{position:absolute;right:-1px;bottom:-1px;width:13px;height:13px;border-radius:50%;border:2.5px solid var(--bg);background:var(--ok)}
.dot.live::after{content:"";position:absolute;inset:-3px;border-radius:50%;border:2px solid var(--ok);animation:ping 1.9s ease-out infinite}
.dot.wait{background:var(--warn);animation:blink 1s ease-in-out infinite}
.pill{font-size:12px;font-weight:600;padding:2px 9px;border-radius:99px;animation:fade .2s}
.pill.live{color:var(--ok);background:color-mix(in srgb,var(--ok) 14%,transparent)}
.pill.wait{color:var(--warn);background:color-mix(in srgb,var(--warn) 16%,transparent)}
.shut{padding:6px 12px;border-radius:9px;color:var(--danger);border:1px solid color-mix(in srgb,var(--danger) 38%,transparent);transition:background-color .15s,transform .12s;animation:fade .2s}
.shut:hover{background:color-mix(in srgb,var(--danger) 12%,transparent)}

.chk{width:20px;height:20px;border-radius:50%;flex:none;position:relative;margin-left:2px;border:1.5px solid var(--line);transition:background-color .18s,border-color .18s,transform .2s var(--ease)}
.chk:hover{border-color:var(--mute)}
.chk[aria-checked=true]{background:var(--acc);border-color:var(--acc);transform:scale(1.08)}
.chk::after{content:"";position:absolute;left:5.5px;top:2px;width:5px;height:9px;border:solid var(--on-acc);border-width:0 2px 2px 0;transform:rotate(45deg) scale(0);transition:transform .2s var(--ease)}
.chk[aria-checked=true]::after{transform:rotate(45deg) scale(1)}

.sk{height:66px;margin:6px 0;border-radius:12px;background:linear-gradient(90deg,var(--panel) 25%,var(--panel2) 50%,var(--panel) 75%);background-size:200% 100%;animation:shimmer 1.3s linear infinite}
.empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;text-align:center;padding-bottom:100px;animation:fade .3s}
.empty small{color:var(--mute);max-width:46ch;word-break:break-word}
.empty .ghost{margin-top:8px}

footer{position:fixed;inset:auto 0 0 0;display:flex;justify-content:center;padding:36px 32px 20px;background:linear-gradient(transparent,var(--bg) 45%);pointer-events:none}
footer>div{pointer-events:auto;width:100%;max-width:716px;display:flex;align-items:center;justify-content:flex-end;gap:10px;padding:10px 10px 10px 18px;border-radius:14px;background:var(--panel);border:1px solid var(--line);box-shadow:var(--shadow)}
.count{flex:1;color:var(--mute);white-space:nowrap}

.toast{position:fixed;left:50%;bottom:96px;transform:translateX(-50%);padding:9px 16px;border-radius:10px;background:var(--text);color:var(--bg);font-weight:600;max-width:80vw;z-index:9;box-shadow:var(--shadow);animation:toast .28s var(--ease)}
.toast.err{background:var(--danger);color:#fff}

.panel{position:absolute;right:0;top:46px;z-index:5;width:340px;max-width:calc(100vw - 32px);padding:16px;border-radius:14px;background:var(--panel);border:1px solid var(--line);box-shadow:var(--shadow);transform-origin:top right;outline:0;animation:pop .22s var(--ease)}
.panel h2{font-size:15px;font-weight:650;margin-bottom:12px}
.grp+.grp{margin-top:14px}
.lbl{display:block;color:var(--mute);font-size:12.5px;margin-bottom:6px}
.note{margin-top:8px;color:var(--mute);font-size:12.5px}
.seg{--n:2;--i:0;position:relative;display:grid;grid-template-columns:repeat(var(--n),1fr);padding:3px;border-radius:10px;background:var(--bg);border:1px solid var(--line)}
.seg::before{content:"";position:absolute;top:3px;bottom:3px;left:3px;width:calc((100% - 6px)/var(--n));border-radius:7px;background:var(--panel2);box-shadow:0 1px 2px #0003;transform:translateX(calc(var(--i)*100%));transition:transform .28s var(--ease)}
.seg button{position:relative;padding:6px 8px;border-radius:7px;color:var(--mute);transition:color .15s,transform .12s}
.seg button[aria-checked=true]{color:var(--text);font-weight:600}
.opts{display:grid;gap:6px}
.opt{display:flex;gap:10px;align-items:flex-start;text-align:left;padding:9px 10px;border-radius:10px;border:1px solid var(--line);transition:border-color .15s,background-color .15s,transform .12s}
.opt:hover{background:var(--panel2)}
.opt[aria-checked=true]{border-color:var(--acc);background:color-mix(in srgb,var(--acc) 9%,transparent)}
.opt b{display:block;font-weight:600}
.opt small{color:var(--mute);font-size:12.5px}
.radio{width:16px;height:16px;border-radius:50%;border:1.5px solid var(--line);flex:none;margin-top:2px;position:relative;transition:border-color .15s}
.opt[aria-checked=true] .radio{border-color:var(--acc)}
.radio::after{content:"";position:absolute;inset:3px;border-radius:50%;background:var(--acc);transform:scale(0);transition:transform .22s var(--ease)}
.opt[aria-checked=true] .radio::after{transform:scale(1)}

@keyframes fade{from{opacity:0}}
@keyframes rise{from{opacity:0;transform:translateY(8px)}}
@keyframes pop{from{opacity:0;transform:translateY(-6px) scale(.97)}}
@keyframes toast{from{opacity:0;transform:translate(-50%,10px)}}
@keyframes shimmer{to{background-position:-200% 0}}
@keyframes ping{from{opacity:.7;transform:scale(.6)}to{opacity:0;transform:scale(1.5)}}
@keyframes blink{50%{opacity:.4}}

@media (max-width:600px){main{padding:20px 16px 0}footer{padding:28px 16px 14px}.dest span,.count{display:none}.pill{display:none}}
@media (prefers-reduced-motion:reduce){*,::before,::after{animation-duration:.01ms!important;animation-delay:0ms!important;transition-duration:.01ms!important}}
`;
