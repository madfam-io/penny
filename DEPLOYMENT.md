# Vercel Deployment Configuration

## Critical Setup Instructions

This project requires **Root Directory** configuration in Vercel to deploy correctly.

### Vercel Dashboard Configuration

1. **Import/Connect Repository**: Connect the `madfam-io/penny` repository to Vercel
2. **Set Root Directory**: In Project Settings → General → Root Directory, set to: `apps/web`
3. **Build Configuration**: Should automatically detect with the local `apps/web/vercel.json`

### Expected Result

- **Root Directory**: `apps/web` (set in Vercel Dashboard)
- **Build Command**: `npm run build` (from local vercel.json)
- **Output Directory**: `dist` (from local vercel.json)
- **Install Command**: Handled by workspace setup

### Project Structure

```
penny/                          <- Repository root
├── vercel.json                 <- Global workspace configuration
├── apps/
│   └── web/
│       ├── vercel.json        <- App-specific build configuration
│       ├── package.json       <- Build scripts
│       └── dist/              <- Build output (generated)
└── scripts/
    └── fix-workspace-vercel.js <- Dependency resolution
```

### Troubleshooting

If deployment fails with "No Output Directory found":
1. Verify Root Directory is set to `apps/web` in Vercel Dashboard
2. Check that `apps/web/vercel.json` exists and is valid
3. Ensure build command runs successfully and creates `dist/` directory

This configuration separates workspace management (root vercel.json) from application deployment (apps/web/vercel.json).