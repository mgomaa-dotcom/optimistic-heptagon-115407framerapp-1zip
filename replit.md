# Mastery Academy imported website

## Project
This is an exported Framer website. Keep the existing HTML, CSS, JavaScript modules, and asset folders in place. The original homepage content and design should remain unchanged during environment setup.

## Run on Replit
Use the **Start application** workflow. It runs:

```sh
python3 -m http.server 5000 --bind 0.0.0.0
```

Open the Replit web preview to view the site. No package installation, database, or secrets are required for this static preview.

Do not open `index.html` through a `file://` URL: the site's JavaScript modules require HTTP. This server is for development preview, not a production hosting configuration.

## Editing
- `index.html`: exported homepage markup
- `styles.css`: exported styles
- `assets/`: JavaScript modules, images, fonts, and other exported resources

The export may retain links, embedded tools, and services hosted by Framer or other providers. Running the local site does not provide a Framer content-editing backend.

## Preview verification
The homepage rendered at desktop and mobile sizes, the proxied preview returned HTTP 200, and all directly referenced local files were present. The imported Framer runtime reports a recoverable React hydration warning, and Framer blocks its embedded editor on other domains. These export limitations were left unchanged to preserve the imported site; interactive flows have not been comprehensively tested.
