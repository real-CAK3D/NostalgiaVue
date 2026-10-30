// NostalgiaVue for Windows: the same TV as nostalgiavue.vercel.app in its own window, with one
// extra power: streaming services can show inside the set on INPUT 2 (channels 501–519), because
// the app removes the "don't show me inside other pages" headers those sites send.
// Note: services with DRM (Netflix, Disney+, Max…) still need Widevine, which stock Electron lacks.
const { app, BrowserWindow, session, shell } = require('electron');

const SITE = 'https://nostalgiavue.vercel.app/';
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

app.whenReady().then(() => {
  session.defaultSession.webRequest.onHeadersReceived((details, done) => {
    const h = { ...details.responseHeaders };
    for (const k of Object.keys(h)) {
      const key = k.toLowerCase();
      if (key === 'x-frame-options') delete h[k];
      else if (key === 'content-security-policy') h[k] = h[k].map(v => v.replace(/frame-ancestors[^;]*;?/gi, ''));
    }
    done({ responseHeaders: h });
  });

  const win = new BrowserWindow({
    width: 1400, height: 950, backgroundColor: '#000000', autoHideMenuBar: true, title: 'NostalgiaVue',
    webPreferences: { contextIsolation: true, sandbox: true },
  });
  win.loadURL(SITE);
  // links meant for a new tab open in the normal browser
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  // F11 = full screen, like a TV
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
  });
});
app.on('window-all-closed', () => app.quit());
