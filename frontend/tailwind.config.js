export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#12202D',
        slate: '#516072',
        cloud: '#F5F7FB',
        line: '#D9E2EF',
        accent: '#0E9F9A',
        success: '#1D8F5F',
        warning: '#D97A20',
        danger: '#CC3D4A',
        sunrise: '#F67E5F',
        bloom: '#FFF2E9',
      },
      boxShadow: {
        card: '0 14px 30px rgba(18, 32, 45, 0.08)',
        panel: '0 24px 52px rgba(16, 27, 40, 0.12)',
      },
      borderRadius: {
        soft: '16px',
      },
      fontFamily: {
        sans: ['Manrope', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
