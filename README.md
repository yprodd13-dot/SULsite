# SUL0557 website

This is your whole site: an intro page, a home page, a drum kits page and a museum page for cover arts and edits. A hidden admin panel lets you change everything from the browser.

```
index.html            ← the site (don't need to touch)
assets/               ← styles, scripts, logo, favicon
content/site.json     ← ALL your text, links, kits, gallery, colours, animations
uploads/              ← pictures/videos you add from the admin panel
studio-…/              ← the hidden admin panel (the folder with the random name)
_headers              ← small settings for Cloudflare Pages
```

The kit and gallery pictures in `uploads/` are samples marked "SAMPLE". Replace them in the admin panel.

---

## 1. Put it on GitHub (one time)

1. Go to github.com, click **New repository**, name it (for example `sul-site`), choose **Private** and create it.
2. Click **uploading an existing file**. Drag in everything **inside** this folder (`index.html`, `assets`, the `studio-…` folder, `content`, `uploads`, `_headers`, `README.md`). Then click **Commit changes**.

## 2. Host it free with Cloudflare Pages (one time)

GitHub Pages doesn't allow sites that sell things, so use Cloudflare Pages. It's free, it allows selling, and it updates on its own from your GitHub repo.

1. Make a free account at dash.cloudflare.com.
2. Go to **Workers & Pages → Create → Pages → Connect to Git**, then pick your `sul-site` repo.
3. Build settings: Framework preset **None**, build command **empty**, build output directory **`/`**. Click **Save and Deploy**.
4. Your site is live at `something.pages.dev`. To use your own domain, go to the project → **Custom domains** → add it.

From now on, every change saved to GitHub goes live in about a minute.

## 3. Open the admin panel

There are two ways in:
- **Its secret address:** `yoursite.com/` followed by the name of the `studio-…` folder and a `/`. Bookmark it.
- **From your site:** tap your logo **5 times fast** (top-left or in the footer). On a computer you can also type your secret word anywhere on the page, once you've set one. A password box pops up and takes you straight in.

**First time:** the admin panel asks you to create a password (10+ characters). Then press **🚀 Publish** once. Until you do, the logo taps on your site won't work, but you can always use the secret address.

**Connecting GitHub (once per device):**
1. On GitHub go to **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
   - **Repository access:** Only select repositories → `sul-site`
   - **Permissions → Contents:** Read and write
2. In the admin panel go to **🚀 Publish & Settings**, paste your username, repo and token, then click **Save & test connection**. The token is saved on that device, locked with your admin password.

In **Publish & Settings → Admin access & password** you can:
- change your password
- change the number of logo taps or turn them off
- set a secret word
- lock the panel with 🔒

### How safe is it?
- You can't edit anything without the password, and the panel locks again when you close the tab.
- The admin address is stored encrypted in your site's data, so it can't be found by reading the site's code.
- Publishing also needs your GitHub token, which is locked with your password on each device.
- Five wrong passwords in a row slow down further tries.
- Use a strong password you don't use anywhere else.
- For an extra login wall on top of this, you can add **Cloudflare Access** (free) to the admin folder from your Cloudflare dashboard.

### Editing
- **Drum Kits:** each kit's **GO TO link** can point to any page where you sell it (Payhip, Gumroad, Lemon Squeezy, a Stripe payment link, BeatStars, Google Drive).
- **Cover Arts & Edits:** upload pictures and videos (you can select many at once), or paste YouTube links.
- **Pages & Layout, Intro Page, Colors & Fonts, Background, Animations:** everything is editable, and the preview updates as you type.
- **Ctrl+Z** undoes changes. Nothing goes live until you press **🚀 Publish**.
- **No token on a device?** Use **Download update as .zip**, then upload the folders inside it to the repo on github.com.

## Testing on your computer
If you double-click `index.html`, the site won't load its content, because browsers block that. Run a small local server in this folder instead:
```
python3 -m http.server 8000
```
Then open http://localhost:8000 (and add your `studio-…` folder name to that address for the admin panel).
