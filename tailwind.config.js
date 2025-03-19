import { fontFamily } from 'tailwindcss/defaultTheme';
import tailwindcssAnimate from 'tailwindcss-animate';
import forms from '@tailwindcss/forms';

/** @type {import('tailwindcss').Config} */
const config = {
  darkMode: ['class'],
  content: ['./src/**/*.{html,js,svelte,ts}'],
  safelist: ['dark'],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px'
      }
    },
    extend: {
      colors: {
        modrinth: 'hsl(var(--modrinth) / <alpha-value>)',
        border: 'hsl(var(--border) / <alpha-value>)',
        input: 'hsl(var(--input) / <alpha-value>)',
        ring: 'hsl(var(--ring) / <alpha-value>)',
        background: 'hsl(var(--background) / <alpha-value>)',
        foreground: 'hsl(var(--foreground) / <alpha-value>)',
        primary: {
          DEFAULT: 'hsl(var(--primary) / <alpha-value>)',
          foreground: 'hsl(var(--primary-foreground) / <alpha-value>)'
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary) / <alpha-value>)',
          foreground: 'hsl(var(--secondary-foreground) / <alpha-value>)'
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive) / <alpha-value>)',
          foreground: 'hsl(var(--destructive-foreground) / <alpha-value>)'
        },
        muted: {
          DEFAULT: 'hsl(var(--muted) / <alpha-value>)',
          foreground: 'hsl(var(--muted-foreground) / <alpha-value>)',
          primary: 'hsl(var(--muted-primary) / <alpha-value>)'
        },
        accent: {
          DEFAULT: 'hsl(var(--accent) / <alpha-value>)',
          foreground: 'hsl(var(--accent-foreground) / <alpha-value>)'
        },
        popover: {
          DEFAULT: 'hsl(var(--popover) / <alpha-value>)',
          foreground: 'hsl(var(--popover-foreground) / <alpha-value>)'
        },
        card: {
          DEFAULT: 'hsl(var(--card) / <alpha-value>)',
          foreground: 'hsl(var(--card-foreground) / <alpha-value>)'
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar-background))',
          foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
          ring: 'hsl(var(--sidebar-ring))'
        }
      },
      borderRadius: {
        xl: 'calc(var(--radius) + 4px)',
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)'
      },
      fontFamily: {
        sans: ['Comfortaa', 'Raleway', ...fontFamily.sans],
        raleway: ['Raleway']
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--bits-accordion-content-height)' }
        },
        'accordion-up': {
          from: { height: 'var(--bits-accordion-content-height)' },
          to: { height: '0' }
        },
        'caret-blink': {
          '0%,70%,100%': { opacity: '1' },
          '20%,50%': { opacity: '0' }
        },
        'smooth-bounce': {
          '0%, 50% 100%': { transform: 'translateY(0)' },
          '25%': { transform: 'translateY(-12.5%)' },
          '75%': { transform: 'translateY(12.5%)' }
        },
        'chameleon-bg': {
          '0%, 100%': { background: 'var(--chameleon-from)' },
          '50%': { background: 'var(--chameleon-to)' }
        },
        'chameleon-text': {
          '0%, 100%': { color: 'var(--chameleon-from)' },
          '50%': { color: 'var(--chameleon-to)' }
        },
        'chameleon-fill': {
          '0%, 100%': { fill: 'var(--chameleon-from)' },
          '50%': { fill: 'var(--chameleon-to)' }
        },
        rainbow: {
          '0%': { background: '#FF3B30' },
          '3.7%': { background: '#FF5A2A' },
          '7.4%': { background: '#FF9500' },
          '11.1%': { background: '#FFB600' },
          '14.8%': { background: '#FFCC00' },
          '18.5%': { background: '#B4D900' },
          '22.2%': { background: '#4CD964' },
          '25.9%': { background: '#2BBF99' },
          '29.6%': { background: '#32D4B2' },
          '33.3%': { background: '#00B8D4' },
          '37%': { background: '#007AFF' },
          '40.7%': { background: '#5A65D1' },
          '44.4%': { background: '#9b7de1' },
          '48.1%': { background: '#9B4DFF' },
          '51.8%': { background: '#D14CFF' },
          '55.5%': { background: '#9B4DFF' },
          '59.2%': { background: '#9b7de1' },
          '62.9%': { background: '#5A65D1' },
          '66.6%': { background: '#007AFF' },
          '70.3%': { background: '#00B8D4' },
          '74%': { background: '#32D4B2' },
          '77.7%': { background: '#2BBF99' },
          '81.4%': { background: '#4CD964' },
          '85.1%': { background: '#B4D900' },
          '88.8%': { background: '#FFCC00' },
          '92.5%': { background: '#FFB600' },
          '96.2%': { background: '#FF9500' },
          '100%': { background: '#FF5A2A' }
        },
        'rainbow-text': {
          '0%': { color: '#FF3B30' },
          '3.7%': { color: '#FF5A2A' },
          '7.4%': { color: '#FF9500' },
          '11.1%': { color: '#FFB600' },
          '14.8%': { color: '#FFCC00' },
          '18.5%': { color: '#B4D900' },
          '22.2%': { color: '#4CD964' },
          '25.9%': { color: '#2BBF99' },
          '29.6%': { color: '#32D4B2' },
          '33.3%': { color: '#00B8D4' },
          '37%': { color: '#007AFF' },
          '40.7%': { color: '#5A65D1' },
          '44.4%': { color: '#9b7de1' },
          '48.1%': { color: '#9B4DFF' },
          '51.8%': { color: '#D14CFF' },
          '55.5%': { color: '#9B4DFF' },
          '59.2%': { color: '#9b7de1' },
          '62.9%': { color: '#5A65D1' },
          '66.6%': { color: '#007AFF' },
          '70.3%': { color: '#00B8D4' },
          '74%': { color: '#32D4B2' },
          '77.7%': { color: '#2BBF99' },
          '81.4%': { color: '#4CD964' },
          '85.1%': { color: '#B4D900' },
          '88.8%': { color: '#FFCC00' },
          '92.5%': { color: '#FFB600' },
          '96.2%': { color: '#FF9500' },
          '100%': { color: '#FF5A2A' }
        }
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'caret-blink': 'caret-blink 1.25s ease-out infinite',
        'smooth-bounce': 'smooth-bounce 1s ease-in-out infinite',
        chameleon: 'chameleon-bg 6s ease-in-out infinite',
        'text-chameleon': 'chameleon-text 6s ease-in-out infinite',
        'fill-chameleon': 'chameleon-fill 6s ease-in-out infinite',
        rainbow: 'rainbow 14s linear infinite',
        'text-rainbow': 'rainbow-text 14s linear infinite'
      }
    }
  },
  plugins: [tailwindcssAnimate,forms]
};

export default config;
