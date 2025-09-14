project-root/
├── app/                        # Next.js App Router
│   ├── (auth)/                 # Route group: auth related pages
│   │   ├── login/
│   │   ├── register/
│   │   └── layout.tsx
│   ├── (dashboard)/            # Route group: main app after login
│   │   ├── page.tsx
│   │   ├── layout.tsx
│   │   └── settings/
│   ├── api/                    # Next.js API routes (if needed alongside Supabase)
│   │   └── webhook/route.ts
│   ├── globals.css             # Tailwind global styles
│   ├── layout.tsx              # Root layout
│   └── page.tsx                # Landing / home page
│
├── components/                 # Shared UI components (shadcn, custom)
│   ├── ui/                     # Shadcn components
│   ├── forms/                  # Reusable form components
│   ├── layout/                 # Navbars, footers, sidebars
│   └── common/                 # Buttons, Modals, etc.
│
├── lib/                        # Utilities & core helpers
│   ├── supabaseClient.ts       # Supabase client init
│   ├── zustand/                # Global Zustand stores
│   │   ├── authStore.ts
│   │   └── uiStore.ts
│   ├── shadcn.ts               # Shadcn config if needed
│   ├── validations.ts          # zod/yup validators
│   └── utils.ts                # Generic helpers
│
├── handlers/                   # Event handlers & business logic
│   ├── auth/                   # Auth-related handlers
│   ├── data/                   # Data manipulation handlers
│   └── api/                    # API request handlers
│
├── providers/                  # Context providers
│   ├── ThemeProvider.tsx
│   ├── ZustandProvider.tsx
│   └── SupabaseProvider.tsx
│
├── styles/                     # Styling system
│   ├── globals.css             # Tailwind entry
│   ├── animations.css
│   └── variables.css
│
├── hooks/                      # Global reusable hooks
│   ├── useMediaQuery.ts
│   ├── useToast.ts
│   └── ...
│
├── configs/                    # Configs of modules
│   ├── userTable.config.ts
│   ├── userForm.config.ts
│   └── ...
│
├── types/                      # Shared TS types
│   ├── next.d.ts
│   ├── db.ts
│   └── index.ts
│
├── tests/                      # Testing (jest/playwright)
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── .env                        # Env variables
├── tailwind.config.ts
├── tsconfig.json
└── package.json