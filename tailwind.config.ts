import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        sidebar: '#0B3547',
        'sidebar-border': '#0F6E56',
        'sidebar-active': '#0F6E56',
        'sidebar-text': '#9FE1CB',
        'sidebar-muted': '#5DCAA5',
        'sidebar-bright': '#E1F5EE',
        brand: '#1D9E75',
        'brand-light': '#E1F5EE',
        'brand-dark': '#085041',
        'brand-darker': '#0F6E56',
        page: '#F8FAFC',
      },
    },
  },
  plugins: [],
}

export default config
