# Keelworks Bridge

A modern [Next.js](https://nextjs.org) application with [Supabase](https://supabase.com) authentication and real-time capabilities. Built with TypeScript, TailwindCSS, and React 19.

## Features

- 🔐 User authentication with Supabase Auth
- 📝 Form submission handling
- 👥 Developer dashboard
- 📋 Queue management system
- 🎨 Responsive UI with TailwindCSS
- 📱 Mobile-friendly design

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18.17 or higher) - [Download](https://nodejs.org/)
- **npm** (v9 or higher) or your preferred package manager (`yarn`, `pnpm`, `bun`)
- **Git** (for version control) - [Download](https://git-scm.com/)
- A **Supabase account** - [Sign up for free](https://supabase.com)

## Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd keelworks-bridge
```

### 2. Install Dependencies

Install all required packages using npm (or your preferred package manager):

```bash
npm install
# or
yarn install
# or
pnpm install
# or
bun install
```

### 3. Environment Configuration

Create a `.env.local` file in the project root directory:

```bash
cp .env.example .env.local
```

Or manually create `.env.local` with the following variables:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

#### Getting Supabase Credentials

1. Log in to your [Supabase dashboard](https://app.supabase.com)
2. Select your project (or create a new one)
3. Go to **Settings → API**
4. Copy your **Project URL** and **anon key**
5. Paste these values into your `.env.local` file

**Note:** The `NEXT_PUBLIC_` prefix makes these variables accessible in the browser. Never commit `.env.local` to version control.

## Development

### Start the Development Server

```bash
npm run dev
```

The application will be available at [http://localhost:3000](http://localhost:3000).

The page will automatically reload as you edit files. TypeScript compilation errors will appear in your browser and terminal.

### Available Pages

- **Home** - Landing page at `/`
- **Login** - Authentication at `/login`
- **Developers** - Developer dashboard at `/developers`
- **Queue** - Queue management at `/queue`

## Building for Production

### Build the Application

```bash
npm run build
```

This creates an optimized production build in the `.next` directory.

### Start Production Server

```bash
npm start
```

## Scripts Reference

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Create optimized production build |
| `npm start` | Start production server (requires build first) |
| `npm run lint` | Run ESLint to check code quality |

## Project Structure

```
src/
├── app/                      # Next.js app directory
│   ├── api/
│   │   └── form-submission/  # Form submission API endpoint
│   ├── developers/           # Developer dashboard page
│   ├── login/                # Authentication page
│   ├── queue/                # Queue management page
│   ├── globals.css          # Global styles
│   ├── layout.tsx           # Root layout component
│   └── page.tsx             # Home page
├── components/               # Reusable React components
│   └── Navbar.tsx           # Navigation bar
├── lib/                      # Utility functions and helpers
│   └── supabaseClient.ts    # Supabase client configuration
public/                       # Static assets
```

## Dependencies

### Core
- **Next.js 16** - React framework with built-in optimization
- **React 19** - UI library
- **TypeScript** - Type-safe JavaScript

### Authentication & Database
- **@supabase/supabase-js** - Supabase JavaScript client
- **@supabase/auth-helpers-nextjs** - Next.js authentication utilities

### Styling
- **TailwindCSS 4** - Utility-first CSS framework
- **PostCSS** - CSS transformation tool

### Development
- **ESLint** - Code linting and quality checking
- **TypeScript** - Static type checking

## Troubleshooting

### Port Already in Use

If port 3000 is already in use, you can specify a different port:

```bash
npm run dev -- -p 3001
```

### Supabase Connection Issues

- Verify your `.env.local` file has the correct credentials
- Check that your Supabase project is active
- Ensure the `NEXT_PUBLIC_SUPABASE_URL` uses HTTPS
- Clear the `.next` cache: `rm -rf .next` then rebuild

### Dependency Issues

Clear the cache and reinstall dependencies:

```bash
rm -rf node_modules package-lock.json
npm install
```

## Deployment

### Deploy on Vercel (Recommended)

The easiest way to deploy is using [Vercel](https://vercel.com), made by the creators of Next.js:

1. Push your code to GitHub
2. Import your repository in [Vercel Dashboard](https://vercel.com/new)
3. Add your environment variables in **Settings → Environment Variables**
4. Vercel will automatically detect Next.js and deploy

[Read Vercel Deployment Documentation](https://nextjs.org/docs/app/building-your-application/deploying)

### Other Deployment Options

- **Netlify** - [Deploy Next.js on Netlify](https://docs.netlify.com/frameworks/next-js/)
- **AWS Amplify** - [Deploy with AWS Amplify](https://docs.amplify.aws/)
- **Docker** - Containerize your application for any platform

## Learn More

### Next.js Resources
- [Next.js Documentation](https://nextjs.org/docs) - Learn about Next.js features
- [Next.js Examples](https://github.com/vercel/next.js/tree/canary/examples) - Example projects
- [Learn Next.js](https://nextjs.org/learn) - Interactive tutorial

### Supabase Resources
- [Supabase Documentation](https://supabase.com/docs) - Database and auth setup
- [Supabase Auth Helpers](https://supabase.com/docs/guides/auth/auth-helpers/nextjs) - Next.js integration guide

### Styling
- [TailwindCSS Documentation](https://tailwindcss.com/docs) - Utility-first CSS framework guide

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is private and proprietary. All rights reserved.

## Support

For issues or questions, please open an issue in the repository or contact the development team.
